import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  const variants: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    review: "bg-blue-50 text-blue-700 border-blue-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    draft: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium border",
      variants[status] || variants.draft
    )}>
      {label}
    </span>
  );
}

export function MetricCard({ label, value, trend, trendType }: { 
  label: string; 
  value: string | number; 
  trend?: string;
  trendType?: 'up' | 'down' | 'neutral'
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="mt-2 flex items-baseline justify-between">
        <h4 className="text-2xl font-bold text-slate-900">{value}</h4>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-1.5 py-0.5 rounded",
            trendType === 'up' ? "text-emerald-700 bg-emerald-50" : 
            trendType === 'down' ? "text-rose-700 bg-rose-50" : 
            "text-slate-600 bg-slate-50"
          )}>
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}

export function SectionContainer({ title, children, action, className }: { 
  title?: string; 
  children: React.ReactNode; 
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between">
          {title && <h3 className="text-sm font-bold text-slate-900 uppercase tracking-tight">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
