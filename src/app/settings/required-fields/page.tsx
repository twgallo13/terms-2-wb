'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { manageRequiredFieldRules } from '@/lib/auth-service';
import { Plus, Edit2, Check, X, ShieldCheck } from 'lucide-react';

interface RequiredFieldRule {
  id: string;
  entityType: string;
  stage: string;
  rules: any[];
}

export default function RequiredFieldsPage() {
  const [rules, setRules] = useState<RequiredFieldRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<RequiredFieldRule>>({});

  useEffect(() => {
    const q = query(collection(db, 'requiredFieldRules'), orderBy('entityType', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ruleList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RequiredFieldRule));
      setRules(ruleList);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (id?: string) => {
    try {
      if (id) {
        await manageRequiredFieldRules('update', formData, id);
        setEditingId(null);
      } else {
        await manageRequiredFieldRules('create', { ...formData, rules: [] });
        setIsAdding(false);
      }
      setFormData({});
    } catch (error) {
      console.error('Error saving rule:', error);
      alert('Failed to save rule');
    }
  };

  if (isLoading) return <div className="flex justify-center p-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Required Fields</h1>
          <p className="text-sm text-gray-500">Manage mandatory fields for different entities and stages</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Rule Set
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rules Count</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isAdding && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <select className="px-2 py-1 border rounded" onChange={e => setFormData({ ...formData, entityType: e.target.value })}>
                    <option value="">Select Entity</option>
                    <option value="vendor">Vendor</option>
                    <option value="brand">Brand</option>
                    <option value="quote">Quote</option>
                    <option value="agreement">Agreement</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-full px-2 py-1 border rounded" placeholder="Stage (e.g. onboarding)" onChange={e => setFormData({ ...formData, stage: e.target.value })} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">0</td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleSave()} className="text-green-600 hover:text-green-900 mr-3"><Check className="w-5 h-5" /></button>
                  <button onClick={() => setIsAdding(false)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                </td>
              </tr>
            )}
            {rules.map((rule) => (
              <tr key={rule.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                  {editingId === rule.id ? (
                    <select className="px-2 py-1 border rounded" defaultValue={rule.entityType} onChange={e => setFormData({ ...formData, entityType: e.target.value })}>
                      <option value="vendor">Vendor</option>
                      <option value="brand">Brand</option>
                      <option value="quote">Quote</option>
                      <option value="agreement">Agreement</option>
                    </select>
                  ) : rule.entityType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingId === rule.id ? (
                    <input type="text" className="w-full px-2 py-1 border rounded" defaultValue={rule.stage} onChange={e => setFormData({ ...formData, stage: e.target.value })} />
                  ) : rule.stage}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-green-500" />
                    <span>{rule.rules?.length || 0} rules defined</span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingId === rule.id ? (
                    <>
                      <button onClick={() => handleSave(rule.id)} className="text-green-600 hover:text-green-900 mr-3"><Check className="w-5 h-5" /></button>
                      <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingId(rule.id); setFormData(rule); }} className="text-blue-600 hover:text-blue-900">
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
