'use client';

import React from 'react';
import MobilePageShell from './MobilePageShell';
import SummaryActionArea from './SummaryActionArea';

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobilePageShell>
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          {children}
        </div>
        <div className="w-full lg:w-80 shrink-0">
          <SummaryActionArea />
        </div>
      </div>
    </MobilePageShell>
  );
}
