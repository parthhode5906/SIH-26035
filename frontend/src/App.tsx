import { useEffect } from 'react'
import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom'
import { LoginPage } from '@/pages/Login'
import { DashboardPage } from '@/pages/Dashboard'
import { NewEvaluationPage } from '@/pages/NewEvaluation'
import { SessionWorkspacePage } from '@/pages/SessionWorkspace'
import { ReportsPage } from '@/pages/Reports'
import { VerifyPage } from '@/pages/Verify'
import { ConnectivityPill } from '@/components/ConnectivityPill'
import { useAuthStore } from '@/stores/auth'
import { startConnectivityWatcher } from '@/stores/connectivity'
import { syncOutbox } from '@/lib/sync'

function RequireAuth() {
  const token = useAuthStore((s) => s.accessToken)
  const fullName = useAuthStore((s) => s.fullName)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-raised/95 px-6 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-3 font-bold">
          <img src="/icon.svg" alt="" className="h-8 w-8" />
          R-76 Compliance Suite
        </Link>
        <div className="flex items-center gap-3">
          <Link
            to="/reports"
            className="rounded px-3 py-1.5 text-sm text-inkmuted hover:bg-slate-100 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            Reports
          </Link>
          <ConnectivityPill />
          <span className="text-sm text-inkmuted">{fullName}</span>
          <button
            type="button"
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded px-3 py-1.5 text-sm text-inkmuted hover:bg-slate-100 hover:text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          >
            Sign out
          </button>
        </div>
      </header>
      <Outlet />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    const stopWatcher = startConnectivityWatcher()
    const syncInterval = setInterval(() => {
      if (navigator.onLine) void syncOutbox()
    }, 30_000)
    return () => {
      stopWatcher()
      clearInterval(syncInterval)
    }
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/evaluations/new" element={<NewEvaluationPage />} />
          <Route path="/sessions/:sessionId" element={<SessionWorkspacePage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
        <Route path="/verify/:reportId" element={<VerifyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
