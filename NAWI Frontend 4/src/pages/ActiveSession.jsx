import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CloudOff, FileText, Save } from 'lucide-react';
import IdentificationModule from '@/components/modules/IdentificationModule';
import EnvironmentModule from '@/components/modules/EnvironmentModule';
import ReadingModule from '@/components/modules/ReadingModule';
import EccentricityModule from '@/components/modules/EccentricityModule';
import CreepModule from '@/components/modules/CreepModule';
import VerdictModule from '@/components/modules/VerdictModule';
import Button from '@/components/Button';
import { evaluateObservation } from '@/lib/metrology';
import { loadWorkingSession, saveWorkingSession, queueOutbox } from '@/lib/offlineStore';
import { TEST_MODULES, moduleStatus, allModulesComplete } from '@/lib/requirements';
import { normalizeDrift } from '@/lib/drift';
import { api } from '@/api/client';

// Screen order: three UI-only screens (Identification, Environment, Verdict)
// plus every backend-recognized test type from lib/requirements.js, in the
// same order/spelling the backend's own module list uses.
const SCREENS = [
  { kind: 'identification', label: 'Identification' },
  { kind: 'environment', label: 'Environment' },
  ...TEST_MODULES.map((m) => ({ kind: 'test', testType: m.testType, label: m.label })),
  { kind: 'verdict', label: 'Verdict' },
];

const isLocalId = (id) => !id || String(id).startsWith('local-');

