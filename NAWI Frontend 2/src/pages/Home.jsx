import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Activity,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileCheck2,
  Plus,
  Thermometer,
} from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import { StatCard } from '@/components/Card';
import Button from '@/components/Button';
import { loadWorkingSession } from '@/lib/offlineStore';
import { api } from '@/api/client';

function ActivityRow({ event, reference, operator, time, status }) {
  return (
    <tr className="table-row border-b border-[#e5ece8] last:border-0">
      <td className="px-5 py-4 font-semibold text-[#33545a]">{event}</td>
      <td className="px-5 py-4 font-mono text-[11px] text-[#66837d]">{reference}</td>
      <td className="px-5 py-4 text-[#66837d]">{operator}</td>
      <td className="px-5 py-4 text-[#66837d]">{time}</td>
      <td className="px-5 py-4 text-right">
        <span className="rounded-full bg-[#dceee8] px-2.5 py-1 text-[10px] font-semibold text-[#2e7568]">
          {status}
        </span>
      </td>
    </tr>
  );
}

export function Home() {
  const [, setLocation] = useLocation();
  const [session, setSession] = useState(null);
  const [serverSessions, setServerSessions] = useState([]);
  const [reportsCount, setReportsCount] = useState(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('nawi-session');
      if (raw) setSession(JSON.parse(raw));
    } catch {
      setSession(null);
    }
    loadWorkingSession((stored) => {
      if (stored?.asset && stored?.serial) {
        setSession(stored);
      }
    });
    api.sessions().then(setServerSessions).catch(() => {});
    api.reports().then((r) => setReportsCount(r.length)).catch(() => {});
  }, []);

  return (
    <div>
      <SectionHeader
        eyebrow="Operations / 07"
        title="Bench overview."
        detail="Current work, environmental readiness, and sealed records for this metrology bench."
        action={
          <Button
            onClick={() => setLocation('/evaluations/new')}
            data-testid="button-start-evaluation"
          >
            <Plus size={16} />
            Start evaluation
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="animate-rise">
          <StatCard
            label="Open sessions"
            value={session ? '01' : '00'}
            detail={session ? 'Bench 02 · in progress' : 'No active evaluations'}
            icon={Activity}
            tone="teal"
          />
        </div>
        <div className="animate-rise animate-delay-1">
          <StatCard
            label="Reports this month"
            value={String(reportsCount).padStart(2, '0')}
            detail="Sealed records from the API"
            icon={FileCheck2}
          />
        </div>
        <div className="animate-rise animate-delay-2">
          <StatCard
            label="Pass rate"
            value={serverSessions.length ? `${Math.round((serverSessions.filter((x) => x.state === 'completed' || x.state === 'approved').length / serverSessions.length) * 1000) / 10}%` : '—'}
            detail="Derived from server sessions"
            icon={BarChart3}
            tone="brass"
          />
        </div>
        <div className="animate-rise animate-delay-3">
          <StatCard
            label="Environment"
            value="Stable"
            detail="21.4°C · 43% RH"
            icon={Thermometer}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <section className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#d7e0db] px-5 py-4">
            <div>
              <div className="eyebrow">Work queue</div>
              <h2 className="mt-1 text-base font-semibold">Continue where you left off</h2>
            </div>
            <Link
              href="/sessions/active"
              className="text-xs font-semibold text-[#2e7568] hover:underline flex items-center gap-1"
              data-testid="link-view-session"
            >
              Open session <ArrowRight size={13} />
            </Link>
          </div>

          {session ? (
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_150px] sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="status-dot" />
                  <span className="font-mono text-[10px] uppercase tracking-[.14em] text-[#2e7568]">
                    In progress
                  </span>
                </div>
                <h3 className="mt-3 text-lg font-semibold">{session.asset}</h3>
                <p className="mt-1 text-xs text-[#66837d]">
                  Serial {session.serial} · Started today
                </p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e5ece8]">
                  <div
                    className="h-full rounded-full bg-[#2e7568] transition-all"
                    style={{ width: `${session.progress || 20}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-[#66837d]">
                  <span>Progress</span>
                  <span className="font-mono">{session.progress || 20}%</span>
                </div>
              </div>
              <Button
                variant="quiet"
                onClick={() => setLocation('/sessions/active')}
                data-testid="button-resume-session"
              >
                Resume session
              </Button>
            </div>
          ) : (
            <div className="grid-paper m-5 rounded-lg border border-dashed border-[#bdd1c8] px-6 py-10 text-center">
              <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#dceee8] text-[#2e7568]">
                <ClipboardCheck size={20} />
              </div>
              <h3 className="mt-4 text-base font-semibold">No open evaluations</h3>
              <p className="mx-auto mt-2 max-w-sm text-xs leading-5 text-[#66837d]">
                Start a session to capture a compliant record for the next instrument on your bench.
              </p>
              <Button
                size="sm"
                onClick={() => setLocation('/evaluations/new')}
                className="mt-5"
                data-testid="button-empty-start"
              >
                Create first evaluation
              </Button>
            </div>
          )}
        </section>

        <section className="panel-dark p-5">
          <div className="flex items-center justify-between">
            <div className="eyebrow !text-[#c8a96b]">Bench health</div>
            <Activity size={16} className="text-[#9ec8bb]" />
          </div>
          <div className="mt-8 flex items-center gap-5">
            <div className="gauge-ring grid h-28 w-28 shrink-0 place-items-center">
              <div className="text-center">
                <div className="font-mono text-2xl text-[#f3e8d0]">OK</div>
                <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-[#9ec8bb]">stable</div>
              </div>
            </div>
            <div>
              <div className="font-mono text-xl">21.4°C</div>
              <div className="mt-1 text-xs text-[#a5c0b8]">within 20–23°C</div>
              <div className="mt-4 font-mono text-xl">43% RH</div>
              <div className="mt-1 text-xs text-[#a5c0b8]">within 35–60% RH</div>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-4 text-xs text-[#a5c0b8]">
            <span className="status-dot mr-2" />
            Last sensor check 09:38:22
          </div>
        </section>
      </div>

      <section className="panel mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#d7e0db] px-5 py-4">
          <div>
            <div className="eyebrow">Recent activity</div>
            <h2 className="mt-1 text-base font-semibold">Audit trail</h2>
          </div>
          <Link
            href="/reports"
            className="text-xs font-semibold text-[#2e7568] hover:underline flex items-center gap-1"
            data-testid="link-view-reports"
          >
            View reports <ArrowRight size={13} />
          </Link>
        </div>
        <div className="mobile-scroll">
          <table className="w-full min-w-[650px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#d7e0db] text-[10px] uppercase tracking-[.12em] text-[#7b9690]">
                <th className="px-5 py-3 font-medium">Event</th>
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Operator</th>
                <th className="px-5 py-3 font-medium">Time</th>
                <th className="px-5 py-3 font-medium text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              <ActivityRow
                event="Report sealed"
                reference="NR-2026-0047"
                operator="Maya Linden"
                time="Yesterday, 16:08"
                status="Verified"
              />
              <ActivityRow
                event="Evaluation completed"
                reference="EVAL-2026-031"
                operator="Jon Bell"
                time="Yesterday, 14:22"
                status="Pass"
              />
              <ActivityRow
                event="Calibration file imported"
                reference="CAL-7721"
                operator="System"
                time="Mon, 11:04"
                status="Stored locally"
              />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Home;
