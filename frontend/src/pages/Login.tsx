/** S1 — Login (design.md screen inventory). */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '@/api/client'
import { useAuthStore } from '@/stores/auth'

export function LoginPage() {
  const [email, setEmail] = useState('tech@lab.gov.in')
  const [password, setPassword] = useState('demo-password-2026')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const tokens = await api.login(email, password)
      login(tokens)
      navigate('/')
    } catch (err) {
      if (err instanceof ApiError) {
        // The server answered (wrong credentials, locked account, ...).
        setError(err.message)
      } else {
        setError(
          'Cannot reach the API server. Ensure the backend is running on ' +
            'port 8000 with --host :: (dual-stack), then reload this page.',
        )
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-raised p-8 shadow-sm">
        <img src="/icon.svg" alt="" className="mx-auto mb-6 h-16 w-16" />
        <h1 className="mb-1 text-center text-xl font-bold">OIML R-76 Compliance Suite</h1>
        <p className="mb-6 text-center text-sm text-inkmuted">Legal metrology test reporting</p>

        <label className="mb-4 block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            type="email"
            required
            autoComplete="username"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="mb-6 block">
          <span className="mb-1 block text-sm font-medium">Password</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded border border-slate-300 px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="mb-4 rounded bg-fail/10 px-3 py-2 text-sm text-fail" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="h-11 w-full rounded bg-accent font-semibold text-white hover:bg-accent/90 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="mt-4 text-center text-xs text-inkmuted">
          Seeded demo users: admin@ / tech@ / officer@lab.gov.in · demo-password-2026
        </p>
      </form>
    </div>
  )
}
