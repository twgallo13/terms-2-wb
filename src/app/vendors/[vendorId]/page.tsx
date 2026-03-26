'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { manageVendor, manageBrand, manageContact } from '@/lib/auth-service';
import { 
  Building2, 
  Tag, 
  MapPin, 
  Globe, 
  Briefcase, 
  Phone, 
  Mail, 
  Plus, 
  Archive, 
  Edit3, 
  ChevronRight,
  User,
  ExternalLink,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

type Tab = 'overview' | 'brands' | 'contacts' | 'commercial' | 'agreements' | 'documents' | 'activity' | 'handoff' | 'notes';

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function VendorDetailPage() {
  const { user, isAuthReady } = useAuth();
  const { vendorId } = useParams();
  const router = useRouter();
  const [vendor, setVendor] = useState<any>(null);
  const [brands, setBrands] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [brandFormData, setBrandFormData] = useState<any>({ status: 'active' });
  const [contactFormData, setContactFormData] = useState<any>({ status: 'active' });

  useEffect(() => {
    if (!vendorId || !isAuthReady || !user) return;

    const vendorRef = doc(db, 'vendors', vendorId as string);
    const unsubscribeVendor = onSnapshot(vendorRef, (doc) => {
      if (doc.exists()) {
        setVendor({ id: doc.id, ...doc.data() });
      } else {
        router.push('/vendors');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `vendors/${vendorId}`);
    });

    const brandsQuery = query(
      collection(db, 'brands'),
      where('vendorId', '==', vendorId),
      where('isArchived', '==', false),
      orderBy('brandName', 'asc')
    );
    const unsubscribeBrands = onSnapshot(brandsQuery, (snapshot) => {
      setBrands(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'brands');
    });

    const contactsQuery = query(
      collection(db, 'contacts'),
      where('vendorId', '==', vendorId),
      where('isArchived', '==', false),
      orderBy('lastName', 'asc')
    );
    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'contacts');
    });

    return () => {
      unsubscribeVendor();
      unsubscribeBrands();
      unsubscribeContacts();
    };
  }, [vendorId, router, isAuthReady, user]);

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await manageBrand('create', { 
        ...brandFormData, 
        vendorId, 
        vendorName: vendor.displayName 
      });
      setIsAddingBrand(false);
      setBrandFormData({ status: 'active' });
    } catch (error) {
      console.error('Error creating brand:', error);
      alert('Failed to create brand');
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await manageContact('create', { 
        ...contactFormData, 
        vendorId 
      });
      setIsAddingContact(false);
      setContactFormData({ status: 'active' });
    } catch (error) {
      console.error('Error creating contact:', error);
      alert('Failed to create contact');
    }
  };

  const handleArchiveVendor = async () => {
    if (!confirm('Are you sure you want to archive this vendor?')) return;
    try {
      await manageVendor('archive', {}, vendorId as string);
      router.push('/vendors');
    } catch (error) {
      console.error('Error archiving vendor:', error);
      alert('Failed to archive vendor');
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading vendor details...</div>;
  if (!vendor) return null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'brands', label: 'Brands', count: brands.length },
    { id: 'contacts', label: 'Contacts', count: contacts.length },
    { id: 'commercial', label: 'Commercial Summary' },
    { id: 'agreements', label: 'Agreements' },
    { id: 'documents', label: 'Documents' },
    { id: 'activity', label: 'Activity' },
    { id: 'handoff', label: 'WB Handoff' },
    { id: 'notes', label: 'Internal Notes' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/vendors" className="hover:text-blue-600 transition-colors">Vendors</Link>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">{vendor.displayName}</span>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex gap-6">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                <Building2 size={40} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">{vendor.displayName}</h1>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    vendor.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  )}>
                    {vendor.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-gray-500">
                  <span className="flex items-center gap-1.5 font-mono text-sm">
                    <Tag size={16} />
                    {vendor.vendorCode}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin size={16} />
                    {vendor.primaryBusinessAddress?.city || 'No City'}, {vendor.primaryBusinessAddress?.state || 'No State'}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Globe size={16} />
                    {vendor.website || 'No Website'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-lg bg-white">
                <Edit3 size={20} />
              </button>
              <button 
                onClick={handleArchiveVendor}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors border border-gray-200 rounded-lg bg-white"
              >
                <Archive size={20} />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-lg bg-white">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-8 mt-8 border-b border-gray-200 -mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "pb-4 text-sm font-medium transition-colors relative",
                  activeTab === tab.id ? "text-blue-600" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className={cn(
                    "ml-2 px-1.5 py-0.5 rounded-full text-[10px]",
                    activeTab === tab.id ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                  )}>
                    {tab.count}
                  </span>
                )}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-3 gap-8">
            <div className="col-span-2 space-y-8">
              {/* Basic Info */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6">Business Information</h3>
                <div className="grid grid-cols-2 gap-y-6 gap-x-12">
                  <div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Legal Name</div>
                    <div className="text-gray-900 font-medium">{vendor.legalName}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">DBA Name</div>
                    <div className="text-gray-900">{vendor.dbaName || 'None'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Business Type</div>
                    <div className="text-gray-900">{vendor.businessType}</div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Tax ID</div>
                    <div className="text-gray-900 font-mono">{vendor.taxId || 'Not Provided'}</div>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="grid grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Primary Address</h3>
                  <div className="text-gray-600 space-y-1">
                    <div>{vendor.primaryBusinessAddress?.street1}</div>
                    {vendor.primaryBusinessAddress?.street2 && <div>{vendor.primaryBusinessAddress.street2}</div>}
                    <div>{vendor.primaryBusinessAddress?.city}, {vendor.primaryBusinessAddress?.state} {vendor.primaryBusinessAddress?.zip}</div>
                    <div>{vendor.primaryBusinessAddress?.country}</div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Mailing Address</h3>
                  <div className="text-gray-600 space-y-1">
                    {vendor.mailingAddress ? (
                      <>
                        <div>{vendor.mailingAddress.street1}</div>
                        <div>{vendor.mailingAddress.city}, {vendor.mailingAddress.state} {vendor.mailingAddress.zip}</div>
                      </>
                    ) : (
                      <div className="italic text-gray-400">Same as primary</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {/* Ownership */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Ownership</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <User size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-gray-900">{vendor.ownerDisplayName || 'Unassigned'}</div>
                    <div className="text-xs text-gray-500">Internal Account Owner</div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {vendor.tags?.map((tag: string) => (
                    <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs font-medium">
                      {tag}
                    </span>
                  )) || <span className="text-gray-400 italic text-sm">No tags added</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'brands' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Brands ({brands.length})</h3>
              <button 
                onClick={() => setIsAddingBrand(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus size={18} />
                New Brand Workspace
              </button>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {brands.map(brand => (
                <Link 
                  key={brand.id} 
                  href={`/brands/${brand.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:border-blue-300 transition-all group"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Briefcase size={24} />
                    </div>
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      brand.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {brand.status}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-gray-900 mb-1">{brand.brandName}</h4>
                  <div className="text-xs font-mono text-gray-500 mb-4">{brand.brandCode}</div>
                  
                  <div className="space-y-2 pt-4 border-t border-gray-100">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Pricing</span>
                      <span className="text-gray-700 font-medium">{brand.defaultPricingProfileKey || 'PENDING'}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Operations</span>
                      <span className="text-gray-700 font-medium">{brand.defaultOperationalProfileKey || 'PENDING'}</span>
                    </div>
                  </div>
                </Link>
              ))}
              {brands.length === 0 && (
                <div className="col-span-3 py-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-500">
                  No brands created for this vendor yet.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-gray-900">Contacts ({contacts.length})</h3>
              <button 
                onClick={() => setIsAddingContact(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus size={18} />
                Add Contact
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {contacts.map(contact => (
                    <tr key={contact.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900">{contact.displayName}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{contact.jobTitle || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Mail size={14} className="text-gray-400" />
                          {contact.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <Phone size={14} className="text-gray-400" />
                          {contact.phone || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-gray-400 hover:text-gray-600">
                          <MoreVertical size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {contacts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-gray-400 italic">
                        No contacts added yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {['commercial', 'agreements', 'documents', 'activity', 'handoff', 'notes'].includes(activeTab) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-300 mx-auto mb-4">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">{tabs.find(t => t.id === activeTab)?.label}</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              This section is currently under development and will be available in a future update.
            </p>
          </div>
        )}
      </div>

      {/* Brand Modal */}
      {isAddingBrand && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">New Brand Workspace</h2>
              <button onClick={() => setIsAddingBrand(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateBrand} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Brand Name</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={brandFormData.brandName || ''}
                  onChange={e => setBrandFormData({ ...brandFormData, brandName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Brand Code</label>
                <input
                  required
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  value={brandFormData.brandCode || ''}
                  onChange={e => setBrandFormData({ ...brandFormData, brandCode: e.target.value.toUpperCase() })}
                />
              </div>
              <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex gap-3">
                <AlertCircle className="text-yellow-600 shrink-0" size={20} />
                <div className="text-xs text-yellow-700 leading-relaxed">
                  <strong>Configuration Check:</strong> This brand will attempt to inherit published pricing and operational defaults. If none are found, it will save in a PENDING state.
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingBrand(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      {isAddingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Add Vendor Contact</h2>
              <button onClick={() => setIsAddingContact(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreateContact} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">First Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={contactFormData.firstName || ''}
                    onChange={e => setContactFormData({ ...contactFormData, firstName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Last Name</label>
                  <input
                    required
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={contactFormData.lastName || ''}
                    onChange={e => setContactFormData({ ...contactFormData, lastName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email Address</label>
                <input
                  required
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={contactFormData.email || ''}
                  onChange={e => setContactFormData({ ...contactFormData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Job Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={contactFormData.jobTitle || ''}
                  onChange={e => setContactFormData({ ...contactFormData, jobTitle: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsAddingContact(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Add Contact
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
