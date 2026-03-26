import * as admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !admin.apps.length 
  ? admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: firebaseConfig.projectId,
    })
  : admin.app();

export const adminDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const adminAuth = admin.auth();
