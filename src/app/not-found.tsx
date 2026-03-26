'use client';

import React from 'react';
import Link from 'next/link';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-6xl font-bold mb-4">404</h1>
      <h2 className="text-2xl font-semibold mb-8 text-slate-400">Page Not Found</h2>
      <p className="max-w-md mb-8 text-slate-500">
        The page you are looking for doesn't exist or has been moved.
      </p>
      <Link 
        href="/"
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all flex items-center gap-2"
      >
        <Home className="w-5 h-5" />
        Back to Home
      </Link>
    </div>
  );
}
