'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/Layouts';
import { Card, SectionContainer, MetricCard, cn } from '@/components/ui/Primitives';
import { BarChart3, PieChart, TrendingUp, Calendar, Download, Filter } from 'lucide-react';

export default function ReportsPage() {
  return (
    <AppShell>
      <PageHeader 
        title="Reports & Analytics" 
        subtitle="Monitor onboarding performance, cycle times, and vendor health metrics."
        actions={
          <button className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 px-4 py-2 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        }
      />

      <div className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <MetricCard label="Avg. Onboarding Time" value="14.2 Days" trend="-2.1" trendType="up" />
          <MetricCard label="Conversion Rate" value="68%" trend="+5%" trendType="up" />
          <MetricCard label="Active Handoffs" value="24" trend="+4" trendType="up" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SectionContainer title="Onboarding Volume (Last 30 Days)">
            <Card className="p-6 h-80 flex items-center justify-center bg-slate-50/50 border-dashed">
              <div className="text-center">
                <BarChart3 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Onboarding Volume Chart</p>
                <p className="text-xs text-slate-500 mt-1">Placeholder for D3/Recharts visualization</p>
              </div>
            </Card>
          </SectionContainer>

          <SectionContainer title="Status Distribution">
            <Card className="p-6 h-80 flex items-center justify-center bg-slate-50/50 border-dashed">
              <div className="text-center">
                <PieChart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-sm font-bold text-slate-900 uppercase tracking-tight">Status Distribution Chart</p>
                <p className="text-xs text-slate-500 mt-1">Placeholder for D3/Recharts visualization</p>
              </div>
            </Card>
          </SectionContainer>
        </div>

        <SectionContainer title="Performance by Vendor Category">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Category</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Active</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Avg. Time</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { category: 'Footwear', active: 12, time: '12.5 Days', trend: '+2%' },
                    { category: 'Apparel', active: 18, time: '15.2 Days', trend: '-5%' },
                    { category: 'Accessories', active: 6, time: '10.8 Days', trend: '0%' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{row.category}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">{row.active}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">{row.time}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={cn(
                          "text-xs font-bold px-2 py-0.5 rounded",
                          row.trend.startsWith('+') ? "text-rose-700 bg-rose-50" : 
                          row.trend.startsWith('-') ? "text-emerald-700 bg-emerald-50" : 
                          "text-slate-600 bg-slate-50"
                        )}>
                          {row.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </SectionContainer>
      </div>
    </AppShell>
  );
}
