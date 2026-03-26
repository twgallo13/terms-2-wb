import { 
  signOut, 
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { auth, db, functions } from './firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export { auth, db, functions };

export async function bootstrapInternalUser() {
  console.log('[AuthService] Initiating bootstrapInternalUser');
  
  if (!auth.currentUser) {
    console.error('[AuthService] Bootstrap failed: No authenticated user found.');
    throw new Error(JSON.stringify({ error: 'UNAUTHENTICATED', message: 'User must be logged in to bootstrap.' }));
  }

  if (!auth.currentUser.emailVerified) {
    console.error('[AuthService] Bootstrap failed: Email not verified.', { email: auth.currentUser.email });
    throw new Error(JSON.stringify({ error: 'UNVERIFIED_EMAIL', message: 'Email must be verified before provisioning.' }));
  }

  try {
    console.log('[AuthService] Calling bootstrapUserOnRequest Cloud Function...', { uid: auth.currentUser.uid, email: auth.currentUser.email });
    
    const idToken = await auth.currentUser.getIdToken();
    const projectId = firebaseConfig.projectId;
    const region = 'us-central1';
    const url = `https://${region}-${projectId}.cloudfunctions.net/bootstrapUserOnRequest`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[AuthService] bootstrapUserOnRequest error response:', errorData);
      
      if (response.status === 403 || errorData.error === 'ACCESS_DENIED') {
        throw new Error(JSON.stringify({ 
          error: 'ACCESS_DENIED', 
          message: errorData.message || 'Your account is not authorized for internal access.' 
        }));
      }
      
      throw new Error(JSON.stringify({ 
        error: errorData.error || 'internal', 
        message: errorData.message || 'Provisioning failed.' 
      }));
    }

    const data = await response.json();
    console.log('[AuthService] bootstrapUserOnRequest success:', data);
    
    if (data.status === 'denied') {
      console.warn('[AuthService] Bootstrap denied by server policy.');
      throw new Error(JSON.stringify({ 
        error: 'ACCESS_DENIED', 
        message: 'Your account is not authorized for internal access.' 
      }));
    }
    
    return data;
  } catch (error: any) {
    console.error('[AuthService] bootstrapUserOnRequest error:', error);
    
    // If it's already a JSON string error we threw above, just re-throw it
    try {
      const parsed = JSON.parse(error.message);
      if (parsed.error) throw error;
    } catch (e) {
      // Not a JSON error, continue
    }

    throw error;
  }
}

// Settings Management Wrappers
export async function manageSite(action: 'create' | 'update', siteData: any, siteId?: string) {
  const manageSiteFn = httpsCallable(functions, 'manageSite');
  return (await manageSiteFn({ action, siteId, siteData })).data as any;
}

export async function manageService(action: 'create' | 'update', serviceData: any, serviceId?: string) {
  const manageServiceFn = httpsCallable(functions, 'manageService');
  return (await manageServiceFn({ action, serviceId, serviceData })).data as any;
}

export async function manageFee(action: 'create' | 'update', feeData: any, feeId?: string) {
  const manageFeeFn = httpsCallable(functions, 'manageFee');
  return (await manageFeeFn({ action, feeId, feeData })).data as any;
}

export async function managePricingProfile(action: 'create' | 'update' | 'publish', profileData: any, profileId?: string) {
  const managePricingProfileFn = httpsCallable(functions, 'managePricingProfile');
  return (await managePricingProfileFn({ action, profileId, profileData })).data as any;
}

export async function manageOperationalProfile(action: 'create' | 'update' | 'publish', profileData: any, profileId?: string) {
  const manageOperationalProfileFn = httpsCallable(functions, 'manageOperationalProfile');
  return (await manageOperationalProfileFn({ action, profileId, profileData })).data as any;
}

export async function manageRequiredFieldRules(action: 'create' | 'update', ruleData: any, ruleId?: string) {
  const manageRequiredFieldRulesFn = httpsCallable(functions, 'manageRequiredFieldRules');
  return (await manageRequiredFieldRulesFn({ action, ruleId, ruleData })).data as any;
}

export async function manageCustomFieldDefinition(action: 'create' | 'update', defData: any, defId?: string) {
  const manageCustomFieldDefinitionFn = httpsCallable(functions, 'manageCustomFieldDefinition');
  return (await manageCustomFieldDefinitionFn({ action, defId, defData })).data as any;
}

export async function manageVendor(action: 'create' | 'update' | 'archive' | 'reactivate', vendorData: any, vendorId?: string) {
  console.log(`Calling manageVendor with action: ${action}`, { vendorId, vendorData });
  try {
    const manageVendorFn = httpsCallable(functions, 'manageVendor');
    const result = await manageVendorFn({ action, vendorId, vendorData });
    console.log('manageVendor result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageVendor error:', error);
    throw error;
  }
}

