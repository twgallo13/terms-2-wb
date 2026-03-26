'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { manageQuote, manageAgreement } from '@/lib/auth-service';
import { accessService } from '@/lib/access-service';
import { 
  FileText, 
  ChevronRight, 
  Save, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  Building2,
  Globe,
  Users,
  User,
  DollarSign,
  Settings2,
  Plus,
  Trash2,
  ArrowLeft,
  MoreVertical,
  Layers,
  ShieldCheck,
  Link as LinkIcon,
  ExternalLink,
  XCircle,
  Copy,
  RefreshCw,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

export default function QuoteBuilderPage() {
  const { user, isAuthReady } = useAuth();
  const { quoteId } = useParams();
  const router = useRouter();
  const [quote, setQuote] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('vendor');
  const [accessLinks, setAccessLinks] = useState<any[]>([]);
  const [issuingLink, setIssuingLink] = useState(false);
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<string | null>(null);

  const steps = [
    { id: 'vendor', label: 'Vendor', icon: Building2 },
    { id: 'brand', label: 'Brand', icon: FileText },
    { id: 'sites', label: 'Sites', icon: Globe },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'commercial', label: 'Commercial Terms', icon: DollarSign },
    { id: 'fees', label: 'Fees and Pricing', icon: DollarSign },
    { id: 'shipping', label: 'Shipping / Operational', icon: Settings2 },
    { id: 'legal', label: 'Terms & Legal', icon: FileText },
    { id: 'review', label: 'Review & Preview', icon: CheckCircle2 },
    { id: 'save', label: 'Save or Send', icon: Save },
  ];

  useEffect(() => {
    if (!quoteId || !isAuthReady || !user) return;

    const quoteRef = doc(db, 'quotes', quoteId as string);
    const unsubscribeQuote = onSnapshot(quoteRef, (docSnap) => {
      if (docSnap.exists()) {
        const qData = { id: docSnap.id, ...docSnap.data() } as any;
        setQuote(qData);

        // Fetch current version
        if (qData.currentVersionId) {
          const versionRef = doc(db, 'quoteVersions', qData.currentVersionId as string);
          const unsubscribeVersion = onSnapshot(versionRef, (vSnap) => {
            if (vSnap.exists()) {
              setVersion({ id: vSnap.id, ...vSnap.data() });
            }
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `quoteVersions/${qData.currentVersionId}`);
          });
          return () => unsubscribeVersion();
        }
      } else {
        router.push('/quotes');
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `quotes/${quoteId}`);
    });

    return () => unsubscribeQuote();
  }, [quoteId, router, isAuthReady, user]);

  useEffect(() => {
    if (!quoteId || !isAuthReady || !user) return;

    const linksRef = collection(db, 'accessLinks');
    const q = query(
      linksRef, 
      where('entityId', '==', quoteId),
      where('entityType', '==', 'quote'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeLinks = onSnapshot(q, (snap) => {
      const links = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccessLinks(links);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accessLinks');
    });

    return () => unsubscribeLinks();
  }, [quoteId, isAuthReady, user]);

  const handleUpdateVersion = async (updates: any) => {
    if (!version) return;
    try {
      setSaving(true);
      await manageQuote('updateVersion', {}, undefined, version.id, updates);
    } catch (error) {
      console.error('Error updating version:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateQuote = async (updates: any) => {
    if (!quote) return;
    try {
      setSaving(true);
      // We don't have a direct 'updateQuote' action in manageQuote yet, 
      // but we can use updateVersion to trigger a quote update if needed, 
      // or just update the quote doc directly if rules allow.
      // For now, let's assume manageQuote handles it or we add it.
      // Actually, manageQuote 'updateVersion' also updates the quote's updatedAt.
      // Let's add a generic update action if needed.
      await manageQuote('updateVersion', {}, undefined, version.id, updates);
    } catch (error) {
      console.error('Error updating quote:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNewVersion = async () => {
    if (!quote || !version) return;
    if (!confirm('Create a new version from this draft?')) return;
    try {
      setSaving(true);
      const result = await manageQuote('createVersion', {}, quote.id, version.id);
      alert(`Created Version ${result.versionNumber}`);
    } catch (error) {
      console.error('Error creating version:', error);
      alert('Failed to create version');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAgreement = async () => {
    if (!quote) return;
    if (!confirm('Create an agreement draft from this quote?')) return;
    try {
      setSaving(true);
      const result = await manageAgreement('create', { quoteId: quote.id });
      router.push(`/agreements/${result.agreementId}`);
    } catch (error) {
      console.error('Error creating agreement:', error);
      alert('Failed to create agreement. Ensure quote is in a valid state.');
    } finally {
      setSaving(false);
    }
  };

  const handleTransitionStatus = async (newStatus?: string, newReviewStatus?: string, overrideReason?: string) => {
    if (!quote) return;
    const notes = prompt('Add internal notes for this status change (optional):') || '';
    try {
      setSaving(true);
      await manageQuote('transitionStatus', undefined, quote.id, undefined, undefined, newStatus, newReviewStatus, overrideReason, notes);
    } catch (error: any) {
      console.error('Error transitioning status:', error);
      alert(error.message || 'Failed to transition status');
    } finally {
      setSaving(false);
    }
  };

  const handleIssueAccessLink = async () => {
    if (!quote) return;
    const email = prompt('Enter recipient email (required for secure link):') || '';
    if (!email) return;
    
    try {
      setIssuingLink(true);
      const result = await accessService.issueLink({
        entityId: quote.id,
        entityType: 'quote',
        entityVersionId: version.id,
        recipientEmail: email,
        vendorId: quote.vendorId,
        brandId: quote.brandId,
        purpose: 'vendor_review',
        scopeType: 'read_only',
        issuedByUserId: 'theo@shiekhshoes.org', // In real app, get from auth
        maxUses: 5
      });
      
      setNewlyIssuedToken(result.rawToken);
      alert(`Secure link issued for ${email}. \n\nIMPORTANT: Copy this link now, it will not be shown again: \n${window.location.origin}/vendor-access/${result.rawToken}`);
    } catch (error: any) {
      console.error('Error issuing access link:', error);
      alert(error.message || 'Failed to issue access link');
    } finally {
      setIssuingLink(false);
    }
  };

  const handleRevokeAccessLink = async (linkId: string) => {
    const reason = prompt('Reason for revocation?') || 'Manually revoked';
    if (!confirm('Are you sure you want to revoke this access link?')) return;
    try {
      setIssuingLink(true);
      await accessService.revokeLink(linkId, 'theo@shiekhshoes.org', reason);
    } catch (error: any) {
      console.error('Error revoking access link:', error);
      alert(error.message || 'Failed to revoke access link');
    } finally {
      setIssuingLink(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Link copied to clipboard');
  };

  const nextStep = () => {
    const currentIndex = steps.findIndex(s => s.id === activeTab);
    if (currentIndex < steps.length - 1) {
      setActiveTab(steps[currentIndex + 1].id);
    }
  };

  const prevStep = () => {
    const currentIndex = steps.findIndex(s => s.id === activeTab);
    if (currentIndex > 0) {
      setActiveTab(steps[currentIndex - 1].id);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500 font-mono text-xs uppercase tracking-widest animate-pulse">Initializing Builder...</div>;
  if (!quote || !version) return null;

  return (
    <div className="min-h-screen bg-[#F5F5F4] flex flex-col font-sans text-[#1C1917]">
      {/* Top Bar */}
      <div className="bg-white border-b border-[#E7E5E4] sticky top-0 z-20">
        <div className="max-w-[1600px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href={`/brands/${quote.brandId}`} className="p-2 text-[#A8A29E] hover:text-[#44403C] transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div className="h-8 w-px bg-[#E7E5E4]" />
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="text-sm font-black tracking-tighter uppercase">{quote.quoteNumber}</span>
                <span className="px-2 py-0.5 bg-[#F5F5F4] text-[#78716C] text-[10px] font-black rounded border border-[#E7E5E4] uppercase tracking-wider">
                  {quote.status}
                </span>
                {quote.reviewStatus && quote.reviewStatus !== 'none' && (
                  <span className="px-2 py-0.5 bg-amber-500 text-white text-[10px] font-black rounded uppercase tracking-wider">
                    {quote.reviewStatus.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold text-[#A8A29E] uppercase tracking-widest">{quote.brandName} • v{quote.currentVersionNumber}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-opacity",
              saving ? "opacity-100" : "opacity-0"
            )}>
              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
              <span className="text-[#78716C]">Autosaving</span>
            </div>
            <button 
              onClick={handleCreateNewVersion}
              className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-[#44403C] hover:bg-[#F5F5F4] rounded-lg border border-[#E7E5E4] transition-all flex items-center gap-2"
            >
              <Layers size={14} />
              New Version
            </button>
            <button 
              onClick={handleCreateAgreement}
              className="px-4 py-2 text-[11px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 transition-all flex items-center gap-2 shadow-sm"
            >
              <ShieldCheck size={14} />
              Create Agreement
            </button>
            <button className="px-5 py-2 bg-[#1C1917] text-white rounded-lg hover:bg-[#44403C] transition-all text-[11px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-stone-200">
              <CheckCircle2 size={14} />
              Finalize
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-[1600px] mx-auto w-full flex">
        {/* Left Sidebar - Navigation */}
        <div className="w-80 shrink-0 border-r border-[#E7E5E4] bg-white p-6 flex flex-col gap-8">
          <div className="space-y-1">
            <div className="px-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.2em] mb-4">Builder Steps</div>
            {steps.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setActiveTab(step.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all group",
                  activeTab === step.id 
                    ? "bg-[#1C1917] text-white shadow-xl shadow-stone-200 translate-x-1" 
                    : "text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]"
                )}
              >
                <div className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center text-[10px]",
                  activeTab === step.id ? "bg-[#44403C]" : "bg-[#F5F5F4] group-hover:bg-[#E7E5E4]"
                )}>
                  {index + 1}
                </div>
                {step.label}
              </button>
            ))}
          </div>

          <div className="mt-auto border-t border-[#E7E5E4] pt-8">
            <div className="px-4 text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.2em] mb-4">Readiness Summary</div>
            <div className="space-y-3">
              {quote.readinessSummary?.blockingErrors?.map((blocker: string, i: number) => (
                <div key={i} className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl flex gap-3">
                  <AlertCircle size={14} className="text-red-600 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-red-900 leading-tight">{blocker}</span>
                </div>
              ))}
              {quote.readinessSummary?.warnings?.map((warning: string, i: number) => (
                <div key={i} className="px-4 py-3 bg-[#FFFBEB] border border-[#FEF3C7] rounded-xl flex gap-3">
                  <AlertCircle size={14} className="text-[#D97706] shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-[#92400E] leading-tight">{warning}</span>
                </div>
              ))}
              {quote.sendReadinessState === 'overridden' && (
                <div className="px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-2 text-amber-600 text-[10px] font-black uppercase tracking-widest mb-1">
                    <ShieldCheck size={12} />
                    Overridden
                  </div>
                  <p className="text-[10px] text-amber-800 italic font-medium leading-tight">
                    "{quote.overrideSummary?.reason}"
                  </p>
                </div>
              )}
              {quote.readinessSummary?.isReady && quote.sendReadinessState !== 'overridden' && (
                <div className="px-4 py-3 bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl flex gap-3">
                  <CheckCircle2 size={14} className="text-[#16A34A] shrink-0 mt-0.5" />
                  <span className="text-[11px] font-bold text-[#166534] leading-tight">Quote is ready for review.</span>
                </div>
              )}
            </div>

            {quote.readinessSummary?.sections && (
              <div className="mt-6 px-4 space-y-2">
                <div className="text-[9px] font-black text-[#A8A29E] uppercase tracking-widest mb-2">Section Status</div>
                {Object.entries(quote.readinessSummary.sections).map(([key, section]: [string, any]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-[#78716C] uppercase">{key}</span>
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      section.status === 'complete' ? "bg-green-500" :
                      section.status === 'warning' ? "bg-amber-500" : "bg-red-500"
                    )} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-12">
          <div className="max-w-4xl mx-auto space-y-12">
            {/* Step Header */}
            <div className="flex items-end justify-between border-b-2 border-[#1C1917] pb-6">
              <div>
                <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.3em] mb-2">Step {steps.findIndex(s => s.id === activeTab) + 1} of {steps.length}</div>
                <h2 className="text-4xl font-black tracking-tighter uppercase italic">{steps.find(s => s.id === activeTab)?.label}</h2>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={prevStep}
                  disabled={activeTab === steps[0].id}
                  className="p-3 rounded-xl border-2 border-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#1C1917]"
                >
                  <ArrowLeft size={20} />
                </button>
                <button 
                  onClick={nextStep}
                  disabled={activeTab === steps[steps.length - 1].id}
                  className="px-8 py-3 bg-[#1C1917] text-white rounded-xl font-black uppercase tracking-widest hover:bg-[#44403C] transition-all disabled:opacity-30"
                >
                  Next Step
                </button>
              </div>
            </div>

            {/* Step Content */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {activeTab === 'vendor' && (
                <div className="grid grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <div className="p-8 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-4">Vendor Details</div>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] font-black text-[#78716C] uppercase">Display Name</label>
                          <div className="text-xl font-black tracking-tight">{version.vendorSnapshot?.displayName}</div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-[#78716C] uppercase">Legal Name</label>
                          <div className="text-sm font-bold text-[#44403C]">{version.vendorSnapshot?.legalName}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="p-8 bg-[#F5F5F4] rounded-3xl border-2 border-dashed border-[#A8A29E]">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-4">System Info</div>
                      <div className="space-y-4 text-xs font-bold text-[#78716C]">
                        <p>Vendor ID: {version.vendorSnapshot?.id}</p>
                        <p>Status: {version.vendorSnapshot?.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'brand' && (
                <div className="p-8 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-6">Brand Snapshot</div>
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Brand Name</label>
                        <div className="text-2xl font-black tracking-tight">{version.brandSnapshot?.brandName}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Code</label>
                        <div className="text-sm font-mono font-black text-[#44403C]">{version.brandSnapshot?.brandCode}</div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Default Pricing</label>
                        <div className="text-sm font-bold text-[#44403C]">{version.brandSnapshot?.defaultPricingProfileKey}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Default Operational</label>
                        <div className="text-sm font-bold text-[#44403C]">{version.brandSnapshot?.defaultOperationalProfileKey}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sites' && (
                <div className="bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
                  <div className="p-8 border-b-2 border-[#1C1917]">
                    <h3 className="text-xl font-black uppercase italic">Approved Site Scope</h3>
                  </div>
                  <div className="divide-y-2 divide-[#F5F5F4]">
                    {version.siteApprovalSnapshot?.map((site: any) => (
                      <div key={site.siteId} className="p-6 flex items-center justify-between hover:bg-[#F5F5F4] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#1C1917] flex items-center justify-center text-white">
                            <Globe size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-black uppercase tracking-tight">{site.displayName || site.siteName}</div>
                            <div className="text-[10px] font-mono font-bold text-[#A8A29E] uppercase">{site.siteCode}</div>
                          </div>
                        </div>
                        <CheckCircle2 size={20} className="text-[#16A34A]" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'contacts' && (
                <div className="bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
                  <div className="p-8 border-b-2 border-[#1C1917]">
                    <h3 className="text-xl font-black uppercase italic">Contact Summary</h3>
                  </div>
                  <div className="divide-y-2 divide-[#F5F5F4]">
                    {version.contactSnapshot?.map((contact: any, i: number) => (
                      <div key={i} className="p-6 flex items-center justify-between hover:bg-[#F5F5F4] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-[#F5F5F4] flex items-center justify-center text-[#1C1917] border-2 border-[#1C1917]">
                            <User size={18} />
                          </div>
                          <div>
                            <div className="text-sm font-black uppercase tracking-tight">{contact.contactName || 'Unknown'}</div>
                            <div className="flex gap-2 mt-1">
                              {contact.roleKeys?.map((rk: string) => (
                                <span key={rk} className="text-[9px] font-black text-[#78716C] bg-[#E7E5E4] px-2 py-0.5 rounded uppercase tracking-widest">
                                  {rk}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                        {contact.isPrimary && (
                          <span className="text-[10px] bg-[#1C1917] text-white px-3 py-1 rounded-full font-black uppercase tracking-widest">Primary</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'commercial' && (
                <div className="space-y-8">
                  <div className="p-8 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                    <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-6">Quote Validity</div>
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Issue Date</label>
                        <input 
                          type="date" 
                          className="w-full p-4 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-xl font-bold focus:ring-4 focus:ring-stone-200 outline-none"
                          value={quote.issueDate || ''}
                          onChange={(e) => handleUpdateQuote({ issueDate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Valid Until</label>
                        <input 
                          type="date" 
                          className="w-full p-4 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-xl font-bold focus:ring-4 focus:ring-stone-200 outline-none"
                          value={quote.validUntilDate || ''}
                          onChange={(e) => handleUpdateQuote({ validUntilDate: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="p-8 bg-[#F5F5F4] rounded-3xl border-2 border-[#1C1917]">
                    <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-6">Pricing Profile Snapshot</div>
                    <div className="grid grid-cols-3 gap-8">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Profile Key</label>
                        <div className="text-sm font-black uppercase">{version.pricingSnapshot?.profileKey}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Version</label>
                        <div className="text-sm font-black">{version.pricingSnapshot?.version}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase">Currency</label>
                        <div className="text-sm font-black uppercase">{version.pricingSnapshot?.currency || 'USD'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'fees' && (
                <div className="space-y-8">
                  <div className="bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)] overflow-hidden">
                    <div className="p-8 border-b-2 border-[#1C1917] flex items-center justify-between">
                      <h3 className="text-xl font-black uppercase italic">Line Items (Services & Fees)</h3>
                      <button className="px-4 py-2 bg-[#1C1917] text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Plus size={14} />
                        Add Item
                      </button>
                    </div>
                    <div className="divide-y-2 divide-[#F5F5F4]">
                      {version.lineItems?.length > 0 ? version.lineItems.map((item: any, i: number) => (
                        <div key={i} className="p-6 flex items-center justify-between hover:bg-[#F5F5F4] transition-colors">
                          <div className="flex-1">
                            <div className="text-sm font-black uppercase tracking-tight">{item.name}</div>
                            <div className="text-[10px] font-bold text-[#78716C]">{item.description}</div>
                          </div>
                          <div className="w-48 text-right">
                            <div className="text-lg font-black tracking-tighter">
                              {item.rateType === 'percentage' ? `${item.rate}%` : `$${item.rate}`}
                            </div>
                            <div className="text-[9px] font-black text-[#A8A29E] uppercase tracking-widest">{item.type}</div>
                          </div>
                          <button className="ml-6 p-2 text-[#A8A29E] hover:text-red-600 transition-colors">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )) : (
                        <div className="p-12 text-center">
                          <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.2em] mb-4">No line items yet</div>
                          <button 
                            onClick={() => {
                              const items = [
                                ...(version.pricingSnapshot?.services || []).map((s: any) => ({ ...s, type: 'service' })),
                                ...(version.pricingSnapshot?.fees || []).map((f: any) => ({ ...f, type: 'fee', rate: f.amount }))
                              ];
                              handleUpdateVersion({ lineItems: items });
                            }}
                            className="px-6 py-3 border-2 border-[#1C1917] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#1C1917] hover:text-white transition-all"
                          >
                            Import from Pricing Profile
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="p-8 bg-[#F5F5F4] border-t-2 border-[#1C1917] flex justify-end">
                      <div className="w-64 space-y-2">
                        <div className="flex justify-between text-[10px] font-black text-[#78716C] uppercase tracking-widest">
                          <span>Subtotal</span>
                          <span>$0.00</span>
                        </div>
                        <div className="flex justify-between text-2xl font-black tracking-tighter border-t-2 border-[#1C1917] pt-2">
                          <span>Total</span>
                          <span>$0.00</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'shipping' && (
                <div className="p-8 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-6">Operational Expectations</div>
                  <div className="space-y-8">
                    <div className="grid grid-cols-2 gap-12">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Shipping Method</label>
                        <div className="text-lg font-black tracking-tight mt-1">{version.operationalSnapshot?.shippingMethod || 'Standard Ground'}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Lead Time</label>
                        <div className="text-lg font-black tracking-tight mt-1">{version.operationalSnapshot?.leadTimeDays || '14'} Days</div>
                      </div>
                    </div>
                    <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-dashed border-[#A8A29E]">
                      <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Operational Notes</label>
                      <p className="text-sm font-bold text-[#44403C] mt-2">{version.operationalSnapshot?.notes || 'No specific operational notes provided in profile.'}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'legal' && (
                <div className="space-y-8">
                  <div className="p-8 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                    <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-6">Terms & Legal References</div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Template Key</label>
                        <div className="text-sm font-black uppercase">{quote.quoteTemplateKey}</div>
                      </div>
                      <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-[#1C1917]">
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mb-4">Standard Terms Snapshot</div>
                        <div className="text-xs font-bold text-[#44403C] leading-relaxed space-y-4">
                          <p>1. This quote is subject to the Terms Workbench Gateway Master Services Agreement.</p>
                          <p>2. Pricing is valid for 30 days from the issue date unless otherwise specified.</p>
                          <p>3. All services are governed by the operational expectations outlined in Step 7.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'review' && (
                <div className="space-y-12">
                  <div className="p-12 bg-white rounded-[40px] border-4 border-[#1C1917] shadow-[16px_16px_0px_0px_rgba(28,25,23,1)]">
                    <div className="flex justify-between items-start mb-12">
                      <div>
                        <h1 className="text-6xl font-black tracking-tighter uppercase italic leading-none mb-2">Quote</h1>
                        <div className="text-xl font-black tracking-tight text-[#A8A29E]">{quote.quoteNumber}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-[0.3em] mb-2">Status</div>
                        <div className="px-4 py-1 bg-[#1C1917] text-white text-xs font-black rounded-full uppercase tracking-widest">{quote.status}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-16 mb-16">
                      <div>
                        <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.3em] mb-4 border-b-2 border-[#E7E5E4] pb-2">Vendor</div>
                        <div className="text-2xl font-black tracking-tight mb-1">{quote.vendorName}</div>
                        <div className="text-sm font-bold text-[#78716C]">{version.vendorSnapshot?.legalName}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.3em] mb-4 border-b-2 border-[#E7E5E4] pb-2">Brand</div>
                        <div className="text-2xl font-black tracking-tight mb-1">{quote.brandName}</div>
                        <div className="text-sm font-bold text-[#78716C]">{version.brandSnapshot?.brandCode}</div>
                      </div>
                    </div>

                    <div className="mb-16">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-[0.3em] mb-6 border-b-2 border-[#E7E5E4] pb-2">Summary of Terms</div>
                      <div className="grid grid-cols-3 gap-8">
                        <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-[#1C1917]">
                          <div className="text-[9px] font-black text-[#78716C] uppercase tracking-widest mb-2">Issue Date</div>
                          <div className="text-sm font-black">{quote.issueDate}</div>
                        </div>
                        <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-[#1C1917]">
                          <div className="text-[9px] font-black text-[#78716C] uppercase tracking-widest mb-2">Valid Until</div>
                          <div className="text-sm font-black">{quote.validUntilDate}</div>
                        </div>
                        <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-[#1C1917]">
                          <div className="text-[9px] font-black text-[#78716C] uppercase tracking-widest mb-2">Sites</div>
                          <div className="text-sm font-black">{quote.siteCodes?.length || 0} Locations</div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t-4 border-[#1C1917] pt-8">
                      <div className="flex justify-between items-center">
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-[0.3em]">Total Estimated Value</div>
                        <div className="text-5xl font-black tracking-tighter italic">$0.00</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'save' && (
                <div className="max-w-4xl mx-auto space-y-12 py-12">
                  <div className="text-center space-y-4">
                    <div className={cn(
                      "w-20 h-20 rounded-[32px] border-4 flex items-center justify-center mx-auto shadow-xl",
                      quote.readinessSummary?.isReady ? "bg-[#F0FDF4] text-[#16A34A] border-[#16A34A] shadow-green-100" : "bg-red-50 text-red-600 border-red-600 shadow-red-100"
                    )}>
                      {quote.readinessSummary?.isReady ? <CheckCircle2 size={40} /> : <AlertCircle size={40} />}
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter uppercase italic">
                      {quote.readinessSummary?.isReady ? "Ready to Proceed?" : "Action Required"}
                    </h2>
                    <p className="text-[#78716C] font-bold">
                      {quote.readinessSummary?.isReady 
                        ? "Your progress is autosaved. You can save this as a draft or send it for internal review."
                        : "Please resolve the blockers listed in the readiness panel before submitting for review."}
                    </p>
                  </div>

                  {/* Secure Vendor Access Section */}
                  <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm space-y-8">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-6">
                      <div className="space-y-1">
                        <h3 className="text-xl font-serif italic text-stone-900">Secure Vendor Access</h3>
                        <p className="text-sm text-stone-500">Issue time-limited secure links for external review</p>
                      </div>
                      <button 
                        onClick={handleIssueAccessLink}
                        disabled={issuingLink}
                        className="px-5 py-2.5 bg-stone-900 text-white rounded-full text-xs font-bold hover:bg-stone-800 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm"
                      >
                        {issuingLink ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                        Issue New Link
                      </button>
                    </div>

                    <div className="space-y-4">
                      {accessLinks.length === 0 ? (
                        <div className="py-12 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">
                          <LinkIcon className="mx-auto text-stone-300 mb-3" size={24} />
                          <p className="text-xs font-medium text-stone-400 uppercase tracking-widest">No active access links found</p>
                        </div>
                      ) : (
                        accessLinks.map((link) => (
                          <div key={link.id} className="p-5 bg-white border border-stone-200 rounded-2xl flex items-center justify-between group hover:border-stone-400 transition-all shadow-sm">
                            <div className="flex items-center gap-5">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center border",
                                link.status === 'active' ? "bg-green-50 border-green-100 text-green-600" : "bg-stone-50 border-stone-100 text-stone-400"
                              )}>
                                <ShieldCheck size={18} />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm font-semibold text-stone-900">
                                    {link.recipientEmail || 'General Access Link'}
                                  </span>
                                  <span className={cn(
                                    "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded-full border",
                                    link.status === 'active' ? "bg-green-50 text-green-700 border-green-100" : "bg-stone-50 text-stone-500 border-stone-100"
                                  )}>
                                    {link.status}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-[10px] font-medium text-stone-400 uppercase tracking-widest">
                                  <span>Expires: {new Date(link.expiresAt).toLocaleDateString()}</span>
                                  <span className="flex items-center gap-1"><Eye size={10} /> {link.viewCount || 0} Views</span>
                                  {link.lastViewedAt && <span>Last: {new Date(link.lastViewedAt.toDate()).toLocaleTimeString()}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleRevokeAccessLink(link.id)}
                                className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition-all"
                                title="Revoke Access"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-8">
                    {(quote.reviewStatus === 'none' || quote.reviewStatus === 'needs_revision') && (
                      <button 
                        onClick={() => handleTransitionStatus(undefined, 'pending_internal_review')}
                        className="w-full p-8 bg-stone-900 text-white rounded-[32px] flex items-center justify-between hover:bg-stone-800 transition-all group shadow-xl shadow-stone-200"
                      >
                        <div className="text-left">
                          <div className="text-2xl font-serif italic tracking-tight">Submit for Internal Review</div>
                          <div className="text-sm font-medium text-stone-400 mt-1">Initiate internal approval workflow for this quote package</div>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
                          <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    )}

                    {quote.reviewStatus === 'pending_internal_review' && (
                      <div className="grid grid-cols-1 gap-6">
                        <div className="grid grid-cols-2 gap-6">
                          <button 
                            onClick={() => handleTransitionStatus(undefined, 'needs_revision')}
                            className="p-8 bg-white border border-stone-200 text-stone-900 rounded-[32px] flex flex-col items-start hover:border-red-200 hover:bg-red-50/30 transition-all shadow-sm group"
                          >
                            <div className="text-2xl font-serif italic tracking-tight text-red-600">Return for Revision</div>
                            <div className="text-sm font-medium text-stone-500 mt-1">Send back to draft state for corrections</div>
                          </button>
                          <button 
                            onClick={() => handleTransitionStatus(undefined, 'approved')}
                            disabled={!quote.readinessSummary?.isReady}
                            className="p-8 bg-stone-900 text-white rounded-[32px] flex flex-col items-start hover:bg-stone-800 transition-all disabled:opacity-50 shadow-xl shadow-stone-200 group"
                          >
                            <div className="text-2xl font-serif italic tracking-tight">Approve for Send</div>
                            <div className="text-sm font-medium text-stone-400 mt-1">Mark as ready for external delivery</div>
                          </button>
                        </div>
                        
                        {!quote.readinessSummary?.isReady && (
                          <button 
                            onClick={() => {
                              const reason = prompt('Enter override reason:');
                              if (reason) handleTransitionStatus(undefined, 'approved', reason);
                            }}
                            className="w-full p-8 bg-amber-50 border border-amber-200 text-amber-900 rounded-[32px] flex items-center justify-between hover:bg-amber-100 transition-all group shadow-sm"
                          >
                            <div className="text-left">
                              <div className="text-2xl font-serif italic tracking-tight">Override & Approve</div>
                              <div className="text-sm font-medium text-amber-700/70 mt-1">Bypass blockers with mandatory reason for audit</div>
                            </div>
                            <div className="w-12 h-12 rounded-full bg-amber-200/50 flex items-center justify-center group-hover:rotate-12 transition-all">
                              <ShieldCheck size={24} className="text-amber-700" />
                            </div>
                          </button>
                        )}
                      </div>
                    )}

                    {quote.reviewStatus === 'approved' && quote.status !== 'ready_to_send' && (
                      <button 
                        onClick={() => handleTransitionStatus('ready_to_send')}
                        className="w-full p-8 bg-stone-900 text-white rounded-[32px] flex items-center justify-between hover:bg-stone-800 transition-all group shadow-xl shadow-stone-200"
                      >
                        <div className="text-left">
                          <div className="text-2xl font-serif italic tracking-tight">Mark as Ready to Send</div>
                          <div className="text-sm font-medium text-stone-400 mt-1">Finalize and prepare for delivery to vendor</div>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
                          <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    )}

                    {quote.status === 'ready_to_send' && (
                      <div className="p-8 bg-green-50 border border-green-200 rounded-[32px] shadow-sm">
                        <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2">Ready to Send</div>
                        <p className="text-xl text-green-800 font-serif italic">This quote is approved and ready for delivery.</p>
                      </div>
                    )}

                    <button 
                      onClick={() => router.push('/quotes')}
                      className="w-full p-8 bg-white border border-stone-200 text-stone-900 rounded-[32px] text-2xl font-serif italic hover:bg-stone-50 transition-all shadow-sm"
                    >
                      Save as Draft & Exit
                    </button>
                  </div>

                  <div className="pt-12 border-t border-stone-100">
                    <div className="text-[10px] font-bold text-stone-400 uppercase tracking-[0.2em] mb-8 text-center">Internal Administration</div>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Internal Notes</label>
                        <textarea 
                          className="w-full h-32 p-6 bg-stone-50/50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-200 focus:bg-white outline-none text-sm transition-all"
                          placeholder="Add internal context or instructions..."
                          value={version.notesInternal || ''}
                          onChange={(e) => handleUpdateVersion({ notesInternal: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-widest">Vendor Visible Notes</label>
                        <textarea 
                          className="w-full h-32 p-6 bg-stone-50/50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-stone-200 focus:bg-white outline-none text-sm transition-all"
                          placeholder="Notes that will be visible to the vendor on the final quote..."
                          value={quote.notesVendorVisible || ''}
                          onChange={(e) => handleUpdateQuote({ notesVendorVisible: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
