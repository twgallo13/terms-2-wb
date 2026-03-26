'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { manageService } from '@/lib/auth-service';
import { Plus, Edit2, Check, X, AlertCircle } from 'lucide-react';

interface Service {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string;
  isActive: boolean;
  vendorVisible: boolean;
  isNegotiable: boolean;
  seededFromLegacy: boolean;
  reviewRequired: boolean;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Service>>({});

  useEffect(() => {
    const q = query(collection(db, 'services'), orderBy('code', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const serviceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
      setServices(serviceList);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (id?: string) => {
    try {
      if (id) {
        await manageService('update', formData, id);
        setEditingId(null);
      } else {
        await manageService('create', { ...formData, isActive: true, seededFromLegacy: false, reviewRequired: false });
        setIsAdding(false);
      }
      setFormData({});
    } catch (error) {
      console.error('Error saving service:', error);
      alert('Failed to save service');
    }
  };

  if (isLoading) return <div className="flex justify-center p-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-sm text-gray-500">Manage reusable services offered by vendors</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visibility</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isAdding && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-20 px-2 py-1 border rounded" placeholder="Code" onChange={e => setFormData({ ...formData, code: e.target.value })} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-full px-2 py-1 border rounded" placeholder="Name" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-full px-2 py-1 border rounded" placeholder="Category" onChange={e => setFormData({ ...formData, category: e.target.value })} />
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
            {services.map((service) => (
              <tr key={service.id} className={service.isActive ? '' : 'bg-gray-50 opacity-75'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-bold text-gray-900">
                  {editingId === service.id ? (
                    <input type="text" className="w-20 px-2 py-1 border rounded" defaultValue={service.code} onChange={e => setFormData({ ...formData, code: e.target.value })} />
                  ) : service.code}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    {editingId === service.id ? (
                      <input type="text" className="w-full px-2 py-1 border rounded" defaultValue={service.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    ) : (
                      <>
                        <span>{service.name}</span>
                        <span className="text-xs text-gray-400">{service.description}</span>
                      </>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingId === service.id ? (
                    <input type="text" className="w-full px-2 py-1 border rounded" defaultValue={service.category} onChange={e => setFormData({ ...formData, category: e.target.value })} />
                  ) : service.category}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => manageService('update', { isActive: !service.isActive }, service.id)}
                      className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        service.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {service.isActive ? 'Active' : 'Inactive'}
                    </button>
                    {service.reviewRequired && (
                      <span className="flex items-center text-orange-600" title="Review Required">
                        <AlertCircle className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col text-[10px] space-y-1">
                    <span className={service.vendorVisible ? 'text-blue-600' : 'text-gray-400'}>
                      {service.vendorVisible ? 'VENDOR VISIBLE' : 'INTERNAL ONLY'}
                    </span>
                    <span className={service.isNegotiable ? 'text-purple-600' : 'text-gray-400'}>
                      {service.isNegotiable ? 'NEGOTIABLE' : 'FIXED'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {editingId === service.id ? (
                    <>
                      <button onClick={() => handleSave(service.id)} className="text-green-600 hover:text-green-900 mr-3"><Check className="w-5 h-5" /></button>
                      <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingId(service.id); setFormData(service); }} className="text-blue-600 hover:text-blue-900">
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
