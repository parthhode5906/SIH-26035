/** S6 — Report archive (design.md §8/§9): searchable list, downloads. */
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { reportsApi, type ReportArchiveDto } from '@/api/client'

export function ReportsPage() {
  const [reports, setReports] = useState<ReportArchiveDto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setReports(await reportsApi.list())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load reports')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? reports.filter((r) => r.session_id.toLowerCase().includes(q) || r.sha256.toLowerCase().includes(q))
    : reports

  async function download(id: string, kind: 'pdf' | 'docx') {
    setBusyId(`${id}:${kind}`)
    try {
      if (kind === 'pdf') await reportsApi.downloadPdf(id)
      else await reportsApi.downloadDocx(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'download failed')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Report archive</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search session ID or seal hash…"
          aria-label="Search reports"
          className="w-72 rounded border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-[var(--accent)] focus:outline-none"
        />
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {filtered.length === 0 && !error && (
        <p className="text-sm text-slate-500">
          No reports yet — finalize a session to generate its R 76-2 report.
        </p>
      )}

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs tracking-wide text-slate-600 uppercase">
            <tr>
              <th className="px-3 py-2">Generated</th>
              <th className="px-3 py-2">Session</th>
              <th className="px-3 py-2">Template</th>
              <th className="px-3 py-2">Seal (SHA-256)</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Downloads</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  <Link to={`/sessions/${r.session_id}`} className="text-[var(--accent)] underline">
                    {r.session_id.slice(0, 8)}…
                  </Link>
                </td>
                <td className="px-3 py-2 text-xs">{r.template_version}</td>
                <td className="px-3 py-2 font-mono text-xs" title={r.sha256}>
                  {r.sha256.slice(0, 12)}…
                </td>
                <td className="px-3 py-2">
                  {r.signed_at ? (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-800">
                      ✓ signed
                    </span>
                  ) : (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-800">
                      awaiting sign-off
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    onClick={() => void download(r.id, 'pdf')}
                    disabled={busyId === `${r.id}:pdf`}
                    className="mr-2 rounded bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {busyId === `${r.id}:pdf` ? '…' : 'PDF'}
                  </button>
                  <button
                    onClick={() => void download(r.id, 'docx')}
                    disabled={busyId === `${r.id}:docx`}
                    className="rounded border border-slate-300 px-2.5 py-1 text-xs font-semibold hover:bg-slate-100 disabled:opacity-50"
                  >
                    {busyId === `${r.id}:docx` ? '…' : 'DOCX'}
                  </button>
                  <Link
                    to={`/verify/${r.id}`}
                    className="ml-2 text-xs text-[var(--accent)] underline"
                  >
                    verify
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
