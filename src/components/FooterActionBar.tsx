'use client';

import React from 'react';

interface FooterActionBarProps {
  children: React.ReactNode;
}

export default function FooterActionBar({ children }: FooterActionBarProps) {
  return (
    <div className="fixed bottom-0 left-64 right-80 bg-white border-t border-gray-200 p-4 flex items-center justify-end space-x-3 shadow-lg z-10">
      {children}
    </div>
  );
}
