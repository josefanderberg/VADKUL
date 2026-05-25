// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "demo-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-vadkul-local",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export { app };

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app, 'europe-west1'); // Matchar serverns region

// Kika om vi ska ansluta till lokala emulatorer
const useEmulator = 
  typeof window !== 'undefined' && (
    process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' ||
    !!process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST ||
    firebaseConfig.projectId?.startsWith('demo-') ||
    window.location.hostname === 'localhost' // Som fallback vid lokal dev
  );

if (useEmulator) {
  let firestorePort = 8080;
  let firestoreHost = 'localhost';

  if (process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST) {
    const parts = process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST.split(':');
    firestoreHost = parts[0];
    if (parts[1]) firestorePort = parseInt(parts[1], 10);
  } else if (firebaseConfig.projectId === 'demo-vadkul-test') {
    firestorePort = 8081;
  }

  try {
    connectFirestoreEmulator(db, firestoreHost, firestorePort);
    console.log(`🔥 Connected to Firestore Emulator on ${firestoreHost}:${firestorePort}`);
    
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    console.log(`🔥 Connected to Auth Emulator on port 9099`);

    connectStorageEmulator(storage, 'localhost', 9199);
    console.log(`🔥 Connected to Storage Emulator on port 9199`);

    connectFunctionsEmulator(functions, 'localhost', 5001);
    console.log(`🔥 Connected to Functions Emulator on port 5001`);
  } catch (e) {
    console.warn("⚠️ Firebase emulators already connected or failed to connect:", e);
  }
}

// Initialize Analytics only in the browser and not in emulator/local dev
const useAnalytics = typeof window !== 'undefined' && !useEmulator && !firebaseConfig.projectId?.startsWith('demo-');
export const analytics = useAnalytics ? 
  isSupported().then(yes => yes ? getAnalytics(app) : null) : 
  Promise.resolve(null);