export async function manageBrand(action: 'create' | 'update' | 'archive' | 'reactivate', brandData: any, brandId?: string) {
  console.log(`Calling manageBrand with action: ${action}`, { brandId, brandData });
  try {
    const manageBrandFn = httpsCallable(functions, 'manageBrand');
    const result = await manageBrandFn({ action, brandId, brandData });
    console.log('manageBrand result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageBrand error:', error);
    throw error;
  }
}

export async function manageContact(action: 'create' | 'update' | 'archive' | 'reactivate', contactData: any, contactId?: string) {
  console.log(`Calling manageContact with action: ${action}`, { contactId, contactData });
  try {
    const manageContactFn = httpsCallable(functions, 'manageContact');
    const result = await manageContactFn({ action, contactId, contactData });
    console.log('manageContact result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageContact error:', error);
    throw error;
  }
}

export async function manageSiteApproval(action: 'assign' | 'remove' | 'update', approvalData: any, approvalId?: string) {
  console.log(`Calling manageSiteApproval with action: ${action}`, { approvalId, approvalData });
  try {
    const manageSiteApprovalFn = httpsCallable(functions, 'manageSiteApproval');
    const result = await manageSiteApprovalFn({ action, approvalId, approvalData });
    console.log('manageSiteApproval result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageSiteApproval error:', error);
    throw error;
  }
}

export async function manageBrandContactAssignment(action: 'assign' | 'remove' | 'update', assignmentData: any, assignmentId?: string) {
  console.log(`Calling manageBrandContactAssignment with action: ${action}`, { assignmentId, assignmentData });
  try {
    const manageBrandContactAssignmentFn = httpsCallable(functions, 'manageBrandContactAssignment');
    const result = await manageBrandContactAssignmentFn({ action, assignmentId, assignmentData });
    console.log('manageBrandContactAssignment result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageBrandContactAssignment error:', error);
    throw error;
  }
}

export async function manageQuote(action: 'create' | 'updateVersion' | 'createVersion' | 'transitionStatus', quoteData?: any, quoteId?: string, versionId?: string, versionData?: any, newStatus?: string, newReviewStatus?: string, overrideReason?: string, notes?: string) {
  console.log(`Calling manageQuote with action: ${action}`, { quoteId, versionId, action });
  try {
    const manageQuoteFn = httpsCallable(functions, 'manageQuote');
    const result = await manageQuoteFn({ action, quoteData, quoteId, versionId, versionData, newStatus, newReviewStatus, overrideReason, notes });
    console.log('manageQuote result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageQuote error:', error);
    throw error;
  }
}

export async function manageAgreement(action: 'create' | 'updateVersion' | 'createVersion' | 'transitionStatus', agreementData?: any, agreementId?: string, versionId?: string, versionData?: any, quoteId?: string, newStatus?: string, newReviewStatus?: string, overrideReason?: string, notes?: string) {
  console.log(`Calling manageAgreement with action: ${action}`, { agreementId, versionId, action });
  try {
    const manageAgreementFn = httpsCallable(functions, 'manageAgreement');
    const result = await manageAgreementFn({ action, agreementData, agreementId, versionId, versionData, quoteId, newStatus, newReviewStatus, overrideReason, notes });
    console.log('manageAgreement result:', result);
    return result.data as any;
  } catch (error: any) {
    console.error('manageAgreement error:', error);
    throw error;
  }
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'system_owner' | 'internal_admin' | 'vendor_primary' | 'vendor_signer' | 'vendor_viewer';
  isInternal: boolean;
  vendorId?: string;
  createdAt: any;
  updatedAt: any;
}

export async function loginWithEmail(email: string, pass: string) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error('Error signing in with email:', error);
    throw error;
  }
}

export async function registerWithEmail(email: string, pass: string) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    return result.user;
  } catch (error) {
    console.error('Error registering with email:', error);
    throw error;
  }
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export async function sendSignInLink(email: string, redirectUrl?: string) {
  const actionCodeSettings = {
    url: redirectUrl || `${window.location.origin}/vendor/login/callback`,
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem('emailForSignIn', email);
}


export async function signInWithLink(email: string, link: string) {
  if (isSignInWithEmailLink(auth, link)) {
    const result = await signInWithEmailLink(auth, email, link);
    return result.user;
  }
  throw new Error('Invalid sign-in link');
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile;
  }
  return null;
}

export async function logout() {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}