export function ActiveSession() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nawi-session') || '{}');
    } catch {
      return {};
    }
  });

  const [screenIndex, setScreenIndex] = useState(0);
  const [reading, setReading] = useState('');
  const [appliedLoad, setAppliedLoad] = useState('5000');
  const [observations, setObservations] = useState([]); // [{test_type, position, applied_load, indication, verdict, corrected_error, mpe_limit, source}]
  const [source, setSource] = useState('manual');
  const [saved, setSaved] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [apiError, setApiError] = useState('');
  const [finalized, setFinalized] = useState(false);
  const [activePosition, setActivePosition] = useState(null);
  const [creepTimer, setCreepTimer] = useState({ running: false, startedAt: null, accumulatedMs: 0 });
  const [, forceTick] = useState(0);

  // Environment: real values persisted to the session, plus the backend's
  // own drift verdict — nothing here is simulated.
  const [envValues, setEnvValues] = useState({ start_temp_c: '', end_temp_c: '', humidity_pct: '', pressure_hpa: '' });
  const [envSaving, setEnvSaving] = useState(false);
  const [envSaveState, setEnvSaveState] = useState('');
  const [driftInfo, setDriftInfo] = useState(null);
  const [driftLoading, setDriftLoading] = useState(false);

  const current = SCREENS[screenIndex];

  useEffect(() => {
    if (session.observations) setObservations(session.observations);
    if (session.creepTimer) setCreepTimer(session.creepTimer);
    if (session.envValues) setEnvValues(session.envValues);
    loadWorkingSession((stored) => {
      if (stored) {
        setSession(stored);
        setObservations(stored.observations || []);
        if (stored.creepTimer) setCreepTimer(stored.creepTimer);
        if (stored.envValues) setEnvValues(stored.envValues);
      }
    });
    if (session.id && !isLocalId(session.id)) {
      api.observations(session.id).then((rows) => setObservations(rows)).catch(() => {});
      api.drift(session.id).then((raw) => setDriftInfo(normalizeDrift(raw))).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!creepTimer.running) return;
    const timer = window.setInterval(() => forceTick((x) => x + 1), 500);
    return () => window.clearInterval(timer);
  }, [creepTimer.running]);

  const creepElapsedMs = creepTimer.accumulatedMs + (creepTimer.running && creepTimer.startedAt ? Date.now() - creepTimer.startedAt : 0);

  const persist = (patch = {}) => {
    const next = { ...session, observations, creepTimer, envValues, note, ...patch };
    localStorage.setItem('nawi-session', JSON.stringify(next));
    saveWorkingSession(next);
    setSession(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const startCreepTimer = () => {
    const next = { running: true, startedAt: Date.now(), accumulatedMs: creepTimer.accumulatedMs };
    setCreepTimer(next);
    persist({ creepTimer: next });
  };
  const stopCreepTimer = () => {
    const next = { running: false, startedAt: null, accumulatedMs: creepElapsedMs };
    setCreepTimer(next);
    persist({ creepTimer: next });
  };
  const resetCreepTimer = () => {
    const next = { running: false, startedAt: null, accumulatedMs: 0 };
    setCreepTimer(next);
    persist({ creepTimer: next });
  };

  const evaluateReading = () => {
    if (!reading.trim()) return null;
    return evaluateObservation({
      appliedLoad: String(appliedLoad || '0'),
      indication: String(reading),
      verificationScaleInterval: session.verificationScaleInterval || 1,
      accuracyClass: session.accuracyClass || 'III',
    });
  };

  const liveValidation = reading.trim() && !Number.isNaN(Number(reading)) ? evaluateReading() : null;

  const rowsFor = (testType) => observations.filter((o) => o.test_type === testType);

  // Every submitted observation uses ObservationDto field names exactly:
  // test_type, position, applied_load, indication, additional_load,
  // zero_error, source. The backend computes and returns error_prior,
  // corrected_error, mpe_limit and verdict — we display whatever it sends
  // back as the authoritative result, falling back to the local decimal.js
  // mirror only while offline.
  const addReading = async (testType, position = null) => {
    if (!reading.trim() || Number.isNaN(Number(reading))) return;
    const provisional = evaluateReading();
    const payload = {
      test_type: testType,
      position,
      applied_load: String(appliedLoad || '0'),
      indication: String(reading),
      additional_load: '0',
      zero_error: '0',
      source,
    };

    let row = {
      test_type: testType,
      position,
      applied_load: payload.applied_load,
      indication: payload.indication,
      corrected_error: provisional?.correctedError,
      mpe_limit: provisional?.mpeLimit,
      verdict: provisional?.verdict,
      source,
      authoritative: false,
    };

    if (session.id && !isLocalId(session.id)) {
      try {
        const res = await api.addObservation(session.id, payload);
        const ev = res?.evaluation || res?.observation || {};
        row = {
          ...row,
          corrected_error: ev.corrected_error ?? row.corrected_error,
          mpe_limit: ev.mpe_limit ?? row.mpe_limit,
          verdict: ev.verdict ?? row.verdict,
          authoritative: true,
        };
        setApiError('');
      } catch (err) {
        // Server rejected or connection dropped — queue it instead of
        // silently discarding the technician's reading.
        try {
          await queueOutbox({ kind: 'observation', sessionId: session.id, payload });
          setApiError('Server unreachable — reading queued locally and will sync automatically.');
        } catch {
          setApiError(err.message || 'Server sync failed; observation remains local only.');
        }
      }
    } else if (session.id) {
      // Local-only session: queued as part of the session-creation outbox
      // item once that syncs (see NewEvaluation.jsx / lib/sync.js).
      await queueOutbox({ kind: 'observation', sessionId: session.id, payload });
    }

    const next = [...observations, row];
    setObservations(next);
    setReading('');
    persist({ observations: next });
  };

  const saveEnvironment = async () => {
    setEnvSaving(true);
    setEnvSaveState('');
    const payload = {
      start_temp_c: envValues.start_temp_c || null,
      end_temp_c: envValues.end_temp_c || null,
      humidity_pct: envValues.humidity_pct || null,
      pressure_hpa: envValues.pressure_hpa || null,
    };
    try {
      if (session.id && !isLocalId(session.id)) {
        await api.patchSession(session.id, payload);
        setEnvSaveState('saved');
        setDriftLoading(true);
        try {
          setDriftInfo(normalizeDrift(await api.drift(session.id)));
        } catch {
          setDriftInfo(null);
        } finally {
          setDriftLoading(false);
        }
      } else if (session.id) {
        await queueOutbox({ kind: 'environment', sessionId: session.id, payload });
        setEnvSaveState('queued');
      }
    } catch {
      try {
        await queueOutbox({ kind: 'environment', sessionId: session.id, payload });
        setEnvSaveState('queued');
      } catch {
        setEnvSaveState('error');
      }
    } finally {
      setEnvSaving(false);
      persist({ envValues });
    }
  };

  const goNext = () => setScreenIndex(Math.min(SCREENS.length - 1, screenIndex + 1));
  const goBack = () => setScreenIndex(Math.max(0, screenIndex - 1));

  const isLastScreen = screenIndex === SCREENS.length - 1;
  const finalizeReady = useMemo(() => allModulesComplete(observations), [observations]);

  const handlePrimaryAction = async () => {
    if (!isLastScreen) return goNext();
    if (!session.id || isLocalId(session.id) || !finalizeReady) {
      setFinalized(true);
      return;
    }
    try {
      await api.finalize(session.id);
      setFinalized(true);
      setApiError('');
    } catch (err) {
      setApiError(err.message || 'Finalize failed.');
    }
  };

  const renderScreen = () => {
    if (current.kind === 'identification') return <IdentificationModule session={session} />;

    if (current.kind === 'environment') {
      return (
        <EnvironmentModule
          values={envValues}
          setValues={setEnvValues}
          onSave={saveEnvironment}
          saving={envSaving}
          saveState={envSaveState}
          driftInfo={driftInfo}
          driftLoading={driftLoading}
        />
      );
    }

    if (current.kind === 'verdict') {
      return <VerdictModule observations={observations} driftFlag={driftInfo?.level === 'warn'} />;
    }

    const module = TEST_MODULES.find((m) => m.testType === current.testType);
    const status = moduleStatus(module, observations);

    if (current.testType === 'eccentricity') {
      return (
        <EccentricityModule
          reading={reading}
          setReading={setReading}
          rows={rowsFor('eccentricity')}
          onAdd={(position) => addReading('eccentricity', position)}
          unit={session.unit || 'g'}
          liveValidation={liveValidation}
          appliedLoad={appliedLoad}
          setAppliedLoad={setAppliedLoad}
          activePosition={activePosition}
          setActivePosition={setActivePosition}
        />
      );
    }

    if (current.testType === 'creep') {
      return (
        <CreepModule
          value={reading}
          setValue={setReading}
          appliedLoad={appliedLoad}
          setAppliedLoad={setAppliedLoad}
          source={source}
          setSource={setSource}
          liveValidation={liveValidation}
          unit={session.unit || 'g'}
          rows={rowsFor('creep')}
          elapsedMs={creepElapsedMs}
          running={creepTimer.running}
          onStart={startCreepTimer}
          onStop={stopCreepTimer}
          onReset={resetCreepTimer}
          onCapture={(position) => addReading('creep', position)}
        />
      );
    }

    // zero_check, weighing_performance, repeatability, tare — plain
    // sequential readings, no required position.
    return (
      <ReadingModule
        title={module.label}
        description={`${module.hint} (need ${status.need} reading${status.need === 1 ? '' : 's'} — ${status.have} captured.)`}
        value={reading}
        setValue={setReading}
        appliedLoad={appliedLoad}
        setAppliedLoad={setAppliedLoad}
        source={source}
        setSource={setSource}
        liveValidation={liveValidation}
        readings={rowsFor(module.testType).map((r) => r.indication)}
        onAdd={() => addReading(module.testType)}
        unit={session.unit || 'g'}
        sessionId={session.id}
      />
    );
  };

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow">Active evaluation</div>
          <h1 className="page-title mt-2">{session.model || session.asset || 'Instrument'}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#66837d]">
            <span className="font-mono">SN {session.serial || '—'}</span>
            <span className="h-1 w-1 rounded-full bg-[#9ab0a9]" />
            <span>{session.capacity || '—'} {session.unit || 'g'} max</span>
            <span className="h-1 w-1 rounded-full bg-[#9ab0a9]" />
            <span className="flex items-center gap-1.5">
              <span className="status-dot" />
              {isLocalId(session.id) ? 'Local draft' : 'Synced'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="quiet" size="sm" onClick={() => setShowNote(!showNote)} data-testid="button-session-note">
            <FileText size={14} /> Note
          </Button>
          <Button variant="quiet" size="sm" onClick={() => persist()} data-testid="button-save-session">
            <Save size={14} /> {saved ? 'Saved' : 'Save locally'}
          </Button>
        </div>
      </div>

      {apiError && <div className="panel mb-6 border-[#e7b5ae] bg-[#fff5f3] p-4 text-xs text-[#a6423b]">{apiError}</div>}

      {showNote && (
        <div className="panel mb-6 p-4 animate-rise">
          <label className="eyebrow" htmlFor="session-note">Session note</label>
          <div className="mt-3 flex gap-3">
            <input
              id="session-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for the approving officer…"
              className="min-w-0 flex-1 rounded-md border border-[#c9d9d1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c69852]"
              data-testid="input-session-note"
            />
            <Button size="sm" onClick={() => { persist(); setShowNote(false); }} data-testid="button-save-note">Save note</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <aside className="panel h-fit p-4">
          <div className="eyebrow mb-5 px-2">Test modules</div>
          <div>
            {SCREENS.map((screen, index) => {
              const active = index === screenIndex;
              const module = screen.kind === 'test' ? TEST_MODULES.find((m) => m.testType === screen.testType) : null;
              const status = module ? moduleStatus(module, observations) : null;
              const complete = status ? status.complete : index < screenIndex;
              return (
                <button
                  key={screen.label}
                  onClick={() => setScreenIndex(index)}
                  className={`module-step flex w-full items-start gap-3 px-2 py-2.5 text-left ${complete ? 'complete' : ''}`}
                  data-testid={`button-module-${index + 1}`}
                >
                  <span
                    className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[10px] ${
                      active ? 'border-[#c69852] bg-[#17333c] text-[#f3e8d0]' : complete ? 'border-[#2e7568] bg-[#dceee8] text-[#2e7568]' : 'border-[#c9d9d1] bg-[#f4f7f3] text-[#7b9690]'
                    }`}
                  >
                    {complete ? <Check size={14} /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="pt-1">
                    <span className={`block text-xs ${active ? 'font-semibold text-[#17333c]' : 'text-[#66837d]'}`}>{screen.label}</span>
                    <span className="mt-1 block font-mono text-[9px] text-[#9ab0a9]">
                      {status ? `${status.have}/${status.need}` : complete ? 'complete' : active ? 'current' : ''}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-[#d7e0db] px-2 pt-4">
            <div className="flex items-center gap-2 text-[10px] text-[#66837d]">
              <CloudOff size={13} /> {isLocalId(session.id) ? 'Not yet synced to server' : 'Synced with server'}
            </div>
          </div>
        </aside>

        <section className="panel min-h-[560px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#d7e0db] px-5 py-4 md:px-7">
            <div>
              <div className="eyebrow">Module {String(screenIndex + 1).padStart(2, '0')} / {String(SCREENS.length).padStart(2, '0')}</div>
              <h2 className="mt-1 text-xl font-semibold">{current.label}</h2>
            </div>
          </div>

          <div className="p-5 md:p-7">{renderScreen()}</div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#d7e0db] bg-[#fbfdfb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
            <Button variant="quiet" size="sm" onClick={goBack} disabled={screenIndex === 0} data-testid="button-previous-module">
              <ArrowLeft size={14} /> Previous
            </Button>
            <div className="flex items-center gap-3">
              {isLastScreen && !finalizeReady && !isLocalId(session.id) && (
                <span className="hidden text-[10px] text-[#b24b43] sm:inline">Some required tests are incomplete</span>
              )}
              <Button size="sm" onClick={handlePrimaryAction} disabled={finalized} data-testid="button-next-module">
                {finalized ? 'Completed' : isLastScreen ? 'Finalize report' : 'Continue'} <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ActiveSession;
