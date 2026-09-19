import React from 'react';

export function SectionHeader({ eyebrow, title, detail, action }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title mt-2">{title}</h1>
        {detail && <p className="mt-3 max-w-2xl text-sm leading-6 text-[#58746f]">{detail}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export default SectionHeader;
