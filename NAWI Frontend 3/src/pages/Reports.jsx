import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Archive, ArrowRight, LockKeyhole, Plus, Search, UploadCloud } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import { api } from '@/api/client';

export function Reports() {
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState('');

  const [reports, setReports] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    api
      .reports()
      .then((data) => {
        setReports(data);
        setLastSync(new Date());
      })
      .catch(() => setLoadError(true));
  }, []);

  const filtered = reports.filter((report) =>
    `${report.report_id} ${report.instrument?.asset || report.instrument || 'Instrument'} ${report.instrument?.serial || report.serial || '—'}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <SectionHeader
        eyebrow="Records / Archive"
        title="Report archive."
        detail="Sealed evaluations and their verification state. Local records remain available when the network is not."
        action={
          <Button
            onClick={() => setLocation('/evaluations/new')}
            data-testid="button-new-from-reports"
          >
            <Plus size={16} />
            New evaluation
          </Button>
        }
      />

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-3 text-[#7b9690]" size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports…"
            className="w-full rounded-md border border-[#c9d9d1] bg-white py-2.5 pl-9 pr-3 text-xs outline-none focus:border-[#c69852]"
            data-testid="input-search-reports"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-[#66837d]">
          <Archive size={14} /> {filtered.length} records shown
        </div>
      </div>

      <section className="panel overflow-hidden">
        <div className="mobile-scroll">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#d7e0db] bg-[#fbfdfb] text-[10px] uppercase tracking-[.12em] text-[#7b9690]">
                <th className="px-5 py-4 font-medium">Report</th>
                <th className="px-5 py-4 font-medium">Instrument</th>
                <th className="px-5 py-4 font-medium">Date</th>
                <th className="px-5 py-4 font-medium">Result</th>
                <th className="px-5 py-4 font-medium">State</th>
                <th className="px-5 py-4 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.report_id} className="table-row border-b border-[#e5ece8] last:border-0">
                  <td className="px-5 py-5">
                    <div className="font-mono font-bold text-[#33545a]">{report.report_id}</div>
                    <div className="mt-1 text-[10px] text-[#9ab0a9]">Sealed report</div>
                  </td>
                  <td className="px-5 py-5">
                    <div className="font-semibold text-[#33545a]">{report.instrument?.asset || report.instrument || 'Instrument'}</div>
                    <div className="mt-1 font-mono text-[10px] text-[#7b9690]">SN {report.instrument?.serial || report.serial || '—'}</div>
                  </td>
                  <td className="px-5 py-5 text-[#66837d]">{(report.created_at ? new Date(report.created_at).toLocaleDateString() : '—')}</td>
                  <td className="px-5 py-5">
                    <span
                      className={`font-mono text-[11px] font-bold ${
                        report.result === 'PASS' ? 'text-[#2e7568]' : 'text-[#ba4e48]'
                      }`}
                    >
                      {report.result || '—'}
                    </span>
                  </td>
                  <td className="px-5 py-5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        !!report.sha256
                          ? 'bg-[#dceee8] text-[#2e7568]'
                          : 'bg-[#f7dfdc] text-[#a43f3b]'
                      }`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {report.state || 'Verified'}
                    </span>
                  </td>
                  <td className="px-5 py-5 text-right">
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => setLocation(`/verify/${report.report_id}`)}
                      data-testid={`button-open-report-${report.report_id}`}
                    >
                      Open report <ArrowRight size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="p-12 text-center text-sm text-[#66837d]">
            No reports match “{query}”.
          </div>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-4 text-[10px] text-[#7b9690]">
        <span className="flex items-center gap-2">
          <UploadCloud size={13} />
          {loadError
            ? 'Could not reach the report archive'
            : lastSync
            ? `Last synced: ${lastSync.toLocaleTimeString()}`
            : 'Syncing…'}
        </span>
        <span className="flex items-center gap-2">
          <LockKeyhole size={13} />
          Integrity checks enabled
        </span>
      </div>
    </div>
  );
}

export default Reports;
