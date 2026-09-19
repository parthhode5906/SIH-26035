import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export function VerdictModule({ readings = [], observations = [], driftFlag = false }) {
  const failed = observations.some((obs) => obs.verdict === 'FAIL');
  const verdict = failed || driftFlag ? 'FAIL' : 'PASS';
  const maxError = observations.length
    ? Math.max(...observations.map((obs) => Math.abs(obs.correctedError)))
    : 0.7;
  const limit = observations.length
    ? Math.min(...observations.map((obs) => obs.mpeLimit))
    : 1;

  return (
    <div className="animate-rise">
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div>
          <div className="flex items-center gap-3">
            <div
              className={`grid h-11 w-11 place-items-center rounded-full ${
                verdict === 'PASS' ? 'bg-[#dceee8] text-[#2e7568]' : 'bg-[#f7dfdc] text-[#b24b43]'
              }`}
            >
              <CheckCircle2 size={25} />
            </div>
            <div>
              <div className="eyebrow">Preliminary result</div>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight">{verdict}</h3>
            </div>
          </div>

          <p className="mt-6 max-w-xl text-sm leading-6 text-[#58746f]">
            {driftFlag
              ? 'Environmental drift exceeded the session limit and has been carried into the report review flag.'
              : verdict === 'PASS'
              ? 'All captured observations are within the applicable maximum permissible error. Review the summary, then save the working record for officer approval.'
              : 'One or more captured observations exceed the applicable maximum permissible error. Review the red rows before continuing.'}
          </p>

          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-[#eaf4ef] p-4">
              <div className="eyebrow">Observations</div>
              <div className="mt-3 font-mono text-xl">{Math.max(readings.length, 3)}</div>
              <div className="mt-1 text-[10px] text-[#66837d]">captured locally</div>
            </div>
            <div className="rounded-lg bg-[#eaf4ef] p-4">
              <div className="eyebrow">Max error</div>
              <div className="mt-3 font-mono text-xl">{maxError} e</div>
              <div className="mt-1 text-[10px] text-[#66837d]">limit {limit} e</div>
            </div>
            <div className="rounded-lg bg-[#fbf4e4] p-4">
              <div className="eyebrow !text-[#92713a]">Disposition</div>
              <div className="mt-3 font-mono text-xl">{verdict === 'PASS' ? 'Ready' : 'Review'}</div>
              <div className="mt-1 text-[10px] text-[#92713a]">{verdict === 'PASS' ? 'for approval' : 'required'}</div>
            </div>
          </div>
        </div>

        <div className="grid-paper grid place-items-center rounded-lg border border-[#d7e0db] p-5 text-center">
          <div className="gauge-ring grid h-40 w-40 place-items-center">
            <div>
              <div className={`font-mono text-4xl font-bold ${verdict === 'PASS' ? 'text-[#17333c]' : 'text-[#b24b43]'}`}>
                {verdict}
              </div>
              <div className="mt-2 text-[9px] uppercase tracking-[.15em] text-[#2e7568]">
                OIML R-76
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 border-t border-[#d7e0db] pt-5 text-xs text-[#66837d]">
        <ShieldCheck size={15} className="mr-2 inline text-[#2e7568]" />
        This is a working verdict. A report becomes official after an approving officer seals it.
      </div>
    </div>
  );
}

export default VerdictModule;
