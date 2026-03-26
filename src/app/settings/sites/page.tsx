'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { manageSite } from '@/lib/auth-service';
import { Plus, Edit2, Check, X, EyeOff, Eye, ArrowUp, ArrowDown } from 'lucide-react';

interface Site {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  displayOrder: number;
  isHidden: boolean;
  availableForNewApprovalsOnly: boolean;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Site>>({});

  useEffect(() => {
    const q = query(collection(db, 'sites'), orderBy('displayOrder', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const siteList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Site));
      setSites(siteList);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (id?: string) => {
    try {
      if (id) {
        await manageSite('update', formData, id);
        setEditingId(null);
      } else {
        const nextOrder = sites.length > 0 ? Math.max(...sites.map(s => s.displayOrder)) + 1 : 1;
        await manageSite('create', { ...formData, displayOrder: nextOrder, isActive: true, isHidden: false, availableForNewApprovalsOnly: false });
        setIsAdding(false);
      }
      setFormData({});
    } catch (error) {
      console.error('Error saving site:', error);
      alert('Failed to save site');
    }
  };

  const handleReorder = async (site: Site, direction: 'up' | 'down') => {
    const index = sites.findIndex(s => s.id === site.id);
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === sites.length - 1) return;

    const otherSite = direction === 'up' ? sites[index - 1] : sites[index + 1];
    
    try {
      await manageSite('update', { displayOrder: otherSite.displayOrder }, site.id);
      await manageSite('update', { displayOrder: site.displayOrder }, otherSite.id);
    } catch (error) {
      console.error('Error reordering sites:', error);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sites</h1>
          <p className="text-sm text-gray-500">Manage selling destinations and their availability</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isAdding && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    className="w-20 px-2 py-1 border rounded"
                    placeholder="Code"
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="text"
                    className="w-full px-2 py-1 border rounded"
                    placeholder="Site Name"
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap" colSpan={2}>
                  <span className="text-xs text-gray-500 italic">Defaults will be applied</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleSave()} className="text-green-600 hover:text-green-900 mr-3">
                    <Check className="w-5 h-5" />
                  </button>
                  <button onClick={() => setIsAdding(false)} className="text-red-600 hover:text-red-900">
                    <X className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            )}
            {sites.map((site, index) => (
              <tr key={site.id} className={site.isActive ? '' : 'bg-gray-50 opacity-75'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span>{site.displayOrder}</span>
                    <div className="flex flex-col">
                      <button onClick={() => handleReorder(site, 'up')} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-25">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleReorder(site, 'down')} disabled={index === sites.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-25">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-900">
                  {editingId === site.id ? (
                    <input
                      type="text"
                      className="w-20 px-2 py-1 border rounded"
                      defaultValue={site.code}
                      onChange={e => setFormData({ ...formData, code: e.target.value })}
                    />
                  ) : site.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {editingId === site.id ? (
                    <input
                      type="text"
                      className="w-full px-2 py-1 border rounded"
                      defaultValue={site.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  ) : site.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => manageSite('update', { isActive: !site.isActive }, site.id)}
                    className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      site.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {site.isActive ? 'Active' : 'Inactive'}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => manageSite('update', { isHidden: !site.isHidden }, site.id)}
                      title={site.isHidden ? 'Hidden from selection' : 'Visible in selection'}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {site.isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => manageSite('update', { availableForNewApprovalsOnly: !site.availableForNewApprovalsOnly }, site.id)}
                      className={`text-[10px] px-1.5 py-0.5 border rounded ${
                        site.availableForNewApprovalsOnly ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-gray-200 text-gray-400'
                      }`}
                    >
                      NEW ONLY
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingId === site.id ? (
                    <>
                      <button onClick={() => handleSave(site.id)} className="text-green-600 hover:text-green-900 mr-3">
                        <Check className="w-5 h-5" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-900">
                        <X className="w-5 h-5" />
                      </button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingId(site.id); setFormData(site); }} className="text-blue-600 hover:text-blue-900">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
