'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/Layouts';
import { Card, SectionContainer, StatusPill } from '@/components/ui/Primitives';
import { Search, Filter, Upload, MoreVertical, Files, Download, FileText } from 'lucide-react';
import Link from 'next/link';

export default function DocumentsPage() {
  return (
    <AppShell>
      <PageHeader 
        title="Documents" 
        subtitle="Centralized repository for all vendor and brand-related documentation."
        actions={
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Upload Document
          </button>
        }
      />

      <div className="space-y-6">
        <Card className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by document name, vendor, or type..." 
              className="pl-10 pr-4 py-2 bg-slate-50 border-slate-200 focus:bg-white focus:border-blue-500 focus:ring-0 rounded-lg text-sm w-full transition-all"
            />
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm font-medium">
              <Filter className="w-4 h-4" />
              Filters
            </button>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Showing 124 Documents</p>
          </div>
        </Card>

        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Document Name</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor / Brand</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Uploaded</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[
                  { name: 'W-9 Form - Nike, Inc.', vendor: 'Nike, Inc.', type: 'Tax Form', date: 'Oct 20, 2026' },
                  { name: 'Certificate of Insurance', vendor: 'Adidas AG', type: 'Compliance', date: 'Oct 22, 2026' },
                  { name: 'Brand Authorization Letter', vendor: 'Puma SE', brand: 'Puma Performance', type: 'Legal', date: 'Oct 23, 2026' },
                  { name: 'Bank Verification Letter', vendor: 'VF Corp', type: 'Financial', date: 'Oct 24, 2026' },
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 rounded text-slate-500 group-hover:bg-white group-hover:shadow-sm transition-all">
                          <FileText className="w-4 h-4" />
                        </div>
                        <p className="text-sm font-bold text-slate-900">{row.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900">{row.vendor}</p>
                      {row.brand && <p className="text-xs text-slate-500 font-medium">{row.brand}</p>}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase tracking-wider">{row.type}</span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-500">{row.date}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
                          <Download className="w-4 h-4" />
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
              View All Documents
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
