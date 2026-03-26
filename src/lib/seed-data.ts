import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function seedAllowlists() {
  if (!auth.currentUser) {
    throw new Error('User must be authenticated to seed data.');
  }

  try {
    const domainAllowlist = collection(db, 'domainAllowlist');
    const emailAllowlist = collection(db, 'emailAllowlist');

    // Seed Domains
    await setDoc(doc(domainAllowlist, 'shiekhshoes.org'), {
      domain: 'shiekhshoes.org',
      role: 'internal_admin',
      createdAt: serverTimestamp(),
    });

    // Seed Emails
    await setDoc(doc(emailAllowlist, 'theo_shiekh_com'), {
      email: 'theo@shiekh.com',
      role: 'system_owner',
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(emailAllowlist, 'theo_shiekhshoes_org'), {
      email: 'theo@shiekhshoes.org',
      role: 'system_owner',
      createdAt: serverTimestamp(),
    });

    // Seed Sites
    const sites = collection(db, 'sites');
    const siteList = [
      { id: 'shiekh_com', code: 'SH', name: 'Shiekh.com', displayOrder: 1 },
      { id: 'karmaloop_com', code: 'KL', name: 'Karmaloop.com', displayOrder: 2 },
      { id: 'mltd_com', code: 'ML', name: 'MLTD.com', displayOrder: 3 },
    ];

    for (const site of siteList) {
      await setDoc(doc(sites, site.id), {
        code: site.code,
        name: site.name,
        displayOrder: site.displayOrder,
        isActive: true,
        isHidden: false,
        availableForNewApprovalsOnly: false,
        updatedAt: serverTimestamp(),
      });
    }

    // Seed Legacy Services
    const services = collection(db, 'services');
    await setDoc(doc(services, 'drop_ship'), {
      code: 'DS',
      name: 'Drop Ship',
      category: 'fulfillment',
      description: 'Vendor ships directly to customer',
      isActive: true,
      vendorVisible: true,
      isNegotiable: true,
      seededFromLegacy: true,
      reviewRequired: true,
      updatedAt: serverTimestamp(),
    });

    // Seed Legacy Fees
    const fees = collection(db, 'fees');
    await setDoc(doc(fees, 'coop_fee'), {
      code: 'COOP',
      name: 'Co-op Advertising Fee',
      category: 'marketing',
      description: 'Contribution to marketing efforts',
      feeType: 'percentage',
      isActive: true,
      vendorVisible: true,
      isNegotiable: true,
      seededFromLegacy: true,
      reviewRequired: true,
      updatedAt: serverTimestamp(),
    });

    // Seed Legacy Pricing Profile
    const pricingProfiles = collection(db, 'pricingProfiles');
    await setDoc(doc(pricingProfiles, 'legacy_v1'), {
      profileKey: 'standard_legacy',
      name: 'Standard Legacy Pricing',
      status: 'draft',
      versionNumber: 1,
      isCurrentPublished: false,
      changeSummary: 'Initial legacy seed - Review Required',
      contentHash: 'legacy-hash-1',
      seededFromLegacy: true,
      reviewRequired: true,
      data: {
        standardMargin: 0.5,
        standardDiscount: 0.1,
      },
      createdAt: serverTimestamp(),
      createdByUserId: 'system',
      updatedAt: serverTimestamp(),
      updatedByUserId: 'system',
    });

    // Seed Legacy Operational Profile
    const operationalProfiles = collection(db, 'operationalProfiles');
    await setDoc(doc(operationalProfiles, 'legacy_v1'), {
      profileKey: 'standard_legacy',
      name: 'Standard Legacy Operations',
      status: 'draft',
      versionNumber: 1,
      isCurrentPublished: false,
      changeSummary: 'Initial legacy seed - Review Required',
      contentHash: 'legacy-hash-1',
      seededFromLegacy: true,
      reviewRequired: true,
      data: {
        shippingWindow: 48,
        returnPolicy: 'standard',
      },
      createdAt: serverTimestamp(),
      createdByUserId: 'system',
      updatedAt: serverTimestamp(),
      updatedByUserId: 'system',
    });

    console.log('Allowlists and settings seeded successfully.');
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seedAllowlists');
  }
}
