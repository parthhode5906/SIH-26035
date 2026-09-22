import React from 'react';
import ReportMeta from '@/components/reports/ReportMeta';
import ReportSection from '@/components/reports/ReportSection';
import ReportGrid from '@/components/reports/ReportGrid';
import ReportTable from '@/components/reports/ReportTable';
import ReportNote from '@/components/reports/ReportNote';
import { reportTests } from '@/lib/reportGenerator';

export function ReportDocument({ reportId, reportHash, metadata = {} }) {
  const sealedDate = metadata.sealedAt ? new Date(metadata.sealedAt) : new Date();
  const geotagText = metadata.geotag
    ? `${metadata.geotag.latitude.toFixed(6)}, ${metadata.geotag.longitude.toFixed(6)} ±${Math.round(metadata.geotag.accuracyM)} m`
    : 'Not captured';

  return (
    <section className="report-print-surface mt-10">
      <div className="report-page relative overflow-hidden rounded-lg border border-[#b9cbc2] bg-white p-5 shadow-[0_18px_60px_rgba(23,51,60,.08)] md:p-10">
        <div className="report-watermark" aria-hidden="true">
          NAWI · CONTROLLED COPY
        </div>

        <div className="relative">
          <div className="report-masthead text-center">
            <div className="eyebrow">
              Government of India · Ministry of Consumer Affairs, Food & Public Distribution
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[.16em] text-[#66837d]">
              Department of Consumer Affairs · Legal Metrology Directorate
            </div>
            <div className="mt-6 text-[10px] uppercase tracking-[.2em] text-[#2e7568]">
              Type Evaluation Report
            </div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">
              Non-Automatic Weighing Instruments (NAWI)
            </h2>
            <div className="mt-2 font-mono text-xs text-[#66837d]">
              OIML R 76-2:2007
            </div>

            <div className="mt-5 grid gap-2 text-left text-[10px] sm:grid-cols-4">
              <ReportMeta label="Report page" value="1 / 12" />
              <ReportMeta label="Application no." value={reportId} />
              <ReportMeta label="Type designation" value="MS6002S" />
              <ReportMeta label="Date" value="14 February 2026" />
            </div>
          </div>

          <ReportSection number="1" title="GENERAL INFORMATION">
            <ReportGrid
              rows={[
                ['Type designation', 'Mettler Toledo MS6002S', 'Instrument category', 'Non-automatic weighing instrument'],
                ['Manufacturer', 'Mettler Toledo', 'Applicant', 'NAWI Metrology'],
                ["Manufacturer's address", '—', "Applicant's address", 'Facility 07'],
                ['Type examination body', 'NAWI Compliance Suite', 'Place of tests', 'Facility 07 · Bench 02'],
                ['Date of tests', '14 February 2026', 'Reference', 'OIML R 76-2:2007'],
              ]}
            />
          </ReportSection>

          <ReportSection number="2" title="INSTRUMENT SPECIFICATIONS">
            <ReportGrid
              rows={[
                ['Accuracy class', 'III', 'Verification scale interval (e)', '1 g'],
                ['Actual scale interval (d)', '1 g', 'Minimum capacity (Min)', '20 g'],
                ['Maximum capacity (Max)', '6,200 g', 'Number of verification scale intervals (n)', '6,200'],
                ['Temperature range', '20 °C to 23 °C', 'Power supply', 'AC mains'],
                ['Zero-setting device', '☑ Semi-automatic  ☐ Automatic  ☐ Zero-tracking', 'Tare device', '☑ Yes  ☐ No'],
                ['Level indicator', '☑ Yes  ☐ No', 'Protection against fraud', '☑ Yes  ☐ No'],
              ]}
            />
          </ReportSection>

          <ReportSection number="3" title="TEST EQUIPMENT">
            <ReportTable
              headers={['Equipment', 'Identification No.', 'Calibration Date']}
              rows={[
                ['Reference mass set', 'NAWI-MASS-017', '08 Jan 2026'],
                ['Environmental sensor', 'NAWI-ENV-004', '12 Jan 2026'],
                ['Digital caliper', 'NAWI-CAL-021', '05 Dec 2025'],
              ]}
            />
          </ReportSection>

          <ReportSection number="4" title="ENVIRONMENTAL CONDITIONS">
            <ReportTable
              headers={['Parameter', 'At start', 'At max', 'At end']}
              rows={[
                ['Temperature (°C)', '21.4', '21.8', '21.6'],
                ['Relative humidity (%)', '43', '44', '43'],
                ['Barometric pressure (hPa)', '1013', '1012', '1013'],
                ['Time', '09:42', '10:16', '10:31'],
              ]}
            />
          </ReportSection>

          <ReportSection number="5" title="SUMMARY OF TYPE EVALUATION">
            <ReportTable
              headers={['Test', 'Report page', 'Passed', 'Failed', 'Remarks']}
              rows={reportTests.map(([num, lbl]) => [
                `${num}. ${lbl}`,
                '—',
                '☑',
                '☐',
                'Within applicable requirements',
              ])}
            />
          </ReportSection>

          <ReportSection number="6" title="TEST 1: WEIGHING PERFORMANCE">
            <ReportTable
              headers={['Load (L)', 'Indication (I)', 'Add. load (ΔL)', 'Error (E)', 'Corrected error (Ec)', 'MPE', 'Pass/Fail']}
              rows={[
                ['500 g', '500.4 g', '—', '+0.4 g', '+0.4 g', '±1.0 g', 'PASS'],
                ['2,500 g', '2,500.6 g', '—', '+0.6 g', '+0.6 g', '±1.0 g', 'PASS'],
                ['5,000 g', '5,000.7 g', '—', '+0.7 g', '+0.7 g', '±1.0 g', 'PASS'],
              ]}
            />
          </ReportSection>

          <ReportSection number="7–36" title="SUPPORTING TEST RECORDS">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReportNote title="Test 7 · Stability of equilibrium" value="No instability observed during disturbance check." />
              <ReportNote title="Test 9 · Tare" value="Tare indication returned within the applicable limit." />
              <ReportNote title="Test 14 · Span stability" value="Change from initial remained within MPE." />
              <ReportNote title="Tests 16–17 · Construction and checklists" value="Markings, software identification, security features, and user instructions reviewed." />
            </div>
          </ReportSection>

          <ReportSection number="37" title="FINAL ASSESSMENT">
            <div className="rounded-md border border-[#9bc8bb] bg-[#eaf4ef] p-4">
              <div className="font-mono text-sm font-bold text-[#2e7568]">
                ☑ PASSED — Instrument complies with OIML R 76 requirements
              </div>
              <p className="mt-2 text-xs leading-5 text-[#58746f]">
                The evaluation record, environmental readings, captured observations, and authorization metadata are retained in the local audit trail.
              </p>
            </div>
          </ReportSection>

          <ReportSection number="38" title="AUTHORIZATION">
            <ReportGrid
              rows={[
                ['Name of observer', metadata.signer || 'Dr. Elias Voss', 'Designation', metadata.designation || 'Approving Officer'],
                ['Signature', metadata.signer || 'Dr. Elias Voss', 'Date / time', sealedDate.toLocaleString()],
                ['Laboratory seal', 'NAWI · Facility 07', 'Geotag', geotagText],
                ['Digital Signature Hash', metadata.signatureHash || 'Pending seal', 'Record Hash', reportHash || 'Pending'],
              ]}
            />
          </ReportSection>

          <div className="report-footer mt-8 flex flex-col gap-2 border-t border-[#c9d9d1] pt-4 text-[10px] text-[#66837d] sm:flex-row sm:justify-between">
            <span>Generated by NAWI Compliance Suite · Controlled copy</span>
            <span className="font-mono">{reportId} · sealed {sealedDate.toISOString()}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReportDocument;
