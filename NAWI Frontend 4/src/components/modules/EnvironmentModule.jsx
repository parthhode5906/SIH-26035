import React, { useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Loader2, Save, Thermometer } from 'lucide-react';
import { EnvironmentCard } from '@/components/Card';

// Real lab/environment capture — every value here is typed in by the
// technician and persisted to the session on the backend (PATCH
// /sessions/{id}), read back via the backend's own drift-watchdog
// (GET /sessions/{id}/drift). Nothing on this screen is simulated.
export function EnvironmentModule({
  values,
  setValues,
  onSave,
  saving,
  saveState,
  driftInfo,
  driftLoading,
}) {
  const [touched, setTouched] = useState(false);

  const field = (key, label, unit, step = '0.1') => (
    <label>
      <span className="eyebrow">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          step={step}
          inputMode="decimal"
          value={values[key]}
          onChange={(e) => {
            setTouched(true);
            setValues({ ...values, [key]: e.target.value });
          }}
          className="measure-input w-full"
          data-testid={`input-env-${key}`}
        />
        <span className="font-mono text-xs text-[#7b9690]">{unit}</span>
      </div>
    </label>
  );

  return (
    <div className="animate-rise">
      <p className="max-w-xl text-sm leading-6 text-[#58746f]">
        Record the laboratory conditions for this evaluation. Values are saved to the session record and checked
        against the drift limit by the backend.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {field('start_temp_c', 'Start temperature', '°C')}
        {field('end_temp_c', 'End temperature', '°C')}
        {field('humidity_pct', 'Relative humidity', '% RH')}
        {field('pressure_hpa', 'Air pressure', 'hPa', '1')}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="button-brass inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-bold"
          data-testid="button-save-environment"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save conditions
        </button>
        {saveState === 'saved' && (
          <span className="flex items-center gap-1.5 text-xs text-[#2e7568]">
            <CheckCircle2 size={14} /> Saved to session
          </span>
        )}
        {saveState === 'queued' && (
          <span className="flex items-center gap-1.5 text-xs text-[#92713a]">
            <Activity size={14} /> Offline — queued, will sync automatically
          </span>
        )}
        {saveState === 'error' && (
          <span className="flex items-center gap-1.5 text-xs text-[#a6423b]">
            <AlertTriangle size={14} /> Could not save — check the connection
          </span>
        )}
        {touched && !saveState && <span className="text-[10px] text-[#9ab0a9]">Unsaved changes</span>}
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <EnvironmentCard label="Start temperature" value={values.start_temp_c || '—'} unit="°C" range="20–23 °C" icon={Thermometer} />
        <EnvironmentCard label="End temperature" value={values.end_temp_c || '—'} unit="°C" range="within drift limit" icon={Thermometer} />
        <EnvironmentCard label="Humidity" value={values.humidity_pct || '—'} unit="% RH" range="35–60 % RH" icon={Activity} />
      </div>

      <div
        className={`mt-7 rounded-lg border p-4 text-xs ${
          driftInfo?.level === 'warn'
            ? 'border-[#e7b5ae] bg-[#fff5f3] text-[#a6423b]'
            : 'border-[#c9d9d1] bg-[#f8fbf8] text-[#66837d]'
        }`}
      >
        {driftLoading ? (
          <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Checking drift against the backend watchdog…</span>
        ) : driftInfo ? (
          <>
            <AlertTriangle size={14} className={`mr-2 inline ${driftInfo.level === 'warn' ? 'text-[#b24b43]' : 'text-[#2e7568]'}`} />
            {driftInfo.deltaC !== null ? `Δ ${driftInfo.deltaC} °C` : 'Drift checked'}
            {driftInfo.allowedDrift !== null ? ` — allowed drift is ${driftInfo.allowedDrift} for this instrument.` : '.'}{' '}
            {driftInfo.level === 'warn' ? 'This exceeds the session limit and is flagged for review.' : 'Within the recommended operating range.'}
          </>
        ) : (
          'Save a start and end temperature to get a drift reading from the backend.'
        )}
      </div>
    </div>
  );
}

export default EnvironmentModule;
