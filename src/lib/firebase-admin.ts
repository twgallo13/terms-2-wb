import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const app = !admin.apps.length 
  ? admin.initializeApp()
  : admin.app();

export const adminDb = getFirestore(app, 'twg-db-terms');
export const adminAuth = admin.auth();
