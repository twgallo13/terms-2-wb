'use client';

import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function SummaryActionArea() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 sticky top-24">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Action Required</h2>
      <div className="space-y-4 mb-6">
        <div className="flex items-start">
          <CheckCircle2 className="w-5 h-5 text-green-500 mr-3 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">Quote Reviewed</p>
            <p className="text-xs text-gray-500">Completed on Mar 23</p>
          </div>
        </div>
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-500 mr-3 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-900">Agreement Pending</p>
            <p className="text-xs text-gray-500">Awaiting your signature</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button className="w-full py-3 bg-blue-600 text-white rounded-md font-bold hover:bg-blue-700 transition-colors">
          Sign Agreement
        </button>
        <button className="w-full py-3 bg-white border border-gray-300 text-gray-700 rounded-md font-medium hover:bg-gray-50 transition-colors">
          Request Changes
        </button>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-100">
        <p className="text-xs text-gray-500 mb-1">Need help?</p>
        <p className="text-xs font-medium text-blue-600 hover:underline cursor-pointer">Contact Shiekh Support</p>
      </div>
    </div>
  );
}
