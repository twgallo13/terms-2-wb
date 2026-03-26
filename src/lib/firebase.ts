import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
let app;
try {
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
} catch (error) {
  console.error('Firebase initialization error:', error);
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const storage = getStorage(app);
const functions = getFunctions(app, 'us-central1');

export { app, auth, db, storage, functions };
