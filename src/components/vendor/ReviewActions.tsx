'use client';

import React, { useState } from 'react';
import { MessageSquare, AlertCircle } from 'lucide-react';
import ChangeRequestModal from './ChangeRequestModal';

interface ReviewActionsProps {
  packageId: string;
  entityType: string;
  packageNumber: string;
  isSuperseded?: boolean;
}

export default function ReviewActions({
  packageId,
  entityType,
  packageNumber,
  isSuperseded
}: ReviewActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (isSuperseded) {
    return (
      <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100 flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-amber-600" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-amber-900">Superseded Version</h4>
          <p className="text-xs text-amber-700 leading-relaxed">
            This version has been superseded by a newer revision. You are viewing this for historical reference only. Actions are disabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full py-4 px-6 bg-white border border-stone-200 text-stone-900 rounded-2xl text-sm font-semibold hover:bg-stone-50 transition-all flex items-center justify-center gap-3 shadow-sm"
        >
          <MessageSquare className="w-5 h-5 text-stone-400" />
          Request Changes
        </button>
        
        <p className="text-[10px] text-stone-400 text-center uppercase tracking-widest font-bold">
          Review Only Mode
        </p>
      </div>

      <ChangeRequestModal
        packageId={packageId}
        entityType={entityType}
        packageNumber={packageNumber}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
