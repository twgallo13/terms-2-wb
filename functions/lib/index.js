"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAccessLink = exports.manageAccessLink = exports.manageQuote = exports.manageAgreement = exports.manageBrandContactAssignment = exports.manageSiteApproval = exports.manageContact = exports.manageBrand = exports.manageVendor = exports.manageCustomFieldDefinition = exports.manageRequiredFieldRules = exports.manageOperationalProfile = exports.managePricingProfile = exports.manageFee = exports.manageService = exports.manageSite = exports.bootstrapUser = exports.onUserCreate = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
admin.initializeApp();
exports.onUserCreate = functions.auth.user().onCreate(async (user) => {
    var _a, _b;
    const db = admin.firestore();
    await db.collection('activityLogs').add({
        userId: user.uid,
        email: user.email,
        action: 'AUTH_ACCOUNT_CREATED',
        details: { provider: ((_b = (_a = user.providerData) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.providerId) || 'unknown' },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
});
exports.bootstrapUser = functions.https.onCall(async (data, context) => {
    var _a, _b;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const email = context.auth.token.email;
    const emailVerified = context.auth.token.email_verified;
    const uid = context.auth.uid;
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'User email missing.');
    }
    const db = admin.firestore();
    const domain = email.split('@')[1];
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        if (userDoc.exists && ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role)) {
            return { status: 'already_provisioned', role: (_b = userDoc.data()) === null || _b === void 0 ? void 0 : _b.role };
        }
        if (!emailVerified) {
            await db.collection('activityLogs').add({
                userId: uid,
                email: email,
                action: 'PROVISIONING_SKIPPED_UNVERIFIED',
                details: { domain },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { status: 'unverified' };
        }
        const domainSnap = await db.collection('domainAllowlist')
            .where('domain', '==', domain)
            .limit(1)
            .get();
        const emailSnap = await db.collection('emailAllowlist')
            .where('email', '==', email)
            .limit(1)
            .get();
        let role = null;
        let isInternal = false;
        if (!domainSnap.empty) {
            role = domainSnap.docs[0].data().role;
            isInternal = true;
        }
        else if (!emailSnap.empty) {
            role = emailSnap.docs[0].data().role;
            isInternal = true;
        }
        if (isInternal && role) {
            await db.collection('users').doc(uid).set({
                email,
                displayName: context.auth.token.name || email.split('@')[0],
                role: role,
                isInternal: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('activityLogs').add({
                userId: uid,
                email: email,
                action: 'USER_PROVISIONED',
                details: { role, domain, method: 'bootstrap-verified' },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { status: 'success', role };
        }
        else {
            await db.collection('activityLogs').add({
                userId: uid,
                email: email,
                action: 'ACCESS_DENIED_UNRECOGNIZED',
                details: { domain },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { status: 'denied' };
        }
    }
    catch (error) {
        console.error('Error in bootstrapUser:', error);
        throw new functions.https.HttpsError('internal', 'Provisioning failed.');
    }
});
const checkAdmin = async (context) => {
    var _a;
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be logged in.');
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(context.auth.uid).get();
    const isBootstrapAdmin = context.auth.token.email === 'theo@shiekhshoes.org' && context.auth.token.email_verified === true;
    if (!userDoc.exists) {
        if (isBootstrapAdmin)
            return db;
        throw new functions.https.HttpsError('permission-denied', 'User profile not found.');
    }
    const role = (_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.role;
    if (role !== 'system_owner' && role !== 'internal_admin' && !isBootstrapAdmin) {
        throw new functions.https.HttpsError('permission-denied', 'User is not an admin.');
    }
    return db;
};
exports.manageSite = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, siteId, siteData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('sites').add(Object.assign(Object.assign({}, siteData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SITE_CREATED',
                details: { siteId: docRef.id, siteData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('sites').doc(siteId).update(Object.assign(Object.assign({}, siteData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SITE_UPDATED',
                details: { siteId, siteData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive') {
            await db.collection('sites').doc(siteId).update({
                isActive: false,
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SITE_ARCHIVED',
                details: { siteId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageSite:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage site.');
    }
});
exports.manageService = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, serviceId, serviceData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('services').add(Object.assign(Object.assign({}, serviceData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SERVICE_CREATED',
                details: { serviceId: docRef.id, serviceData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('services').doc(serviceId).update(Object.assign(Object.assign({}, serviceData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SERVICE_UPDATED',
                details: { serviceId, serviceData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive') {
            await db.collection('services').doc(serviceId).update({
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SERVICE_ARCHIVED',
                details: { serviceId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageService:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage service.');
    }
});
exports.manageFee = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, feeId, feeData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('fees').add(Object.assign(Object.assign({}, feeData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'FEE_CREATED',
                details: { feeId: docRef.id, feeData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('fees').doc(feeId).update(Object.assign(Object.assign({}, feeData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'FEE_UPDATED',
                details: { feeId, feeData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive') {
            await db.collection('fees').doc(feeId).update({
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'FEE_ARCHIVED',
                details: { feeId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageFee:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage fee.');
    }
});
exports.managePricingProfile = functions.https.onCall(async (data, context) => {
    var _a;
    const db = await checkAdmin(context);
    const { action, profileId, profileData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('pricingProfiles').add(Object.assign(Object.assign({}, profileData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'PRICING_PROFILE_CREATED',
                details: { profileId: docRef.id, profileData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('pricingProfiles').doc(profileId).update(Object.assign(Object.assign({}, profileData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'PRICING_PROFILE_UPDATED',
                details: { profileId, profileData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'publish') {
            const targetDoc = await db.collection('pricingProfiles').doc(profileId).get();
            if (!targetDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Profile not found.');
            }
            const profileKey = (_a = targetDoc.data()) === null || _a === void 0 ? void 0 : _a.profileKey;
            if (!profileKey) {
                throw new functions.https.HttpsError('failed-precondition', 'Profile missing profileKey.');
            }
            const currentSnap = await db.collection('pricingProfiles')
                .where('profileKey', '==', profileKey)
                .where('isCurrentPublished', '==', true)
                .get();
            const batch = db.batch();
            currentSnap.forEach(doc => {
                if (doc.id !== profileId) {
                    batch.update(doc.ref, { isCurrentPublished: false, status: 'retired' });
                }
            });
            batch.update(db.collection('pricingProfiles').doc(profileId), {
                isCurrentPublished: true,
                status: 'published',
                publishedAt: admin.firestore.FieldValue.serverTimestamp(),
                publishedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'PRICING_PROFILE_PUBLISHED',
                details: { profileId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive') {
            await db.collection('pricingProfiles').doc(profileId).update({
                isArchived: true,
                status: 'archived',
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'PRICING_PROFILE_ARCHIVED',
                details: { profileId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in managePricingProfile:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage pricing profile.');
    }
});
exports.manageOperationalProfile = functions.https.onCall(async (data, context) => {
    var _a;
    const db = await checkAdmin(context);
    const { action, profileId, profileData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('operationalProfiles').add(Object.assign(Object.assign({}, profileData), { createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'OPERATIONAL_PROFILE_CREATED',
                details: { profileId: docRef.id, profileData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('operationalProfiles').doc(profileId).update(Object.assign(Object.assign({}, profileData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'OPERATIONAL_PROFILE_UPDATED',
                details: { profileId, profileData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'publish') {
            const targetDoc = await db.collection('operationalProfiles').doc(profileId).get();
            if (!targetDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Profile not found.');
            }
            const profileKey = (_a = targetDoc.data()) === null || _a === void 0 ? void 0 : _a.profileKey;
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
                publishedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'OPERATIONAL_PROFILE_PUBLISHED',
                details: { profileId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive') {
            await db.collection('operationalProfiles').doc(profileId).update({
                isArchived: true,
                status: 'archived',
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'OPERATIONAL_PROFILE_ARCHIVED',
                details: { profileId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageOperationalProfile:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage operational profile.');
    }
});
exports.manageRequiredFieldRules = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, ruleId, ruleData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('requiredFieldRules').add(Object.assign(Object.assign({}, ruleData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'REQUIRED_FIELD_RULE_CREATED',
                details: { ruleId: docRef.id, ruleData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('requiredFieldRules').doc(ruleId).update(Object.assign(Object.assign({}, ruleData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'REQUIRED_FIELD_RULE_UPDATED',
                details: { ruleId, ruleData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageRequiredFieldRules:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage required field rules.');
    }
});
exports.manageCustomFieldDefinition = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, defId, defData } = data;
    try {
        if (action === 'create') {
            const docRef = await db.collection('customFieldDefinitions').add(Object.assign(Object.assign({}, defData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'CUSTOM_FIELD_DEFINITION_CREATED',
                details: { defId: docRef.id, defData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            await db.collection('customFieldDefinitions').doc(defId).update(Object.assign(Object.assign({}, defData), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }));
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'CUSTOM_FIELD_DEFINITION_UPDATED',
                details: { defId, defData },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageCustomFieldDefinition:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage custom field definition.');
    }
});
function generateSearchKeywords(text) {
    if (!text)
        return [];
    const normalized = text.toLowerCase().trim();
    const words = normalized.split(/\s+/);
    const keywords = new Set();
    words.forEach(word => {
        for (let i = 1; i <= word.length; i++) {
            keywords.add(word.substring(0, i));
        }
    });
    return Array.from(keywords);
}
exports.manageVendor = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, vendorData, vendorId } = data;
    try {
        if (action === 'create') {
            const normalizedName = vendorData.displayName.toLowerCase().trim();
            const searchKeywords = generateSearchKeywords(vendorData.displayName);
            const searchText = `${vendorData.displayName} ${vendorData.legalName} ${vendorData.vendorCode}`.toLowerCase();
            const newVendor = Object.assign(Object.assign({}, vendorData), { normalizedName,
                searchKeywords,
                searchText, activeBrandCount: 0, isArchived: false, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const docRef = await db.collection('vendors').add(newVendor);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'VENDOR_CREATED',
                details: { vendorId: docRef.id, displayName: vendorData.displayName, vendorCode: vendorData.vendorCode },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            if (!vendorId)
                throw new functions.https.HttpsError('invalid-argument', 'Vendor ID required.');
            const updatePayload = Object.assign(Object.assign({}, vendorData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            if (vendorData.displayName) {
                updatePayload.normalizedName = vendorData.displayName.toLowerCase().trim();
                updatePayload.searchKeywords = generateSearchKeywords(vendorData.displayName);
                updatePayload.searchText = `${vendorData.displayName} ${vendorData.legalName || ''} ${vendorData.vendorCode || ''}`.toLowerCase();
            }
            await db.collection('vendors').doc(vendorId).update(updatePayload);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'VENDOR_UPDATED',
                details: { vendorId, changes: Object.keys(vendorData) },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive' || action === 'reactivate') {
            if (!vendorId)
                throw new functions.https.HttpsError('invalid-argument', 'Vendor ID required.');
            const isArchiving = action === 'archive';
            await db.collection('vendors').doc(vendorId).update({
                isArchived: isArchiving,
                status: isArchiving ? 'archived' : 'active',
                archivedAt: isArchiving ? admin.firestore.FieldValue.serverTimestamp() : null,
                archivedByUserId: isArchiving ? context.auth.uid : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: isArchiving ? 'VENDOR_ARCHIVED' : 'VENDOR_REACTIVATED',
                details: { vendorId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageVendor:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage vendor.');
    }
});
exports.manageBrand = functions.https.onCall(async (data, context) => {
    var _a;
    const db = await checkAdmin(context);
    const { action, brandData, brandId } = data;
    try {
        if (action === 'create') {
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
            const newBrand = Object.assign(Object.assign({}, brandData), { defaultPricingProfileKey: (pricingDefault === null || pricingDefault === void 0 ? void 0 : pricingDefault.profileKey) || null, defaultPricingProfileVersion: (pricingDefault === null || pricingDefault === void 0 ? void 0 : pricingDefault.versionNumber) || null, defaultOperationalProfileKey: (operationalDefault === null || operationalDefault === void 0 ? void 0 : operationalDefault.profileKey) || null, defaultOperationalProfileVersion: (operationalDefault === null || operationalDefault === void 0 ? void 0 : operationalDefault.versionNumber) || null, normalizedName,
                searchKeywords,
                searchText, isArchived: false, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const docRef = await db.collection('brands').add(newBrand);
            await db.collection('vendors').doc(brandData.vendorId).update({
                activeBrandCount: admin.firestore.FieldValue.increment(1)
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'BRAND_CREATED',
                details: { brandId: docRef.id, brandName: brandData.brandName, vendorId: brandData.vendorId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            if (!brandId)
                throw new functions.https.HttpsError('invalid-argument', 'Brand ID required.');
            const updatePayload = Object.assign(Object.assign({}, brandData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            if (brandData.brandName) {
                updatePayload.normalizedName = brandData.brandName.toLowerCase().trim();
                updatePayload.searchKeywords = generateSearchKeywords(brandData.brandName);
                updatePayload.searchText = `${brandData.brandName} ${brandData.brandCode || ''}`.toLowerCase();
            }
            await db.collection('brands').doc(brandId).update(updatePayload);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'BRAND_UPDATED',
                details: { brandId, changes: Object.keys(brandData) },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive' || action === 'reactivate') {
            if (!brandId)
                throw new functions.https.HttpsError('invalid-argument', 'Brand ID required.');
            const isArchiving = action === 'archive';
            const brandDoc = await db.collection('brands').doc(brandId).get();
            const vendorId = (_a = brandDoc.data()) === null || _a === void 0 ? void 0 : _a.vendorId;
            await db.collection('brands').doc(brandId).update({
                isArchived: isArchiving,
                status: isArchiving ? 'archived' : 'active',
                archivedAt: isArchiving ? admin.firestore.FieldValue.serverTimestamp() : null,
                archivedByUserId: isArchiving ? context.auth.uid : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            if (vendorId) {
                await db.collection('vendors').doc(vendorId).update({
                    activeBrandCount: admin.firestore.FieldValue.increment(isArchiving ? -1 : 1)
                });
            }
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: isArchiving ? 'BRAND_ARCHIVED' : 'BRAND_REACTIVATED',
                details: { brandId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageBrand:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage brand.');
    }
});
exports.manageContact = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = await checkAdmin(context);
    const { action, contactData, contactId } = data;
    try {
        if (action === 'create') {
            const fullName = `${contactData.firstName} ${contactData.lastName}`;
            const normalizedName = fullName.toLowerCase().trim();
            const normalizedEmail = contactData.email.toLowerCase().trim();
            const searchKeywords = generateSearchKeywords(fullName);
            const searchText = `${fullName} ${contactData.email}`.toLowerCase();
            const newContact = Object.assign(Object.assign({}, contactData), { displayName: fullName, normalizedName,
                normalizedEmail,
                searchKeywords,
                searchText, isArchived: false, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const docRef = await db.collection('contacts').add(newContact);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'CONTACT_CREATED',
                details: { contactId: docRef.id, displayName: fullName, vendorId: contactData.vendorId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            if (!contactId)
                throw new functions.https.HttpsError('invalid-argument', 'Contact ID required.');
            const updatePayload = Object.assign(Object.assign({}, contactData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            if (contactData.firstName || contactData.lastName) {
                const current = await db.collection('contacts').doc(contactId).get();
                const firstName = contactData.firstName || ((_a = current.data()) === null || _a === void 0 ? void 0 : _a.firstName);
                const lastName = contactData.lastName || ((_b = current.data()) === null || _b === void 0 ? void 0 : _b.lastName);
                const fullName = `${firstName} ${lastName}`;
                updatePayload.displayName = fullName;
                updatePayload.normalizedName = fullName.toLowerCase().trim();
                updatePayload.searchKeywords = generateSearchKeywords(fullName);
                updatePayload.searchText = `${fullName} ${contactData.email || ((_c = current.data()) === null || _c === void 0 ? void 0 : _c.email)}`.toLowerCase();
            }
            if (contactData.email) {
                updatePayload.normalizedEmail = contactData.email.toLowerCase().trim();
            }
            await db.collection('contacts').doc(contactId).update(updatePayload);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'CONTACT_UPDATED',
                details: { contactId, changes: Object.keys(contactData) },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'archive' || action === 'reactivate') {
            if (!contactId)
                throw new functions.https.HttpsError('invalid-argument', 'Contact ID required.');
            const isArchiving = action === 'archive';
            await db.collection('contacts').doc(contactId).update({
                isArchived: isArchiving,
                status: isArchiving ? 'archived' : 'active',
                archivedAt: isArchiving ? admin.firestore.FieldValue.serverTimestamp() : null,
                archivedByUserId: isArchiving ? context.auth.uid : null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: isArchiving ? 'CONTACT_ARCHIVED' : 'CONTACT_REACTIVATED',
                details: { contactId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageContact:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage contact.');
    }
});
exports.manageSiteApproval = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const db = await checkAdmin(context);
    const { action, approvalData, approvalId } = data;
    try {
        if (action === 'assign') {
            const { brandId, siteId } = approvalData;
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
                await doc.ref.update({
                    isArchived: false,
                    status: 'approved',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedByUserId: context.auth.uid,
                });
                await syncBrandSiteSummaries(db, brandId);
                return { id: doc.id };
            }
            const newApproval = Object.assign(Object.assign({}, approvalData), { status: 'approved', isArchived: false, selectedAt: admin.firestore.FieldValue.serverTimestamp(), selectedByUserId: context.auth.uid, approvedAt: admin.firestore.FieldValue.serverTimestamp(), approvedByUserId: context.auth.uid, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const docRef = await db.collection('siteApprovals').add(newApproval);
            await syncBrandSiteSummaries(db, brandId);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SITE_APPROVAL_ASSIGNED',
                details: { brandId, siteId, siteName: approvalData.siteName },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            if (!approvalId)
                throw new functions.https.HttpsError('invalid-argument', 'Approval ID required.');
            const updatePayload = Object.assign(Object.assign({}, approvalData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            await db.collection('siteApprovals').doc(approvalId).update(updatePayload);
            const approvalDoc = await db.collection('siteApprovals').doc(approvalId).get();
            await syncBrandSiteSummaries(db, (_a = approvalDoc.data()) === null || _a === void 0 ? void 0 : _a.brandId);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SITE_APPROVAL_UPDATED',
                details: { approvalId, changes: Object.keys(approvalData) },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'remove') {
            if (!approvalId)
                throw new functions.https.HttpsError('invalid-argument', 'Approval ID required.');
            const approvalDoc = await db.collection('siteApprovals').doc(approvalId).get();
            const brandId = (_b = approvalDoc.data()) === null || _b === void 0 ? void 0 : _b.brandId;
            await db.collection('siteApprovals').doc(approvalId).update({
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            if (brandId) {
                await syncBrandSiteSummaries(db, brandId);
            }
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'SITE_APPROVAL_REMOVED',
                details: { approvalId, brandId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageSiteApproval:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage site approval.');
    }
});
exports.manageBrandContactAssignment = functions.https.onCall(async (data, context) => {
    var _a, _b;
    const db = await checkAdmin(context);
    const { action, assignmentData, assignmentId } = data;
    try {
        if (action === 'assign') {
            const { brandId, contactId } = assignmentData;
            const existing = await db.collection('brandContactAssignments')
                .where('brandId', '==', brandId)
                .where('contactId', '==', contactId)
                .limit(1)
                .get();
            if (!existing.empty) {
                const doc = existing.docs[0];
                await doc.ref.update(Object.assign(Object.assign({}, assignmentData), { isArchived: false, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
                await syncBrandContactSummaries(db, brandId);
                return { id: doc.id };
            }
            const newAssignment = Object.assign(Object.assign({}, assignmentData), { isArchived: false, createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const docRef = await db.collection('brandContactAssignments').add(newAssignment);
            await syncBrandContactSummaries(db, brandId);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'BRAND_CONTACT_ASSIGNED',
                details: { brandId, contactId, roles: assignmentData.roleKeys },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: docRef.id };
        }
        else if (action === 'update') {
            if (!assignmentId)
                throw new functions.https.HttpsError('invalid-argument', 'Assignment ID required.');
            const updatePayload = Object.assign(Object.assign({}, assignmentData), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            await db.collection('brandContactAssignments').doc(assignmentId).update(updatePayload);
            const assignmentDoc = await db.collection('brandContactAssignments').doc(assignmentId).get();
            await syncBrandContactSummaries(db, (_a = assignmentDoc.data()) === null || _a === void 0 ? void 0 : _a.brandId);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'BRAND_CONTACT_ASSIGNMENT_UPDATED',
                details: { assignmentId, changes: Object.keys(assignmentData) },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'remove') {
            if (!assignmentId)
                throw new functions.https.HttpsError('invalid-argument', 'Assignment ID required.');
            const assignmentDoc = await db.collection('brandContactAssignments').doc(assignmentId).get();
            const brandId = (_b = assignmentDoc.data()) === null || _b === void 0 ? void 0 : _b.brandId;
            await db.collection('brandContactAssignments').doc(assignmentId).update({
                isArchived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                archivedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            if (brandId) {
                await syncBrandContactSummaries(db, brandId);
            }
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'BRAND_CONTACT_ASSIGNMENT_REMOVED',
                details: { assignmentId, brandId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageBrandContactAssignment:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage brand contact assignment.');
    }
});
async function getNextAgreementNumber(db) {
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
async function evaluateReadiness(db, type, data, versionData) {
    const blockingErrors = [];
    const warnings = [];
    const informational = [];
    const sections = {};
    const addIssue = (sectionKey, type, message) => {
        if (!sections[sectionKey])
            sections[sectionKey] = { status: 'complete', issues: [] };
        sections[sectionKey].issues.push({ type, message });
        if (type === 'blocking_error') {
            blockingErrors.push(message);
            sections[sectionKey].status = 'incomplete';
        }
        else if (type === 'warning') {
            warnings.push(message);
            if (sections[sectionKey].status !== 'incomplete')
                sections[sectionKey].status = 'warning';
        }
        else {
            informational.push(message);
        }
    };
    if (!data.vendorId || !data.vendorName) {
        addIssue('parties', 'blocking_error', 'Vendor linkage missing');
    }
    if (!data.brandId || !data.brandName) {
        addIssue('parties', 'blocking_error', 'Brand linkage missing');
    }
    if (!data.siteCodes || data.siteCodes.length === 0) {
        addIssue('sites', 'warning', 'No sites selected');
    }
    else {
        addIssue('sites', 'informational', `${data.siteCodes.length} sites selected`);
    }
    if (type === 'quote') {
        if (!data.recipientContactIds || data.recipientContactIds.length === 0) {
            addIssue('contacts', 'warning', 'No recipient contacts assigned');
        }
    }
    else {
        if (!data.primarySignerContactId) {
            addIssue('contacts', 'blocking_error', 'Primary internal signer missing');
        }
        if (!data.primaryExternalContactId) {
            addIssue('contacts', 'blocking_error', 'Primary external contact missing');
        }
    }
    if (!data.pricingProfileKey) {
        addIssue('pricing', 'blocking_error', 'Pricing profile reference missing');
    }
    if (!data.operationalProfileKey) {
        addIssue('operations', 'blocking_error', 'Operational profile reference missing');
    }
    if (type === 'quote') {
        if (!data.quoteTemplateKey) {
            addIssue('legal', 'blocking_error', 'Quote template reference missing');
        }
    }
    else {
        if (!versionData.termsSnapshot || Object.keys(versionData.termsSnapshot).length === 0) {
            addIssue('legal', 'blocking_error', 'Legal terms snapshot missing');
        }
    }
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
exports.manageAgreement = functions.https.onCall(async (data, context) => {
    var _a, _b, _c;
    const db = await checkAdmin(context);
    const { action, agreementId, versionId, agreementData, versionData, quoteId } = data;
    try {
        if (action === 'create') {
            if (!quoteId)
                throw new functions.https.HttpsError('invalid-argument', 'Quote ID required.');
            const quoteRef = db.collection('quotes').doc(quoteId);
            const quoteDoc = await quoteRef.get();
            if (!quoteDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Quote not found.');
            const quote = quoteDoc.data();
            const qVersionRef = db.collection('quoteVersions').doc(quote.currentVersionId);
            const qVersionDoc = await qVersionRef.get();
            if (!qVersionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Quote version not found.');
            const qVersion = qVersionDoc.data();
            const agreementNumber = await getNextAgreementNumber(db);
            const agreementRef = db.collection('agreements').doc();
            const agreement = {
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
                primarySignerContactId: ((_a = quote.signerContactIds) === null || _a === void 0 ? void 0 : _a[0]) || '',
                primaryExternalContactId: ((_b = quote.recipientContactIds) === null || _b === void 0 ? void 0 : _b[0]) || '',
                readinessSummary: quote.readinessSummary || {},
                warnings: quote.warnings || [],
                isArchived: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            };
            const version1 = {
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
                createdByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            };
            const batch = db.batch();
            batch.set(agreementRef, agreement);
            const versionRef = db.collection('agreementVersions').doc();
            batch.set(versionRef, version1);
            batch.update(agreementRef, { currentVersionId: versionRef.id });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'AGREEMENT_CREATED',
                details: { agreementId: agreementRef.id, agreementNumber, quoteId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: agreementRef.id, agreementNumber };
        }
        else if (action === 'updateVersion') {
            if (!versionId)
                throw new functions.https.HttpsError('invalid-argument', 'Version ID required.');
            const versionRef = db.collection('agreementVersions').doc(versionId);
            const versionDoc = await versionRef.get();
            if (!versionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Version not found.');
            const aId = (_c = versionDoc.data()) === null || _c === void 0 ? void 0 : _c.agreementId;
            const batch = db.batch();
            const agreementFields = ['status', 'primarySignerContactId', 'primaryExternalContactId', 'isArchived'];
            const aUpdates = {};
            const vUpdates = {};
            Object.keys(versionData || {}).forEach(key => {
                if (agreementFields.includes(key)) {
                    aUpdates[key] = versionData[key];
                }
                else {
                    vUpdates[key] = versionData[key];
                }
            });
            if (Object.keys(vUpdates).length > 0) {
                batch.update(versionRef, Object.assign(Object.assign({}, vUpdates), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            }
            batch.update(db.collection('agreements').doc(aId), Object.assign(Object.assign({}, aUpdates), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'AGREEMENT_UPDATED',
                details: { agreementId: aId, versionId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'createVersion') {
            if (!agreementId || !versionId)
                throw new functions.https.HttpsError('invalid-argument', 'Agreement and Source Version IDs required.');
            const agreementRef = db.collection('agreements').doc(agreementId);
            const agreementDoc = await agreementRef.get();
            if (!agreementDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Agreement not found.');
            const agreement = agreementDoc.data();
            const sourceVersionRef = db.collection('agreementVersions').doc(versionId);
            const sourceVersionDoc = await sourceVersionRef.get();
            if (!sourceVersionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Source version not found.');
            const sourceVersion = sourceVersionDoc.data();
            const nextVersionNumber = (agreement.currentVersionNumber || 1) + 1;
            const newVersionRef = db.collection('agreementVersions').doc();
            const newVersion = Object.assign(Object.assign({}, sourceVersion), { versionNumber: nextVersionNumber, status: 'draft', sourceVersionId: versionId, changeSummary: (versionData === null || versionData === void 0 ? void 0 : versionData.changeSummary) || '', createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const batch = db.batch();
            batch.set(newVersionRef, newVersion);
            batch.update(agreementRef, {
                currentVersionId: newVersionRef.id,
                currentVersionNumber: nextVersionNumber,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'AGREEMENT_VERSIONED',
                details: { agreementId, versionId: newVersionRef.id, versionNumber: nextVersionNumber },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: newVersionRef.id, versionNumber: nextVersionNumber };
        }
        else if (action === 'transitionStatus') {
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
            if (!agreementDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Agreement not found.');
            const agreement = agreementDoc.data();
            const versionRef = db.collection('agreementVersions').doc(agreement.currentVersionId);
            const versionDoc = await versionRef.get();
            if (!versionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Version not found.');
            const versionData = versionDoc.data();
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
                        userId: context.auth.uid,
                        timestamp: new Date().toISOString()
                    };
                    await db.collection('activityLogs').add({
                        userId: context.auth.uid,
                        action: 'AGREEMENT_READINESS_OVERRIDE',
                        details: { agreementId: aId, reason: overrideReason, blockers: readiness.blockingErrors },
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
            const batch = db.batch();
            const updates = {
                readinessSummary: readiness,
                sendReadinessState,
                overrideSummary,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid
            };
            if (newStatus)
                updates.status = newStatus;
            if (newReviewStatus)
                updates.reviewStatus = newReviewStatus;
            batch.update(agreementRef, updates);
            batch.update(versionRef, {
                status: newStatus || agreement.status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid
            });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
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
    }
    catch (error) {
        console.error('Error in manageAgreement:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage agreement.');
    }
});
exports.manageQuote = functions.https.onCall(async (data, context) => {
    var _a, _b, _c, _d;
    const db = await checkAdmin(context);
    const { action, quoteData, quoteId, versionId, versionData } = data;
    try {
        if (action === 'create') {
            const { vendorId, brandId } = quoteData;
            const vendorDoc = await db.collection('vendors').doc(vendorId).get();
            const brandDoc = await db.collection('brands').doc(brandId).get();
            if (!vendorDoc.exists || !brandDoc.exists) {
                throw new functions.https.HttpsError('not-found', 'Vendor or Brand not found.');
            }
            const vendor = vendorDoc.data();
            const brand = brandDoc.data();
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
            const sitesSnap = await db.collection('siteApprovals')
                .where('brandId', '==', brandId)
                .where('isArchived', '==', false)
                .get();
            const siteScope = sitesSnap.docs.map(d => d.data());
            const contactsSnap = await db.collection('brandContactAssignments')
                .where('brandId', '==', brandId)
                .where('isArchived', '==', false)
                .get();
            const contactAssignments = contactsSnap.docs.map(d => d.data());
            const quoteNumber = await getNextQuoteNumber(db);
            const warnings = [];
            if (!pricingProfile)
                warnings.push('No published pricing profile found for brand.');
            if (!operationalProfile)
                warnings.push('No published operational profile found for brand.');
            if (siteScope.length === 0)
                warnings.push('No approved sites found for brand.');
            if (!brand.primarySignerContactId)
                warnings.push('No primary signer assigned.');
            if (!brand.primaryExternalContactId)
                warnings.push('No primary business contact assigned.');
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
                ownerUserId: context.auth.uid,
                ownerDisplayName: ((_b = (_a = context.auth) === null || _a === void 0 ? void 0 : _a.token) === null || _b === void 0 ? void 0 : _b.name) || 'Unknown User',
                pricingProfileKey: brand.defaultPricingProfileKey || null,
                pricingProfileVersion: brand.defaultPricingProfileVersion || null,
                operationalProfileKey: brand.defaultOperationalProfileKey || null,
                operationalProfileVersion: brand.defaultOperationalProfileVersion || null,
                quoteTemplateKey: brand.defaultQuoteTemplateKey || 'standard-v1',
                quoteTemplateVersion: 1,
                currentVersionId: '',
                currentVersionNumber: 1,
                siteApprovalIds: siteScope.map(s => s.id || s.siteId).filter(Boolean),
                siteCodes: siteScope.map(s => s.siteCode).filter(Boolean),
                siteNames: siteScope.map(s => s.displayName || s.siteName).filter(Boolean),
                recipientContactIds: brand.primaryExternalContactId ? [brand.primaryExternalContactId] : [],
                signerContactIds: brand.primarySignerContactId ? [brand.primarySignerContactId] : [],
                issueDate: new Date().toISOString().split('T')[0],
                validUntilDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
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
                createdByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            };
            const quoteRef = db.collection('quotes').doc();
            batch.set(quoteRef, newQuote);
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
                templateSnapshot: null,
                termsSnapshot: null,
                lineItems: [],
                totals: { subtotal: 0, tax: 0, total: 0 },
                renderSummary: {},
                contentHash: '',
                notesInternal: '',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            };
            const versionRef = db.collection('quoteVersions').doc();
            batch.set(versionRef, version1);
            batch.update(quoteRef, {
                currentVersionId: versionRef.id,
            });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'QUOTE_CREATED',
                details: { quoteId: quoteRef.id, quoteNumber, brandId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: quoteRef.id, quoteNumber };
        }
        else if (action === 'updateVersion') {
            if (!versionId)
                throw new functions.https.HttpsError('invalid-argument', 'Version ID required.');
            const versionRef = db.collection('quoteVersions').doc(versionId);
            const versionDoc = await versionRef.get();
            if (!versionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Version not found.');
            const qId = (_c = versionDoc.data()) === null || _c === void 0 ? void 0 : _c.quoteId;
            const batch = db.batch();
            const quoteFields = ['issueDate', 'validUntilDate', 'notesVendorVisible', 'status'];
            const qUpdates = {};
            const vUpdates = {};
            Object.keys(versionData).forEach(key => {
                if (quoteFields.includes(key)) {
                    qUpdates[key] = versionData[key];
                }
                else {
                    vUpdates[key] = versionData[key];
                }
            });
            if (Object.keys(vUpdates).length > 0) {
                batch.update(versionRef, Object.assign(Object.assign({}, vUpdates), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            }
            batch.update(db.collection('quotes').doc(qId), Object.assign(Object.assign({}, qUpdates), { updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid }));
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'QUOTE_UPDATED',
                details: { quoteId: qId, versionId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action === 'createVersion') {
            if (!quoteId || !versionId)
                throw new functions.https.HttpsError('invalid-argument', 'Quote and Source Version IDs required.');
            const sourceVersionDoc = await db.collection('quoteVersions').doc(versionId).get();
            if (!sourceVersionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Source version not found.');
            const quoteDoc = await db.collection('quotes').doc(quoteId).get();
            const nextVersionNumber = (((_d = quoteDoc.data()) === null || _d === void 0 ? void 0 : _d.currentVersionNumber) || 0) + 1;
            const newVersion = Object.assign(Object.assign({}, sourceVersionDoc.data()), { versionNumber: nextVersionNumber, sourceVersionId: versionId, status: 'draft', createdAt: admin.firestore.FieldValue.serverTimestamp(), createdByUserId: context.auth.uid, updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedByUserId: context.auth.uid });
            const newVersionRef = await db.collection('quoteVersions').add(newVersion);
            await db.collection('quotes').doc(quoteId).update({
                currentVersionId: newVersionRef.id,
                currentVersionNumber: nextVersionNumber,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'QUOTE_VERSIONED',
                details: { quoteId, fromVersion: versionId, toVersion: newVersionRef.id, versionNumber: nextVersionNumber },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: newVersionRef.id, versionNumber: nextVersionNumber };
        }
        else if (action === 'transitionStatus') {
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
            if (!quoteDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Quote not found.');
            const quote = quoteDoc.data();
            const versionRef = db.collection('quoteVersions').doc(quote.currentVersionId);
            const versionDoc = await versionRef.get();
            if (!versionDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Version not found.');
            const versionData = versionDoc.data();
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
                        userId: context.auth.uid,
                        timestamp: new Date().toISOString()
                    };
                    await db.collection('activityLogs').add({
                        userId: context.auth.uid,
                        action: 'QUOTE_READINESS_OVERRIDE',
                        details: { quoteId: qId, reason: overrideReason, blockers: readiness.blockingErrors },
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
            const batch = db.batch();
            const updates = {
                readinessSummary: readiness,
                sendReadinessState,
                overrideSummary,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid
            };
            if (newStatus)
                updates.status = newStatus;
            if (newReviewStatus)
                updates.reviewStatus = newReviewStatus;
            batch.update(quoteRef, updates);
            batch.update(versionRef, {
                status: newStatus || quote.status,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid
            });
            await batch.commit();
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
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
    }
    catch (error) {
        console.error('Error in manageQuote:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage quote.');
    }
});
exports.manageAccessLink = functions.https.onCall(async (data, context) => {
    const db = await checkAdmin(context);
    const { action, packageId, packageType, linkId, recipientEmail, recipientContactId, expiresDays = 7 } = data;
    try {
        if (action === 'issue') {
            if (!packageId || !packageType)
                throw new functions.https.HttpsError('invalid-argument', 'Package ID and Type required.');
            const packageRef = db.collection(packageType === 'quote' ? 'quotes' : 'agreements').doc(packageId);
            const packageDoc = await packageRef.get();
            if (!packageDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Package not found.');
            const pData = packageDoc.data();
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
                createdByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            };
            await linkRef.set(link);
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'ACCESS_LINK_ISSUED',
                details: { linkId: linkRef.id, packageId, packageType, recipientEmail },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { id: linkRef.id, token };
        }
        else if (action === 'revoke') {
            if (!linkId)
                throw new functions.https.HttpsError('invalid-argument', 'Link ID required.');
            const linkRef = db.collection('accessLinks').doc(linkId);
            const linkDoc = await linkRef.get();
            if (!linkDoc.exists)
                throw new functions.https.HttpsError('not-found', 'Link not found.');
            await linkRef.update({
                status: 'revoked',
                revokedAt: admin.firestore.FieldValue.serverTimestamp(),
                revokedByUserId: context.auth.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedByUserId: context.auth.uid,
            });
            await db.collection('activityLogs').add({
                userId: context.auth.uid,
                action: 'ACCESS_LINK_REVOKED',
                details: { linkId },
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            return { success: true };
        }
        return { success: true };
    }
    catch (error) {
        console.error('Error in manageAccessLink:', error);
        throw new functions.https.HttpsError('internal', 'Failed to manage access link.');
    }
});
exports.validateAccessLink = functions.https.onCall(async (data, context) => {
    const { token } = data;
    if (!token)
        throw new functions.https.HttpsError('invalid-argument', 'Token required.');
    const db = admin.firestore();
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
    if (new Date(link.expiresAt) < new Date()) {
        await linkDoc.ref.update({ status: 'expired' });
        await db.collection('activityLogs').add({
            action: 'EXPIRED_ACCESS_ATTEMPT',
            details: { linkId: linkDoc.id, packageId: link.packageId },
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        throw new functions.https.HttpsError('failed-precondition', 'Access link has expired.');
    }
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
async function getNextQuoteNumber(db) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const snap = await db.collection('quotes')
        .where('createdAt', '>=', admin.firestore.Timestamp.fromDate(startOfDay))
        .get();
    const count = snap.size + 1;
    const seq = count.toString().padStart(4, '0');
    return `Q-${dateStr}-${seq}`;
}
async function syncBrandSiteSummaries(db, brandId) {
    if (!brandId)
        return;
    const approvalsSnap = await db.collection('siteApprovals')
        .where('brandId', '==', brandId)
        .where('isArchived', '==', false)
        .where('status', '==', 'approved')
        .get();
    const approvedSiteIds = [];
    const approvedSiteCodes = [];
    const approvedSiteNames = [];
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
async function syncBrandContactSummaries(db, brandId) {
    if (!brandId)
        return;
    const assignmentsSnap = await db.collection('brandContactAssignments')
        .where('brandId', '==', brandId)
        .where('isArchived', '==', false)
        .get();
    let primarySignerContactId = null;
    let primaryExternalContactId = null;
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
//# sourceMappingURL=index.js.map