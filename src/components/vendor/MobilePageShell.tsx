'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

export default function MobilePageShell({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-gray-900">TWG Vendor Portal</h1>
        </div>
        <button 
          className="lg:hidden p-2 text-gray-500"
          onClick={() => setIsOpen(!isOpen)}
        >
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {isOpen && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsOpen(false)}>
          <nav className="bg-white w-64 h-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <Link href="/vendor/review/1" className="block text-sm font-medium text-gray-900">Package Summary</Link>
            <Link href="/vendor/quote/1" className="block text-sm font-medium text-gray-600">Quote Details</Link>
            <Link href="/vendor/agreement/1" className="block text-sm font-medium text-gray-600">Agreement Terms</Link>
          </nav>
        </div>
      )}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 p-6 text-center text-sm text-gray-500">
        &copy; 2026 Shiekh Shoes. All rights reserved.
      </footer>
    </div>
  );
}
