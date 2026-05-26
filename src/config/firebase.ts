import admin from 'firebase-admin';
import { getEnv } from './env.js';

let firebaseInitialized = false;

export function initializeFirebase(): void {
  if (firebaseInitialized) return;

  const env = getEnv();

  if (env.SKIP_FIREBASE || !env.FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID === 'your-project-id') {
    console.log('ℹ️ Firebase skipped (SKIP_FIREBASE or placeholder config)');
    return;
  }

  if (!env.FIREBASE_PRIVATE_KEY || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_STORAGE_BUCKET) {
    console.log('ℹ️ Firebase skipped (incomplete credentials)');
    return;
  }

  const serviceAccount: admin.ServiceAccount = {
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
  };

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: env.FIREBASE_STORAGE_BUCKET,
  });

  firebaseInitialized = true;
  console.log('✅ Firebase initialized');
}

export function getStorageBucket() {
  if (!firebaseInitialized) {
    throw new Error('Firebase is not initialized');
  }
  return admin.storage().bucket();
}

export function isFirebaseEnabled(): boolean {
  return firebaseInitialized;
}
