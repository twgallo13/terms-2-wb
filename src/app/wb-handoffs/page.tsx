'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/Layouts';
import { Card, SectionContainer, StatusPill, cn } from '@/components/ui/Primitives';
import { Search, Filter, ArrowRightLeft, MoreVertical, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import Link from 'next/link';

export default function WBHandoffsPage() {
  return (
    <AppShell>
      <PageHeader 
        title="WB Handoffs" 
        subtitle="Monitor and manage the handoff of onboarded brands to the Workbench team."
        actions={
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
            <ArrowRightLeft className="w-4 h-4" />
            Initiate Handoff
          </button>
        }
      />

      <div className="space-y-6">
        <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Filter by brand, vendor, or handoff status..." 
              className="pl-10 pr-4 py-2 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-0 rounded-lg text-sm w-full transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Showing 12 Handoffs</p>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Brand / Vendor</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Handoff Status</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Validation</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Handoff Date</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { brand: 'Nike Sportswear', vendor: 'Nike, Inc.', status: 'active', statusLabel: 'Completed', validation: 'Passed', date: 'Oct 21, 2026' },
                  { brand: 'Adidas Originals', vendor: 'Adidas AG', status: 'pending', statusLabel: 'In Progress', validation: 'Pending', date: 'Oct 23, 2026' },
                  { brand: 'Puma Performance', vendor: 'Puma SE', status: 'review', statusLabel: 'Ready for WB', validation: 'Passed', date: 'Oct 24, 2026' },
                  { brand: 'The North Face', vendor: 'VF Corp', status: 'error', statusLabel: 'Failed', validation: 'Failed', date: 'Oct 24, 2026' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{row.brand}</p>
                      <p className="text-xs text-slate-500 font-medium">{row.vendor}</p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusPill status={row.status} label={row.statusLabel} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {row.validation === 'Passed' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : row.validation === 'Failed' ? (
                          <AlertCircle className="w-4 h-4 text-rose-500" />
                        ) : (
                          <Clock className="w-4 h-4 text-amber-500" />
                        )}
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          row.validation === 'Passed' ? "text-emerald-700" : 
                          row.validation === 'Failed' ? "text-rose-700" : 
                          "text-amber-700"
                        )}>
                          {row.validation}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{row.date}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
                          <ArrowRightLeft className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
            <button className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
              View All Handoffs
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
