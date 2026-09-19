import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export function IdentificationModule({ session = {} }) {
  return (
    <div className="animate-rise">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-lg bg-[#edf4ef] p-5">
          <div className="eyebrow">Instrument</div>
          <div className="mt-3 text-lg font-semibold">{session.asset || 'Mettler Toledo MS6002S'}</div>
          <div className="mt-1 font-mono text-xs text-[#66837d]">SN {session.serial || 'B723814'}</div>
        </div>
        <div className="rounded-lg bg-[#fbf4e4] p-5">
          <div className="eyebrow !text-[#92713a]">Reference</div>
          <div className="mt-3 text-lg font-semibold">OIML R-76</div>
          <div className="mt-1 text-xs text-[#92713a]">Non-automatic weighing instruments</div>
        </div>
      </div>
      <div className="mt-8 max-w-2xl">
        <h3 className="text-base font-semibold">Before you begin</h3>
        <div className="mt-4 space-y-3 text-sm leading-6 text-[#58746f]">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-1 shrink-0 text-[#2e7568]" size={16} />
            <span>Check the identification plate matches the instrument record.</span>
          </div>
          <div className="flex gap-3">
            <CheckCircle2 className="mt-1 shrink-0 text-[#2e7568]" size={16} />
            <span>Allow the instrument to reach thermal equilibrium before taking readings.</span>
          </div>
          <div className="flex gap-3">
            <CheckCircle2 className="mt-1 shrink-0 text-[#2e7568]" size={16} />
            <span>Remove all loads and confirm the platform is clean.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IdentificationModule;
