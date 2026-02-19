#!/bin/sh
set -e
echo "=== CampaignQA startup ==="
echo "Python: $(python3 --version 2>&1)"
echo "Uvicorn: $(/opt/venv/bin/uvicorn --version 2>&1)"
echo "PORT: $PORT"
echo "SUPABASE_URL: $SUPABASE_URL"
echo "ENVIRONMENT: $ENVIRONMENT"
echo "=== Starting uvicorn ==="
exec /opt/venv/bin/uvicorn main:app --host 0.0.0.0 --port "$PORT"
