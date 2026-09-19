import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CloudOff, FileText, Save } from 'lucide-react';
import IdentificationModule from '@/components/modules/IdentificationModule';
import EnvironmentModule from '@/components/modules/EnvironmentModule';
import ReadingModule from '@/components/modules/ReadingModule';
import EccentricityModule from '@/components/modules/EccentricityModule';
import CreepModule from '@/components/modules/CreepModule';
import VerdictModule from '@/components/modules/VerdictModule';
import Button from '@/components/Button';
import { evaluateObservation } from '@/lib/metrology';
import { loadWorkingSession, saveWorkingSession } from '@/lib/offlineStore';
import { api } from '@/api/client';

const modules = [
  { label: 'Identification', short: '01' },
  { label: 'Environment', short: '02' },
  { label: 'Zero check', short: '03' },
  { label: 'Eccentricity', short: '04' },
  { label: 'Repeatability', short: '05' },
  { label: 'Linearity', short: '06' },
  { label: 'Creep', short: '07' },
  { label: 'Discrimination', short: '08' },
  { label: 'Verdict', short: '09' },
];

export function ActiveSession() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('nawi-session') || '{}');
    } catch {
      return {};
    }
  });

  const [moduleIndex, setModuleIndex] = useState(1);
  const [reading, setReading] = useState('');
  const [appliedLoad, setAppliedLoad] = useState('5000');
  const [readings, setReadings] = useState([]);
  const [observations, setObservations] = useState([]);
  const [source, setSource] = useState('manual');
  const [saved, setSaved] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [apiError, setApiError] = useState('');
  const [finalized, setFinalized] = useState(false);
  const [creepReadings, setCreepReadings] = useState([]);
  const [creepTimer, setCreepTimer] = useState({ running: false, startedAt: null, accumulatedMs: 0 });
  const [, forceTick] = useState(0);

  const current = modules[moduleIndex];

  useEffect(() => {
    if (session.readings) setReadings(session.readings);
    if (session.observations) setObservations(session.observations);
    if (session.creepReadings) setCreepReadings(session.creepReadings);
    if (session.creepTimer) setCreepTimer(session.creepTimer);
    loadWorkingSession((stored) => {
      if (stored) {
        setSession(stored);
        setReadings(stored.readings || []);
        setObservations(stored.observations || []);
        setCreepReadings(stored.creepReadings || []);
        if (stored.creepTimer) setCreepTimer(stored.creepTimer);
      }
    });
    if (session.id && !String(session.id).startsWith('local-')) {
      api.observations(session.id).then((rows) => setObservations(rows)).catch(() => {});
    }
  }, []);

  // Keep the creep-test clock ticking (in real time) even while the operator
  // switches to a different module tab — the timer state itself lives here,
  // in the parent, rather than inside the module that gets unmounted.
  useEffect(() => {
    if (!creepTimer.running) return;
    const timer = window.setInterval(() => forceTick((x) => x + 1), 500);
    return () => window.clearInterval(timer);
  }, [creepTimer.running]);

  const creepElapsedMs =
    creepTimer.accumulatedMs + (creepTimer.running && creepTimer.startedAt ? Date.now() - creepTimer.startedAt : 0);

  const persist = (
    nextIndex = moduleIndex,
    nextReadings = readings,
    nextObservations = observations,
    nextDriftFlag = session.driftFlag,
    nextCreepReadings = creepReadings,
    nextCreepTimer = creepTimer
  ) => {
    const next = {
      ...session,
      progress: Math.min(100, Math.round(((nextIndex + 1) / modules.length) * 100)),
      readings: nextReadings,
      observations: nextObservations,
      driftFlag: nextDriftFlag,
      creepReadings: nextCreepReadings,
      creepTimer: nextCreepTimer,
      note,
    };
    localStorage.setItem('nawi-session', JSON.stringify(next));
    saveWorkingSession(next);
    setSession(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const startCreepTimer = () => {
    const next = { running: true, startedAt: Date.now(), accumulatedMs: creepTimer.accumulatedMs };
    setCreepTimer(next);
    persist(moduleIndex, readings, observations, session.driftFlag, creepReadings, next);
  };

  const stopCreepTimer = () => {
    const next = { running: false, startedAt: null, accumulatedMs: creepElapsedMs };
    setCreepTimer(next);
    persist(moduleIndex, readings, observations, session.driftFlag, creepReadings, next);
  };

  const resetCreepTimer = () => {
    const next = { running: false, startedAt: null, accumulatedMs: 0 };
    setCreepTimer(next);
    persist(moduleIndex, readings, observations, session.driftFlag, creepReadings, next);
  };

  const evaluateReading = () => {
    if (!reading.trim()) return null;
    const result = evaluateObservation({
      appliedLoad: String(appliedLoad || '0'),
      indication: String(reading),
      verificationScaleInterval: session.verificationScaleInterval || 1,
      accuracyClass: session.accuracyClass || 'III',
    });
    const observation = {
      position: moduleIndex === 3 ? ['Center', 'A', 'B', 'C', 'D'][readings.length] : undefined,
      load: Number(appliedLoad) || 0,
      indication: Number(reading),
      errorPrior: result.errorPrior,
      correctedError: result.correctedError,
      mpeLimit: result.mpeLimit,
      verdict: result.verdict,
      source,
    };
    return { result, observation };
  };

  const addReading = async (opts = {}) => {
    const { elapsedSeconds } = opts;
    if (!reading.trim() || Number.isNaN(Number(reading))) return;
    const evaluated = evaluateReading();
    const next = [...readings, reading.trim()];
    const nextObservations = evaluated
      ? [...observations, { ...evaluated.observation, elapsedSeconds }]
      : observations;
    let nextCreep = creepReadings;
    if (typeof elapsedSeconds === 'number' && evaluated) {
      nextCreep = [
        ...creepReadings,
        {
          elapsedSeconds,
          value: reading.trim(),
          verdict: evaluated.result.verdict,
          correctedError: evaluated.result.correctedError,
        },
      ];
      setCreepReadings(nextCreep);
    }
    setReadings(next);
    setObservations(nextObservations);
    setReading('');
    persist(moduleIndex, next, nextObservations, session.driftFlag, nextCreep, creepTimer);
    if (session.id && !String(session.id).startsWith('local-') && evaluated) {
      try {
        const moduleKey = ['identification','environment','zero','eccentricity','repeatability','linearity','creep','discrimination','verdict'][moduleIndex];
        const logicalKey = typeof elapsedSeconds === 'number' ? `${moduleKey}-${elapsedSeconds}s` : `${moduleKey}-${next.length}`;
        await api.addObservation(session.id, { module: moduleKey, logical_key: logicalKey, applied_load: String(appliedLoad || '0'), indication: String(evaluated.observation.indication), source });
        setApiError('');
      } catch (err) { setApiError(err.message || 'Server sync failed; observation remains local.'); }
    }
  };

  const next = () => {
    const nextIndex = Math.min(modules.length - 1, moduleIndex + 1);
    setModuleIndex(nextIndex);
    persist(nextIndex);
  };

  const back = () => setModuleIndex(Math.max(0, moduleIndex - 1));

  const liveValidation =
    reading.trim() && !Number.isNaN(Number(reading)) ? evaluateReading()?.result ?? null : null;

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="eyebrow">Active evaluation / EVAL-2026-032</div>
          <h1 className="page-title mt-2">{session.asset || 'Mettler Toledo MS6002S'}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#66837d]">
            <span className="font-mono">SN {session.serial || 'B723814'}</span>
            <span className="h-1 w-1 rounded-full bg-[#9ab0a9]" />
            <span>{session.capacity || '6,200'} {session.unit || 'g'} max</span>
            <span className="h-1 w-1 rounded-full bg-[#9ab0a9]" />
            <span className="flex items-center gap-1.5">
              <span className="status-dot" />
              Local draft
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            size="sm"
            onClick={() => setShowNote(!showNote)}
            data-testid="button-session-note"
          >
            <FileText size={14} />
            Note
          </Button>
          <Button
            variant="quiet"
            size="sm"
            onClick={() => persist(moduleIndex)}
            data-testid="button-save-session"
          >
            <Save size={14} />
            {saved ? 'Saved' : 'Save locally'}
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
            <Button
              size="sm"
              onClick={() => {
                persist(moduleIndex);
                setShowNote(false);
              }}
              data-testid="button-save-note"
            >
              Save note
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[240px_1fr]">
        <aside className="panel h-fit p-4">
          <div className="eyebrow mb-5 px-2">Test modules</div>
          <div>
            {modules.map((module, index) => {
              const active = index === moduleIndex;
              const complete = index < moduleIndex;
              return (
                <button
                  key={module.short}
                  onClick={() => setModuleIndex(index)}
                  className={`module-step flex w-full items-start gap-3 px-2 py-2.5 text-left ${
                    complete ? 'complete' : ''
                  }`}
                  data-testid={`button-module-${index + 1}`}
                >
                  <span
                    className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${
                      active
                        ? 'border-[#c69852] bg-[#17333c] text-[#f3e8d0]'
                        : complete
                        ? 'border-[#2e7568] bg-[#dceee8] text-[#2e7568]'
                        : 'border-[#c9d9d1] bg-[#f4f7f3] text-[#7b9690]'
                    }`}
                  >
                    {complete ? <Check size={14} /> : module.short}
                  </span>
                  <span className="pt-1">
                    <span
                      className={`block text-xs ${
                        active ? 'font-semibold text-[#17333c]' : 'text-[#66837d]'
                      }`}
                    >
                      {module.label}
                    </span>
                    <span className="mt-1 block font-mono text-[9px] text-[#9ab0a9]">
                      {complete ? 'complete' : active ? 'current' : `0${index + 1}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 border-t border-[#d7e0db] px-2 pt-4">
            <div className="flex items-center gap-2 text-[10px] text-[#66837d]">
              <CloudOff size={13} />
              Changes stay on this device
            </div>
          </div>
        </aside>

        <section className="panel min-h-[560px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#d7e0db] px-5 py-4 md:px-7">
            <div>
              <div className="eyebrow">Module {current.short} / {String(modules.length).padStart(2, '0')}</div>
              <h2 className="mt-1 text-xl font-semibold">{current.label}</h2>
            </div>
            <div className="font-mono text-xs text-[#7b9690]">
              {String(moduleIndex + 1).padStart(2, '0')}{' '}
              <span className="text-[#c9d9d1]">/</span> {String(modules.length).padStart(2, '0')}
            </div>
          </div>

          <div className="p-5 md:p-7">
            {moduleIndex === 0 && <IdentificationModule session={session} />}
            {moduleIndex === 1 && (
              <EnvironmentModule
                onDrift={(flag) => {
                  setSession((currentSession) => ({ ...currentSession, driftFlag: flag }));
                  persist(moduleIndex, readings, observations, flag);
                }}
              />
            )}
            {moduleIndex === 2 && (
              <ReadingModule
                title="Zero indication"
                description="Confirm the instrument returns to zero with the platform clear."
                value={reading}
                setValue={setReading}
                appliedLoad={appliedLoad}
                setAppliedLoad={setAppliedLoad}
                source={source}
                setSource={setSource}
                liveValidation={liveValidation}
                readings={readings}
                onAdd={addReading}
                unit={session.unit || 'g'}
                sessionId={session.id}
              />
            )}
            {moduleIndex === 3 && (
              <EccentricityModule
                reading={reading}
                setReading={setReading}
                readings={readings}
                onAdd={addReading}
                unit={session.unit || 'g'}
                liveValidation={liveValidation}
                appliedLoad={appliedLoad}
                setAppliedLoad={setAppliedLoad}
              />
            )}
            {moduleIndex === 4 && (
              <ReadingModule
                title="Repeatability"
                description="Place the reference load centrally and capture three consecutive indications."
                value={reading}
                setValue={setReading}
                appliedLoad={appliedLoad}
                setAppliedLoad={setAppliedLoad}
                source={source}
                setSource={setSource}
                liveValidation={liveValidation}
                readings={readings}
                onAdd={addReading}
                unit={session.unit || 'g'}
                sessionId={session.id}
              />
            )}
            {moduleIndex === 5 && <ReadingModule title="Linearity" description="Capture indications across the selected load points and retain the authoritative server evaluation." value={reading} setValue={setReading} appliedLoad={appliedLoad} setAppliedLoad={setAppliedLoad} source={source} setSource={setSource} liveValidation={liveValidation} readings={readings} onAdd={addReading} unit={session.unit || 'g'} sessionId={session.id} />}
            {moduleIndex === 6 && (
              <CreepModule
                value={reading}
                setValue={setReading}
                appliedLoad={appliedLoad}
                setAppliedLoad={setAppliedLoad}
                source={source}
                setSource={setSource}
                liveValidation={liveValidation}
                unit={session.unit || 'g'}
                creepReadings={creepReadings}
                elapsedMs={creepElapsedMs}
                running={creepTimer.running}
                onStart={startCreepTimer}
                onStop={stopCreepTimer}
                onReset={resetCreepTimer}
                onCapture={(elapsedSeconds) => addReading({ elapsedSeconds })}
              />
            )}
            {moduleIndex === 7 && <ReadingModule title="Discrimination" description="Capture the discrimination check reading and retain the result in the session record." value={reading} setValue={setReading} appliedLoad={appliedLoad} setAppliedLoad={setAppliedLoad} source={source} setSource={setSource} liveValidation={liveValidation} readings={readings} onAdd={addReading} unit={session.unit || 'g'} sessionId={session.id} />}
            {moduleIndex === 8 && (
              <VerdictModule
                readings={readings}
                observations={observations}
                driftFlag={session.driftFlag}
              />
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-[#d7e0db] bg-[#fbfdfb] px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-7">
            <Button
              variant="quiet"
              size="sm"
              onClick={back}
              disabled={moduleIndex === 0}
              data-testid="button-previous-module"
            >
              <ArrowLeft size={14} /> Previous
            </Button>
            <div className="flex items-center gap-3">
              <span className="hidden text-[10px] text-[#7b9690] sm:inline">Saved locally</span>
              <Button size="sm" onClick={async () => {
                if (moduleIndex !== modules.length - 1) return next();
                if (!session.id || String(session.id).startsWith('local-')) { setFinalized(true); return; }
                try { await api.finalize(session.id); setFinalized(true); setApiError(''); } catch (err) { setApiError(err.message || 'Finalize failed.'); }
              }} disabled={finalized} data-testid="button-next-module">
                {finalized ? 'Completed' : moduleIndex === modules.length - 1 ? 'Finalize report' : 'Continue'} <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default ActiveSession;
