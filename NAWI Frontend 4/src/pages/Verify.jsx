import React, { useEffect, useState } from 'react';
import { Link } from 'wouter';
import {
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileSignature,
  Fingerprint,
  Globe2,
  LockKeyhole,
  MapPin,
  Printer,
  ShieldCheck,
  Stamp,
} from 'lucide-react';
import ReportDocument from '@/components/reports/ReportDocument';
import Button from '@/components/Button';
import { sha256 } from '@/lib/reportGenerator';
import logoImg from '@/assets/logo.png';
import { api, downloadReport } from '@/api/client';
import QRCode from 'qrcode';

function VerifyField({ label, value, mono }) {
  return (
    <div>
      <div className="eyebrow">{label}</div>
      <div className={`mt-2 text-sm font-semibold text-[#33545a] ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
    </div>
  );
}

const PENDING = 'Verifying…';

export function Verify({ id }) {
  const reportId = id || 'NR-2026-0047';
  const [reportHash, setReportHash] = useState(PENDING);
  const [metadata, setMetadata] = useState({
    signer: '',
    designation: '',
    sealedAt: '',
    signatureHash: '',
  });
  const [signatureName, setSignatureName] = useState('');
  const [designation, setDesignation] = useState('');
  const [geoState, setGeoState] = useState('Not captured');
  const [verified, setVerified] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [loading, setLoading] = useState(true);

  // Local, unsealed geotag/signature drafts a technician may have started on
  // this device before an officer's real seal comes back from the server.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`nawi-report-${reportId}`);
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed?.geotag) setGeoState('Captured');
    } catch {
      // no local draft — fine, the server response below is authoritative anyway
    }
  }, [reportId]);

  useEffect(() => {
    setLoading(true);
    api
      .verify(reportId)
      .then((data) => {
        setVerified(data);
        setReportHash(data.sha256 || 'Not available');
        setMetadata((m) => ({
          ...m,
          signer: data.signer || '',
          designation: data.designation || '',
          sealedAt: data.signed_at || '',
          signatureHash: data.signature_hash || m.signatureHash,
        }));
        setSignatureName(data.signer || '');
        setDesignation(data.designation || '');
      })
      .catch((err) => {
        setVerifyError(err.message);
        setReportHash('Not available');
      })
      .finally(() => setLoading(false));
  }, [reportId]);

  // A real, scannable QR code encoding this report's public verification
  // URL — previously this was a decorative grid derived from the hash.
  const verifyUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/verify/${reportId}`
      : `https://nawi.local/verify/${reportId}`;
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, color: { dark: '#17333c', light: '#ffffff' } })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  const captureGeotag = () => {
    if (!navigator.geolocation) {
      setGeoState('Unavailable in this browser');
      return;
    }
    setGeoState('Requesting location…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          ...metadata,
          geotag: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyM: position.coords.accuracy,
          },
        };
        setMetadata(next);
        setGeoState('Captured');
        localStorage.setItem(`nawi-report-${reportId}`, JSON.stringify(next));
      },
      () => setGeoState('Permission denied'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const signReport = async () => {
    // The signer's identity and timestamp are taken from the authenticated
    // officer/admin session on the backend — nothing is posted here beyond
    // the session id. The name/designation fields below are a local display
    // convenience only and are overwritten by whatever the server returns.
    try {
      const report = await api.reports();
      const target = report.find((r) => r.report_id === reportId);
      if (!target) throw new Error('Report not found on server.');
      const signed = await api.sign(target.session_id);
      const next = {
        ...metadata,
        signer: signed.signed_by || signatureName.trim() || 'Approving officer',
        designation: designation.trim(),
        sealedAt: signed.signed_at || new Date().toISOString(),
      };
      setMetadata(next);
      setReportHash(signed.sha256 || reportHash);
      localStorage.setItem(`nawi-report-${reportId}`, JSON.stringify(next));
      return;
    } catch (err) {
      setVerifyError(err.message || 'Server signing failed — sign-off requires an officer/admin account and a synced report.');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#edf3ee] text-[#17333c]">
      <header className="screen-only border-b border-[#cfddd5] bg-[#f4f7f3]/90 px-5 py-5 md:px-12">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-3" data-testid="link-verify-logo">
            <div className="grid h-9 w-9 place-items-center rounded-[9px] border border-[#c69852] bg-[#17333c] overflow-hidden">
              <img src={logoImg} alt="NAWI Logo" className="h-full w-full object-cover" onError={(e) => {
                e.currentTarget.style.display = 'none';
              }} />
              <span className="font-mono text-sm font-bold text-[#c69852]">N</span>
            </div>
            <div>
              <div className="wordmark">NAWI</div>
              <div className="mt-1 text-[9px] uppercase tracking-[.16em] text-[#66837d]">
                Public verification
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 text-xs text-[#66837d]">
            <ShieldCheck size={15} className="text-[#2e7568]" />
            Independent record check
          </div>
        </div>
      </header>

      {verifyError && <div className="screen-only mx-auto max-w-6xl px-5 pt-5 md:px-12 text-xs text-[#a6423b]">{verifyError}</div>}
      <main className="mx-auto max-w-6xl px-5 py-10 md:px-12 md:py-14">
        <div className="screen-only grid gap-8 lg:grid-cols-[1fr_280px]">
          <section>
            <div className="eyebrow">Verified instrument report</div>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h1 className="page-title">Report {reportId}</h1>
              <span className={`stamp inline-flex w-fit items-center gap-2 rounded px-3 py-2 font-mono text-[10px] font-bold ${verified?.reverify_bytes === false ? '!border-[#b24b43] !text-[#b24b43]' : ''}`}><Check size={13} />{verifyError ? 'UNAVAILABLE' : verified?.reverify_bytes === false ? 'TAMPERED' : 'AUTHENTIC'}</span>
            </div>

            <div className="panel mt-8 overflow-hidden">
              {(() => {
                const result = verified?.result || verified?.verdict || verified?.overall_verdict;
                const isPass = result === 'PASS';
                const isFail = result === 'FAIL';
                return (
                  <div
                    className={`flex items-center gap-4 border-b border-[#d7e0db] px-5 py-5 ${
                      isPass ? 'bg-[#eaf4ef]' : isFail ? 'bg-[#fdeceb]' : 'bg-[#f4f7f3]'
                    }`}
                  >
                    <div
                      className={`grid h-12 w-12 place-items-center rounded-full text-[#f4f7f3] ${
                        isPass ? 'bg-[#2e7568]' : isFail ? 'bg-[#b24b43]' : 'bg-[#7b9690]'
                      }`}
                    >
                      <CheckCircle2 size={27} />
                    </div>
                    <div>
                      <div
                        className={`font-mono text-xl font-bold ${
                          isPass ? 'text-[#2e7568]' : isFail ? 'text-[#b24b43]' : 'text-[#58746f]'
                        }`}
                      >
                        {loading ? PENDING : result || 'Not reported'}
                      </div>
                      <div className="mt-1 text-xs text-[#58746f]">
                        {loading
                          ? 'Contacting the verification service…'
                          : verifyError
                          ? verifyError
                          : isPass
                          ? 'Evaluation meets applicable requirements'
                          : isFail
                          ? 'Evaluation did not meet applicable requirements'
                          : 'Result not reported by the server'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 md:p-7">
                <VerifyField
                  label="Instrument"
                  value={loading ? PENDING : verified?.instrument?.model || verified?.instrument?.asset || verified?.instrument || 'Not available'}
                />
                <VerifyField
                  label="Serial number"
                  value={loading ? PENDING : verified?.instrument?.serial_number || verified?.instrument?.serial || verified?.serial || 'Not available'}
                  mono
                />
                <VerifyField label="Standard" value={verified?.standard || 'OIML R 76-2:2007'} />
                <VerifyField
                  label="Evaluation date"
                  value={
                    loading
                      ? PENDING
                      : verified?.evaluated_at
                      ? new Date(verified.evaluated_at).toLocaleDateString()
                      : 'Not available'
                  }
                />
                <VerifyField label="Approving officer" value={metadata.signer || 'Not yet signed'} />
                <VerifyField label="Facility" value={verified?.facility || 'Not reported'} />
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button
                size="sm"
                onClick={() => window.print()}
                data-testid="button-print-report"
              >
                <Printer size={15} />
                Print report
              </Button>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => void downloadReport(reportId).catch((err) => setVerifyError(err.message))}
                data-testid="button-download-report"
              >
                <Download size={15} />
                Download copy
              </Button>
            </div>
          </section>

          <aside className="space-y-5">
            <div className="panel p-5">
              <div className="eyebrow">Verification key</div>
              <div className="mt-5 grid aspect-square place-items-center rounded-lg border border-[#c9d9d1] bg-white p-4">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR code linking to the verification page for report ${reportId}`}
                    className="h-full w-full object-contain"
                    data-testid="image-verify-qr"
                  />
                ) : (
                  <div className="text-[10px] text-[#9ab0a9]">Generating QR code…</div>
                )}
              </div>
              <div className="mt-4 break-all text-center font-mono text-[10px] text-[#66837d]">
                {verifyUrl.replace(/^https?:\/\//, '')}
              </div>
            </div>

            <div className="panel p-5 text-xs leading-5 text-[#66837d]">
              <LockKeyhole size={15} className="mb-3 text-[#2e7568]" />
              <p>
                This verification view confirms the report identifier, instrument identity, result, officer signature, seal timestamp, and record hash.
              </p>
              <p className="mt-3">
                Record hash <span className="break-all font-mono text-[#33545a]">{reportHash}</span>
              </p>
            </div>
          </aside>
        </div>

        <section className="screen-only panel mt-8 p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="eyebrow">Seal controls / 38 Authorization</div>
              <h2 className="mt-2 text-xl font-semibold">Complete the controlled report record.</h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-[#66837d]">
                A signature hash binds the approving officer, seal time, report hash, and any captured geotag. Location capture is optional and requires browser permission.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dceee8] px-3 py-1.5 text-[#2e7568]">
                <Fingerprint size={13} />
                Signature hash recorded
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 ${
                  metadata.geotag ? 'bg-[#dceee8] text-[#2e7568]' : 'bg-[#fbf4e4] text-[#92713a]'
                }`}
              >
                <MapPin size={13} />
                {geoState}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label>
              <span className="eyebrow">Approving officer</span>
              <input
                value={signatureName}
                onChange={(event) => setSignatureName(event.target.value)}
                className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-[#fbfdfb] px-3 py-2.5 text-sm outline-none focus:border-[#c69852]"
                data-testid="input-signature-name"
              />
            </label>
            <label>
              <span className="eyebrow">Designation</span>
              <input
                value={designation}
                onChange={(event) => setDesignation(event.target.value)}
                className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-[#fbfdfb] px-3 py-2.5 text-sm outline-none focus:border-[#c69852]"
                data-testid="input-signature-designation"
              />
            </label>
            <div className="flex gap-2 self-end">
              <Button
                variant="quiet"
                size="sm"
                onClick={captureGeotag}
                data-testid="button-capture-geotag"
              >
                <MapPin size={14} />
                Capture geotag
              </Button>
              <Button
                size="sm"
                onClick={() => void signReport()}
                data-testid="button-seal-report"
              >
                <Stamp size={14} />
                Seal report
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 border-t border-[#d7e0db] pt-4 text-[10px] text-[#66837d] sm:grid-cols-3">
            <span className="flex items-center gap-2">
              <Clock3 size={13} />
              Sealed: <strong className="font-mono text-[#33545a]">{metadata.sealedAt ? new Date(metadata.sealedAt).toLocaleString() : 'Not yet sealed'}</strong>
            </span>
            <span className="flex items-center gap-2">
              <FileSignature size={13} />
              Signature: <strong className="font-mono text-[#33545a]">{metadata.signatureHash ? `${metadata.signatureHash.slice(0, 16)}…` : 'Not yet signed'}</strong>
            </span>
            <span className="flex items-center gap-2">
              <Globe2 size={13} />
              Geotag: <strong className="font-mono text-[#33545a]">{metadata.geotag ? `${metadata.geotag.latitude.toFixed(4)}, ${metadata.geotag.longitude.toFixed(4)}` : 'not captured'}</strong>
            </span>
          </div>
        </section>

        <ReportDocument reportId={reportId} reportHash={reportHash} metadata={metadata} />
      </main>
    </div>
  );
}

export default Verify;
