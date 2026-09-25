import React from 'react';
import { cn } from '@/lib/utils';

export function Card({ children, className, ...props }) {
  return (
    <div className={cn('panel p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function PanelDark({ children, className, ...props }) {
  return (
    <div className={cn('panel-dark p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ label, value, detail, icon: Icon, tone = 'plain', className }) {
  return (
    <div
      className={cn(
        'panel p-5',
        tone === 'teal' ? 'bg-[#eaf4ef]' : tone === 'brass' ? 'bg-[#fbf4e4]' : '',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon size={17} className="text-[#71928b]" />}
      </div>
      <div className="metric-value mt-5">{value}</div>
      <div className="mt-2 text-xs text-[#66837d]">{detail}</div>
    </div>
  );
}

export function EnvironmentCard({ label, value, unit, range, icon: Icon, className }) {
  return (
    <div className={cn('rounded-lg border border-[#d7e0db] p-4', className)}>
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {Icon && <Icon size={15} className="text-[#2e7568]" />}
      </div>
      <div className="mt-5 font-mono text-2xl tracking-[-.08em] text-[#17333c]">
        {value}
        <span className="ml-1 text-sm tracking-normal text-[#66837d]">{unit}</span>
      </div>
      <div className="mt-2 text-[10px] text-[#7b9690]">Acceptable {range}</div>
    </div>
  );
}

export default Card;
