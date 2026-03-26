'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Briefcase, Search, Building2, User, ChevronRight, ExternalLink, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Brand {
  id: string;
  vendorId: string;
  vendorName: string;
  brandName: string;
  brandCode: string;
  status: string;
  ownerDisplayName: string;
  isArchived: boolean;
  defaultPricingProfileKey: string | null;
  defaultOperationalProfileKey: string | null;
  createdAt: any;
}

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function BrandsPage() {
  const { user, isAuthReady } = useAuth();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(
      collection(db, 'brands'),
      where('isArchived', '==', showArchived),
      orderBy('brandName', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const brandList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Brand[];
      setBrands(brandList);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'brands');
    });

    return () => unsubscribe();
  }, [showArchived, isAuthReady, user]);

  const filteredBrands = brands.filter(b => 
    b.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.brandCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.vendorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Brand Workspaces</h1>
          <p className="text-gray-500 mt-1">Operational hubs for vendor-brand relationships.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-bottom border-gray-200 bg-gray-50 flex flex-wrap gap-4 items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by brand, code, or vendor..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              Show Archived
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Brand</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Config</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">Loading brands...</td>
                </tr>
              ) : filteredBrands.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">No brands found.</td>
                </tr>
              ) : (
                filteredBrands.map((brand) => (
                  <tr key={brand.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/brands/${brand.id}`} className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                          <Briefcase size={20} />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                            {brand.brandName}
                          </div>
                          <div className="text-xs font-mono text-gray-500 uppercase">{brand.brandCode}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <Link href={`/vendors/${brand.vendorId}`} className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600">
                        <Building2 size={14} className="text-gray-400" />
                        {brand.vendorName}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        brand.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                      )}>
                        {brand.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(!brand.defaultPricingProfileKey || !brand.defaultOperationalProfileKey) ? (
                        <div className="flex items-center gap-1.5 text-yellow-600" title="Missing default configuration">
                          <AlertCircle size={14} />
                          <span className="text-xs font-medium uppercase">Pending</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-600">
                          <span className="text-xs font-medium uppercase">Configured</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {brand.ownerDisplayName || 'Unassigned'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={`/brands/${brand.id}`}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink size={18} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
