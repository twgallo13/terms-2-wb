'use client';

import React from 'react';
import AppShell from '@/components/AppShell';
import { PageHeader } from '@/components/ui/Layouts';
import { Card, SectionContainer } from '@/components/ui/Primitives';
import { Settings, User, Bell, Shield, Database, Globe, Mail } from 'lucide-react';

export default function SettingsPage() {
  return (
    <AppShell>
      <PageHeader 
        title="Settings" 
        subtitle="Configure your TWG workspace, user permissions, and global onboarding rules."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <aside className="lg:col-span-1 space-y-2">
          {[
            { label: 'Profile Settings', icon: User, active: true },
            { label: 'Notifications', icon: Bell, active: false },
            { label: 'Security & Access', icon: Shield, active: false },
            { label: 'Data Management', icon: Database, active: false },
            { label: 'Global Rules', icon: Globe, active: false },
            { label: 'Email Templates', icon: Mail, active: false },
          ].map((item, idx) => (
            <button 
              key={idx} 
              className={cn(
                "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-bold transition-all",
                item.active ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </aside>

        <div className="lg:col-span-2 space-y-8">
          <SectionContainer title="Profile Information">
            <Card className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Full Name</label>
                  <input type="text" defaultValue="Theo Shiekh" className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                  <input type="email" defaultValue="theo@shiekhshoes.org" className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Job Title</label>
                  <input type="text" defaultValue="Administrator" className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm font-medium" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Department</label>
                  <input type="text" defaultValue="Operations" className="w-full px-4 py-2 bg-slate-50 border-slate-200 rounded-lg text-sm font-medium" />
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-600/20 transition-all">
                  Save Changes
                </button>
              </div>
            </Card>
          </SectionContainer>

          <SectionContainer title="System Preferences">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">Dark Mode</p>
                  <p className="text-xs text-slate-500">Enable dark mode for the TWG dashboard.</p>
                </div>
                <div className="w-10 h-5 bg-slate-200 rounded-full relative">
                  <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-900">Email Notifications</p>
                  <p className="text-xs text-slate-500">Receive email alerts for new vendor submissions.</p>
                </div>
                <div className="w-10 h-5 bg-blue-600 rounded-full relative">
                  <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm"></div>
                </div>
              </div>
            </Card>
          </SectionContainer>
        </div>
      </div>
    </AppShell>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
