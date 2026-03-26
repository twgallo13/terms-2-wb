'use client';

import React from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function RightRail() {
  return (
    <aside className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center">
          <Activity className="w-4 h-4 mr-2 text-blue-500" />
          Activity & Tasks
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Validation Warnings</h3>
          <div className="space-y-2">
            <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-md flex items-start">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
              <p className="text-xs text-yellow-700">Missing primary contact for Brand: Shiekh Shoes</p>
            </div>
            <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-md flex items-start">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mr-2 mt-0.5" />
              <p className="text-xs text-yellow-700">Quote #Q-2026-001 is missing fee schedule</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 mr-3 shrink-0"></div>
                <div>
                  <p className="text-xs font-medium text-gray-900">Theo sent Quote #Q-2026-001</p>
                  <p className="text-[10px] text-gray-500">2 hours ago</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Tasks</h3>
          <div className="space-y-2">
            <div className="flex items-center p-2 hover:bg-gray-50 rounded-md group cursor-pointer">
              <div className="w-4 h-4 border border-gray-300 rounded mr-3 group-hover:border-blue-500"></div>
              <p className="text-xs text-gray-600">Review vendor change request</p>
            </div>
            <div className="flex items-center p-2 hover:bg-gray-50 rounded-md group cursor-pointer">
              <CheckCircle2 className="w-4 h-4 text-green-500 mr-3" />
              <p className="text-xs text-gray-400 line-through">Generate agreement for Nike</p>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
}
