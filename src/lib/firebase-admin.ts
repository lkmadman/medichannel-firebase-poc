/**
 * Firebase Admin SDK initialization
 * Server-side only - never exposed to browser
 * Credentials loaded from environment variables or credential file (gitignored)
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;

/**
 * Initialize Firebase Admin SDK
 * Uses service account credentials from:
 * 1. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON file)
 * 2. FIREBASE_SERVICE_ACCOUNT_JSON environment variable (JSON string)
 * 3. Local credentials/firebase-service-account.json file (gitignored)
 */
export function initializeFirebaseAdmin(): { app: App; db: Firestore } {
  if (adminApp && adminDb) {
    return { app: adminApp, db: adminDb };
  }

  try {
    let serviceAccount: any = null;

    // Priority 1: Environment variable with JSON string
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        console.log('[Firebase Admin] Loaded credentials from FIREBASE_SERVICE_ACCOUNT_JSON env var');
      } catch (e) {
        console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', e);
      }
    }

    // Priority 2: Environment variable with file path
    if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const fs = require('fs');
      const path = require('path');
      const credPath = path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
      if (fs.existsSync(credPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
        console.log('[Firebase Admin] Loaded credentials from GOOGLE_APPLICATION_CREDENTIALS file');
      }
    }

    // Priority 3: Local gitignored file
    if (!serviceAccount) {
      const fs = require('fs');
      const path = require('path');
      const localCredPath = path.resolve(process.cwd(), 'credentials', 'firebase-service-account.json');
      if (fs.existsSync(localCredPath)) {
        serviceAccount = JSON.parse(fs.readFileSync(localCredPath, 'utf8'));
        console.log('[Firebase Admin] Loaded credentials from local credentials/firebase-service-account.json');
      }
    }

    if (!serviceAccount) {
      throw new Error(
        'Firebase Admin credentials not found. Please provide credentials via:\n' +
        '1. FIREBASE_SERVICE_ACCOUNT_JSON environment variable (JSON string)\n' +
        '2. GOOGLE_APPLICATION_CREDENTIALS environment variable (path to JSON file)\n' +
        '3. credentials/firebase-service-account.json file (gitignored)'
      );
    }

    // Validate required fields
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Invalid service account: missing required fields (project_id, client_email, private_key)');
    }

    // Initialize the app
    adminApp = getApps().length > 0 ? getApps()[0] : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

    adminDb = getFirestore(adminApp);

    // Configure Firestore settings
    adminDb.settings({
      ignoreUndefinedProperties: true,
    });

    console.log(`[Firebase Admin] Initialized for project: ${serviceAccount.project_id}`);
    return { app: adminApp, db: adminDb };
  } catch (error) {
    console.error('[Firebase Admin] Initialization failed:', error);
    throw error;
  }
}

/**
 * Get the Firestore instance (initializes if needed)
 */
export function getAdminDb(): Firestore {
  if (!adminDb) {
    initializeFirebaseAdmin();
  }
  return adminDb!;
}

/**
 * Get the Firebase Admin app instance
 */
export function getAdminApp(): App {
  if (!adminApp) {
    initializeFirebaseAdmin();
  }
  return adminApp!;
}

/**
 * Check if Firebase Admin is initialized
 */
export function isFirebaseAdminInitialized(): boolean {
  return adminApp !== null && adminDb !== null;
}