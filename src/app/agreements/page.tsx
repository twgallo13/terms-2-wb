'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { 
  FileText, 
  Search, 
  Filter, 
  ChevronRight, 
  Plus, 
  Building2, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Archive,
  MoreVertical,
  ShieldCheck
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function AgreementsListPage() {
  const { user, isAuthReady } = useAuth();
  const [agreements, setAgreements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const agreementsQuery = query(
      collection(db, 'agreements'),
      where('isArchived', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(agreementsQuery, (snap) => {
      setAgreements(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agreements');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const filteredAgreements = agreements.filter(agreement => {
    const matchesSearch = 
      agreement.agreementNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.brandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.vendorName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      agreement.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || agreement.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading agreements...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Agreements</h1>
              <p className="text-sm text-gray-500 mt-1">Manage legal agreements, signatures, and active terms.</p>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by agreement #, quote #, brand, or vendor..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <select 
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending Review</option>
                <option value="sent">Sent</option>
                <option value="signed">Signed</option>
                <option value="active">Active</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredAgreements.length === 0 ? (
              <div className="p-12 text-center">
                <ShieldCheck className="mx-auto text-gray-300 mb-4" size={48} />
                <h3 className="text-lg font-medium text-gray-900">No agreements found</h3>
                <p className="text-gray-500 mt-1">Agreements are created from finalized quotes.</p>
              </div>
            ) : (
              filteredAgreements.map(agreement => (
                <Link 
                  key={agreement.id} 
                  href={`/agreements/${agreement.id}`}
                  className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{agreement.agreementNumber}</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          agreement.status === 'active' ? "bg-green-100 text-green-700" :
                          agreement.status === 'signed' ? "bg-blue-100 text-blue-700" :
                          agreement.status === 'draft' ? "bg-gray-100 text-gray-600" :
                          "bg-amber-100 text-amber-700"
                        )}>
                          {agreement.status?.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Building2 size={14} />
                          <span>{agreement.brandName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText size={14} />
                          <span>Quote: {agreement.quoteNumber}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={14} />
                          <span>Updated {agreement.updatedAt?.toDate().toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="text-gray-300 group-hover:text-gray-600 transition-colors" size={20} />
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
