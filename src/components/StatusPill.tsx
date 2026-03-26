'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatusPillProps {
  status: string;
  className?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  collecting_info: 'bg-blue-100 text-blue-700',
  ready_for_quote: 'bg-indigo-100 text-indigo-700',
  quote_sent: 'bg-yellow-100 text-yellow-700',
  vendor_review: 'bg-purple-100 text-purple-700',
  signed: 'bg-green-100 text-green-700',
  ready_for_wb: 'bg-emerald-100 text-emerald-700',
  wb_complete: 'bg-teal-100 text-teal-700',
  archived: 'bg-gray-200 text-gray-800',
};

export default function StatusPill({ status, className }: StatusPillProps) {
  const colorClass = statusColors[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  const label = status.replace(/_/g, ' ').toUpperCase();

  return (
    <span className={cn(
      "px-2.5 py-0.5 rounded-full text-xs font-medium",
      colorClass,
      className
    )}>
      {label}
    </span>
  );
}
