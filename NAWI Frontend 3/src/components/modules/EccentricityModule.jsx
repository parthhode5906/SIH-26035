import React from 'react';
import { Plus } from 'lucide-react';
import LiveValidationRow from '@/components/LiveValidationRow';

export function EccentricityModule({
  reading,
  setReading,
  readings = [],
  onAdd,
  unit = 'g',
  liveValidation,
  appliedLoad,
  setAppliedLoad,
}) {
  const positions = ['Center', 'A', 'B', 'C', 'D'];

  return (
    <div className="animate-rise">
      <p className="max-w-xl text-sm leading-6 text-[#58746f]">
        Apply the test load successively at the center and four peripheral positions. The greatest difference will be compared against the maximum permissible error.
      </p>

      <div className="mt-7 grid gap-6 lg:grid-cols-[210px_1fr]">
        <div className="grid-paper relative mx-auto aspect-square w-full max-w-[210px] rounded-lg border border-[#c9d9d1] bg-[#f8fbf8]">
          <div className="absolute inset-[24%] grid place-items-center rounded-full border border-dashed border-[#9dbbb2]">
            <span className="font-mono text-[9px] uppercase tracking-wider text-[#7b9690]">load</span>
          </div>
          {positions.map((position, index) => (
            <div
              key={position}
              className={`absolute grid h-8 w-8 place-items-center rounded-full border text-[10px] font-semibold ${
                index === 0
                  ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 border-[#c69852] bg-[#fbf4e4] text-[#92713a]'
                  : index === 1
                  ? 'left-3 top-3 border-[#c9d9d1] bg-white text-[#66837d]'
                  : index === 2
                  ? 'right-3 top-3 border-[#c9d9d1] bg-white text-[#66837d]'
                  : index === 3
                  ? 'bottom-3 right-3 border-[#c9d9d1] bg-white text-[#66837d]'
                  : 'bottom-3 left-3 border-[#c9d9d1] bg-white text-[#66837d]'
              }`}
            >
              {position === 'Center' ? 'C' : position}
            </div>
          ))}
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="eyebrow">Position readings</div>
            <span className="font-mono text-[10px] text-[#7b9690]">{readings.length} / 5 captured</span>
          </div>

          <div className="rounded-lg border border-[#d7e0db] bg-[#fbfdfb] p-4">
            <div className="grid gap-3 sm:grid-cols-[.65fr_1fr_auto]">
              <label>
                <span className="eyebrow">Applied load</span>
                <input
                  type="number"
                  value={appliedLoad}
                  onChange={(e) => setAppliedLoad(e.target.value)}
                  className="measure-input mt-2 w-full"
                />
              </label>
              <label>
                <span className="eyebrow">Position indication / {unit}</span>
                <input
                  value={reading}
                  onChange={(e) => setReading(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onAdd()}
                  inputMode="decimal"
                  placeholder="0.000"
                  className="measure-input mt-2 w-full"
                  aria-label="Eccentricity reading"
                  data-testid="input-eccentricity-reading"
                />
              </label>
              <button
                onClick={onAdd}
                className="button-brass self-end rounded-md px-4 py-3 text-xs font-bold"
                data-testid="button-capture-eccentricity"
              >
                <Plus size={15} />
              </button>
            </div>
            {liveValidation && <LiveValidationRow evaluation={liveValidation} unit={unit} />}
          </div>

          <div className="mt-4 grid grid-cols-5 gap-2">
            {['C', 'A', 'B', 'C', 'D'].map((position, index) => (
              <div
                key={`${position}-${index}`}
                className={`rounded border p-2 text-center ${
                  readings[index] ? 'border-[#9bc8bb] bg-[#eaf4ef]' : 'border-[#d7e0db]'
                }`}
              >
                <div className="font-mono text-[9px] text-[#7b9690]">
                  {position}{index === 0 ? ' · center' : ''}
                </div>
                <div className="mt-1 font-mono text-xs font-bold text-[#33545a]">
                  {readings[index] || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EccentricityModule;
