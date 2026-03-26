'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, HelpCircle } from 'lucide-react';

export default function PublicShell({ 
  children, 
  title, 
  subtitle 
}: { 
  children: React.ReactNode; 
  title?: string; 
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Simple Header */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 md:px-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/20">T</div>
          <span className="font-bold text-slate-900 tracking-tight">Terms Workbench Gateway</span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 text-sm font-medium">
          <Link href="#" className="hover:text-slate-900 transition-colors flex items-center gap-2">
            <HelpCircle className="w-4 h-4" />
            Support
          </Link>
          <div className="h-4 w-px bg-slate-200"></div>
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
            Secure Session
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md space-y-8">
          {(title || subtitle) && (
            <div className="text-center space-y-2">
              {title && <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>}
              {subtitle && <p className="text-slate-500 font-medium">{subtitle}</p>}
            </div>
          )}
          
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 p-8 md:p-10">
            {children}
          </div>

          <div className="text-center">
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
              &copy; 2026 Terms Workbench Gateway. All Rights Reserved.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
