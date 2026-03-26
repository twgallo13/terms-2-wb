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
  MoreVertical
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function QuotesListPage() {
  const { user, isAuthReady } = useAuth();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    if (!isAuthReady || !user) return;

    const quotesQuery = query(
      collection(db, 'quotes'),
      where('isArchived', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(quotesQuery, (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.quoteNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.brandName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || quote.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  if (loading) return <div className="p-8 text-center text-gray-500">Loading quotes...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Quotes</h1>
              <p className="text-sm text-gray-500 mt-1">Manage all quote drafts and versions across brands.</p>
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by quote #, brand, or vendor..."
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
                <option value="sent">Sent</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {filteredQuotes.map(quote => (
              <Link 
                key={quote.id} 
                href={`/quotes/${quote.id}`}
                className="p-6 flex items-center justify-between hover:bg-gray-50 transition-all group"
              >
                <div className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                    <FileText size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {quote.quoteNumber}
                      </span>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        quote.status === 'draft' ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                      )}>
                        {quote.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Building2 size={14} />
                        {quote.brandName}
                      </div>
                      <span>•</span>
                      <div className="text-xs">
                        v{quote.currentVersionNumber}
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5 text-xs">
                        <Clock size={14} />
                        {quote.createdAt?.toDate().toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  {quote.warnings?.length > 0 && (
                    <div className="flex items-center gap-1.5 text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                      <AlertCircle size={14} />
                      <span className="text-[10px] font-bold uppercase">{quote.warnings.length} Warnings</span>
                    </div>
                  )}
                  <ChevronRight size={20} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-1 transition-all" />
                </div>
              </Link>
            ))}
            {filteredQuotes.length === 0 && (
              <div className="p-20 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-4">
                  <FileText size={32} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">No quotes found</h3>
                <p className="text-gray-500 mt-1">Try adjusting your search or filters.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
