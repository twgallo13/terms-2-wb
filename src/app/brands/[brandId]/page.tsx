'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, where, onSnapshot, doc, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { manageBrand, manageSiteApproval, manageBrandContactAssignment, manageQuote } from '@/lib/auth-service';
import { 
  Briefcase, 
  Building2, 
  User, 
  ChevronRight, 
  Archive, 
  Edit3, 
  MoreVertical, 
  AlertCircle,
  Settings2,
  FileText,
  History,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ShieldCheck,
  Globe,
  Users
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function BrandWorkspacePage() {
  const { user, isAuthReady } = useAuth();
  const { brandId } = useParams();
  const router = useRouter();
  const [brand, setBrand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [siteApprovals, setSiteApprovals] = useState<any[]>([]);
  const [contactAssignments, setContactAssignments] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [availableSites, setAvailableSites] = useState<any[]>([]);
  const [vendorContacts, setVendorContacts] = useState<any[]>([]);
  
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [selectedContactId, setSelectedContactId] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isPrimary, setIsPrimary] = useState(false);

  const roleOptions = [
    { key: 'primary_business', label: 'Primary Business' },
    { key: 'legal', label: 'Legal' },
    { key: 'operations', label: 'Operations' },
    { key: 'finance', label: 'Finance' },
    { key: 'returns', label: 'Returns' },
    { key: 'support', label: 'Support' },
    { key: 'signer', label: 'Signer' },
  ];

  useEffect(() => {
    if (!brandId || !isAuthReady || !user) return;

    const brandRef = doc(db, 'brands', brandId as string);
    const unsubscribe = onSnapshot(brandRef, (doc) => {
      if (doc.exists()) {
        const data = doc.exists() ? { id: doc.id, ...doc.data() } as any : null;
        setBrand(data);
        
        // Fetch vendor contacts once we have vendorId
        if (data?.vendorId) {
          const contactsQuery = query(
            collection(db, 'contacts'),
            where('vendorId', '==', data.vendorId),
            where('isArchived', '==', false)
          );
          getDocs(contactsQuery).then(snap => {
            setVendorContacts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          }).catch(err => {
            handleFirestoreError(err, OperationType.LIST, 'contacts');
          });
        }
      } else {
        router.push('/brands');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `brands/${brandId}`);
    });

    const approvalsQuery = query(
      collection(db, 'siteApprovals'),
      where('brandId', '==', brandId),
      where('isArchived', '==', false)
    );
    const unsubscribeApprovals = onSnapshot(approvalsQuery, (snap) => {
      setSiteApprovals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'siteApprovals');
    });

    const assignmentsQuery = query(
      collection(db, 'brandContactAssignments'),
      where('brandId', '==', brandId),
      where('isArchived', '==', false)
    );
    const unsubscribeAssignments = onSnapshot(assignmentsQuery, (snap) => {
      setContactAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'brandContactAssignments');
    });

    const quotesQuery = query(
      collection(db, 'quotes'),
      where('brandId', '==', brandId),
      where('isArchived', '==', false),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeQuotes = onSnapshot(quotesQuery, (snap) => {
      setQuotes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'quotes');
    });

    // Fetch all available sites
    const sitesQuery = query(collection(db, 'sites'), where('isActive', '==', true));
    getDocs(sitesQuery).then(snap => {
      setAvailableSites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(err => {
      handleFirestoreError(err, OperationType.LIST, 'sites');
    });

    return () => {
      unsubscribe();
      unsubscribeApprovals();
      unsubscribeAssignments();
      unsubscribeQuotes();
    };
  }, [brandId, router, isAuthReady, user]);

  const handleArchiveBrand = async () => {
    if (!confirm('Are you sure you want to archive this brand workspace?')) return;
    try {
      await manageBrand('archive', {}, brandId as string);
      router.push(`/vendors/${brand.vendorId}`);
    } catch (error) {
      console.error('Error archiving brand:', error);
      alert('Failed to archive brand');
    }
  };

  const handleAssignSite = async () => {
    if (!selectedSiteId) return;
    const site = availableSites.find(s => s.id === selectedSiteId);
    try {
      await manageSiteApproval('assign', {
        vendorId: brand.vendorId,
        brandId: brand.id,
        siteId: site.id,
        siteCode: site.code,
        siteName: site.name,
      });
      setIsAddingSite(false);
      setSelectedSiteId('');
    } catch (error) {
      console.error('Error assigning site:', error);
      alert('Failed to assign site');
    }
  };

  const handleRemoveSite = async (approvalId: string) => {
    if (!confirm('Remove this site approval?')) return;
    try {
      await manageSiteApproval('remove', {}, approvalId);
    } catch (error) {
      console.error('Error removing site:', error);
      alert('Failed to remove site');
    }
  };

  const handleAssignContact = async () => {
    if (!selectedContactId || selectedRoles.length === 0) return;
    try {
      await manageBrandContactAssignment('assign', {
        vendorId: brand.vendorId,
        brandId: brand.id,
        contactId: selectedContactId,
        roleKeys: selectedRoles,
        isPrimary,
        isActive: true,
      });
      setIsAddingContact(false);
      setSelectedContactId('');
      setSelectedRoles([]);
      setIsPrimary(false);
    } catch (error) {
      console.error('Error assigning contact:', error);
      alert('Failed to assign contact');
    }
  };

  const handleRemoveContact = async (assignmentId: string) => {
    if (!confirm('Remove this contact assignment?')) return;
    try {
      await manageBrandContactAssignment('remove', {}, assignmentId);
    } catch (error) {
      console.error('Error removing contact:', error);
      alert('Failed to remove contact');
    }
  };

  const handleCreateQuote = async () => {
    try {
      setLoading(true);
      const result = await manageQuote('create', {
        vendorId: brand.vendorId,
        brandId: brand.id
      });
      router.push(`/quotes/${result.id}`);
    } catch (error) {
      console.error('Error creating quote:', error);
      alert('Failed to create quote. Check if brand and vendor are correctly configured.');
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading brand workspace...</div>;
  if (!brand) return null;

  const isConfigComplete = brand.defaultPricingProfileKey && brand.defaultOperationalProfileKey;
  const hasSites = siteApprovals.length > 0;
  const hasPrimaryContact = contactAssignments.some(a => a.isPrimary && a.roleKeys.includes('primary_business'));
  const hasPrimarySigner = contactAssignments.some(a => a.isPrimary && a.roleKeys.includes('signer'));

  const warnings = [];
  if (!isConfigComplete) warnings.push('Missing default configuration profiles.');
  if (!hasSites) warnings.push('No sites approved for this brand.');
  if (!hasPrimaryContact) warnings.push('No primary business contact assigned.');
  if (!hasPrimarySigner) warnings.push('No primary signer assigned.');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/vendors" className="hover:text-blue-600 transition-colors">Vendors</Link>
            <ChevronRight size={14} />
            <Link href={`/vendors/${brand.vendorId}`} className="hover:text-blue-600 transition-colors">{brand.vendorName}</Link>
            <ChevronRight size={14} />
            <span className="text-gray-900 font-medium">{brand.brandName}</span>
          </div>

          <div className="flex justify-between items-start">
            <div className="flex gap-6">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                <Briefcase size={40} />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-bold text-gray-900">{brand.brandName}</h1>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    brand.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                  )}>
                    {brand.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-gray-500">
                  <span className="flex items-center gap-1.5 font-mono text-sm">
                    {brand.brandCode}
                  </span>
                  <Link href={`/vendors/${brand.vendorId}`} className="flex items-center gap-1.5 hover:text-blue-600 transition-colors">
                    <Building2 size={16} />
                    {brand.vendorName}
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-lg bg-white">
                <Edit3 size={20} />
              </button>
              <button 
                onClick={handleArchiveBrand}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors border border-gray-200 rounded-lg bg-white"
              >
                <Archive size={20} />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors border border-gray-200 rounded-lg bg-white">
                <MoreVertical size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-3 gap-8">
          <div className="col-span-2 space-y-8">
            {/* Warnings Banner */}
            {warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center text-yellow-600 shrink-0">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-yellow-900">Workspace Incomplete</h4>
                  <ul className="mt-2 space-y-1">
                    {warnings.map((w, i) => (
                      <li key={i} className="text-yellow-700 text-sm flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-yellow-400" />
                        {w}
                      </li>
                    ))}
                  </ul>
                  <p className="text-yellow-600 text-xs mt-4 italic">
                    Quotes and agreements cannot be generated until setup is complete.
                  </p>
                </div>
              </div>
            )}

            {/* Config Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Settings2 size={20} className="text-gray-400" />
                  Configuration Defaults
                </h3>
              </div>
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                <div className="p-6">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Pricing Profile</div>
                  {brand.defaultPricingProfileKey ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{brand.defaultPricingProfileKey}</div>
                        <div className="text-xs text-gray-500">Version {brand.defaultPricingProfileVersion}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-gray-400 italic">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                      <span className="text-sm">No pricing profile assigned</span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-4">Operational Profile</div>
                  {brand.defaultOperationalProfileKey ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                        <CheckCircle2 size={20} />
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{brand.defaultOperationalProfileKey}</div>
                        <div className="text-xs text-gray-500">Version {brand.defaultOperationalProfileVersion}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-gray-400 italic">
                      <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                      <span className="text-sm">No operational profile assigned</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Site Approvals */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Globe size={20} className="text-gray-400" />
                  Site Approvals
                </h3>
                <button 
                  onClick={() => setIsAddingSite(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Add Site
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {siteApprovals.map(approval => (
                  <div key={approval.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                        <Globe size={16} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{approval.siteName}</div>
                        <div className="text-[10px] font-mono text-gray-500 uppercase">{approval.siteCode}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">APPROVED</span>
                      <button 
                        onClick={() => handleRemoveSite(approval.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {siteApprovals.length === 0 && (
                  <div className="p-8 text-center text-gray-400 italic text-sm">
                    No sites approved yet.
                  </div>
                )}
              </div>
            </div>

            {/* Contact Assignments */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Users size={20} className="text-gray-400" />
                  Contact Roles
                </h3>
                <button 
                  onClick={() => setIsAddingContact(true)}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <Plus size={16} />
                  Assign Contact
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {contactAssignments.map(assignment => {
                  const contact = vendorContacts.find(c => c.id === assignment.contactId);
                  return (
                    <div key={assignment.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500">
                          <User size={16} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                            {contact?.displayName || 'Unknown Contact'}
                            {assignment.isPrimary && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Primary</span>
                            )}
                          </div>
                          <div className="flex gap-1 mt-1">
                            {assignment.roleKeys.map((rk: string) => (
                              <span key={rk} className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-md">
                                {roleOptions.find(o => o.key === rk)?.label || rk}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveContact(assignment.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
                {contactAssignments.length === 0 && (
                  <div className="p-8 text-center text-gray-400 italic text-sm">
                    No contacts assigned to this brand yet.
                  </div>
                )}
              </div>
            </div>

            {/* Quotes Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={20} className="text-gray-400" />
                  Quotes
                </h3>
                <button 
                  onClick={handleCreateQuote}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-bold flex items-center gap-2"
                >
                  <Plus size={16} />
                  Create Quote
                </button>
              </div>
              <div className="divide-y divide-gray-100">
                {quotes.map(quote => (
                  <Link 
                    key={quote.id} 
                    href={`/quotes/${quote.id}`}
                    className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                          {quote.quoteNumber}
                        </div>
                        <div className="text-[10px] text-gray-500 flex items-center gap-2">
                          <span className="uppercase">{quote.status}</span>
                          <span>•</span>
                          <span>v{quote.currentVersionNumber}</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" />
                  </Link>
                ))}
                {quotes.length === 0 && (
                  <div className="p-8 text-center text-gray-400 italic text-sm">
                    No quotes generated for this brand yet.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {/* Summary Pointers */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-6">Key Pointers</h3>
              <div className="space-y-6">
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Primary Signer</div>
                  {hasPrimarySigner ? (
                    <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-xl border border-blue-100">
                      <ShieldCheck size={18} className="text-blue-600" />
                      <div className="text-sm font-bold text-blue-900">
                        {vendorContacts.find(c => c.id === brand.primarySignerContactId)?.displayName}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Unassigned
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Primary Business Contact</div>
                  {hasPrimaryContact ? (
                    <div className="flex items-center gap-3 p-2 bg-blue-50 rounded-xl border border-blue-100">
                      <User size={18} className="text-blue-600" />
                      <div className="text-sm font-bold text-blue-900">
                        {vendorContacts.find(c => c.id === brand.primaryExternalContactId)?.displayName}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Unassigned
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Approved Sites Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Approved Sites</h3>
              <div className="flex flex-wrap gap-2">
                {brand.approvedSiteCodes?.map((code: string) => (
                  <span key={code} className="px-2 py-1 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-bold font-mono">
                    {code}
                  </span>
                )) || <span className="text-gray-400 italic text-sm">None approved</span>}
              </div>
            </div>

            {/* History Link */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Activity</h3>
              <button className="w-full flex items-center justify-between p-3 hover:bg-gray-50 rounded-xl transition-colors group">
                <div className="flex items-center gap-3">
                  <History size={18} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">View Activity Log</span>
                </div>
                <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Site Assignment Modal */}
      {isAddingSite && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Approve Site</h2>
              <button onClick={() => setIsAddingSite(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Select Site</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedSiteId}
                  onChange={e => setSelectedSiteId(e.target.value)}
                >
                  <option value="">Choose a site...</option>
                  {availableSites
                    .filter(s => !siteApprovals.some(a => a.siteId === s.id))
                    .map(site => (
                      <option key={site.id} value={site.id}>{site.name} ({site.code})</option>
                    ))
                  }
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setIsAddingSite(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignSite}
                  disabled={!selectedSiteId}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  Approve Site
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Assignment Modal */}
      {isAddingContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">Assign Brand Contact</h2>
              <button onClick={() => setIsAddingContact(false)} className="text-gray-400 hover:text-gray-600">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Select Contact</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  value={selectedContactId}
                  onChange={e => setSelectedContactId(e.target.value)}
                >
                  <option value="">Choose a contact...</option>
                  {vendorContacts.map(contact => (
                    <option key={contact.id} value={contact.id}>{contact.displayName} ({contact.email})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Roles</label>
                <div className="grid grid-cols-2 gap-2">
                  {roleOptions.map(role => (
                    <label key={role.key} className="flex items-center gap-2 p-2 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.key)}
                        onChange={e => {
                          if (e.target.checked) setSelectedRoles([...selectedRoles, role.key]);
                          else setSelectedRoles(selectedRoles.filter(r => r !== role.key));
                        }}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-700">{role.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                <input
                  type="checkbox"
                  id="isPrimary"
                  checked={isPrimary}
                  onChange={e => setIsPrimary(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isPrimary" className="text-xs font-bold text-blue-700 cursor-pointer">
                  Mark as Primary for these roles
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => setIsAddingContact(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignContact}
                  disabled={!selectedContactId || selectedRoles.length === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                >
                  Assign Roles
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
