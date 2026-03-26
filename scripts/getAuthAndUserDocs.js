import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const firebaseConfig = require('../firebase-applet-config.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId
  });
}

const adminDb = getFirestore(admin.app(), firebaseConfig.firestoreDatabaseId || 'twg-db-terms');

async function checkUserFirestore(email) {
  console.log(`\n=== INVESTIGATING FIRESTORE: ${email} ===`);
  
  try {
    // 1. Search by email field in 'userProfiles'
    const userProfilesByEmail = await adminDb.collection('userProfiles').where('email', '==', email).get();
    if (userProfilesByEmail.empty) {
      console.log(`No documents found in 'userProfiles' for ${email}`);
    } else {
      userProfilesByEmail.forEach(doc => {
        console.log(`--- Found in 'userProfiles' collection (ID: ${doc.id}) ---`);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    }

    // 2. Search by email field in 'userProfiles'
    const profilesByEmail = await adminDb.collection('userProfiles').where('email', '==', email).get();
    if (profilesByEmail.empty) {
      console.log(`No documents found in 'userProfiles' for ${email}`);
    } else {
      profilesByEmail.forEach(doc => {
        console.log(`--- Found in 'userProfiles' collection (ID: ${doc.id}) ---`);
        console.log(JSON.stringify(doc.data(), null, 2));
      });
    }

  } catch (err) {
    console.error('Error checking Firestore:', err);
  }
}

(async () => {
  try {
    await checkUserFirestore('theo@shiekhshoes.org');
    await checkUserFirestore('theo@shiekh.com');
  } catch (err) {
    console.error('Global error:', err);
  } finally {
    process.exit(0);
  }
})();
