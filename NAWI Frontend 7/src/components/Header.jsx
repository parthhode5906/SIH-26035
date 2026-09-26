import React from 'react';
import { CircleHelp, Menu } from 'lucide-react';
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
