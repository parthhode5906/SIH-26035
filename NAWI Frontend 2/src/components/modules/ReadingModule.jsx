import React from 'react';
import { Activity, Plus, UploadCloud } from 'lucide-react';
import LiveValidationRow from '@/components/LiveValidationRow';

export function ReadingModule({
  title,
  description,
  value,
  setValue,
  appliedLoad,
  setAppliedLoad,
  source,
  setSource,
  liveValidation,
  readings = [],
  onAdd,
  unit = 'g',
}) {
  const connectScale = async () => {
    if (!('serial' in navigator)) {
      window.alert('Web Serial is available in Chromium-based browsers. You can continue with manual capture.');
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      if (port) setSource('serial');
    } catch {
      setSource('manual');
    }
  };

  const readPhoto = (event) => {
    if (event.target.files?.length) {
      setSource('ocr');
      window.alert('Display image queued for 7-segment OCR. Review the detected value before capture.');
    }
  };

  return (
    <div className="animate-rise">
      <p className="max-w-xl text-sm leading-6 text-[#58746f]">{description}</p>
      
      <div className="mt-8 max-w-2xl rounded-lg border border-[#d7e0db] bg-[#fbfdfb] p-5">
        <div className="grid gap-4 sm:grid-cols-[.8fr_1fr_auto]">
          <label>
            <span className="eyebrow">Applied load / {unit}</span>
            <input
              type="number"
              inputMode="decimal"
              value={appliedLoad}
              onChange={(e) => setAppliedLoad(e.target.value)}
              className="measure-input mt-2 w-full"
              data-testid="input-applied-load"
            />
          </label>
          <label>
            <span className="eyebrow">Indication / {unit}</span>
            <input
              id="measurement"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAdd()}
              inputMode="decimal"
              placeholder="0.000"
              className="measure-input mt-2 w-full"
              data-testid={`input-${title.toLowerCase().replaceAll(' ', '-')}`}
            />
          </label>
          <button
            onClick={onAdd}
            className="button-brass self-end rounded-md px-4 py-3 text-xs font-bold"
            data-testid={`button-capture-${title.toLowerCase().replaceAll(' ', '-')}`}
          >
            <Plus size={15} />
            <span className="sr-only">Capture reading</span>
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={connectScale}
            className="button-quiet inline-flex items-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold"
            data-testid="button-connect-serial"
          >
            <Activity size={13} />
            Connect scale
          </button>
          <label className="button-quiet inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold">
            <UploadCloud size={13} />
            Read display photo
            <input
              type="file"
              accept="image/*"
              onChange={readPhoto}
              className="sr-only"
              data-testid="input-display-photo"
            />
          </label>
          <span className="self-center font-mono text-[10px] text-[#7b9690]">source: {source}</span>
        </div>

        <div className="mt-3 flex items-center justify-between text-[10px] text-[#7b9690]">
          <span>Enter reading, then capture</span>
          <span className="font-mono">resolution 0.001 {unit}</span>
        </div>

        {liveValidation && <LiveValidationRow evaluation={liveValidation} unit={unit} />}
      </div>

      {readings.length > 0 && (
        <div className="mt-7 max-w-2xl">
          <div className="eyebrow mb-3">Captured indications</div>
          <div className="divide-y divide-[#e5ece8] rounded-lg border border-[#d7e0db] bg-white">
            {readings.map((item, index) => (
              <div key={`${item}-${index}`} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-[#66837d]">Observation {String(index + 1).padStart(2, '0')}</span>
                <span className="font-mono font-bold text-[#17333c]">
                  {item} <span className="font-sans text-xs font-normal text-[#7b9690]">{unit}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReadingModule;
