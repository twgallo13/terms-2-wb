'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Globe, 
  Settings, 
  FileText, 
  DollarSign, 
  Briefcase, 
  CheckSquare, 
  PlusSquare 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { seedAllowlists } from '@/lib/seed-data';

const settingsNav = [
  { name: 'Sites', href: '/settings/sites', icon: Globe },
  { name: 'Services', href: '/settings/services', icon: Briefcase },
  { name: 'Fees', href: '/settings/fees', icon: DollarSign },
  { name: 'Pricing Profiles', href: '/settings/pricing', icon: FileText },
  { name: 'Operational Profiles', href: '/settings/operational', icon: Settings },
  { name: 'Required Fields', href: '/settings/required-fields', icon: CheckSquare },
  { name: 'Custom Fields', href: '/settings/custom-fields', icon: PlusSquare },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSeeding, setIsSeeding] = React.useState(false);

  const handleSeed = async () => {
    if (!confirm('This will seed initial sites, services, fees, and profiles. Continue?')) return;
    setIsSeeding(true);
    try {
      await seedAllowlists();
      alert('System data seeded successfully.');
    } catch (error) {
      console.error('Seeding failed:', error);
      alert('Seeding failed.');
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex flex-col">
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <p className="text-sm text-gray-500">Manage system configuration</p>
        </div>
        
        <nav className="space-y-1 flex-1">
          {settingsNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                )}
              >
                <item.icon className={cn(
                  "mr-3 h-5 w-5",
                  isActive ? "text-blue-700" : "text-gray-400"
                )} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6 border-t border-gray-100">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="w-full flex items-center justify-center px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-50"
          >
            {isSeeding ? 'Seeding...' : 'Seed System Data'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
