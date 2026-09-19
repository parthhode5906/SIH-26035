import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, Search } from 'lucide-react';
import SectionHeader from '@/components/SectionHeader';
import Button from '@/components/Button';
import { api } from '@/api/client';

const EMPTY_FORM = {
  asset: '',
  serial: '',
  min_capacity: '0',
  max_capacity: '',
  unit: 'g',
  accuracy_class: 'III',
  e: '1',
  d: '1',
};

// Numeric fields sometimes arrive with thousands separators from copy/paste
// ("6,200") — strip those before they hit the server as a bad decimal string.
const cleanNumber = (value) => String(value ?? '').replaceAll(',', '').trim();

export default function Registry() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [justRegistered, setJustRegistered] = useState('');

  const load = () => {
    api
      .instruments(q)
      .then((rows) => {
        setItems(rows);
        setLoadError('');
      })
      .catch((err) => setLoadError(err.message || 'Could not load the instrument registry.'));
  };

  useEffect(load, [q]);

  const field = (key, label, opts = {}) => (
    <label key={key}>
      <span className="eyebrow">{label}</span>
      <input
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        type={opts.type || 'text'}
        inputMode={opts.inputMode}
        className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#c69852]"
        data-testid={`input-instrument-${key.replaceAll('_', '-')}`}
      />
    </label>
  );

  const validate = () => {
    if (!form.asset.trim()) return 'Instrument / model is required.';
    if (!form.serial.trim()) return 'Serial number is required.';
    const maxCap = Number(cleanNumber(form.max_capacity));
    if (!form.max_capacity || Number.isNaN(maxCap) || maxCap <= 0) return 'Maximum capacity must be a positive number.';
    const eVal = Number(cleanNumber(form.e));
    if (!form.e || Number.isNaN(eVal) || eVal <= 0) return 'Verification interval (e) must be a positive number.';
    const dVal = Number(cleanNumber(form.d));
    if (!form.d || Number.isNaN(dVal) || dVal <= 0) return 'Scale interval (d) must be a positive number.';
    return '';
  };

  const submit = async () => {
    const problem = validate();
    if (problem) {
      setSubmitError(problem);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        asset: form.asset.trim(),
        serial: form.serial.trim(),
        min_capacity: cleanNumber(form.min_capacity) || '0',
        max_capacity: cleanNumber(form.max_capacity),
        unit: form.unit,
        accuracy_class: form.accuracy_class,
        e: cleanNumber(form.e),
        d: cleanNumber(form.d),
      };
      const created = await api.createInstrument(payload);
      setJustRegistered(created?.serial || payload.serial);
      setForm(EMPTY_FORM);
      setShow(false);
      load();
      window.setTimeout(() => setJustRegistered(''), 4000);
    } catch (err) {
      setSubmitError(err.message || 'Registration failed. Check the fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <SectionHeader
        eyebrow="Reference / Registry"
        title="Instrument registry."
        detail="Validated instrument DNA is stored server-side before an evaluation can use it."
        action={
          <Button
            onClick={() => {
              setSubmitError('');
              setShow(!show);
            }}
            data-testid="button-toggle-registration-form"
          >
            <Plus size={16} /> Register instrument
          </Button>
        }
      />

      {justRegistered && (
        <div className="panel mb-6 flex items-center gap-2 border-[#9bc8bb] bg-[#eaf4ef] p-4 text-xs text-[#2e7568]">
          <CheckCircle2 size={15} />
          Instrument {justRegistered} registered and validated.
        </div>
      )}

      {show && (
        <section className="panel mb-6 p-5 md:p-7">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {field('asset', 'Instrument / model')}
            {field('serial', 'Serial number')}
            {field('min_capacity', 'Minimum capacity', { type: 'number', inputMode: 'decimal' })}
            {field('max_capacity', 'Maximum capacity', { type: 'number', inputMode: 'decimal' })}
            <label>
              <span className="eyebrow">Unit</span>
              <select
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
                className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-white px-3 py-2.5 text-sm"
                data-testid="select-instrument-unit"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="mg">mg</option>
              </select>
            </label>
            <label>
              <span className="eyebrow">Class</span>
              <select
                value={form.accuracy_class}
                onChange={(e) => setForm({ ...form, accuracy_class: e.target.value })}
                className="mt-2 w-full rounded-md border border-[#c9d9d1] bg-white px-3 py-2.5 text-sm"
                data-testid="select-instrument-accuracy-class"
              >
                <option value="I">I</option>
                <option value="II">II</option>
                <option value="III">III</option>
                <option value="IIII">IIII</option>
              </select>
            </label>
            {field('e', 'Verification interval (e)', { type: 'number', inputMode: 'decimal' })}
            {field('d', 'Scale interval (d)', { type: 'number', inputMode: 'decimal' })}
          </div>

          {submitError && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-[#e7b5ae] bg-[#fff5f3] px-3 py-2.5 text-xs text-[#a6423b]">
              <AlertTriangle size={14} />
              {submitError}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="quiet" onClick={() => setShow(false)} data-testid="button-cancel-registration">
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting} data-testid="button-submit-registration">
              {submitting ? <Loader2 size={15} className="animate-spin" /> : null}
              {submitting ? 'Validating…' : 'Validate & register'}
            </Button>
          </div>
        </section>
      )}

      <div className="mb-5 relative max-w-xs">
        <Search className="absolute left-3 top-3 text-[#7b9690]" size={15} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search instruments…"
          className="w-full rounded-md border border-[#c9d9d1] bg-white py-2.5 pl-9 pr-3 text-xs"
          data-testid="input-registry-search"
        />
      </div>

      {loadError && (
        <div className="panel mb-5 flex items-center gap-2 border-[#e7b5ae] bg-[#fff5f3] p-4 text-xs text-[#a6423b]">
          <AlertTriangle size={14} />
          {loadError}
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="mobile-scroll">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-[#d7e0db] text-[10px] uppercase tracking-[.12em] text-[#7b9690]">
                <th className="px-5 py-4">Instrument</th>
                <th className="px-5 py-4">Serial</th>
                <th className="px-5 py-4">Capacity</th>
                <th className="px-5 py-4">Class</th>
                <th className="px-5 py-4">n Max</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="table-row border-b border-[#e5ece8]">
                  <td className="px-5 py-4 font-semibold text-[#33545a]">{i.asset}</td>
                  <td className="px-5 py-4 font-mono">{i.serial}</td>
                  <td className="px-5 py-4">
                    {i.capacity ?? i.max_capacity} {i.unit}
                  </td>
                  <td className="px-5 py-4">Class {i.accuracy_class}</td>
                  <td className="px-5 py-4 font-mono">{i.n_max}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!items.length && !loadError && (
          <div className="p-10 text-center text-xs text-[#66837d]">No registered instruments.</div>
        )}
      </section>
    </div>
  );
}
