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

function formatAuditTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

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
  const [environment, setEnvironment] = useState(null);
  const [environmentError, setEnvironmentError] = useState(false);
  const [activity, setActivity] = useState([]);
  const [activityError, setActivityError] = useState(false);

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
    // Real audit feed — replaces the old hardcoded demo rows.
    api
      .audit()
      .then((rows) => setActivity(rows.slice(0, 5)))
      .catch(() => setActivityError(true));
  }, []);

  // Live environment/drift reading for whichever session is actually open on
  // the server — no fabricated temperature/humidity numbers.
  useEffect(() => {
    const liveSessionId = session?.id && !String(session.id).startsWith('local-') ? session.id : null;
    if (!liveSessionId) {
      setEnvironment(null);
      return;
    }
    api
      .drift(liveSessionId)
      .then(setEnvironment)
      .catch(() => setEnvironmentError(true));
  }, [session?.id]);

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
            value={String(
              serverSessions.filter((s) => s.state !== 'completed' && s.state !== 'approved').length
            ).padStart(2, '0')}
            detail={
              serverSessions.length
                ? 'From server session records'
                : session
                ? 'Local draft not yet synced'
                : 'No active evaluations'
            }
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
            value={environment?.status ? environment.status : environment === null ? 'No session' : '—'}
            detail={
              environment
                ? `${environment.temperature ?? '—'}°C · ${environment.humidity ?? '—'}% RH`
                : environmentError
                ? 'Drift check unavailable'
                : 'Open a synced session to read live sensor data'
            }
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
          {environment ? (
            <>
              <div className="mt-8 flex items-center gap-5">
                <div className="gauge-ring grid h-28 w-28 shrink-0 place-items-center">
                  <div className="text-center">
                    <div className="font-mono text-2xl text-[#f3e8d0]">
                      {environment.status || (environment.drift_flag ? 'DRIFT' : 'OK')}
                    </div>
                    <div className="mt-1 text-[9px] uppercase tracking-[.14em] text-[#9ec8bb]">
                      {environment.drift_flag ? 'flagged' : 'stable'}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="font-mono text-xl">{environment.temperature ?? '—'}°C</div>
                  <div className="mt-1 text-xs text-[#a5c0b8]">
                    {environment.temperature_range || 'range not reported'}
                  </div>
                  <div className="mt-4 font-mono text-xl">{environment.humidity ?? '—'}% RH</div>
                  <div className="mt-1 text-xs text-[#a5c0b8]">
                    {environment.humidity_range || 'range not reported'}
                  </div>
                </div>
              </div>
              <div className="mt-8 border-t border-white/10 pt-4 text-xs text-[#a5c0b8]">
                <span className="status-dot mr-2" />
                Last checked {formatAuditTime(environment.checked_at || environment.updated_at)}
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-lg border border-dashed border-white/15 p-6 text-center text-xs text-[#a5c0b8]">
              {environmentError
                ? 'Could not reach the drift endpoint for this session.'
                : 'No synced session is open, so there is no live sensor reading to show.'}
            </div>
          )}
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
              {activity.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-[#7b9690]">
                    {activityError ? 'Audit log unavailable.' : 'No audit events yet.'}
                  </td>
                </tr>
              )}
              {activity.map((row) => (
                <ActivityRow
                  key={row.id || `${row.action}-${row.created_at}`}
                  event={row.action || '—'}
                  reference={row.object_id ? String(row.object_id).slice(0, 12) : '—'}
                  operator={row.actor_email || row.actor || row.user || 'System'}
                  time={formatAuditTime(row.created_at)}
                  status={row.detail || '—'}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default Home;
