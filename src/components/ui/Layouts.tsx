'use client';

import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn, StatusPill } from './Primitives';
import Link from 'next/link';

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav className="flex items-center space-x-1 text-xs font-medium text-slate-500 mb-2">
      <Link href="/dashboard" className="hover:text-slate-900 transition-colors">
        <Home className="w-3 h-3" />
      </Link>
      {items.map((item, idx) => (
        <React.Fragment key={idx}>
          <ChevronRight className="w-3 h-3 text-slate-300" />
          {item.href ? (
            <Link href={item.href} className="hover:text-slate-900 transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-slate-900">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

export function PageHeader({ 
  title, 
  subtitle, 
  status, 
  statusLabel, 
  actions, 
  breadcrumbs 
}: { 
  title: string; 
  subtitle?: string; 
  status?: string; 
  statusLabel?: string; 
  actions?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}) {
  return (
    <div className="mb-8">
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
            {status && statusLabel && <StatusPill status={status} label={statusLabel} />}
          </div>
          {subtitle && <p className="text-sm text-slate-500 font-medium">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

export function TabShell({ 
  tabs, 
  activeTab, 
  onTabChange, 
  children 
}: { 
  tabs: { id: string; label: string; count?: number }[]; 
  activeTab: string; 
  onTabChange: (id: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors",
                activeTab === tab.id
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  "ml-2 py-0.5 px-2 rounded-full text-[10px] font-bold",
                  activeTab === tab.id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="min-h-[400px]">
        {children}
      </div>
    </div>
  );
}
