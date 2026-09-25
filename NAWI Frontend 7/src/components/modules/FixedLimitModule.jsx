import React, { useState } from 'react';
import { Plus, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import LiveValidationRow from '@/components/LiveValidationRow';

export function FixedLimitModule({
  testType,
  title,
  description,
  clause,
  session = {},
  rows = [],
  onAdd,
  unit = 'g',
  source = 'manual',
  setSource,
}) {
  const [appliedLoad, setAppliedLoad] = useState(testType === 'tilting' ? '0' : '1000');
  const [indication, setIndication] = useState('');
  const [additionalLoad, setAdditionalLoad] = useState('0');
  const [position, setPosition] = useState(testType === 'tilting' ? '1' : null);

  const e = session.verificationScaleInterval || session.verification_scale_interval || '1';

  const handleCapture = () => {
    if (!indication || Number.isNaN(Number(indication))) return;
    onAdd({
      applied_load: String(appliedLoad || '0'),
      indication: String(indication),
      additional_load: String(additionalLoad || '0'),
      zero_error: '0',
      position: position || null,
    });
    setIndication('');
  };

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="max-w-2xl text-sm leading-6 text-[#58746f]">
          {description} ({clause}). The evaluation uses the applicable deviation limits.
        </p>
      </div>

      <div className="rounded-lg border border-[#c9d9d1] bg-[#fbfdfb] p-5 shadow-sm max-w-2xl">
        <div className="grid gap-4 sm:grid-cols-3">
          {testType === 'tilting' && (
            <label>
              <span className="eyebrow">Tilt Orientation</span>
              <select
                value={position || '1'}
                onChange={(e) => setPosition(e.target.value)}
                className="measure-input mt-2 w-full font-mono text-sm"
              >
                <option value="1">Position 1 (Longitudinal 5%)</option>
                <option value="2">Position 2 (Transverse 5%)</option>
              </select>
            </label>
          )}

          <label>
            <span className="eyebrow">Applied Load / {unit}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={appliedLoad}
              onChange={(e) => setAppliedLoad(e.target.value)}
              placeholder="1000"
              className="measure-input mt-2 w-full font-mono text-sm"
              data-testid="input-fixed-applied-load"
            />
          </label>

          <label>
            <span className="eyebrow">Indication / {unit}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={indication}
              onChange={(e) => setIndication(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCapture()}
              placeholder="1000.0"
              className="measure-input mt-2 w-full font-mono text-sm"
              data-testid="input-fixed-indication"
            />
          </label>

          <label>
            <span className="eyebrow">Add. load ΔL / {unit}</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={additionalLoad}
              onChange={(e) => setAdditionalLoad(e.target.value)}
              placeholder="0.0"
              className="measure-input mt-2 w-full font-mono text-sm"
              data-testid="input-fixed-add-load"
            />
          </label>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-[#7b9690]">
          <span>Captured under test conditions</span>
          <span className="font-mono">e = {e} {unit}</span>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={handleCapture}
            disabled={!indication}
            className="button-brass inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-xs font-bold"
            data-testid="button-capture-fixed-reading"
          >
            <Plus size={14} /> Capture Reading
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="max-w-2xl">
          <div className="eyebrow mb-3">Captured Observations ({rows.length})</div>
          <div className="divide-y divide-[#e5ece8] rounded-lg border border-[#d7e0db] bg-white overflow-hidden">
            {rows.map((r, index) => (
              <div key={r.id || index} className="p-4 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-[#17333c]">
                    {r.position ? `Position ${r.position} · ` : ''}Load: {r.applied_load} {unit} · Indication: {r.indication} {unit}
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-[#66837d]">
                    Corrected error = {r.corrected_error} {unit} · Limit = ±{r.mpe_limit} {unit} · Seq #{r.sequence_no ?? index}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${
                    r.verdict === 'PASS' ? 'bg-[#dceee8] text-[#2e7568]' : 'bg-[#fdeceb] text-[#b24b43]'
                  }`}
                >
                  {r.verdict}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FixedLimitModule;
