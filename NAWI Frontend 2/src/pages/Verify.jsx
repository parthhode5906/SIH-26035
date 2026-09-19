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
import { downloadReportCopy, sha256 } from '@/lib/reportGenerator';
import logoImg from '@/assets/logo.png';
import { api, downloadReport } from '@/api/client';

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

export function Verify({ id }) {
  const reportId = id || 'NR-2026-0047';
  const [reportHash, setReportHash] = useState('7E4A…91C2');
  const [metadata, setMetadata] = useState({
    signer: 'Dr. Elias Voss',
    designation: 'Approving Officer',
    sealedAt: '2026-02-14T16:08:32.000Z',
    signatureHash: '',
  });
  const [signatureName, setSignatureName] = useState('Dr. Elias Voss');
  const [designation, setDesignation] = useState('Approving Officer');
  const [geoState, setGeoState] = useState('Not captured');
  const [verified, setVerified] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  useEffect(() => {
    const payload = JSON.stringify({
      reportId,
      instrument: 'Mettler Toledo MS6002S',
      result: 'PASS',
      standard: 'OIML R-76',
    });

    void sha256(payload).then((hash) => {
      setReportHash(hash);
      try {
        const stored = localStorage.getItem(`nawi-report-${reportId}`);
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed) {
          setMetadata(parsed);
          setSignatureName(parsed.signer);
          setDesignation(parsed.designation);
          setGeoState(parsed.geotag ? 'Captured' : 'Not captured');
          return;
        }
      } catch {
        // Use deterministic hash below
      }

      void sha256(`${reportId}|${hash}|Dr. Elias Voss|Approving Officer|2026-02-14T16:08:32.000Z`).then(
        (signatureHash) => {
          setMetadata((current) => ({ ...current, signatureHash }));
        }
      );
    });
  }, [reportId]);

  useEffect(() => { api.verify(reportId).then((data) => { setVerified(data); setReportHash(data.sha256); setMetadata((m)=>({...m, signer:data.signer||m.signer, designation:data.designation||m.designation, sealedAt:data.signed_at||m.sealedAt})); }).catch((err)=>setVerifyError(err.message)); }, [reportId]);

  const qrSeed = reportHash.replaceAll('…', 'A');
  const darkCells = new Set(
    Array.from({ length: 49 }, (_, index) => {
      const char = qrSeed[index % qrSeed.length] ?? '0';
      return (parseInt(char, 16) + index * 3) % 5 < 2 ? index : -1;
    }).filter((index) => index >= 0)
  );

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
    const signer = signatureName.trim() || 'Dr. Elias Voss';
    const next = {
      ...metadata,
      signer,
      designation: designation.trim() || 'Approving Officer',
      sealedAt: new Date().toISOString(),
    };
    try {
      const report = await api.reports();
      const target = report.find((r) => r.report_id === reportId);
      if (!target) throw new Error('Report not found on server.');
      const signed = await api.sign(target.session_id, signer, next.designation);
      setMetadata((m) => ({ ...m, signer: signed.signer, designation: signed.designation, sealedAt: signed.signed_at }));
      setReportHash(signed.sha256 || reportHash);
      return;
    } catch (err) {
      setVerifyError(err.message || 'Server signing failed.');
    }
    next.signatureHash = await sha256(`${reportId}|${reportHash}|${next.signer}|${next.designation}|${next.sealedAt}`);
    setMetadata(next);
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
              <div className="flex items-center gap-4 border-b border-[#d7e0db] bg-[#eaf4ef] px-5 py-5">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#2e7568] text-[#f4f7f3]">
                  <CheckCircle2 size={27} />
                </div>
                <div>
                  <div className="font-mono text-xl font-bold text-[#2e7568]">PASS</div>
                  <div className="mt-1 text-xs text-[#58746f]">
                    Evaluation meets applicable requirements
                  </div>
                </div>
              </div>

              <div className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 md:p-7">
                <VerifyField label="Instrument" value="Mettler Toledo MS6002S" />
                <VerifyField label="Serial number" value="B723814" mono />
                <VerifyField label="Standard" value="OIML R-76-2:2007" />
                <VerifyField label="Evaluation date" value="14 February 2026" />
                <VerifyField label="Approving officer" value={metadata.signer} />
                <VerifyField label="Facility" value="NAWI Metrology · Facility 07" />
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
              <div className="mt-5 grid aspect-square place-items-center rounded-lg border border-[#c9d9d1] bg-white">
                <div className="grid grid-cols-7 gap-1 opacity-80">
                  {Array.from({ length: 49 }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-3 w-3 ${
                        darkCells.has(index) ? 'bg-[#17333c]' : 'bg-[#edf3ee]'
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-4 break-all text-center font-mono text-[10px] text-[#66837d]">
                nawi.local/verify/{reportId}
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
              Sealed: <strong className="font-mono text-[#33545a]">{new Date(metadata.sealedAt).toLocaleString()}</strong>
            </span>
            <span className="flex items-center gap-2">
              <FileSignature size={13} />
              Signature: <strong className="font-mono text-[#33545a]">{metadata.signatureHash.slice(0, 16)}…</strong>
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
