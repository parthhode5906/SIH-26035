/**
 * EvidenceCapture (P6-2) — camera/photo evidence attached to the session.
 *
 * Uses getUserMedia when available; falls back to `<input type=file
 * capture>` which opens the OS camera app on tablets/phones (design.md
 * §1.2 — tablets on carts). Uploads via the existing P2-7 attachment
 * endpoint (type/size-restricted, stored outside web root).
 *
 * OCR scope decision (P6-2): automated 7-segment display OCR is DEFERRED.
 * Rationale: tesseract.js is ~4 MB of WASM with poor 7-segment accuracy
 * outside tightly-controlled lighting — a wrong auto-read indication in a
 * legal-metrology workflow is worse than no automation (§7 rule 2 spirit:
 * reject with reasons, never silently clamp). The camera's value here is
 * tamper-evident evidence; the trusted reading path is the scale link
 * (P6-1) or keyed entry. Revisit only with a lab-validated model.
 */
import { useEffect, useRef, useState } from 'react'
import { uploadAttachment } from '@/api/client'

export function EvidenceCapture({ sessionId }: { sessionId: string }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [cameraOn, setCameraOn] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  async function upload(file: File) {
    setBusy(true)
    setErr(null)
    setMsg(null)
    try {
      const res = await uploadAttachment(sessionId, file)
      setMsg(`Evidence stored (${res.filename}) — visible in the report attachments index.`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'upload failed')
    } finally {
      setBusy(false)
    }
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setCameraOn(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setErr('Camera unavailable — use Choose file instead (opens the camera app on tablets).')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraOn(false)
  }

  async function snap() {
    const video = videoRef.current
    if (!video || !streamRef.current || video.videoWidth === 0 || video.videoHeight === 0) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        stopCamera()
        if (blob) void upload(new File([blob], `evidence-${Date.now()}.jpg`, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-raised p-4">
      <p className="mb-3 text-xs font-semibold text-inkmuted uppercase tracking-wide">Evidence capture (P6-2)</p>
      <video ref={videoRef} className={cameraOn ? 'mb-3 max-h-48 rounded' : 'hidden'} muted playsInline />
      <div className="flex flex-wrap items-center gap-3">
        {!cameraOn ? (
          <>
            <button type="button" onClick={() => void startCamera()} className="h-9 rounded bg-accent px-4 text-sm font-semibold text-white hover:bg-accent/90">
              Open camera
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="h-9 rounded border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100"
            >
              Choose file
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={() => void snap()} className="h-9 rounded bg-pass px-4 text-sm font-semibold text-white hover:bg-pass/90">
              Capture photo
            </button>
            <button type="button" onClick={stopCamera} className="h-9 rounded border border-slate-300 px-4 text-sm hover:bg-slate-100">
              Cancel
            </button>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void upload(f)
            e.target.value = ''
          }}
        />
      </div>
      {busy && <p className="mt-2 text-xs text-inkmuted">Uploading…</p>}
      {msg && <p className="mt-2 text-xs text-pass" role="status">{msg}</p>}
      {err && <p className="mt-2 text-xs text-fail" role="alert">{err}</p>}
    </div>
  )
}
