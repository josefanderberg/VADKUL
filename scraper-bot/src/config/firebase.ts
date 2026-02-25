import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Ensure you have downloaded the service account key from Firebase Console
// Project Settings -> Service Accounts -> Generate new private key
// Save it as 'service-account.json' in the root folder of this project.

const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');

try {
    const serviceAccount = require(serviceAccountPath);

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (error) {
    console.warn('⚠️ WARNING: service-account.json not found or invalid.');
    console.warn('Please add it to the root of the vadkul-scraper project to interact with Firebase.');
}

const db = admin.apps.length ? admin.firestore() : null;

export { admin, db };
