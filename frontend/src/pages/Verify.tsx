/** S8 — Public verification page (design.md §8): unauthenticated QR target. */
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { publicVerify, type VerifyDto } from '@/api/client'

export function VerifyPage() {
  const { reportId } = useParams<{ reportId: string }>()
  const [data, setData] = useState<VerifyDto | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!reportId) return
    publicVerify(reportId)
      .then((dto) => {
        setData(dto)
        setError(null)
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'verification failed'),
      )
  }, [reportId])

  if (error) {
    return (
      <div className="mx-auto max-w-xl p-10 text-center">
        <div className="rounded border border-red-200 bg-red-50 p-6">
          <h1 className="text-xl font-bold text-red-800">✗ Cannot verify this report</h1>
          <p className="mt-2 text-sm text-red-700">{error}</p>
          <p className="mt-3 text-xs text-red-600">
            The report ID may be wrong, or the report does not exist. Scanned from an
            official document? Contact the issuing laboratory.
          </p>
        </div>
        <Link to="/" className="mt-6 inline-block text-sm text-[var(--accent)] underline">
          Go to sign-in
        </Link>
      </div>
    )
  }

  if (!data) {
    return <p className="p-10 text-center text-sm text-slate-500">Verifying…</p>
  }

  const qrDigest = window.location.hash.replace(/^#/, '')
  const hasQrDigest = qrDigest.length > 0
  const digestMatches = hasQrDigest && qrDigest === data.content_digest
  const authentic = data.file_intact && digestMatches

  return (
    <div className="mx-auto max-w-xl p-10">
      <div
        role="status"
        className={`rounded border p-6 ${
          authentic ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
        }`}
      >
        <h1 className={`text-2xl font-bold ${authentic ? 'text-green-800' : 'text-red-800'}`}>
          {authentic
            ? '✓ Authentic report'
            : !hasQrDigest
              ? '⚠ QR digest missing'
              : '✗ Verification failed'}
        </h1>
        {!hasQrDigest && (
          <p className="mt-2 text-sm text-amber-700">
            This link does not contain the digest from the report QR code, so the report meaning cannot be verified.
          </p>
        )}
        {hasQrDigest && !digestMatches && (
          <p className="mt-2 text-sm text-red-700">
            The digest in this link does not match the report content digest.
          </p>
        )}
        {!authentic && hasQrDigest && digestMatches && (
          <p className="mt-2 text-sm text-red-700">
            The stored file no longer matches its recorded SHA-256 seal. This document
            may have been altered after generation — contact the issuing laboratory.
          </p>
        )}
        <dl className="mt-4 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Report ID</dt>
            <dd className="font-mono text-xs">{data.report_id}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Session</dt>
            <dd className="font-mono text-xs">{data.session_id.slice(0, 8)}…</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Session status</dt>
            <dd className="font-semibold">{data.session_status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Template</dt>
            <dd>{data.template_version}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Signed</dt>
            <dd className="font-semibold">
              {data.signed ? `✓ ${data.signed_by ?? 'yes'}` : 'not yet signed'}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">File SHA-256</dt>
            <dd className="font-mono text-[10px] break-all">{data.file_sha256}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Content digest (in QR)</dt>
            <dd className="font-mono text-[10px] break-all">{data.content_digest}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-600">Stored file integrity</dt>
            <dd className={authentic ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
              {authentic ? 'intact — matches seal' : 'MODIFIED AFTER GENERATION'}
            </dd>
          </div>
        </dl>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        This page needs no account — it is the public target of the QR seal printed on
        the report cover.
      </p>
      <Link to="/" className="mt-6 inline-block text-sm text-[var(--accent)] underline">
        Go to sign-in
      </Link>
    </div>
  )
}
