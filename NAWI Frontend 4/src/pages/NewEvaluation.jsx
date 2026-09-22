import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowLeft, ArrowRight, Check, LockKeyhole, Search } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import { saveWorkingSession, queueOutbox } from '@/lib/offlineStore';
import { TEST_MODULES } from '@/lib/requirements';
import { api } from '@/api/client';

const cleanNumber = (value) => String(value ?? '').replaceAll(',', '').trim();

export function NewEvaluation() {
  const [, setLocation] = useLocation();
  const [manufacturer, setManufacturer] = useState('Mettler Toledo');
  const [model, setModel] = useState('MS6002S');
  const [serial, setSerial] = useState('B723814');
  const [minCapacity, setMinCapacity] = useState('0');
  const [capacity, setCapacity] = useState('6200');
  const [unit, setUnit] = useState('g');
  const [accuracyClass, setAccuracyClass] = useState('III');
  const [verificationScaleInterval, setVerificationScaleInterval] = useState('1');
  const [displayInterval, setDisplayInterval] = useState('1');
  const [operatorNote, setOperatorNote] = useState('');

  const start = async () => {
    // Field names here match InstrumentDto exactly: manufacturer, model,
    // serial_number, accuracy_class, max_capacity, min_capacity,
    // verification_scale_interval, display_interval, base_unit.
    const instrumentPayload = {
      manufacturer,
      model,
      serial_number: serial,
      min_capacity: cleanNumber(minCapacity) || '0',
      max_capacity: cleanNumber(capacity),
      base_unit: unit,
      accuracy_class: accuracyClass,
      verification_scale_interval: String(verificationScaleInterval),
      display_interval: String(displayInterval || verificationScaleInterval),
    };
    const localSessionFields = {
      asset: `${manufacturer} ${model}`.trim(),
      model,
      manufacturer,
      serial,
      capacity,
      unit,
      accuracyClass,
      verificationScaleInterval: String(verificationScaleInterval),
      operatorNote,
      progress: 16,
      startedAt: new Date().toISOString(),
      observations: [],
    };

    try {
      const existing = (await api.instruments(serial)).find((item) => item.serial_number === serial);
      const instrument = existing || (await api.createInstrument(instrumentPayload));
      const serverSession = await api.createSession({ instrument_id: instrument.id });
      const nextSession = { ...serverSession, ...localSessionFields, id: serverSession.id, instrumentId: instrument.id, synced: true };
      localStorage.setItem('nawi-session', JSON.stringify(nextSession));
      saveWorkingSession(nextSession);
      setLocation('/sessions/active');
    } catch (err) {
      // Offline or the server rejected the request — keep working locally
      // and queue the real creation so it happens automatically once the
      // connection returns (see lib/sync.js "session" outbox handling).
      const localId = `local-${Date.now()}`;
      const nextSession = { ...localSessionFields, id: localId, pendingCreate: true };
      localStorage.setItem('nawi-session', JSON.stringify(nextSession));
      saveWorkingSession(nextSession);
      await queueOutbox({ kind: 'session', localId, payload: { instrument: instrumentPayload } });
      setLocation('/sessions/active');
    }
  };

  return (
    <div>
      <SectionHeader
        eyebrow="New record / 01"
        title="Set up an evaluation."
        detail="Create the working record before you place the test load. All fields can be amended until the report is sealed."
        action={
          <Link href="/dashboard" className="button-quiet inline-flex items-center gap-2 rounded-md px-4 py-3 text-sm font-semibold" data-testid="link-cancel-evaluation">
            <ArrowLeft size={15} /> Back to overview
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
        <section className="panel p-5 md:p-7">
          <div className="eyebrow">Instrument profile</div>
          <h2 className="mt-2 text-lg font-semibold">What are you testing?</h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Manufacturer</span>
              <input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} className="w-full rounded-md border border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 text-sm text-[#17333c] outline-none transition focus:border-[#c69852]" data-testid="input-manufacturer" />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Model</span>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-[#7b9690]" size={16} />
                <input value={model} onChange={(e) => setModel(e.target.value)} className="w-full rounded-md border border-[#c9d9d1] bg-[#fbfdfb] py-3 pl-10 pr-3 text-sm text-[#17333c] outline-none transition focus:border-[#c69852]" data-testid="input-model" />
              </div>
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Serial number</span>
              <input value={serial} onChange={(e) => setSerial(e.target.value)} className="w-full rounded-md border border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 font-mono text-sm outline-none transition focus:border-[#c69852]" data-testid="input-serial" />
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Minimum capacity</span>
              <div className="flex">
                <input value={minCapacity} onChange={(e) => setMinCapacity(e.target.value)} className="min-w-0 flex-1 rounded-l-md border border-r-0 border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 font-mono text-sm outline-none focus:border-[#c69852]" data-testid="input-min-capacity" />
                <span className="grid place-items-center rounded-r-md border border-[#c9d9d1] bg-[#edf4ef] px-3 font-mono text-xs text-[#66837d]">{unit}</span>
              </div>
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Maximum capacity</span>
              <div className="flex">
                <input value={capacity} onChange={(e) => setCapacity(e.target.value)} className="min-w-0 flex-1 rounded-l-md border border-r-0 border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 font-mono text-sm outline-none focus:border-[#c69852]" data-testid="input-capacity" />
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="rounded-r-md border border-[#c9d9d1] bg-[#edf4ef] px-3 text-sm font-semibold text-[#33545a] outline-none" data-testid="select-unit">
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="mg">mg</option>
                </select>
              </div>
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Accuracy class</span>
              <select value={accuracyClass} onChange={(e) => setAccuracyClass(e.target.value)} className="w-full rounded-md border border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 text-sm font-semibold text-[#33545a] outline-none focus:border-[#c69852]" data-testid="select-accuracy-class">
                <option value="I">Class I (Special)</option>
                <option value="II">Class II (High)</option>
                <option value="III">Class III (Medium)</option>
                <option value="IIII">Class IIII (Ordinary)</option>
              </select>
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Verification interval (e)</span>
              <div className="flex">
                <input type="number" min="0.001" step="any" value={verificationScaleInterval} onChange={(e) => setVerificationScaleInterval(e.target.value)} className="min-w-0 flex-1 rounded-l-md border border-r-0 border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 font-mono text-sm outline-none focus:border-[#c69852]" data-testid="input-verification-interval" />
                <span className="grid place-items-center rounded-r-md border border-[#c9d9d1] bg-[#edf4ef] px-3 font-mono text-xs text-[#66837d]">{unit}</span>
              </div>
            </label>

            <label>
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Scale/display interval (d)</span>
              <div className="flex">
                <input type="number" min="0.001" step="any" value={displayInterval} onChange={(e) => setDisplayInterval(e.target.value)} className="min-w-0 flex-1 rounded-l-md border border-r-0 border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 font-mono text-sm outline-none focus:border-[#c69852]" data-testid="input-display-interval" />
                <span className="grid place-items-center rounded-r-md border border-[#c9d9d1] bg-[#edf4ef] px-3 font-mono text-xs text-[#66837d]">{unit}</span>
              </div>
            </label>

            <label className="sm:col-span-2">
              <span className="mb-2 block text-xs font-semibold text-[#33545a]">Operator note <span className="font-normal text-[#7b9690]">(optional)</span></span>
              <textarea value={operatorNote} onChange={(e) => setOperatorNote(e.target.value)} rows={3} placeholder="Record anything unusual about the setup or instrument condition." className="w-full resize-none rounded-md border border-[#c9d9d1] bg-[#fbfdfb] px-3 py-3 text-sm outline-none placeholder:text-[#9ab0a9] focus:border-[#c69852]" data-testid="input-operator-note" />
            </label>
          </div>

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-[#d7e0db] pt-5 sm:flex-row sm:justify-end">
            <Link href="/dashboard" className="button-quiet rounded-md px-4 py-3 text-center text-sm font-semibold" data-testid="link-cancel-form">Cancel</Link>
            <Button onClick={() => void start()} disabled={!model || !serial} data-testid="button-create-session">
              Create working session <ArrowRight className="ml-2 inline" size={15} />
            </Button>
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel-dark grid-paper p-6">
            <div className="flex items-center gap-2 text-[#c8a96b]">
              <LockKeyhole size={15} />
              <span className="eyebrow !text-[#c8a96b]">Record integrity</span>
            </div>
            <h2 className="mt-5 max-w-sm text-xl font-semibold leading-tight text-[#f4f7f3]">Build the record before the reading.</h2>
            <p className="mt-3 text-sm leading-6 text-[#a5c0b8]">NAWI timestamps your observations, tracks the environment, and preserves every change for the approving officer.</p>
            <div className="mt-7 space-y-3 border-t border-white/10 pt-5 text-xs text-[#c8dbd2]">
              <div className="flex items-center gap-3"><Check size={14} className="text-[#c8a96b]" /> OIML R-76 aligned workflow</div>
              <div className="flex items-center gap-3"><Check size={14} className="text-[#c8a96b]" /> Works without a network — queued and synced automatically</div>
              <div className="flex items-center gap-3"><Check size={14} className="text-[#c8a96b]" /> Sealed report verification</div>
            </div>
          </section>

          <section className="panel p-5">
            <div className="eyebrow">Sequence / {TEST_MODULES.length + 3} modules</div>
            <div className="mt-4 space-y-4">
              {['Identification', 'Environment', ...TEST_MODULES.map((m) => m.label), 'Verdict'].map((label, index) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className={`grid h-7 w-7 place-items-center rounded-full font-mono text-[10px] ${index === 0 ? 'bg-[#17333c] text-[#f4f7f3]' : 'bg-[#e5eee9] text-[#6d8984]'}`}>
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className={index === 0 ? 'font-semibold text-[#33545a]' : 'text-[#7b9690]'}>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default NewEvaluation;
