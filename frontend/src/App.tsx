// v3
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

const LoginPage          = lazy(() => import('@/pages/LoginPage'))
const LandingPage        = lazy(() => import('@/pages/LandingPage'))
const DashboardPage      = lazy(() => import('@/pages/DashboardPage'))
const NewRunPage         = lazy(() => import('@/pages/NewRunPage'))
const RunPage            = lazy(() => import('@/pages/RunPage'))
const ReportPage         = lazy(() => import('@/pages/ReportPage'))
const SharedReportPage   = lazy(() => import('@/pages/SharedReportPage'))
const SettingsPage       = lazy(() => import('@/pages/SettingsPage'))
const ComparePage        = lazy(() => import('@/pages/ComparePage'))
const ApiDocsPage        = lazy(() => import('@/pages/ApiDocsPage'))
const ChecksCatalogPage  = lazy(() => import('@/pages/ChecksCatalogPage'))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

const PageSpinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
)

function AppRoutes() {
  const { session } = useAuth()
  return (
    <Suspense fallback={<PageSpinner />}>
      <Routes>
        {/* Public */}
        <Route path="/" element={session ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reports/share/:token" element={<SharedReportPage />} />

        {/* Protected */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/new"       element={<ProtectedRoute><NewRunPage /></ProtectedRoute>} />
        <Route path="/settings"  element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
        <Route path="/compare"   element={<ProtectedRoute><ComparePage /></ProtectedRoute>} />
        <Route path="/api-docs"  element={<ProtectedRoute><ApiDocsPage /></ProtectedRoute>} />
        <Route path="/checks"    element={<ProtectedRoute><ChecksCatalogPage /></ProtectedRoute>} />
        <Route path="/runs/:runId"        element={<ProtectedRoute><RunPage /></ProtectedRoute>} />
        <Route path="/runs/:runId/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
