'use client';

import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { managePricingProfile } from '@/lib/auth-service';
import { Plus, Edit2, Check, X, Send, History, AlertCircle } from 'lucide-react';

interface PricingProfile {
  id: string;
  profileKey: string;
  name: string;
  status: 'draft' | 'published' | 'retired';
  versionNumber: number;
  isCurrentPublished: boolean;
  changeSummary: string;
  seededFromLegacy: boolean;
  reviewRequired: boolean;
  publishedAt?: any;
  publishedByUserId?: string;
  data: any;
  createdAt: any;
}

export default function PricingProfilesPage() {
  const [profiles, setProfiles] = useState<PricingProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PricingProfile>>({});

  useEffect(() => {
    const q = query(collection(db, 'pricingProfiles'), orderBy('versionNumber', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profileList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PricingProfile));
      setProfiles(profileList);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async (id?: string) => {
    try {
      if (id) {
        await managePricingProfile('update', formData, id);
        setEditingId(null);
      } else {
        // Find max version for this specific profileKey
        const sameKeyProfiles = profiles.filter(p => p.profileKey === formData.profileKey);
        const nextVersion = sameKeyProfiles.length > 0 ? Math.max(...sameKeyProfiles.map(p => p.versionNumber)) + 1 : 1;
        
        await managePricingProfile('create', { 
          ...formData, 
          status: 'draft', 
          versionNumber: nextVersion, 
          isCurrentPublished: false,
          seededFromLegacy: false,
          reviewRequired: false,
          data: formData.data || {}
        });
        setIsAdding(false);
      }
      setFormData({});
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile');
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm('Are you sure you want to publish this profile? It will become the system standard.')) return;
    try {
      await managePricingProfile('publish', {}, id);
    } catch (error) {
      console.error('Error publishing profile:', error);
      alert('Failed to publish profile');
    }
  };

  if (isLoading) return <div className="flex justify-center p-12">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Profiles</h1>
          <p className="text-sm text-gray-500">Manage versioned pricing configurations</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Draft
        </button>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Key</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Version</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Summary</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {isAdding && (
              <tr className="bg-blue-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-full px-2 py-1 border rounded text-xs font-mono" placeholder="profile_key" onChange={e => setFormData({ ...formData, profileKey: e.target.value })} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">NEW</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-full px-2 py-1 border rounded" placeholder="Profile Name" onChange={e => setFormData({ ...formData, name: e.target.value })} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Draft</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input type="text" className="w-full px-2 py-1 border rounded" placeholder="Change summary" onChange={e => setFormData({ ...formData, changeSummary: e.target.value })} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button onClick={() => handleSave()} className="text-green-600 hover:text-green-900 mr-3"><Check className="w-5 h-5" /></button>
                  <button onClick={() => setIsAdding(false)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                </td>
              </tr>
            )}
            {profiles.map((profile) => (
              <tr key={profile.id} className={profile.isCurrentPublished ? 'bg-blue-50/30' : ''}>
                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-500">
                  {profile.profileKey}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                  v{profile.versionNumber}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2">
                      {editingId === profile.id ? (
                        <input type="text" className="w-full px-2 py-1 border rounded" defaultValue={profile.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                      ) : (
                        <>
                          <span className="font-medium">{profile.name}</span>
                          {profile.isCurrentPublished && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">CURRENT</span>
                          )}
                        </>
                      )}
                    </div>
                    {profile.seededFromLegacy && (
                      <div className="mt-1 flex flex-col space-y-0.5">
                        <span className="text-[10px] text-orange-600 font-medium uppercase tracking-tight flex items-center">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Imported from legacy policy
                        </span>
                        {profile.reviewRequired && (
                          <span className="text-[10px] text-red-500 italic">
                            Review required • Not final until published
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      profile.status === 'published' ? 'bg-green-100 text-green-800' : 
                      profile.status === 'draft' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {profile.status.toUpperCase()}
                    </span>
                    {profile.reviewRequired && (
                      <AlertCircle className="w-3 h-3 text-orange-600" />
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {editingId === profile.id ? (
                    <input type="text" className="w-full px-2 py-1 border rounded" defaultValue={profile.changeSummary} onChange={e => setFormData({ ...formData, changeSummary: e.target.value })} />
                  ) : profile.changeSummary}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-3">
                    {profile.status === 'draft' && (
                      <button onClick={() => handlePublish(profile.id)} title="Publish" className="text-green-600 hover:text-green-900">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    {editingId === profile.id ? (
                      <>
                        <button onClick={() => handleSave(profile.id)} className="text-green-600 hover:text-green-900"><Check className="w-5 h-5" /></button>
                        <button onClick={() => setEditingId(null)} className="text-red-600 hover:text-red-900"><X className="w-5 h-5" /></button>
                      </>
                    ) : (
                      <button onClick={() => { setEditingId(profile.id); setFormData(profile); }} className="text-blue-600 hover:text-blue-900">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    <button title="View History" className="text-gray-400 hover:text-gray-600">
                      <History className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
