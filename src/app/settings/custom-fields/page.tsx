'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { manageCustomFieldDefinition } from '@/lib/auth-service';
import { Plus, Edit2, Check, X, ToggleLeft, ToggleRight } from 'lucide-react';

interface CustomFieldDefinition {
  id: string;
  entityType: string;
  fieldName: string;
  label: string;
  fieldType: string;
  options: string[];
  isActive: boolean;
}

export default function CustomFieldsPage() {
  const [definitions, setDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<CustomFieldDefinition>>({});

  useEffect(() => {
    const q = query(collection(db, 'customFieldDefinitions'), orderBy('entityType', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const defList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomFieldDefinition));
      setDefinitions(defList);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (id?: string) => {
    try {
      if (id) {
        await manageCustomFieldDefinition('update', formData, id);
        setEditingId(null);
      } else {
        await manageCustomFieldDefinition('create', { ...formData, isActive: true, options: [] });
        setIsAdding(false);
      }
      setFormData({});
    } catch (error) {
      console.error('Error saving definition:', error);
      alert('Failed to save definition');
    }
  };

  if (isLoading) return <div className="flex justify-center p-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Custom Fields</h1>
          <p className="text-sm text-gray-500">Define user-defined fields for entities</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Field
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Label / Field Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
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
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col space-y-1">
                    <input type="text" className="px-2 py-1 border rounded" placeholder="Label" onChange={e => setFormData({ ...formData, label: e.target.value })} />
                    <input type="text" className="px-2 py-1 border rounded text-xs font-mono" placeholder="field_name" onChange={e => setFormData({ ...formData, fieldName: e.target.value })} />
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select className="px-2 py-1 border rounded" onChange={e => setFormData({ ...formData, fieldType: e.target.value })}>
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                    <option value="select">Select</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap" colSpan={2}>
                  <span className="text-xs text-gray-500 italic">Defaults will be applied</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleSave()} className="text-green-600 hover:text-green-900 mr-3"><Check className="w-5 h-5" /></button>
                  <button onClick={() => setIsAdding(false)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                </td>
              </tr>
            )}
            {definitions.map((def) => (
              <tr key={def.id} className={def.isActive ? '' : 'bg-gray-50 opacity-75'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                  {editingId === def.id ? (
                    <select className="px-2 py-1 border rounded" defaultValue={def.entityType} onChange={e => setFormData({ ...formData, entityType: e.target.value })}>
                      <option value="vendor">Vendor</option>
                      <option value="brand">Brand</option>
                      <option value="quote">Quote</option>
                    </select>
                  ) : def.entityType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    {editingId === def.id ? (
                      <>
                        <input type="text" className="px-2 py-1 border rounded" defaultValue={def.label} onChange={e => setFormData({ ...formData, label: e.target.value })} />
                        <input type="text" className="px-2 py-1 border rounded text-xs font-mono" defaultValue={def.fieldName} onChange={e => setFormData({ ...formData, fieldName: e.target.value })} />
                      </>
                    ) : (
                      <>
                        <span className="text-sm text-gray-900 font-medium">{def.label}</span>
                        <span className="text-xs text-gray-400 font-mono">{def.fieldName}</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                  {editingId === def.id ? (
                    <select className="px-2 py-1 border rounded" defaultValue={def.fieldType} onChange={e => setFormData({ ...formData, fieldType: e.target.value })}>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="select">Select</option>
                    </select>
                  ) : def.fieldType}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => manageCustomFieldDefinition('update', { isActive: !def.isActive }, def.id)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {def.isActive ? <ToggleRight className="w-6 h-6 text-green-500" /> : <ToggleLeft className="w-6 h-6" />}
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingId === def.id ? (
                    <>
                      <button onClick={() => handleSave(def.id)} className="text-green-600 hover:text-green-900 mr-3"><Check className="w-5 h-5" /></button>
                      <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingId(def.id); setFormData(def); }} className="text-blue-600 hover:text-blue-900">
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
