'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/Layouts';
import { Card, MetricCard, SectionContainer, StatusPill } from '@/components/ui/Primitives';
import { 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  FileText, 
  UserPlus, 
  ClipboardCheck, 
  History,
  Users
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const rightRail = (
    <div className="space-y-6">
      <SectionContainer title="Recent Activity">
        <Card className="p-4 space-y-4">
          {[
            { icon: UserPlus, label: 'Nike, Inc. added', time: '2h ago', color: 'text-blue-600 bg-blue-50', href: '/vendors/V-2026-001' },
            { icon: FileText, label: 'Quote #Q-2026-001 accepted', time: '4h ago', color: 'text-emerald-600 bg-emerald-50', href: '/quotes/Q-2026-001' },
            { icon: ClipboardCheck, label: 'Agreement sent to Adidas', time: '1d ago', color: 'text-purple-600 bg-purple-50', href: '/agreements/A-2026-001' },
          ].map((item, idx) => (
            <Link key={idx} href={item.href} className="flex items-start gap-3 group">
              <div className={item.color + " p-2 rounded-lg group-hover:scale-110 transition-transform"}>
                <item.icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">{item.label}</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">{item.time}</p>
              </div>
            </Link>
          ))}
          <button className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 border-t border-slate-100 mt-2 pt-4">
            <History className="w-3 h-3" />
            View Full Audit Log
          </button>
        </Card>
      </SectionContainer>

      <SectionContainer title="Alerts & Exceptions">
        <Card className="p-4 border-rose-200 bg-rose-50/30">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-rose-900">3 Expired Quotes</p>
              <p className="text-xs text-rose-700 mt-1">Quotes for Puma, Reebok, and Under Armour have expired without acceptance.</p>
              <button className="text-xs font-bold text-rose-900 mt-3 flex items-center gap-1 hover:underline">
                Review Exceptions <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </Card>
      </SectionContainer>
    </div>
  );

  return (
    <AppShell rightRail={rightRail}>
      <PageHeader 
        title="Terms Workbench Dashboard" 
        subtitle="Welcome back, Theo. Here's what needs your attention today."
        actions={
          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Onboard New Vendor
          </button>
        }
      />

      {/* Snapshot Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Active Onboarding" value="12" trend="+2" trendType="up" />
        <MetricCard label="Pending Quotes" value="8" trend="-1" trendType="down" />
        <MetricCard label="Awaiting Signature" value="5" trend="0" trendType="neutral" />
        <MetricCard label="Ready for WB" value="4" trend="+3" trendType="up" />
      </div>

      <div className="space-y-8">
        {/* Action Required */}
        <SectionContainer 
          title="Action Required" 
          action={<button className="text-xs font-bold text-blue-600 hover:text-blue-700">View All (5)</button>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 border-l-4 border-l-amber-400">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <StatusPill status="pending" label="Quote Review" />
                  <h4 className="text-lg font-bold text-slate-900 mt-2">Nike Sportswear</h4>
                  <p className="text-xs text-slate-500 font-medium">Vendor submitted counter-offer on commercial terms.</p>
                </div>
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1, 2].map(i => (
                    <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">JD</div>
                  ))}
                </div>
                <Link href="/quotes/Q-2026-001" className="text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                  Review Offer
                </Link>
              </div>
            </Card>

            <Card className="p-5 border-l-4 border-l-blue-400">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <StatusPill status="review" label="Agreement Prep" />
                  <h4 className="text-lg font-bold text-slate-900 mt-2">Adidas Originals</h4>
                  <p className="text-xs text-slate-500 font-medium">Quote accepted. Generate final agreement for signature.</p>
                </div>
                <ClipboardCheck className="w-5 h-5 text-blue-500" />
              </div>
              <div className="mt-6 flex items-center justify-between">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">TS</div>
                </div>
                <Link href="/agreements/A-2026-001" className="text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors">
                  Generate Agreement
                </Link>
              </div>
            </Card>
          </div>
        </SectionContainer>

        {/* My Queue */}
        <SectionContainer 
          title="My Queue" 
          action={<button className="text-xs font-bold text-blue-600 hover:text-blue-700">Manage Queue</button>}
        >
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vendor / Brand</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Current Step</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Last Updated</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[
                    { id: 'V-2026-003', vendor: 'Puma SE', brand: 'Puma Performance', step: 'Quote Sent', status: 'pending', date: 'Oct 24, 2026' },
                    { id: 'V-2026-004', vendor: 'VF Corp', brand: 'The North Face', step: 'Agreement Review', status: 'review', date: 'Oct 23, 2026' },
                    { id: 'V-2026-005', vendor: 'New Balance', brand: 'NB Lifestyle', step: 'WB Handoff', status: 'active', date: 'Oct 22, 2026' },
                  ].map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-slate-900">{row.vendor}</p>
                        <p className="text-xs text-slate-500 font-medium">{row.brand}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <StatusPill status={row.status} label={row.step} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-slate-500">{row.date}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/vendors/${row.id}`} className="p-2 inline-block hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-slate-900 transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-center">
              <button className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors">
                View All Items in My Queue
              </button>
            </div>
          </Card>
        </SectionContainer>

        {/* Team Queue Placeholder */}
        <SectionContainer title="Team Queue">
          <Card className="p-12 text-center bg-slate-50/30 border-dashed">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-900">Team Queue is empty</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">All team-assigned tasks have been picked up or completed.</p>
          </Card>
        </SectionContainer>
      </div>
    </AppShell>
  );
}
