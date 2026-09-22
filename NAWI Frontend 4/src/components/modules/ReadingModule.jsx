import React, { useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Loader2, Plus, UploadCloud, XCircle } from 'lucide-react';
import LiveValidationRow from '@/components/LiveValidationRow';
import { api } from '@/api/client';
import { queueOutbox } from '@/lib/offlineStore';

// Most bench scales that expose a serial/USB-serial interface stream plain
// ASCII lines like "ST,GS,+001234g\r\n" or just "1234.5\r\n". We don't know
// the exact protocol for every instrument, so we pull the first signed
// decimal number out of each line — that covers the common cases without
// requiring a driver per scale model.
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/;

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
  sessionId,
}) {
  const [connection, setConnection] = useState({ status: 'idle', message: '' });
  const [lastLine, setLastLine] = useState('');
  const [uploadState, setUploadState] = useState({ status: 'idle', message: '' });
  const portRef = useRef(null);
  const readerRef = useRef(null);
  const keepReadingRef = useRef(false);

  const disconnectScale = async () => {
    keepReadingRef.current = false;
    try {
      await readerRef.current?.cancel();
    } catch {
      // reader already gone — fine
    }
    try {
      readerRef.current?.releaseLock();
    } catch {
      // already released
    }
    try {
      await portRef.current?.close();
    } catch {
      // already closed
    }
    portRef.current = null;
    readerRef.current = null;
    setConnection({ status: 'idle', message: '' });
    if (source === 'serial') setSource('manual');
  };

  useEffect(() => () => { keepReadingRef.current = false; readerRef.current?.cancel().catch(() => {}); }, []);

  const runReadLoop = async (port) => {
    const textStream = port.readable.pipeThrough(new TextDecoderStream());
    const reader = textStream.getReader();
    readerRef.current = reader;
    let buffer = '';
    try {
      while (keepReadingRef.current) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buffer += chunk;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          setLastLine(trimmed);
          const match = trimmed.match(NUMBER_PATTERN);
          if (match) {
            setValue(match[0]);
          }
        }
      }
    } catch (err) {
      if (keepReadingRef.current) {
        setConnection({ status: 'error', message: err.message || 'Serial connection dropped.' });
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
    }
  };

  const connectScale = async () => {
    if (connection.status === 'connected') {
      await disconnectScale();
      return;
    }
    if (!('serial' in navigator)) {
      window.alert('Web Serial is available in Chromium-based browsers. You can continue with manual capture.');
      return;
    }
    try {
      setConnection({ status: 'connecting', message: '' });
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      portRef.current = port;
      keepReadingRef.current = true;
      setSource('serial');
      setConnection({ status: 'connected', message: '' });
      runReadLoop(port);
    } catch (err) {
      keepReadingRef.current = false;
      setSource('manual');
      setConnection({ status: 'error', message: err.message || 'Could not open the serial port.' });
    }
  };

  const readPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSource('ocr');
    const isSyncedSession = sessionId && !String(sessionId).startsWith('local-');
    if (!isSyncedSession) {
      setUploadState({ status: 'error', message: 'Sync this session to the server before attaching photos.' });
      event.target.value = '';
      return;
    }
    setUploadState({ status: 'uploading', message: '' });
    try {
      await api.upload(sessionId, file);
      setUploadState({ status: 'uploaded', message: file.name });
    } catch (err) {
      try {
        await queueOutbox({ kind: 'attachment', sessionId, file, addedAt: Date.now() });
        setUploadState({ status: 'queued', message: 'Will upload once the connection returns.' });
      } catch {
        setUploadState({ status: 'error', message: err.message || 'Upload failed.' });
      }
    } finally {
      event.target.value = '';
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

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={connectScale}
            className="button-quiet inline-flex items-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold"
            data-testid="button-connect-serial"
          >
            {connection.status === 'connecting' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Activity size={13} className={connection.status === 'connected' ? 'text-[#2e7568]' : ''} />
            )}
            {connection.status === 'connected'
              ? 'Disconnect scale'
              : connection.status === 'connecting'
              ? 'Connecting…'
              : 'Connect scale'}
          </button>
          <label className="button-quiet inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-[11px] font-semibold">
            {uploadState.status === 'uploading' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <UploadCloud size={13} />
            )}
            Read display photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={readPhoto}
              className="sr-only"
              data-testid="input-display-photo"
            />
          </label>
          <span className="self-center font-mono text-[10px] text-[#7b9690]">source: {source}</span>
        </div>

        {connection.status === 'connected' && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-[#9bc8bb] bg-[#eaf4ef] px-3 py-2 text-[10px] text-[#2e7568]">
            <span className="status-dot" />
            Live from serial{lastLine ? ` · last line: ${lastLine}` : ' · waiting for data…'}
          </div>
        )}
        {connection.status === 'error' && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-[#e7b5ae] bg-[#fff5f3] px-3 py-2 text-[10px] text-[#a6423b]">
            <XCircle size={13} />
            {connection.message}
          </div>
        )}
        {uploadState.status !== 'idle' && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-md border px-3 py-2 text-[10px] ${
              uploadState.status === 'error'
                ? 'border-[#e7b5ae] bg-[#fff5f3] text-[#a6423b]'
                : uploadState.status === 'uploaded'
                ? 'border-[#9bc8bb] bg-[#eaf4ef] text-[#2e7568]'
                : 'border-[#e3cf9c] bg-[#fbf4e4] text-[#92713a]'
            }`}
          >
            {uploadState.status === 'uploaded' ? (
              <CheckCircle2 size={13} />
            ) : uploadState.status === 'uploading' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <UploadCloud size={13} />
            )}
            {uploadState.status === 'uploaded'
              ? `Uploaded ${uploadState.message}`
              : uploadState.status === 'uploading'
              ? 'Uploading display photo…'
              : uploadState.message}
          </div>
        )}

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
