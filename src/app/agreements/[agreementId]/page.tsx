'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, functions } from '@/lib/firebase';
import { httpsCallable } from 'firebase/functions';
import { manageAgreement } from '@/lib/auth-service';
import { accessService } from '@/lib/access-service';
import { 
  ShieldCheck, 
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
  FileText,
  Scale,
  Gavel,
  BookOpen,
  Eye,
  Link as LinkIcon,
  XCircle,
  Copy,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

import { useAuth } from '@/components/FirebaseProvider';
import { handleFirestoreError, OperationType } from '@/lib/firestore-errors';

const steps = [
  { id: 'metadata', label: 'Metadata', icon: FileText },
  { id: 'vendor_brand', label: 'Vendor & Brand', icon: Building2 },
  { id: 'sites', label: 'Site Scope', icon: Globe },
  { id: 'contacts', label: 'Signers & Contacts', icon: Users },
  { id: 'pricing_ops', label: 'Pricing & Ops', icon: DollarSign },
  { id: 'legal', label: 'Legal & Terms', icon: Gavel },
  { id: 'clauses', label: 'Clause Summary', icon: Scale },
  { id: 'review', label: 'Review & Preview', icon: Eye },
  { id: 'save', label: 'Finalize', icon: Save },
];

export default function AgreementBuilderPage() {
  const { user, isAuthReady } = useAuth();
  const { agreementId } = useParams();
  const router = useRouter();
  const [agreement, setAgreement] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('metadata');
  const [saving, setSaving] = useState(false);
  const [accessLinks, setAccessLinks] = useState<any[]>([]);
  const [issuingLink, setIssuingLink] = useState(false);
  const [newlyIssuedToken, setNewlyIssuedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!agreementId || !isAuthReady || !user) return;

    const unsubAgreement = onSnapshot(doc(db, 'agreements', agreementId as string), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAgreement({ id: snap.id, ...data });
        
        if (data.currentVersionId) {
          const unsubVersion = onSnapshot(doc(db, 'agreementVersions', data.currentVersionId), (vSnap) => {
            if (vSnap.exists()) {
              setVersion({ id: vSnap.id, ...vSnap.data() });
            }
            setLoading(false);
          }, (error) => {
            handleFirestoreError(error, OperationType.GET, `agreementVersions/${data.currentVersionId}`);
          });
          return () => unsubVersion();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `agreements/${agreementId}`);
    });

    return () => unsubAgreement();
  }, [agreementId, isAuthReady, user]);

  useEffect(() => {
    if (!agreementId || !isAuthReady || !user) return;

    const linksRef = collection(db, 'accessLinks');
    const q = query(
      linksRef, 
      where('entityId', '==', agreementId),
      where('entityType', '==', 'agreement'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeLinks = onSnapshot(q, (snap) => {
      const links = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAccessLinks(links);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'accessLinks');
    });

    return () => unsubscribeLinks();
  }, [agreementId, isAuthReady, user]);

  const handleUpdateVersion = async (updates: any) => {
    setSaving(true);
    try {
      await manageAgreement('updateVersion', {
        versionId: agreement.currentVersionId,
        versionData: updates
      });
    } catch (error) {
      console.error('Error updating agreement version:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateAgreement = async (updates: any) => {
    setSaving(true);
    try {
      await manageAgreement('updateVersion', {
        versionId: agreement.currentVersionId,
        versionData: updates // Cloud function handles splitting to agreement summary
      });
    } catch (error) {
      console.error('Error updating agreement:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleTransitionStatus = async (newStatus?: string, newReviewStatus?: string, overrideReason?: string) => {
    if (!agreement) return;
    const notes = prompt('Add internal notes for this status change (optional):') || '';
    try {
      setSaving(true);
      await manageAgreement('transitionStatus', undefined, agreement.id, undefined, undefined, undefined, newStatus, newReviewStatus, overrideReason, notes);
    } catch (error: any) {
      console.error('Error transitioning status:', error);
      alert(error.message || 'Failed to transition status');
    } finally {
      setSaving(false);
    }
  };

  const handleIssueAccessLink = async () => {
    if (!agreement) return;
    const email = prompt('Enter recipient email (required for secure link):') || '';
    if (!email) return;

    try {
      setIssuingLink(true);
      const result = await accessService.issueLink({
        entityId: agreement.id,
        entityType: 'agreement',
        entityVersionId: version.id,
        recipientEmail: email,
        vendorId: agreement.vendorId,
        brandId: agreement.brandId,
        purpose: 'vendor_review',
        scopeType: 'read_only',
        issuedByUserId: 'theo@shiekhshoes.org',
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

  if (loading) return <div className="p-12 text-center text-[#78716C] font-black uppercase tracking-widest animate-pulse">Loading Agreement...</div>;
  if (!agreement || !version) return <div className="p-12 text-center text-[#78716C] font-black uppercase tracking-widest">Agreement not found</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F4] pb-24">
      {/* Header */}
      <div className="bg-white border-b-4 border-[#1C1917] sticky top-0 z-30">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-6">
              <Link href="/agreements" className="w-12 h-12 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-xl flex items-center justify-center hover:bg-[#1C1917] hover:text-white transition-all">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-3xl font-black tracking-tighter text-[#1C1917] uppercase italic">{agreement.agreementNumber}</h1>
                  <span className="px-3 py-1 bg-[#1C1917] text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                    {agreement.status}
                  </span>
                  {agreement.reviewStatus && agreement.reviewStatus !== 'none' && (
                    <span className="px-3 py-1 bg-amber-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                      {agreement.reviewStatus.replace(/_/g, ' ')}
                    </span>
                  )}
                  {saving && (
                    <span className="flex items-center gap-2 text-[10px] font-black text-[#A8A29E] uppercase tracking-widest animate-pulse">
                      <Clock size={12} />
                      Autosaving...
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 text-[10px] font-black text-[#78716C] uppercase tracking-widest">
                  <span className="flex items-center gap-1"><Building2 size={12} /> {agreement.brandName}</span>
                  <span className="flex items-center gap-1"><FileText size={12} /> Quote: {agreement.quoteNumber}</span>
                  <span className="flex items-center gap-1"><Clock size={12} /> v{agreement.currentVersionNumber}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button className="w-12 h-12 bg-white border-2 border-[#1C1917] rounded-xl flex items-center justify-center hover:bg-[#F5F5F4] transition-all">
                <History size={20} />
              </button>
              <button className="px-8 py-3 bg-[#1C1917] text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_0px_0px_rgba(120,113,108,1)]">
                Send for Review
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 mt-12">
        <div className="grid grid-cols-12 gap-12">
          {/* Sidebar Navigation */}
          <div className="col-span-3 space-y-8">
            <div className="bg-white rounded-3xl border-2 border-[#1C1917] p-4 shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
              <div className="space-y-1">
                {steps.map((step) => {
                  const Icon = step.icon;
                  const isActive = activeTab === step.id;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setActiveTab(step.id)}
                      className={cn(
                        "w-full flex items-center gap-4 px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all text-left",
                        isActive 
                          ? "bg-[#1C1917] text-white shadow-[4px_4px_0px_0px_rgba(120,113,108,1)]" 
                          : "text-[#78716C] hover:bg-[#F5F5F4] hover:text-[#1C1917]"
                      )}
                    >
                      <Icon size={18} />
                      {step.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Readiness Summary */}
            <div className="bg-[#1C1917] rounded-3xl p-8 text-white shadow-[8px_8px_0px_0px_rgba(120,113,108,1)]">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#A8A29E] mb-6">Agreement Readiness</div>
              <div className="space-y-4">
                {agreement.readinessSummary?.blockingErrors?.map((blocker: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-red-500/10 rounded-2xl border border-red-500/20">
                    <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-[10px] font-bold leading-relaxed text-red-200">{blocker}</span>
                  </div>
                ))}
                {agreement.readinessSummary?.warnings?.map((warning: string, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                    <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <span className="text-[10px] font-bold leading-relaxed text-amber-200">{warning}</span>
                  </div>
                ))}
                {agreement.sendReadinessState === 'overridden' && (
                  <div className="p-4 bg-amber-500/20 rounded-2xl border border-amber-500/40">
                    <div className="flex items-center gap-2 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-2">
                      <ShieldCheck size={14} />
                      Readiness Overridden
                    </div>
                    <p className="text-[10px] text-amber-200 italic font-medium leading-relaxed">
                      "{agreement.overrideSummary?.reason}"
                    </p>
                  </div>
                )}
                {agreement.readinessSummary?.isReady && agreement.sendReadinessState !== 'overridden' && (
                  <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-2xl border border-green-500/20">
                    <CheckCircle2 size={16} className="text-green-400" />
                    <span className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Ready for Review</span>
                  </div>
                )}
              </div>

              {agreement.readinessSummary?.sections && (
                <div className="mt-8 pt-8 border-t border-white/10 space-y-3">
                  <div className="text-[9px] font-black text-[#A8A29E] uppercase tracking-widest mb-2">Section Status</div>
                  {Object.entries(agreement.readinessSummary.sections).map(([key, section]: [string, any]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#A8A29E] uppercase">{key}</span>
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

          {/* Main Content Area */}
          <div className="col-span-9">
            <div className="min-h-[600px]">
              {activeTab === 'metadata' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-8">Agreement Metadata</div>
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Agreement Number</label>
                        <div className="text-2xl font-black tracking-tighter mt-1">{agreement.agreementNumber}</div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Status</label>
                        <div className="mt-2">
                          <div className="px-4 py-3 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-xl text-sm font-bold uppercase tracking-widest">
                            {agreement.status} {agreement.reviewStatus && agreement.reviewStatus !== 'none' ? `(${agreement.reviewStatus.replace(/_/g, ' ')})` : ''}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Linked Quote</label>
                        <div className="flex items-center gap-2 mt-1">
                          <FileText size={16} className="text-[#A8A29E]" />
                          <span className="text-lg font-black tracking-tight underline decoration-2 underline-offset-4">{agreement.quoteNumber}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Internal Notes</label>
                        <textarea 
                          value={version.notesInternal || ''}
                          onChange={(e) => handleUpdateVersion({ notesInternal: e.target.value })}
                          placeholder="Add internal notes for this version..."
                          className="w-full bg-[#F5F5F4] border-2 border-[#1C1917] rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-[#1C1917]/20 transition-all h-32 resize-none mt-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vendor_brand' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="grid grid-cols-2 gap-16">
                    <div className="space-y-8">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Vendor Snapshot</div>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-2xl flex items-center justify-center text-[#1C1917]">
                          <Building2 size={32} />
                        </div>
                        <div>
                          <div className="text-2xl font-black tracking-tighter">{version.vendorSnapshot?.displayName}</div>
                          <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mt-1">ID: {agreement.vendorId}</div>
                        </div>
                      </div>
                      <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-[#1C1917]">
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mb-2">Legal Name</div>
                        <div className="text-sm font-bold">{version.vendorSnapshot?.legalName || version.vendorSnapshot?.displayName}</div>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Brand Snapshot</div>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#1C1917] text-white rounded-2xl flex items-center justify-center">
                          <Globe size={32} />
                        </div>
                        <div>
                          <div className="text-2xl font-black tracking-tighter">{version.brandSnapshot?.brandName}</div>
                          <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mt-1">ID: {agreement.brandId}</div>
                        </div>
                      </div>
                      <div className="p-6 bg-[#F5F5F4] rounded-2xl border-2 border-[#1C1917]">
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mb-2">Internal Code</div>
                        <div className="text-sm font-bold">{version.brandSnapshot?.internalCode || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'sites' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-8">Approved Site Scope</div>
                  <div className="grid grid-cols-3 gap-6">
                    {version.siteApprovalSnapshot?.map((site: any, i: number) => (
                      <div key={i} className="p-6 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-2xl relative group">
                        <div className="text-lg font-black tracking-tight">{site.displayName || site.siteName}</div>
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mt-1">{site.siteCode}</div>
                        <div className="mt-4 flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-[#1C1917] text-white text-[8px] font-black uppercase tracking-widest rounded">Approved</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'contacts' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Primary Internal Signer</div>
                      <div className="p-6 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-white border-2 border-[#1C1917] rounded-xl flex items-center justify-center text-[#1C1917]">
                          <User size={24} />
                        </div>
                        <div>
                          <div className="font-black tracking-tight">Internal Admin</div>
                          <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">ID: {agreement.primarySignerContactId}</div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Primary External Contact</div>
                      <div className="p-6 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-3xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#1C1917] text-white rounded-xl flex items-center justify-center">
                          <Users size={24} />
                        </div>
                        <div>
                          <div className="font-black tracking-tight">Vendor Contact</div>
                          <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">ID: {agreement.primaryExternalContactId}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'pricing_ops' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="grid grid-cols-2 gap-12">
                    <div className="space-y-8">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Pricing Reference</div>
                      <div className="p-8 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-3xl">
                        <div className="text-xl font-black tracking-tighter mb-2">{agreement.pricingProfileKey}</div>
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Version: {agreement.pricingProfileVersion}</div>
                        <div className="mt-6 space-y-3">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#A8A29E]">
                            <span>Line Items</span>
                            <span>{version.pricingSnapshot?.services?.length || 0} Items</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#A8A29E]">
                            <span>Fees</span>
                            <span>{version.pricingSnapshot?.fees?.length || 0} Fees</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">Operational Reference</div>
                      <div className="p-8 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-3xl">
                        <div className="text-xl font-black tracking-tighter mb-2">{agreement.operationalProfileKey}</div>
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Version: {agreement.operationalProfileVersion}</div>
                        <div className="mt-6 space-y-3">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#A8A29E]">
                            <span>Shipping</span>
                            <span>{version.operationalSnapshot?.shippingMethod || 'Standard'}</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#A8A29E]">
                            <span>Lead Time</span>
                            <span>{version.operationalSnapshot?.leadTimeDays || '14'} Days</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'legal' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-8">Legal & Terms Snapshot</div>
                  <div className="space-y-8">
                    <div className="p-8 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-3xl">
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-white border-2 border-[#1C1917] rounded-xl flex items-center justify-center text-[#1C1917]">
                          <BookOpen size={24} />
                        </div>
                        <div>
                          <div className="text-xl font-black tracking-tighter uppercase italic">Standard Terms v1</div>
                          <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest">Snapshot ID: {version.termsSnapshot?.id || 'DEFAULT'}</div>
                        </div>
                      </div>
                      <div className="prose prose-sm max-w-none text-[#44403C] font-bold leading-relaxed">
                        <p>This agreement incorporates the standard commercial terms and conditions as defined in the Terms Workbench Gateway. All parties agree to the operational and pricing snapshots attached to this version.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'clauses' && (
                <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                  <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-8">Clause Summary</div>
                  <div className="p-12 text-center border-2 border-dashed border-[#A8A29E] rounded-3xl">
                    <Scale className="mx-auto text-[#A8A29E] mb-4" size={48} />
                    <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest">No custom clauses added to this version</div>
                  </div>
                </div>
              )}

              {activeTab === 'review' && (
                <div className="space-y-8">
                  <div className="p-12 bg-white rounded-3xl border-2 border-[#1C1917] shadow-[8px_8px_0px_0px_rgba(28,25,23,1)]">
                    <div className="flex justify-between items-start mb-12">
                      <div>
                        <div className="text-[10px] font-black text-[#A8A29E] uppercase tracking-widest mb-2">Agreement Summary</div>
                        <h2 className="text-4xl font-black tracking-tighter uppercase italic">{agreement.agreementNumber}</h2>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mb-1">Created On</div>
                        <div className="text-lg font-black tracking-tight">{agreement.createdAt?.toDate().toLocaleDateString()}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-12 border-t-2 border-[#1C1917] pt-12">
                      <div>
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mb-4">Parties</div>
                        <div className="space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#1C1917] text-white rounded-lg flex items-center justify-center text-[10px] font-black">B</div>
                            <span className="font-black tracking-tight">{agreement.brandName}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-lg flex items-center justify-center text-[10px] font-black">V</div>
                            <span className="font-black tracking-tight">{agreement.vendorName}</span>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-black text-[#78716C] uppercase tracking-widest mb-4">Scope</div>
                        <div className="flex flex-wrap gap-2">
                          {agreement.approvedSiteCodes?.map((code: string) => (
                            <span key={code} className="px-3 py-1 bg-[#F5F5F4] border-2 border-[#1C1917] rounded-lg text-[10px] font-black uppercase tracking-widest">{code}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'save' && (
                <div className="max-w-4xl mx-auto space-y-12 py-12">
                  <div className="text-center space-y-4">
                    <div className={cn(
                      "w-24 h-24 rounded-[40px] border-4 flex items-center justify-center mx-auto shadow-xl",
                      agreement.readinessSummary?.isReady ? "bg-green-50 text-green-600 border-green-600 shadow-green-100" : "bg-red-50 text-red-600 border-red-600 shadow-red-100"
                    )}>
                      {agreement.readinessSummary?.isReady ? <CheckCircle2 size={48} /> : <AlertCircle size={48} />}
                    </div>
                    <h2 className="text-4xl font-black tracking-tighter uppercase italic">
                      {agreement.readinessSummary?.isReady ? "Ready to Finalize?" : "Action Required"}
                    </h2>
                    <p className="text-[#78716C] font-bold max-w-md mx-auto">
                      {agreement.readinessSummary?.isReady 
                        ? "Your progress is autosaved. You can submit this agreement for internal legal review."
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
                    {(agreement.reviewStatus === 'none' || agreement.reviewStatus === 'needs_revision') && (
                      <button 
                        onClick={() => handleTransitionStatus(undefined, 'pending_internal_review')}
                        className="w-full p-8 bg-stone-900 text-white rounded-[32px] flex items-center justify-between hover:bg-stone-800 transition-all group shadow-xl shadow-stone-200"
                      >
                        <div className="text-left">
                          <div className="text-2xl font-serif italic tracking-tight">Submit for Internal Review</div>
                          <div className="text-sm font-medium text-stone-400 mt-1">Initiate internal approval workflow for this agreement package</div>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-all">
                          <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                        </div>
                      </button>
                    )}
                    
                    {agreement.reviewStatus === 'pending_internal_review' && (
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
                            disabled={!agreement.readinessSummary?.isReady}
                            className="p-8 bg-stone-900 text-white rounded-[32px] flex flex-col items-start hover:bg-stone-800 transition-all disabled:opacity-50 shadow-xl shadow-stone-200 group"
                          >
                            <div className="text-2xl font-serif italic tracking-tight">Approve for Send</div>
                            <div className="text-sm font-medium text-stone-400 mt-1">Mark as ready for external delivery</div>
                          </button>
                        </div>
                        
                        {!agreement.readinessSummary?.isReady && (
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

                    {agreement.reviewStatus === 'approved' && (
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
                    
                    {agreement.status === 'ready_to_send' && (
                      <div className="p-8 bg-green-50 border border-green-200 rounded-[32px] shadow-sm">
                        <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2">Ready to Send</div>
                        <p className="text-xl text-green-800 font-serif italic">This agreement is approved and ready for delivery.</p>
                      </div>
                    )}

                    <button 
                      onClick={() => router.push('/agreements')}
                      className="w-full p-8 bg-white border border-stone-200 text-stone-900 rounded-[32px] text-2xl font-serif italic hover:bg-stone-50 transition-all shadow-sm"
                    >
                      Save as Draft & Exit
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Buttons */}
            <div className="mt-12 flex justify-between">
              <button 
                onClick={prevStep}
                disabled={activeTab === steps[0].id}
                className="flex items-center gap-2 px-8 py-4 bg-white border-4 border-[#1C1917] text-[#1C1917] rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-[#F5F5F4] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ArrowLeft size={16} /> Previous Step
              </button>
              <button 
                onClick={nextStep}
                disabled={activeTab === steps[steps.length - 1].id}
                className="flex items-center gap-2 px-8 py-4 bg-[#1C1917] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[4px_4px_0px_0px_rgba(120,113,108,1)]"
              >
                Next Step <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
