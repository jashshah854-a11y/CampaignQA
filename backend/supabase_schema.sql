-- ============================================================
-- Paid Media Pre-Launch QA Tool — Supabase Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id               uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email            text NOT NULL,
  full_name        text,
  company_name     text,
  plan_tier        text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'pro', 'agency')),
  reports_used     integer NOT NULL DEFAULT 0,
  reports_limit    integer NOT NULL DEFAULT 3,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Increment reports_used safely
CREATE OR REPLACE FUNCTION increment_reports_used(uid uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET reports_used = reports_used + 1, updated_at = now() WHERE id = uid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- qa_runs
CREATE TABLE IF NOT EXISTS qa_runs (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  run_name           text NOT NULL,
  platform           text NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok', 'linkedin', 'multi', 'universal')),
  input_method       text NOT NULL DEFAULT 'manual' CHECK (input_method IN ('manual', 'csv', 'api')),
  raw_input          jsonb,
  status             text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at         timestamptz,
  completed_at       timestamptz,
  error_message      text,
  total_checks       integer,
  passed_checks      integer,
  failed_checks      integer,
  warning_checks     integer,
  readiness_score    numeric(5,2),
  share_token        text UNIQUE,
  is_public          boolean NOT NULL DEFAULT false,
  industry_vertical  text,
  campaign_objective text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE qa_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can view own runs" ON qa_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users can insert own runs" ON qa_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "public can view shared reports" ON qa_runs FOR SELECT USING (is_public = true);

CREATE INDEX idx_qa_runs_user_id ON qa_runs (user_id);
CREATE INDEX idx_qa_runs_status ON qa_runs (status);
CREATE INDEX idx_qa_runs_share_token ON qa_runs (share_token) WHERE share_token IS NOT NULL;

-- check_results
CREATE TABLE IF NOT EXISTS check_results (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  check_id        text NOT NULL,
  check_category  text NOT NULL,
  platform        text NOT NULL,
  status          text NOT NULL CHECK (status IN ('passed', 'failed', 'warning', 'skipped', 'error')),
  severity        text NOT NULL CHECK (severity IN ('critical', 'major', 'minor')),
  check_name      text NOT NULL,
  message         text NOT NULL,
  recommendation  text,
  affected_items  jsonb DEFAULT '[]',
  metadata        jsonb DEFAULT '{}',
  execution_ms    integer DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE check_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can view own check results" ON check_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service role can insert check results" ON check_results FOR INSERT WITH CHECK (true);

CREATE INDEX idx_check_results_run_id ON check_results (run_id);
CREATE INDEX idx_check_results_status ON check_results (status);
CREATE INDEX idx_check_results_check_id ON check_results (check_id);

-- campaign_urls
CREATE TABLE IF NOT EXISTS campaign_urls (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  raw_url         text NOT NULL,
  parsed_url      jsonb,
  ad_name         text,
  ad_set_name     text,
  campaign_name   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaign_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users can view own urls" ON campaign_urls FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service role can insert urls" ON campaign_urls FOR INSERT WITH CHECK (true);

CREATE INDEX idx_campaign_urls_run_id ON campaign_urls (run_id);

-- audit_log (ALCOA+ immutable audit trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name     text NOT NULL,
  record_id      uuid NOT NULL,
  action         text NOT NULL,
  actor_id       uuid,
  framework_version text,
  input_hash     text,
  payload        jsonb NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Immutability trigger on audit_log
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable — no updates or deletes permitted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutability
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();

-- ============================================================
-- BENCHMARK VIEWS (Gold layer — data moat)
-- Requires at least 10 distinct tenants before exposing (Rule of 10)
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS benchmark_snapshots AS
SELECT
  cr.check_id,
  cr.check_category,
  cr.platform,
  qr.industry_vertical,
  qr.campaign_objective,
  cr.status,
  cr.severity,
  count(*) AS check_count,
  count(DISTINCT qr.user_id) AS tenant_count,
  round(
    100.0 * sum(CASE WHEN cr.status = 'passed' THEN 1 ELSE 0 END) / count(*),
    1
  ) AS pass_rate_pct,
  date_trunc('week', cr.created_at) AS week_start
FROM check_results cr
JOIN qa_runs qr ON qr.id = cr.run_id
WHERE qr.status = 'completed'
GROUP BY 1, 2, 3, 4, 5, 6, 7, date_trunc('week', cr.created_at)
HAVING count(DISTINCT qr.user_id) >= 10  -- Rule of 10
WITH DATA;

CREATE INDEX idx_benchmark_check_id ON benchmark_snapshots (check_id);
CREATE INDEX idx_benchmark_platform ON benchmark_snapshots (platform, industry_vertical);
