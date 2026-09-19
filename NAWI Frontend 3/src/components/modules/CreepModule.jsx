import React from 'react';
import { Pause, Play, Plus, RotateCcw } from 'lucide-react';
import LiveValidationRow from '@/components/LiveValidationRow';

// Standard OIML R76 creep-test checkpoints: capture a reading soon after
// loading, then at increasing intervals so drift over time is visible.
const CHECKPOINTS_SECONDS = [30, 60, 120, 180, 240, 300, 1800];

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatCheckpoint(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs === 0 ? `${minutes}:00` : `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function CreepModule({
  value,
  setValue,
  appliedLoad,
  setAppliedLoad,
  source,
  setSource,
  liveValidation,
  unit = 'g',
  creepReadings = [],
  elapsedMs = 0,
  running = false,
  onStart,
  onStop,
  onReset,
  onCapture,
}) {
  const nearestCapturedCheckpoint = (targetSeconds) =>
    creepReadings.some((r) => Math.abs(r.elapsedSeconds - targetSeconds) <= 5);

  const first = creepReadings[0];
  const last = creepReadings[creepReadings.length - 1];
  const drift = first && last && creepReadings.length > 1 ? Number(last.value) - Number(first.value) : null;

  return (
    <div className="animate-rise">
      <p className="max-w-xl text-sm leading-6 text-[#58746f]">
        Apply the test load once and hold it in place. Capture the indication at the start and again at each
        checkpoint below to measure how much the reading drifts over time.
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-4 rounded-lg border border-[#d7e0db] bg-[#fbfdfb] p-5">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full border border-[#c9d9d1] bg-white">
          <span className={`h-2.5 w-2.5 rounded-full ${running ? 'bg-[#2e7568] animate-pulse' : 'bg-[#c9d9d1]'}`} />
        </div>
        <div>
          <div className="eyebrow">Elapsed time</div>
          <div className="font-mono text-3xl tracking-tight text-[#17333c]" data-testid="text-creep-elapsed">
            {formatElapsed(elapsedMs)}
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          {!running ? (
            <button
              onClick={onStart}
              className="button-brass inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-bold"
              data-testid="button-start-creep-timer"
            >
              <Play size={14} /> {elapsedMs > 0 ? 'Resume timer' : 'Start creep timer'}
            </button>
          ) : (
            <button
              onClick={onStop}
              className="button-quiet inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-semibold"
              data-testid="button-stop-creep-timer"
            >
              <Pause size={14} /> Stop timer
            </button>
          )}
          <button
            onClick={onReset}
            className="button-quiet inline-flex items-center gap-2 rounded-md px-3 py-2.5 text-xs font-semibold"
            title="Reset timer (keeps captured readings)"
            data-testid="button-reset-creep-timer"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {CHECKPOINTS_SECONDS.map((checkpoint) => {
          const captured = nearestCapturedCheckpoint(checkpoint);
          const due = !captured && running && elapsedMs / 1000 >= checkpoint;
          return (
            <span
              key={checkpoint}
              className={`rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                captured
                  ? 'border-[#9bc8bb] bg-[#eaf4ef] text-[#2e7568]'
                  : due
                  ? 'border-[#e3cf9c] bg-[#fbf4e4] text-[#92713a]'
                  : 'border-[#d7e0db] text-[#7b9690]'
              }`}
            >
              {formatCheckpoint(checkpoint)} {captured ? '✓' : due ? '· due' : ''}
            </span>
          );
        })}
      </div>

      <div className="mt-6 max-w-2xl rounded-lg border border-[#d7e0db] bg-[#fbfdfb] p-5">
        <div className="grid gap-4 sm:grid-cols-[.8fr_1fr_auto]">
          <label>
            <span className="eyebrow">Applied load / {unit}</span>
            <input
              type="number"
              inputMode="decimal"
              value={appliedLoad}
              onChange={(e) => setAppliedLoad(e.target.value)}
              className="measure-input mt-2 w-full"
              data-testid="input-creep-applied-load"
            />
          </label>
          <label>
            <span className="eyebrow">Indication / {unit}</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onCapture(Math.round(elapsedMs / 1000))}
              inputMode="decimal"
              placeholder="0.000"
              className="measure-input mt-2 w-full"
              data-testid="input-creep-reading"
            />
          </label>
          <button
            onClick={() => onCapture(Math.round(elapsedMs / 1000))}
            className="button-brass self-end rounded-md px-4 py-3 text-xs font-bold"
            data-testid="button-capture-creep"
          >
            <Plus size={15} />
            <span className="sr-only">Capture creep reading</span>
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] text-[#7b9690]">
          <span>Captures the reading at the current elapsed time ({formatElapsed(elapsedMs)})</span>
          <span className="font-mono">source: {source}</span>
        </div>
        {liveValidation && <LiveValidationRow evaluation={liveValidation} unit={unit} />}
      </div>

      {creepReadings.length > 0 && (
        <div className="mt-7 max-w-2xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="eyebrow">Timestamped captures</div>
            {drift !== null && (
              <span className="font-mono text-[10px] text-[#66837d]" data-testid="text-creep-drift">
                Drift {drift >= 0 ? '+' : ''}
                {drift.toFixed(3)} {unit}
              </span>
            )}
          </div>
          <div className="divide-y divide-[#e5ece8] rounded-lg border border-[#d7e0db] bg-white">
            {creepReadings.map((item, index) => (
              <div key={`${item.elapsedSeconds}-${index}`} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-mono text-xs text-[#66837d]">{formatElapsed(item.elapsedSeconds * 1000)}</span>
                <span className="font-mono font-bold text-[#17333c]">
                  {item.value} <span className="font-sans text-xs font-normal text-[#7b9690]">{unit}</span>
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.verdict === 'PASS' ? 'bg-[#dceee8] text-[#2e7568]' : 'bg-[#f7dfdc] text-[#b24b43]'
                  }`}
                >
                  {item.verdict}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default CreepModule;
