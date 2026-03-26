import { cookies } from 'next/headers';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { createHash } from 'crypto';
import { ShieldCheck, Building2, MapPin, Users, FileText, Info, AlertCircle, Clock, Eye, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReviewActions from '@/components/vendor/ReviewActions';

interface AccessLink {
  id: string;
  entityId: string;
  entityType: 'quote' | 'agreement';
  entityVersionId?: string;
  status: string;
  expiresAt?: any;
  maxUses?: number;
  currentUseCount?: number;
  firstViewedAt?: any;
  lastUsedAt?: any;
  [key: string]: any;
}

async function getAccessLink(token: string): Promise<AccessLink | null> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const links = await adminDb.collection('accessLinks')
    .where('tokenHash', '==', tokenHash)
    .limit(1)
    .get();

  if (links.empty) return null;
  const link = links.docs[0];
  const data = link.data();

  // Check status
  const allowedStatuses = ['active', 'superseded'];
  if (!allowedStatuses.includes(data.status)) return null;

  // Check expiration
  if (data.expiresAt && data.expiresAt.toDate() < new Date()) return null;
  
  // Check max uses
  if (data.maxUses && data.currentUseCount >= data.maxUses) return null;

  return { id: link.id, ...data } as AccessLink;
}

async function logPageView(link: AccessLink) {
  try {
    const batch = adminDb.batch();
    const logRef = adminDb.collection('activityLogs').doc();
    
    batch.set(logRef, {
      action: 'package.viewed',
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      email: link.recipientEmail,
      details: {
        packageId: link.entityId,
        entityType: link.entityType,
        versionId: link.entityVersionId,
        linkId: link.id,
        status: link.status
      }
    });

    if (link.status === 'superseded') {
      const supersededLogRef = adminDb.collection('activityLogs').doc();
      batch.set(supersededLogRef, {
        action: 'package.superseded_notice_shown',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        email: link.recipientEmail,
        details: {
          packageId: link.entityId,
          entityType: link.entityType,
          versionId: link.entityVersionId,
          linkId: link.id
        }
      });
    }

    await batch.commit();
  } catch (err) {
    console.error('Failed to log page view:', err);
  }
}

