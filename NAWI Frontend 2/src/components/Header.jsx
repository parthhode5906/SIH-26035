import React from 'react';
import { ChevronRight, CircleHelp, Menu } from 'lucide-react';
import ConnectivityPill from '@/components/ConnectivityPill';

export function Header({ onOpenMobileNav, onOpenHelp }) {
  return (
    <header className="flex h-[70px] items-center justify-between border-b border-[#d7e0db] bg-[#f4f7f3]/85 px-5 backdrop-blur md:px-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileNav}
          className="rounded-md p-2 text-[#33545a] md:hidden"
          aria-label="Open navigation"
          data-testid="button-open-navigation"
        >
          <Menu size={20} />
        </button>
        <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[#6d8984] md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2e7568]" />
          Facility 07 <ChevronRight size={12} /> Bench 02
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.12em] text-[#6d8984] md:hidden">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2e7568]" />
          Bench 02
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenHelp}
          className="hidden items-center gap-2 text-xs text-[#58746f] transition-colors hover:text-[#17333c] sm:flex"
          data-testid="button-header-help"
        >
          <CircleHelp size={15} />
          Help
        </button>
        <ConnectivityPill />
      </div>
    </header>
  );
}

export default Header;
