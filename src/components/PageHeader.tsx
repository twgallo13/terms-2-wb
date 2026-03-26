'use client';

import React from 'react';
import StatusPill from './StatusPill';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  status?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, status, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <div className="flex items-center space-x-3 mb-1">
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {status && <StatusPill status={status} />}
        </div>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
      <div className="flex items-center space-x-3">
        {actions}
      </div>
    </div>
  );
}
