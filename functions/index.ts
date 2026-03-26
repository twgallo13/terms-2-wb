import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as corsModule from 'cors';

const cors = corsModule({ origin: true });

admin.initializeApp();

const FIRESTORE_DB_ID = 'twg-db-terms';

// Log account creation (unverified)
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
  const db = admin.firestore(FIRESTORE_DB_ID);
  await db.collection('activityLogs').add({
    userId: user.uid,
    email: user.email,
    action: 'AUTH_ACCOUNT_CREATED',
    details: { provider: user.providerData?.[0]?.providerId || 'unknown' },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// Core provisioning logic shared between onCall and onRequest handlers
async function provisionUserCore(uid: string, email: string, emailVerified: boolean, displayName: string) {
  const db = admin.firestore(FIRESTORE_DB_ID);
  const domain = email.split('@')[1];

  // 1. Check if already provisioned
  const userDoc = await db.collection('users').doc(uid).get();
  if (userDoc.exists && userDoc.data()?.role) {
    console.log('[Bootstrap] User already provisioned.', { uid, email, role: userDoc.data()?.role });
    return { status: 'already_provisioned', role: userDoc.data()?.role };
  }

  // 2. Require Email Verification
  if (!emailVerified) {
    console.warn('[Bootstrap] Email not verified.', { uid, email });
    await db.collection('activityLogs').add({
      userId: uid,
      email: email,
      action: 'PROVISIONING_SKIPPED_UNVERIFIED',
      details: { domain },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new functions.https.HttpsError('failed-precondition', 'Email must be verified before provisioning.', {
      error: 'UNVERIFIED_EMAIL',
      message: 'Your email address is not yet verified. Please click the link in your inbox.'
    });
  }

  // 3. Check Email Allowlist (System Owners)
  const emailSnap = await db.collection('emailAllowlist')
    .where('email', '==', email)
    .limit(1)
    .get();

  if (!emailSnap.empty) {
    const role = emailSnap.docs[0].data().role || 'system_owner';
    console.log('[Bootstrap] Email allowlist match.', { email, role });
    
    await db.collection('users').doc(uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      role: role,
      isInternal: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('activityLogs').add({
      userId: uid,
      email: email,
      action: 'USER_PROVISIONED',
      details: { role, domain, method: 'email-allowlist' },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { status: 'success', role };
  }

  // 4. Check Domain Allowlist (Internal Admins)
  const domainSnap = await db.collection('domainAllowlist')
    .where('domain', '==', domain)
    .limit(1)
    .get();

  if (!domainSnap.empty) {
    const role = domainSnap.docs[0].data().role || 'internal_admin';
    console.log('[Bootstrap] Domain allowlist match.', { domain, role });

    await db.collection('users').doc(uid).set({
      email,
      displayName: displayName || email.split('@')[0],
      role: role,
      isInternal: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection('activityLogs').add({
      userId: uid,
      email: email,
      action: 'USER_PROVISIONED',
      details: { role, domain, method: 'domain-allowlist' },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { status: 'success', role };
  }

  // 5. Access Denied
  console.warn('[Bootstrap] Access denied: Not in allowlist.', { email, domain });
  await db.collection('activityLogs').add({
    userId: uid,
    email: email,
    action: 'ACCESS_DENIED_UNRECOGNIZED',
    details: { domain },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
  throw new functions.https.HttpsError('permission-denied', 'Account not authorized for internal access.', {
    error: 'ACCESS_DENIED',
    message: 'Your account is not recognized as an internal administrator.'
  });
}

// Backend-controlled provisioning on first successful verified login
export const bootstrapUser = functions.https.onCall(async (data, context) => {
  // 1. Require Authentication
  if (!context.auth) {
    console.warn('[Bootstrap] Unauthenticated attempt.');
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }

  const email = context.auth.token.email;
  const emailVerified = context.auth.token.email_verified;
  const uid = context.auth.uid;
  const displayName = context.auth.token.name || '';

  if (!email) {
    console.error('[Bootstrap] Email missing from token.', { uid });
    throw new functions.https.HttpsError('invalid-argument', 'User email missing.');
  }

  try {
    return await provisionUserCore(uid, email, !!emailVerified, displayName);
  } catch (error: any) {
    console.error('[Bootstrap] Error:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', error.message || 'Provisioning failed.');
  }
});

// New CORS-safe onRequest wrapper for bootstrapUser
export const bootstrapUserOnRequest = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    // Ensure explicit headers for extra safety
    const origin = req.get('Origin') || '*';
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
      if (req.method === 'OPTIONS') {
        return res.status(204).send('');
      }

      if (req.method !== 'POST') {
        return res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Only POST is allowed' });
      }

      const authHeader = req.get('Authorization') || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;
      
      if (!idToken) {
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Missing auth token' });
      }

      const decoded = await admin.auth().verifyIdToken(idToken).catch(err => {
        console.error('Token verify failed', err);
        return null;
      });

      if (!decoded) {
        return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Invalid auth token' });
      }

      const result = await provisionUserCore(
        decoded.uid,
        decoded.email || '',
        !!decoded.email_verified,
        decoded.name || ''
      );

      return res.status(200).json(result);
    } catch (err: any) {
      console.error('bootstrapUserOnRequest error:', err);
      
      // Map HttpsError to appropriate HTTP status codes
      if (err instanceof functions.https.HttpsError) {
        let status = 500;
        switch (err.code) {
          case 'unauthenticated': status = 401; break;
          case 'permission-denied': status = 403; break;
          case 'invalid-argument': status = 400; break;
          case 'failed-precondition': status = 412; break;
          case 'not-found': status = 404; break;
          case 'already-exists': status = 409; break;
        }
        return res.status(status).json({ 
          error: err.details?.error || err.code, 
          message: err.details?.message || err.message 
        });
      }
      
      return res.status(500).json({ error: 'internal', message: err.message || 'Internal error' });
    }
  });
});

// Helper to check if caller is an admin
const checkAdmin = async (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
  }
  const db = admin.firestore(FIRESTORE_DB_ID);
  const userDoc = await db.collection('users').doc(context.auth.uid).get().catch(err => {
    console.error('Error fetching user profile:', err);
    throw new functions.https.HttpsError('internal', `Database connection error: ${err.message}`);
  });
  
  // Bootstrap admin check
  const isBootstrapAdmin = context.auth.token.email === 'theo@shiekhshoes.org' && context.auth.token.email_verified === true;
  
  if (!userDoc.exists) {
    if (isBootstrapAdmin) return db;
    throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
  }
  const role = userDoc.data()?.role;
  if (role !== 'system_owner' && role !== 'internal_admin' && !isBootstrapAdmin) {
    throw new functions.https.HttpsError('permission-denied', 'User is not an admin.');
  }
  return db;
};

// Manage Sites
export const manageSite = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, siteId, siteData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('sites').add({
        ...siteData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SITE_CREATED',
        details: { siteId: docRef.id, siteData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('sites').doc(siteId).update({
        ...siteData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SITE_UPDATED',
        details: { siteId, siteData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'archive') {
      await db.collection('sites').doc(siteId).update({
        isActive: false,
        isArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SITE_ARCHIVED',
        details: { siteId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageSite:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage site.');
  }
});

// Manage Services
export const manageService = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, serviceId, serviceData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('services').add({
        ...serviceData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SERVICE_CREATED',
        details: { serviceId: docRef.id, serviceData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('services').doc(serviceId).update({
        ...serviceData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SERVICE_UPDATED',
        details: { serviceId, serviceData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'archive') {
      await db.collection('services').doc(serviceId).update({
        isArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SERVICE_ARCHIVED',
        details: { serviceId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageService:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage service.');
  }
});

// Manage Fees
export const manageFee = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, feeId, feeData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('fees').add({
        ...feeData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'FEE_CREATED',
        details: { feeId: docRef.id, feeData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('fees').doc(feeId).update({
        ...feeData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'FEE_UPDATED',
        details: { feeId, feeData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'archive') {
      await db.collection('fees').doc(feeId).update({
        isArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'FEE_ARCHIVED',
        details: { feeId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageFee:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage fee.');
  }
});

// Manage Pricing Profiles
export const managePricingProfile = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, profileId, profileData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('pricingProfiles').add({
        ...profileData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'PRICING_PROFILE_CREATED',
        details: { profileId: docRef.id, profileData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('pricingProfiles').doc(profileId).update({
        ...profileData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'PRICING_PROFILE_UPDATED',
        details: { profileId, profileData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'publish') {
      // 1. Get the profile to be published to find its profileKey
      const targetDoc = await db.collection('pricingProfiles').doc(profileId).get();
      if (!targetDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Profile not found.');
      }
      const profileKey = targetDoc.data()?.profileKey;
      if (!profileKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Profile missing profileKey.');
      }

      // 2. Retire current published profile with the SAME profileKey
      const currentSnap = await db.collection('pricingProfiles')
        .where('profileKey', '==', profileKey)
        .where('isCurrentPublished', '==', true)
        .get();
      
      const batch = db.batch();
      currentSnap.forEach(doc => {
        // Idempotency check: if it's already the target, we don't need to retire it
        if (doc.id !== profileId) {
          batch.update(doc.ref, { isCurrentPublished: false, status: 'retired' });
        }
      });

      // 3. Publish new profile
      batch.update(db.collection('pricingProfiles').doc(profileId), {
        isCurrentPublished: true,
        status: 'published',
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'PRICING_PROFILE_PUBLISHED',
        details: { profileId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'archive') {
      await db.collection('pricingProfiles').doc(profileId).update({
        isArchived: true,
        status: 'archived',
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'PRICING_PROFILE_ARCHIVED',
        details: { profileId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in managePricingProfile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage pricing profile.');
  }
});

// Manage Operational Profiles
export const manageOperationalProfile = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, profileId, profileData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('operationalProfiles').add({
        ...profileData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'OPERATIONAL_PROFILE_CREATED',
        details: { profileId: docRef.id, profileData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('operationalProfiles').doc(profileId).update({
        ...profileData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'OPERATIONAL_PROFILE_UPDATED',
        details: { profileId, profileData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'publish') {
      // 1. Get the profile to be published to find its profileKey
      const targetDoc = await db.collection('operationalProfiles').doc(profileId).get();
      if (!targetDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Profile not found.');
      }
      const profileKey = targetDoc.data()?.profileKey;
      if (!profileKey) {
        throw new functions.https.HttpsError('failed-precondition', 'Profile missing profileKey.');
      }

      const currentSnap = await db.collection('operationalProfiles')
        .where('profileKey', '==', profileKey)
        .where('isCurrentPublished', '==', true)
        .get();
      
      const batch = db.batch();
      currentSnap.forEach(doc => {
        if (doc.id !== profileId) {
          batch.update(doc.ref, { isCurrentPublished: false, status: 'retired' });
        }
      });

      batch.update(db.collection('operationalProfiles').doc(profileId), {
        isCurrentPublished: true,
        status: 'published',
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'OPERATIONAL_PROFILE_PUBLISHED',
        details: { profileId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else if (action === 'archive') {
      await db.collection('operationalProfiles').doc(profileId).update({
        isArchived: true,
        status: 'archived',
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'OPERATIONAL_PROFILE_ARCHIVED',
        details: { profileId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageOperationalProfile:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage operational profile.');
  }
});

// Manage Required Field Rules
export const manageRequiredFieldRules = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, ruleId, ruleData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('requiredFieldRules').add({
        ...ruleData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'REQUIRED_FIELD_RULE_CREATED',
        details: { ruleId: docRef.id, ruleData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('requiredFieldRules').doc(ruleId).update({
        ...ruleData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'REQUIRED_FIELD_RULE_UPDATED',
        details: { ruleId, ruleData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageRequiredFieldRules:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage required field rules.');
  }
});

// Manage Custom Field Definitions
export const manageCustomFieldDefinition = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, defId, defData } = data;

  try {
    if (action === 'create') {
      const docRef = await db.collection('customFieldDefinitions').add({
        ...defData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'CUSTOM_FIELD_DEFINITION_CREATED',
        details: { defId: docRef.id, defData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { id: docRef.id };
    } else if (action === 'update') {
      await db.collection('customFieldDefinitions').doc(defId).update({
        ...defData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'CUSTOM_FIELD_DEFINITION_UPDATED',
        details: { defId, defData },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageCustomFieldDefinition:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage custom field definition.');
  }
});

// TODO: Implement access link issuance/revocation
// TODO: Implement quote/agreement versioning logic
// TODO: Implement final signature verification
// TODO: Implement WB handoff workflow

/**
 * Helper to generate search keywords from a string
 */
function generateSearchKeywords(text: string): string[] {
  if (!text) return [];
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  const keywords = new Set<string>();
  
  words.forEach(word => {
    for (let i = 1; i <= word.length; i++) {
      keywords.add(word.substring(0, i));
    }
  });
  
  return Array.from(keywords);
}

/**
 * Vendor Management
 */
export const manageVendor = functions.https.onCall(async (data, context) => {
      const db = await checkAdmin(context);
      const { action, vendorData, vendorId } = data;

      try {
        if (action === 'create') {
          if (!vendorData) throw new functions.https.HttpsError('invalid-argument', 'Vendor data missing.');
          if (!vendorData.displayName) throw new functions.https.HttpsError('invalid-argument', 'Vendor display name missing.');

          const normalizedName = vendorData.displayName.toLowerCase().trim();
          const searchKeywords = generateSearchKeywords(vendorData.displayName);
          const searchText = `${vendorData.displayName} ${vendorData.legalName || ''} ${vendorData.vendorCode || ''}`.toLowerCase();

          const newVendor = {
            ...vendorData,
            normalizedName,
            searchKeywords,
            searchText,
            activeBrandCount: 0,
            isArchived: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdByUserId: context.auth!.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUserId: context.auth!.uid,
          };

          const docRef = await db.collection('vendors').add(newVendor);
          
          await db.collection('activityLogs').add({
            userId: context.auth!.uid,
            action: 'VENDOR_CREATED',
            details: { vendorId: docRef.id, displayName: vendorData.displayName, vendorCode: vendorData.vendorCode },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

          return { id: docRef.id };

        } else if (action === 'update') {
          if (!vendorId) throw new functions.https.HttpsError('invalid-argument', 'Vendor ID required.');
          
          const updatePayload: any = {
            ...vendorData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUserId: context.auth!.uid,
          };

          if (vendorData.displayName) {
            updatePayload.normalizedName = vendorData.displayName.toLowerCase().trim();
            updatePayload.searchKeywords = generateSearchKeywords(vendorData.displayName);
            updatePayload.searchText = `${vendorData.displayName} ${vendorData.legalName || ''} ${vendorData.vendorCode || ''}`.toLowerCase();
          }

          await db.collection('vendors').doc(vendorId).update(updatePayload);

          await db.collection('activityLogs').add({
            userId: context.auth!.uid,
            action: 'VENDOR_UPDATED',
            details: { vendorId, changes: Object.keys(vendorData) },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });

        } else if (action === 'archive' || action === 'reactivate') {
          if (!vendorId) throw new functions.https.HttpsError('invalid-argument', 'Vendor ID required.');
          const isArchiving = action === 'archive';

          await db.collection('vendors').doc(vendorId).update({
            isArchived: isArchiving,
            status: isArchiving ? 'archived' : 'active',
            archivedAt: isArchiving ? admin.firestore.FieldValue.serverTimestamp() : null,
            archivedByUserId: isArchiving ? context.auth!.uid : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedByUserId: context.auth!.uid,
          });

          await db.collection('activityLogs').add({
            userId: context.auth!.uid,
            action: isArchiving ? 'VENDOR_ARCHIVED' : 'VENDOR_REACTIVATED',
            details: { vendorId },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        return { success: true };
    } catch (error: any) {
      console.error('Error in manageVendor:', error);
      if (error instanceof functions.https.HttpsError) throw error;
      throw new functions.https.HttpsError('internal', error.message || 'Failed to manage vendor.');
    }
});

/**
 * Brand Management
 */
export const manageBrand = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, brandData, brandId } = data;

  try {
    if (action === 'create') {
      // Fetch published defaults if they exist
      const pricingSnap = await db.collection('pricingProfiles')
        .where('isCurrentPublished', '==', true)
        .limit(1)
        .get();
      
      const operationalSnap = await db.collection('operationalProfiles')
        .where('isCurrentPublished', '==', true)
        .limit(1)
        .get();

      const pricingDefault = pricingSnap.empty ? null : pricingSnap.docs[0].data();
      const operationalDefault = operationalSnap.empty ? null : operationalSnap.docs[0].data();

      const normalizedName = brandData.brandName.toLowerCase().trim();
      const searchKeywords = generateSearchKeywords(brandData.brandName);
      const searchText = `${brandData.brandName} ${brandData.brandCode}`.toLowerCase();

      const newBrand = {
        ...brandData,
        defaultPricingProfileKey: pricingDefault?.profileKey || null,
        defaultPricingProfileVersion: pricingDefault?.versionNumber || null,
        defaultOperationalProfileKey: operationalDefault?.profileKey || null,
        defaultOperationalProfileVersion: operationalDefault?.versionNumber || null,
        normalizedName,
        searchKeywords,
        searchText,
        isArchived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const docRef = await db.collection('brands').add(newBrand);

      // Increment vendor's active brand count
      await db.collection('vendors').doc(brandData.vendorId).update({
        activeBrandCount: admin.firestore.FieldValue.increment(1)
      });
      
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'BRAND_CREATED',
        details: { brandId: docRef.id, brandName: brandData.brandName, vendorId: brandData.vendorId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: docRef.id };

    } else if (action === 'update') {
      if (!brandId) throw new functions.https.HttpsError('invalid-argument', 'Brand ID required.');
      
      const updatePayload: any = {
        ...brandData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      if (brandData.brandName) {
        updatePayload.normalizedName = brandData.brandName.toLowerCase().trim();
        updatePayload.searchKeywords = generateSearchKeywords(brandData.brandName);
        updatePayload.searchText = `${brandData.brandName} ${brandData.brandCode || ''}`.toLowerCase();
      }

      await db.collection('brands').doc(brandId).update(updatePayload);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'BRAND_UPDATED',
        details: { brandId, changes: Object.keys(brandData) },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else if (action === 'archive' || action === 'reactivate') {
      if (!brandId) throw new functions.https.HttpsError('invalid-argument', 'Brand ID required.');
      const isArchiving = action === 'archive';

      const brandDoc = await db.collection('brands').doc(brandId).get();
      const vendorId = brandDoc.data()?.vendorId;

      await db.collection('brands').doc(brandId).update({
        isArchived: isArchiving,
        status: isArchiving ? 'archived' : 'active',
        archivedAt: isArchiving ? admin.firestore.FieldValue.serverTimestamp() : null,
        archivedByUserId: isArchiving ? context.auth!.uid : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      if (vendorId) {
        await db.collection('vendors').doc(vendorId).update({
          activeBrandCount: admin.firestore.FieldValue.increment(isArchiving ? -1 : 1)
        });
      }

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: isArchiving ? 'BRAND_ARCHIVED' : 'BRAND_REACTIVATED',
        details: { brandId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageBrand:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage brand.');
  }
});

/**
 * Contact Management
 */
export const manageContact = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, contactData, contactId } = data;

  try {
    if (action === 'create') {
      const fullName = `${contactData.firstName} ${contactData.lastName}`;
      const normalizedName = fullName.toLowerCase().trim();
      const normalizedEmail = contactData.email.toLowerCase().trim();
      const searchKeywords = generateSearchKeywords(fullName);
      const searchText = `${fullName} ${contactData.email}`.toLowerCase();

      const newContact = {
        ...contactData,
        displayName: fullName,
        normalizedName,
        normalizedEmail,
        searchKeywords,
        searchText,
        isArchived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const docRef = await db.collection('contacts').add(newContact);
      
      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'CONTACT_CREATED',
        details: { contactId: docRef.id, displayName: fullName, vendorId: contactData.vendorId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: docRef.id };

    } else if (action === 'update') {
      if (!contactId) throw new functions.https.HttpsError('invalid-argument', 'Contact ID required.');
      
      const updatePayload: any = {
        ...contactData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      if (contactData.firstName || contactData.lastName) {
        const current = await db.collection('contacts').doc(contactId).get();
        const firstName = contactData.firstName || current.data()?.firstName;
        const lastName = contactData.lastName || current.data()?.lastName;
        const fullName = `${firstName} ${lastName}`;
        updatePayload.displayName = fullName;
        updatePayload.normalizedName = fullName.toLowerCase().trim();
        updatePayload.searchKeywords = generateSearchKeywords(fullName);
        updatePayload.searchText = `${fullName} ${contactData.email || current.data()?.email}`.toLowerCase();
      }

      if (contactData.email) {
        updatePayload.normalizedEmail = contactData.email.toLowerCase().trim();
      }

      await db.collection('contacts').doc(contactId).update(updatePayload);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'CONTACT_UPDATED',
        details: { contactId, changes: Object.keys(contactData) },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else if (action === 'archive' || action === 'reactivate') {
      if (!contactId) throw new functions.https.HttpsError('invalid-argument', 'Contact ID required.');
      const isArchiving = action === 'archive';

      await db.collection('contacts').doc(contactId).update({
        isArchived: isArchiving,
        status: isArchiving ? 'archived' : 'active',
        archivedAt: isArchiving ? admin.firestore.FieldValue.serverTimestamp() : null,
        archivedByUserId: isArchiving ? context.auth!.uid : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: isArchiving ? 'CONTACT_ARCHIVED' : 'CONTACT_REACTIVATED',
        details: { contactId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageContact:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage contact.');
  }
});

/**
 * Site Approval Management
 */
export const manageSiteApproval = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, approvalData, approvalId } = data;

  try {
    if (action === 'assign') {
      const { brandId, siteId } = approvalData;
      
      // Check for existing (including archived)
      const existing = await db.collection('siteApprovals')
        .where('brandId', '==', brandId)
        .where('siteId', '==', siteId)
        .limit(1)
        .get();
      
      if (!existing.empty) {
        const doc = existing.docs[0];
        if (!doc.data().isArchived) {
          throw new functions.https.HttpsError('already-exists', 'Site already approved for this brand.');
        }
        // Reactivate
        await doc.ref.update({
          isArchived: false,
          status: 'approved',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUserId: context.auth!.uid,
        });
        await syncBrandSiteSummaries(db, brandId);
        return { id: doc.id };
      }

      const newApproval = {
        ...approvalData,
        status: 'approved',
        isArchived: false,
        selectedAt: admin.firestore.FieldValue.serverTimestamp(),
        selectedByUserId: context.auth!.uid,
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedByUserId: context.auth!.uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const docRef = await db.collection('siteApprovals').add(newApproval);
      
      await syncBrandSiteSummaries(db, brandId);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SITE_APPROVAL_ASSIGNED',
        details: { brandId, siteId, siteName: approvalData.siteName },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: docRef.id };

    } else if (action === 'update') {
      if (!approvalId) throw new functions.https.HttpsError('invalid-argument', 'Approval ID required.');
      
      const updatePayload = {
        ...approvalData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      await db.collection('siteApprovals').doc(approvalId).update(updatePayload);
      
      const approvalDoc = await db.collection('siteApprovals').doc(approvalId).get();
      await syncBrandSiteSummaries(db, approvalDoc.data()?.brandId);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SITE_APPROVAL_UPDATED',
        details: { approvalId, changes: Object.keys(approvalData) },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else if (action === 'remove') {
      if (!approvalId) throw new functions.https.HttpsError('invalid-argument', 'Approval ID required.');
      
      const approvalDoc = await db.collection('siteApprovals').doc(approvalId).get();
      const brandId = approvalDoc.data()?.brandId;

      await db.collection('siteApprovals').doc(approvalId).update({
        isArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });
      
      if (brandId) {
        await syncBrandSiteSummaries(db, brandId);
      }

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'SITE_APPROVAL_REMOVED',
        details: { approvalId, brandId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageSiteApproval:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage site approval.');
  }
});

/**
 * Brand Contact Assignment Management
 */
export const manageBrandContactAssignment = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, assignmentData, assignmentId } = data;

  try {
    if (action === 'assign') {
      const { brandId, contactId } = assignmentData;
      
      // Check for existing (including archived)
      const existing = await db.collection('brandContactAssignments')
        .where('brandId', '==', brandId)
        .where('contactId', '==', contactId)
        .limit(1)
        .get();
      
      if (!existing.empty) {
        const doc = existing.docs[0];
        // Reactivate and update roles
        await doc.ref.update({
          ...assignmentData,
          isArchived: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUserId: context.auth!.uid,
        });
        await syncBrandContactSummaries(db, brandId);
        return { id: doc.id };
      }

      const newAssignment = {
        ...assignmentData,
        isArchived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const docRef = await db.collection('brandContactAssignments').add(newAssignment);
      
      await syncBrandContactSummaries(db, brandId);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'BRAND_CONTACT_ASSIGNED',
        details: { brandId, contactId, roles: assignmentData.roleKeys },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: docRef.id };

    } else if (action === 'update') {
      if (!assignmentId) throw new functions.https.HttpsError('invalid-argument', 'Assignment ID required.');
      
      const updatePayload = {
        ...assignmentData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      await db.collection('brandContactAssignments').doc(assignmentId).update(updatePayload);
      
      const assignmentDoc = await db.collection('brandContactAssignments').doc(assignmentId).get();
      await syncBrandContactSummaries(db, assignmentDoc.data()?.brandId);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'BRAND_CONTACT_ASSIGNMENT_UPDATED',
        details: { assignmentId, changes: Object.keys(assignmentData) },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else if (action === 'remove') {
      if (!assignmentId) throw new functions.https.HttpsError('invalid-argument', 'Assignment ID required.');
      
      const assignmentDoc = await db.collection('brandContactAssignments').doc(assignmentId).get();
      const brandId = assignmentDoc.data()?.brandId;

      await db.collection('brandContactAssignments').doc(assignmentId).update({
        isArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        archivedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });
      
      if (brandId) {
        await syncBrandContactSummaries(db, brandId);
      }

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'BRAND_CONTACT_ASSIGNMENT_REMOVED',
        details: { assignmentId, brandId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error in manageBrandContactAssignment:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage brand contact assignment.');
  }
});

/**
 * Agreement Management
 */
async function getNextAgreementNumber(db: admin.firestore.Firestore): Promise<string> {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const snapshot = await db.collection('agreements')
    .where('agreementNumber', '>=', `A-${date}-`)
    .where('agreementNumber', '<=', `A-${date}-\uf8ff`)
    .orderBy('agreementNumber', 'desc')
    .limit(1)
    .get();

  let nextSeq = 1;
  if (!snapshot.empty) {
    const lastNum = snapshot.docs[0].data().agreementNumber;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1]);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  return `A-${date}-${nextSeq.toString().padStart(4, '0')}`;
}

async function evaluateReadiness(db: admin.firestore.Firestore, type: 'quote' | 'agreement', data: any, versionData: any) {
  const blockingErrors: string[] = [];
  const warnings: string[] = [];
  const informational: string[] = [];
  const sections: { [key: string]: { status: 'complete' | 'incomplete' | 'warning', issues: { type: 'blocking_error' | 'warning' | 'informational', message: string }[] } } = {};

  // Helper to add issues
  const addIssue = (sectionKey: string, type: 'blocking_error' | 'warning' | 'informational', message: string) => {
    if (!sections[sectionKey]) sections[sectionKey] = { status: 'complete', issues: [] };
    sections[sectionKey].issues.push({ type, message });
    
    if (type === 'blocking_error') {
      blockingErrors.push(message);
      sections[sectionKey].status = 'incomplete';
    } else if (type === 'warning') {
      warnings.push(message);
      if (sections[sectionKey].status !== 'incomplete') sections[sectionKey].status = 'warning';
    } else {
      informational.push(message);
    }
  };

  // 1. Vendor and Brand linkage
  if (!data.vendorId || !data.vendorName) {
    addIssue('parties', 'blocking_error', 'Vendor linkage missing');
  }
  if (!data.brandId || !data.brandName) {
    addIssue('parties', 'blocking_error', 'Brand linkage missing');
  }

  // 2. Approved Sites
  if (!data.siteCodes || data.siteCodes.length === 0) {
    addIssue('sites', 'warning', 'No sites selected');
  } else {
    addIssue('sites', 'informational', `${data.siteCodes.length} sites selected`);
  }

  // 3. Required Contact Roles
  if (type === 'quote') {
    if (!data.recipientContactIds || data.recipientContactIds.length === 0) {
      addIssue('contacts', 'warning', 'No recipient contacts assigned');
    }
  } else {
    if (!data.primarySignerContactId) {
      addIssue('contacts', 'blocking_error', 'Primary internal signer missing');
    }
    if (!data.primaryExternalContactId) {
      addIssue('contacts', 'blocking_error', 'Primary external contact missing');
    }
  }

  // 4. Pricing Reference
  if (!data.pricingProfileKey) {
    addIssue('pricing', 'blocking_error', 'Pricing profile reference missing');
  }

  // 5. Operational Reference
  if (!data.operationalProfileKey) {
    addIssue('operations', 'blocking_error', 'Operational profile reference missing');
  }

  // 6. Terms/Template/Legal References
  if (type === 'quote') {
    if (!data.quoteTemplateKey) {
      addIssue('legal', 'blocking_error', 'Quote template reference missing');
    }
  } else {
    if (!versionData.termsSnapshot || Object.keys(versionData.termsSnapshot).length === 0) {
      addIssue('legal', 'blocking_error', 'Legal terms snapshot missing');
    }
  }

  // 7. Required Field Rules (Data-driven)
  const rulesSnap = await db.collection('requiredFieldRules')
    .where('entityType', '==', type)
    .where('isActive', '==', true)
    .get();

  for (const ruleDoc of rulesSnap.docs) {
    const rule = ruleDoc.data();
    const fieldName = rule.fieldName;
    const value = data[fieldName] || versionData[fieldName];
    
    if (!value) {
      addIssue('general', rule.severity || 'blocking_error', `Required field missing: ${rule.label}`);
    }
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    warnings,
    informational,
    sections,
    evaluatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}

export const manageAgreement = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, agreementId, versionId, agreementData, versionData, quoteId } = data;

  try {
    if (action === 'create') {
      if (!quoteId) throw new functions.https.HttpsError('invalid-argument', 'Quote ID required.');

      const quoteRef = db.collection('quotes').doc(quoteId);
      const quoteDoc = await quoteRef.get();
      if (!quoteDoc.exists) throw new functions.https.HttpsError('not-found', 'Quote not found.');
      const quote = quoteDoc.data()!;

      const qVersionRef = db.collection('quoteVersions').doc(quote.currentVersionId);
      const qVersionDoc = await qVersionRef.get();
      if (!qVersionDoc.exists) throw new functions.https.HttpsError('not-found', 'Quote version not found.');
      const qVersion = qVersionDoc.data()!;

      const agreementNumber = await getNextAgreementNumber(db);
      const agreementRef = db.collection('agreements').doc();

      const agreement: any = {
        agreementNumber,
        quoteId,
        quoteNumber: quote.quoteNumber,
        vendorId: quote.vendorId,
        vendorName: quote.vendorName,
        brandId: quote.brandId,
        brandName: quote.brandName,
        status: 'draft',
        reviewStatus: 'none',
        sendReadinessState: 'incomplete',
        overrideSummary: null,
        currentVersionNumber: 1,
        pricingProfileKey: quote.pricingProfileKey || '',
        pricingProfileVersion: quote.pricingProfileVersion || 0,
        operationalProfileKey: quote.operationalProfileKey || '',
        operationalProfileVersion: quote.operationalProfileVersion || 0,
        approvedSiteIds: quote.approvedSiteIds || [],
        approvedSiteCodes: quote.approvedSiteCodes || [],
        approvedSiteNames: quote.approvedSiteNames || [],
        primarySignerContactId: quote.signerContactIds?.[0] || '',
        primaryExternalContactId: quote.recipientContactIds?.[0] || '',
        readinessSummary: quote.readinessSummary || {},
        warnings: quote.warnings || [],
        isArchived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const version1: any = {
        agreementId: agreementRef.id,
        agreementNumber,
        quoteId,
        quoteNumber: quote.quoteNumber,
        versionNumber: 1,
        status: 'draft',
        vendorSnapshot: qVersion.vendorSnapshot || {},
        brandSnapshot: qVersion.brandSnapshot || {},
        siteApprovalSnapshot: qVersion.siteApprovalSnapshot || [],
        contactSnapshot: qVersion.contactSnapshot || [],
        pricingSnapshot: qVersion.pricingSnapshot || {},
        operationalSnapshot: qVersion.operationalSnapshot || {},
        templateSnapshot: qVersion.templateSnapshot || {},
        termsSnapshot: qVersion.termsSnapshot || {},
        clauseSnapshot: {},
        renderSummary: qVersion.renderSummary || {},
        notesInternal: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const batch = db.batch();
      batch.set(agreementRef, agreement);
      const versionRef = db.collection('agreementVersions').doc();
      batch.set(versionRef, version1);
      batch.update(agreementRef, { currentVersionId: versionRef.id });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'AGREEMENT_CREATED',
        details: { agreementId: agreementRef.id, agreementNumber, quoteId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: agreementRef.id, agreementNumber };

    } else if (action === 'updateVersion') {
      if (!versionId) throw new functions.https.HttpsError('invalid-argument', 'Version ID required.');
      
      const versionRef = db.collection('agreementVersions').doc(versionId);
      const versionDoc = await versionRef.get();
      if (!versionDoc.exists) throw new functions.https.HttpsError('not-found', 'Version not found.');

      const aId = versionDoc.data()?.agreementId;
      const batch = db.batch();

      const agreementFields = ['status', 'primarySignerContactId', 'primaryExternalContactId', 'isArchived'];
      const aUpdates: any = {};
      const vUpdates: any = {};

      Object.keys(versionData || {}).forEach(key => {
        if (agreementFields.includes(key)) {
          aUpdates[key] = versionData[key];
        } else {
          vUpdates[key] = versionData[key];
        }
      });

      if (Object.keys(vUpdates).length > 0) {
        batch.update(versionRef, {
          ...vUpdates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUserId: context.auth!.uid,
        });
      }

      batch.update(db.collection('agreements').doc(aId), {
        ...aUpdates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'AGREEMENT_UPDATED',
        details: { agreementId: aId, versionId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else if (action === 'createVersion') {
      if (!agreementId || !versionId) throw new functions.https.HttpsError('invalid-argument', 'Agreement and Source Version IDs required.');

      const agreementRef = db.collection('agreements').doc(agreementId);
      const agreementDoc = await agreementRef.get();
      if (!agreementDoc.exists) throw new functions.https.HttpsError('not-found', 'Agreement not found.');
      const agreement = agreementDoc.data()!;

      const sourceVersionRef = db.collection('agreementVersions').doc(versionId);
      const sourceVersionDoc = await sourceVersionRef.get();
      if (!sourceVersionDoc.exists) throw new functions.https.HttpsError('not-found', 'Source version not found.');
      const sourceVersion = sourceVersionDoc.data()!;

      const nextVersionNumber = (agreement.currentVersionNumber || 1) + 1;
      const newVersionRef = db.collection('agreementVersions').doc();

      const newVersion = {
        ...sourceVersion,
        versionNumber: nextVersionNumber,
        status: 'draft',
        sourceVersionId: versionId,
        changeSummary: versionData?.changeSummary || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const batch = db.batch();
      batch.set(newVersionRef, newVersion);
      batch.update(agreementRef, {
        currentVersionId: newVersionRef.id,
        currentVersionNumber: nextVersionNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'AGREEMENT_VERSIONED',
        details: { agreementId, versionId: newVersionRef.id, versionNumber: nextVersionNumber },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: newVersionRef.id, versionNumber: nextVersionNumber };
    } else if (action === 'transitionStatus') {
      const { newStatus, newReviewStatus, overrideReason, notes, agreementId: aId } = data;
      
      const canonicalStatuses = ["draft", "ready_to_send", "sent", "viewed", "changes_requested", "awaiting_signature", "signed", "superseded", "voided", "archived"];
      const reviewStatuses = ["none", "pending_internal_review", "needs_revision", "approved"];
      
      if (newStatus && !canonicalStatuses.includes(newStatus)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid canonical status.');
      }
      if (newReviewStatus && !reviewStatuses.includes(newReviewStatus)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid review status.');
      }

      const agreementRef = db.collection('agreements').doc(aId);
      const agreementDoc = await agreementRef.get();
      if (!agreementDoc.exists) throw new functions.https.HttpsError('not-found', 'Agreement not found.');
      
      const agreement = agreementDoc.data()!;
      const versionRef = db.collection('agreementVersions').doc(agreement.currentVersionId);
      const versionDoc = await versionRef.get();
      if (!versionDoc.exists) throw new functions.https.HttpsError('not-found', 'Version not found.');
      const versionData = versionDoc.data()!;

      const readiness = await evaluateReadiness(db, 'agreement', agreement, versionData);

      let sendReadinessState = readiness.isReady ? 'ready' : 'incomplete';
      let overrideSummary = agreement.overrideSummary || null;

      if (newStatus === 'ready_to_send' || newReviewStatus === 'approved') {
        if (!readiness.isReady && !overrideReason) {
          throw new functions.https.HttpsError('failed-precondition', 'Cannot approve or mark ready with active blockers without an override reason.');
        }
        if (overrideReason) {
          sendReadinessState = 'overridden';
          overrideSummary = {
            reason: overrideReason,
            userId: context.auth!.uid,
            timestamp: new Date().toISOString()
          };
          
          await db.collection('activityLogs').add({
            userId: context.auth!.uid,
            action: 'AGREEMENT_READINESS_OVERRIDE',
            details: { agreementId: aId, reason: overrideReason, blockers: readiness.blockingErrors },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      const batch = db.batch();
      const updates: any = {
        readinessSummary: readiness,
        sendReadinessState,
        overrideSummary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid
      };
      if (newStatus) updates.status = newStatus;
      if (newReviewStatus) updates.reviewStatus = newReviewStatus;

      batch.update(agreementRef, updates);
      batch.update(versionRef, { 
        status: newStatus || agreement.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'AGREEMENT_STATUS_TRANSITION',
        details: { 
          agreementId: aId, 
          fromStatus: agreement.status, 
          toStatus: newStatus || agreement.status,
          fromReviewStatus: agreement.reviewStatus || 'none',
          toReviewStatus: newReviewStatus || agreement.reviewStatus || 'none',
          notes 
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, readiness };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in manageAgreement:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage agreement.');
  }
});

/**
 * Quote Management
 */
export const manageQuote = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, quoteData, quoteId, versionId, versionData } = data;

  try {
    if (action === 'create') {
      const { vendorId, brandId } = quoteData;
      
      // Fetch source data for snapshots
      const vendorDoc = await db.collection('vendors').doc(vendorId).get();
      const brandDoc = await db.collection('brands').doc(brandId).get();
      
      if (!vendorDoc.exists || !brandDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Vendor or Brand not found.');
      }

      const vendor = vendorDoc.data()!;
      const brand = brandDoc.data()!;

      // Get published profiles
      const pricingSnap = await db.collection('pricingProfiles')
        .where('profileKey', '==', brand.defaultPricingProfileKey || '')
        .where('isCurrentPublished', '==', true)
        .limit(1)
        .get();
      
      const operationalSnap = await db.collection('operationalProfiles')
        .where('profileKey', '==', brand.defaultOperationalProfileKey || '')
        .where('isCurrentPublished', '==', true)
        .limit(1)
        .get();

      const pricingProfile = pricingSnap.empty ? null : pricingSnap.docs[0].data();
      const operationalProfile = operationalSnap.empty ? null : operationalSnap.docs[0].data();

      // Get site approvals
      const sitesSnap = await db.collection('siteApprovals')
        .where('brandId', '==', brandId)
        .where('isArchived', '==', false)
        .get();
      
      const siteScope = sitesSnap.docs.map(d => d.data());

      // Get contact assignments
      const contactsSnap = await db.collection('brandContactAssignments')
        .where('brandId', '==', brandId)
        .where('isArchived', '==', false)
        .get();
      
      const contactAssignments = contactsSnap.docs.map(d => d.data());

      // Generate Quote Number
      const quoteNumber = await getNextQuoteNumber(db);

      // Readiness check
      const warnings: string[] = [];
      if (!pricingProfile) warnings.push('No published pricing profile found for brand.');
      if (!operationalProfile) warnings.push('No published operational profile found for brand.');
      if (siteScope.length === 0) warnings.push('No approved sites found for brand.');
      if (!brand.primarySignerContactId) warnings.push('No primary signer assigned.');
      if (!brand.primaryExternalContactId) warnings.push('No primary business contact assigned.');

      // Mark other quotes for this brand as not current
      const existingQuotes = await db.collection('quotes')
        .where('brandId', '==', brandId)
        .where('isCurrentForBrand', '==', true)
        .get();
      
      const batch = db.batch();
      existingQuotes.forEach(doc => {
        batch.update(doc.ref, { isCurrentForBrand: false, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      });

      const newQuote = {
        quoteNumber,
        vendorId,
        vendorName: vendor.displayName,
        brandId,
        brandName: brand.brandName,
        status: 'draft',
        reviewStatus: 'none',
        sendReadinessState: 'incomplete',
        overrideSummary: null,
        isCurrentForBrand: true,
        ownerUserId: context.auth!.uid,
        ownerDisplayName: context.auth?.token?.name || 'Unknown User',
        pricingProfileKey: brand.defaultPricingProfileKey || null,
        pricingProfileVersion: brand.defaultPricingProfileVersion || null,
        operationalProfileKey: brand.defaultOperationalProfileKey || null,
        operationalProfileVersion: brand.defaultOperationalProfileVersion || null,
        quoteTemplateKey: brand.defaultQuoteTemplateKey || 'standard-v1',
        quoteTemplateVersion: 1,
        currentVersionId: '', // Will update after version creation
        currentVersionNumber: 1,
        siteApprovalIds: siteScope.map(s => s.id || s.siteId).filter(Boolean),
        siteCodes: siteScope.map(s => s.siteCode).filter(Boolean),
        siteNames: siteScope.map(s => s.displayName || s.siteName).filter(Boolean),
        recipientContactIds: brand.primaryExternalContactId ? [brand.primaryExternalContactId] : [],
        signerContactIds: brand.primarySignerContactId ? [brand.primarySignerContactId] : [],
        issueDate: new Date().toISOString().split('T')[0],
        validUntilDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days default
        notesInternal: '',
        notesVendorVisible: '',
        recordNumberNormalized: quoteNumber.replace(/-/g, '').toLowerCase(),
        searchKeywords: [quoteNumber, vendor.displayName, brand.brandName].map(s => s.toLowerCase()),
        searchText: `${quoteNumber} ${vendor.displayName} ${brand.brandName}`.toLowerCase(),
        readinessSummary: {
          hasPricing: !!pricingProfile,
          hasOperational: !!operationalProfile,
          hasSites: siteScope.length > 0,
          hasContacts: !!brand.primarySignerContactId && !!brand.primaryExternalContactId
        },
        warnings,
        isArchived: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const quoteRef = db.collection('quotes').doc();
      batch.set(quoteRef, newQuote);

      // Create Version 1
      const version1 = {
        quoteId: quoteRef.id,
        quoteNumber,
        versionNumber: 1,
        status: 'draft',
        isCurrentVersion: true,
        isLocked: false,
        revisionReason: 'Initial creation',
        vendorSnapshot: vendor,
        brandSnapshot: brand,
        siteApprovalSnapshot: siteScope,
        contactSnapshot: contactAssignments,
        pricingSnapshot: pricingProfile,
        operationalSnapshot: operationalProfile,
        templateSnapshot: null, // Placeholder
        termsSnapshot: null, // Placeholder
        lineItems: [], // Will be populated from pricing profile in builder
        totals: { subtotal: 0, tax: 0, total: 0 },
        renderSummary: {},
        contentHash: '', // Placeholder
        notesInternal: '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const versionRef = db.collection('quoteVersions').doc();
      batch.set(versionRef, version1);

      // Update quote with current version pointer
      batch.update(quoteRef, {
        currentVersionId: versionRef.id,
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'QUOTE_CREATED',
        details: { quoteId: quoteRef.id, quoteNumber, brandId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: quoteRef.id, quoteNumber };

    } else if (action === 'updateVersion') {
      if (!versionId) throw new functions.https.HttpsError('invalid-argument', 'Version ID required.');
      
      const versionRef = db.collection('quoteVersions').doc(versionId);
      const versionDoc = await versionRef.get();
      if (!versionDoc.exists) throw new functions.https.HttpsError('not-found', 'Version not found.');

      const qId = versionDoc.data()?.quoteId;
      const batch = db.batch();

      // If versionData has fields that belong to the quote summary, we should update both
      // For simplicity, let's assume the client knows what it's doing or we split them.
      // The current client implementation sends quote updates as versionData.
      // Let's check for specific quote fields.
      const quoteFields = ['issueDate', 'validUntilDate', 'notesVendorVisible', 'status'];
      const qUpdates: any = {};
      const vUpdates: any = {};

      Object.keys(versionData).forEach(key => {
        if (quoteFields.includes(key)) {
          qUpdates[key] = versionData[key];
        } else {
          vUpdates[key] = versionData[key];
        }
      });

      if (Object.keys(vUpdates).length > 0) {
        batch.update(versionRef, {
          ...vUpdates,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedByUserId: context.auth!.uid,
        });
      }

      batch.update(db.collection('quotes').doc(qId), {
        ...qUpdates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'QUOTE_UPDATED',
        details: { quoteId: qId, versionId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

    } else if (action === 'createVersion') {
      if (!quoteId || !versionId) throw new functions.https.HttpsError('invalid-argument', 'Quote and Source Version IDs required.');
      
      const sourceVersionDoc = await db.collection('quoteVersions').doc(versionId).get();
      if (!sourceVersionDoc.exists) throw new functions.https.HttpsError('not-found', 'Source version not found.');
      
      const quoteDoc = await db.collection('quotes').doc(quoteId).get();
      const nextVersionNumber = (quoteDoc.data()?.currentVersionNumber || 0) + 1;

      const newVersion = {
        ...sourceVersionDoc.data(),
        versionNumber: nextVersionNumber,
        sourceVersionId: versionId,
        status: 'draft',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      const newVersionRef = await db.collection('quoteVersions').add(newVersion);

      await db.collection('quotes').doc(quoteId).update({
        currentVersionId: newVersionRef.id,
        currentVersionNumber: nextVersionNumber,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'QUOTE_VERSIONED',
        details: { quoteId, fromVersion: versionId, toVersion: newVersionRef.id, versionNumber: nextVersionNumber },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: newVersionRef.id, versionNumber: nextVersionNumber };
    } else if (action === 'transitionStatus') {
      const { newStatus, newReviewStatus, overrideReason, notes, quoteId: qId } = data;
      
      const canonicalStatuses = ["draft", "ready_to_send", "sent", "viewed", "changes_requested", "rejected", "accepted", "expired", "withdrawn", "superseded"];
      const reviewStatuses = ["none", "pending_internal_review", "needs_revision", "approved"];
      
      if (newStatus && !canonicalStatuses.includes(newStatus)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid canonical status.');
      }
      if (newReviewStatus && !reviewStatuses.includes(newReviewStatus)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid review status.');
      }

      const quoteRef = db.collection('quotes').doc(qId);
      const quoteDoc = await quoteRef.get();
      if (!quoteDoc.exists) throw new functions.https.HttpsError('not-found', 'Quote not found.');
      
      const quote = quoteDoc.data()!;
      const versionRef = db.collection('quoteVersions').doc(quote.currentVersionId);
      const versionDoc = await versionRef.get();
      if (!versionDoc.exists) throw new functions.https.HttpsError('not-found', 'Version not found.');
      const versionData = versionDoc.data()!;

      const readiness = await evaluateReadiness(db, 'quote', quote, versionData);

      let sendReadinessState = readiness.isReady ? 'ready' : 'incomplete';
      let overrideSummary = quote.overrideSummary || null;

      if (newStatus === 'ready_to_send' || newReviewStatus === 'approved') {
        if (!readiness.isReady && !overrideReason) {
          throw new functions.https.HttpsError('failed-precondition', 'Cannot approve or mark ready with active blockers without an override reason.');
        }
        if (overrideReason) {
          sendReadinessState = 'overridden';
          overrideSummary = {
            reason: overrideReason,
            userId: context.auth!.uid,
            timestamp: new Date().toISOString()
          };
          
          await db.collection('activityLogs').add({
            userId: context.auth!.uid,
            action: 'QUOTE_READINESS_OVERRIDE',
            details: { quoteId: qId, reason: overrideReason, blockers: readiness.blockingErrors },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      const batch = db.batch();
      const updates: any = {
        readinessSummary: readiness,
        sendReadinessState,
        overrideSummary,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid
      };
      if (newStatus) updates.status = newStatus;
      if (newReviewStatus) updates.reviewStatus = newReviewStatus;

      batch.update(quoteRef, updates);
      batch.update(versionRef, { 
        status: newStatus || quote.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid
      });

      await batch.commit();

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'QUOTE_STATUS_TRANSITION',
        details: { 
          quoteId: qId, 
          fromStatus: quote.status, 
          toStatus: newStatus || quote.status,
          fromReviewStatus: quote.reviewStatus || 'none',
          toReviewStatus: newReviewStatus || quote.reviewStatus || 'none',
          notes 
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true, readiness };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in manageQuote:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage quote.');
  }
});

/**
 * Manage Access Links (Issue, Revoke, Refresh)
 */
export const manageAccessLink = functions.https.onCall(async (data, context) => {
  const db = await checkAdmin(context);
  const { action, packageId, packageType, linkId, recipientEmail, recipientContactId, expiresDays = 7 } = data;

  try {
    if (action === 'issue') {
      if (!packageId || !packageType) throw new functions.https.HttpsError('invalid-argument', 'Package ID and Type required.');

      const packageRef = db.collection(packageType === 'quote' ? 'quotes' : 'agreements').doc(packageId);
      const packageDoc = await packageRef.get();
      if (!packageDoc.exists) throw new functions.https.HttpsError('not-found', 'Package not found.');
      const pData = packageDoc.data()!;

      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresDays);

      const linkRef = db.collection('accessLinks').doc();
      const link = {
        token,
        packageId,
        packageType,
        vendorId: pData.vendorId,
        brandId: pData.brandId,
        recipientContactId: recipientContactId || null,
        recipientEmail: recipientEmail || null,
        status: 'active',
        expiresAt: expiresAt.toISOString(),
        viewCount: 0,
        scopeSummary: `Access to ${packageType} ${pData.quoteNumber || pData.agreementNumber}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      };

      await linkRef.set(link);

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'ACCESS_LINK_ISSUED',
        details: { linkId: linkRef.id, packageId, packageType, recipientEmail },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { id: linkRef.id, token };

    } else if (action === 'revoke') {
      if (!linkId) throw new functions.https.HttpsError('invalid-argument', 'Link ID required.');

      const linkRef = db.collection('accessLinks').doc(linkId);
      const linkDoc = await linkRef.get();
      if (!linkDoc.exists) throw new functions.https.HttpsError('not-found', 'Link not found.');

      await linkRef.update({
        status: 'revoked',
        revokedAt: admin.firestore.FieldValue.serverTimestamp(),
        revokedByUserId: context.auth!.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedByUserId: context.auth!.uid,
      });

      await db.collection('activityLogs').add({
        userId: context.auth!.uid,
        action: 'ACCESS_LINK_REVOKED',
        details: { linkId },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { success: true };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in manageAccessLink:', error);
    throw new functions.https.HttpsError('internal', 'Failed to manage access link.');
  }
});

/**
 * Validate Access Link (Public)
 */
export const validateAccessLink = functions.https.onCall(async (data, context) => {
  const { token } = data;
  if (!token) throw new functions.https.HttpsError('invalid-argument', 'Token required.');

  const db = admin.firestore(FIRESTORE_DB_ID);
  const linksSnap = await db.collection('accessLinks')
    .where('token', '==', token)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (linksSnap.empty) {
    await db.collection('activityLogs').add({
      action: 'INVALID_ACCESS_ATTEMPT',
      details: { token: token.substring(0, 8) + '...' },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new functions.https.HttpsError('not-found', 'Invalid or inactive access link.');
  }

  const linkDoc = linksSnap.docs[0];
  const link = linkDoc.data();

  // Check expiration
  if (new Date(link.expiresAt) < new Date()) {
    await linkDoc.ref.update({ status: 'expired' });
    await db.collection('activityLogs').add({
      action: 'EXPIRED_ACCESS_ATTEMPT',
      details: { linkId: linkDoc.id, packageId: link.packageId },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw new functions.https.HttpsError('failed-precondition', 'Access link has expired.');
  }

  // Log view
  await linkDoc.ref.update({
    lastViewedAt: admin.firestore.FieldValue.serverTimestamp(),
    viewCount: admin.firestore.FieldValue.increment(1),
  });

  await db.collection('activityLogs').add({
    action: 'ACCESS_LINK_VIEWED',
    details: { linkId: linkDoc.id, packageId: link.packageId, packageType: link.packageType },
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    packageId: link.packageId,
    packageType: link.packageType,
    vendorId: link.vendorId,
    brandId: link.brandId,
  };
});

async function getNextQuoteNumber(db: admin.firestore.Firestore): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  const startOfDay = new Date(today.setHours(0,0,0,0));
  const snap = await db.collection('quotes')
    .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
    .get();
  
  const count = snap.size + 1;
  const seq = count.toString().padStart(4, '0');
  
  return `Q-${dateStr}-${seq}`;
}

/**
 * Sync brand site summaries
 */
async function syncBrandSiteSummaries(db: admin.firestore.Firestore, brandId: string) {
  if (!brandId) return;
  
  const approvalsSnap = await db.collection('siteApprovals')
    .where('brandId', '==', brandId)
    .where('isArchived', '==', false)
    .where('status', '==', 'approved')
    .get();
  
  const approvedSiteIds: string[] = [];
  const approvedSiteCodes: string[] = [];
  const approvedSiteNames: string[] = [];
  
  approvalsSnap.forEach(doc => {
    const data = doc.data();
    approvedSiteIds.push(data.siteId);
    approvedSiteCodes.push(data.siteCode);
    approvedSiteNames.push(data.siteName);
  });
  
  await db.collection('brands').doc(brandId).update({
    approvedSiteIds,
    approvedSiteCodes,
    approvedSiteNames,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Sync brand contact summaries and pointers
 */
async function syncBrandContactSummaries(db: admin.firestore.Firestore, brandId: string) {
  if (!brandId) return;
  
  const assignmentsSnap = await db.collection('brandContactAssignments')
    .where('brandId', '==', brandId)
    .where('isArchived', '==', false)
    .get();
  
  let primarySignerContactId: string | null = null;
  let primaryExternalContactId: string | null = null;
  
  assignmentsSnap.forEach(doc => {
    const data = doc.data();
    if (data.isPrimary) {
      if (data.roleKeys.includes('signer')) {
        primarySignerContactId = data.contactId;
      }
      if (data.roleKeys.includes('primary_business')) {
        primaryExternalContactId = data.contactId;
      }
    }
  });
  
  await db.collection('brands').doc(brandId).update({
    primarySignerContactId,
    primaryExternalContactId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}