export default async function VendorReviewPage({ params }: { params: Promise<{ packageId: string }> }) {
  const { packageId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get('vendor_access_token')?.value;

  if (!token) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-stone-200 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-serif italic text-stone-800">Session Expired</h1>
          <p className="text-stone-600">Your secure access session has expired or is invalid. Please use the original link provided to you.</p>
        </div>
      </div>
    );
  }

  const link = await getAccessLink(token);
  if (!link || link.entityId !== packageId) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-stone-200 text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-serif italic text-stone-800">Invalid Access</h1>
          <p className="text-stone-600">You do not have permission to view this package or the link is no longer valid.</p>
        </div>
      </div>
    );
  }

  // Log the view
  await logPageView(link);

  const collectionName = link.entityType === 'quote' ? 'quotes' : 'agreements';
  const packageDoc = await adminDb.collection(collectionName).doc(packageId).get();

  if (!packageDoc.exists) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-sm border border-stone-200 text-center space-y-6">
          <h1 className="text-2xl font-serif italic text-stone-800">Package Not Found</h1>
          <p className="text-stone-600">The requested package could not be found.</p>
        </div>
      </div>
    );
  }

  const packageData = packageDoc.data()!;
  
  // Scoped Version Rendering
  let displayData = packageData;
  if (link.entityVersionId) {
    const versionCollection = link.entityType === 'quote' ? 'quoteVersions' : 'agreementVersions';
    const versionDoc = await adminDb.collection(versionCollection).doc(link.entityVersionId).get();
    if (versionDoc.exists) {
      displayData = { ...packageData, ...versionDoc.data() };
    }
  }

  const vendorDoc = displayData.vendorId ? await adminDb.collection('vendors').doc(displayData.vendorId).get() : null;
  const brandDoc = displayData.brandId ? await adminDb.collection('brands').doc(displayData.brandId).get() : null;
  
  const vendor = vendorDoc?.exists ? vendorDoc.data() : null;
  const brand = brandDoc?.exists ? brandDoc.data() : null;

  const isQuote = link.entityType === 'quote';
  const number = isQuote ? displayData.quoteNumber : displayData.agreementNumber;
  const isSuperseded = link.status === 'superseded';

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-stone-900 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-serif italic text-stone-900">Terms Workbench Gateway</h1>
              <p className="text-xs text-stone-400 uppercase tracking-widest font-medium">Secure Vendor Review</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn(
              "px-4 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-2",
              isSuperseded ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-green-50 text-green-700 border-green-100"
            )}>
              <div className={cn(
                "w-1.5 h-1.5 rounded-full animate-pulse",
                isSuperseded ? "bg-amber-500" : "bg-green-500"
              )} />
              {isSuperseded ? 'Historical View Only' : 'Secure Session Active'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Left Column: Summary */}
          <div className="lg:col-span-2 space-y-12">
            {/* Package Title */}
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-stone-400">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-medium uppercase tracking-widest">{link.entityType} Package</span>
              </div>
              <h2 className="text-5xl font-serif italic text-stone-900 leading-tight">
                {isQuote ? 'Quote' : 'Agreement'} Review: {number}
              </h2>
              <div className="flex items-center gap-6 pt-4 border-t border-stone-200">
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Status</p>
                  <p className="text-sm font-medium text-stone-800 capitalize">{displayData.status?.replace(/_/g, ' ')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Version</p>
                  <p className="text-sm font-medium text-stone-800">{displayData.versionNumber || '1.0'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Created</p>
                  <p className="text-sm font-medium text-stone-800">{displayData.createdAt ? new Date(displayData.createdAt.toDate ? displayData.createdAt.toDate() : displayData.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
                {displayData.validUntilDate && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Expires</p>
                    <p className="text-sm font-medium text-stone-800">{new Date(displayData.validUntilDate).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
            </section>

            {/* Content Sections */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Vendor & Brand */}
              <div className="bg-white p-8 rounded-3xl border border-stone-200 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-serif italic text-stone-800">Parties</h3>
                  <Building2 className="w-5 h-5 text-stone-300" />
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Vendor</p>
                    <p className="text-sm font-medium text-stone-900">{vendor?.legalName || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Brand</p>
                    <p className="text-sm font-medium text-stone-900">{brand?.brandName || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Sites */}
              <div className="bg-white p-8 rounded-3xl border border-stone-200 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-serif italic text-stone-800">Approved Sites</h3>
                  <MapPin className="w-5 h-5 text-stone-300" />
                </div>
                <div className="space-y-2">
                  {displayData.siteNames?.map((site: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-stone-600">
                      <div className="w-1 h-1 bg-stone-300 rounded-full" />
                      {site}
                    </div>
                  )) || <p className="text-sm text-stone-400 italic">No sites specified</p>}
                </div>
              </div>
            </div>

            {/* Terms Summary */}
            <section className="bg-white p-10 rounded-3xl border border-stone-200 space-y-8">
              <div className="flex items-center justify-between border-b border-stone-100 pb-6">
                <h3 className="text-2xl font-serif italic text-stone-800">Terms Summary</h3>
                <Info className="w-5 h-5 text-stone-300" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Pricing Model</p>
                  <p className="text-sm font-medium text-stone-800 capitalize">{displayData.pricingProfileKey || 'Standard'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Operational Profile</p>
                  <p className="text-sm font-medium text-stone-800 capitalize">{displayData.operationalProfileKey ? 'Assigned' : 'Default'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Review Scope</p>
                  <p className="text-sm font-medium text-stone-800">{link.scopeType || 'Full Package'}</p>
                </div>
              </div>
              <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
                <p className="text-sm text-stone-600 leading-relaxed italic">
                  "This is a read-only review of the proposed terms. Formal acceptance and signature flows will be initiated once the review period is complete and internal approvals are finalized."
                </p>
              </div>
            </section>
          </div>

          {/* Right Column: Contacts & Actions */}
          <div className="space-y-8">
            {/* Actions */}
            <ReviewActions 
              packageId={packageId}
              entityType={link.entityType}
              packageNumber={number}
              isSuperseded={isSuperseded}
            />

            {/* View Stats */}
            <section className="bg-white p-8 rounded-3xl border border-stone-200 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif italic text-stone-800">Access History</h3>
                <Clock className="w-5 h-5 text-stone-300" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-stone-400 font-medium">
                    <Eye className="w-4 h-4" />
                    <span>View Count</span>
                  </div>
                  <span className="font-semibold text-stone-900">{link.currentUseCount || 1}</span>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">First Viewed</p>
                  <p className="text-xs font-medium text-stone-800">
                    {link.firstViewedAt ? new Date(link.firstViewedAt.toDate ? link.firstViewedAt.toDate() : link.firstViewedAt).toLocaleString() : 'Just now'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Last Viewed</p>
                  <p className="text-xs font-medium text-stone-800">
                    {link.lastUsedAt ? new Date(link.lastUsedAt.toDate ? link.lastUsedAt.toDate() : link.lastUsedAt).toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
            </section>

            {/* Contacts */}
            <section className="bg-white p-8 rounded-3xl border border-stone-200 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-serif italic text-stone-800">Key Contacts</h3>
                <Users className="w-5 h-5 text-stone-300" />
              </div>
              <div className="space-y-6">
                {displayData.contactSnapshot?.map((contact: any, i: number) => (
                  <div key={i} className="space-y-1 pb-4 border-b border-stone-50 last:border-0 last:pb-0">
                    <p className="text-sm font-semibold text-stone-900">{contact.firstName} {contact.lastName}</p>
                    <p className="text-xs text-stone-500">{contact.email}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {contact.roleKeys?.map((role: string) => (
                        <span key={role} className="px-2 py-0.5 bg-stone-100 text-stone-500 rounded text-[9px] uppercase tracking-wider font-bold">
                          {role.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                )) || <p className="text-sm text-stone-400 italic">No contacts assigned</p>}
              </div>
            </section>

            {/* Notice */}
            <section className="bg-stone-900 p-8 rounded-3xl text-white space-y-6">
              <ShieldCheck className="w-8 h-8 text-stone-400" />
              <div className="space-y-2">
                <h3 className="text-lg font-serif italic">Secure Review Notice</h3>
                <p className="text-sm text-stone-400 leading-relaxed">
                  You are viewing this document via a secure, time-limited access link. This session is being logged for audit purposes.
                </p>
              </div>
              <div className="pt-4 border-t border-stone-800">
                <p className="text-[10px] text-stone-500 uppercase tracking-widest font-bold mb-2">Audit ID</p>
                <p className="text-[10px] font-mono text-stone-400 truncate">{link.id}</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-stone-400 text-[10px] uppercase tracking-widest font-bold">
          <p>© 2026 Terms Workbench Gateway</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-stone-900 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-stone-900 transition-colors">Terms of Access</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
