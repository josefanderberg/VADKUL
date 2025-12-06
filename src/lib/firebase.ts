// src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBk17AJuuOtUOLR8ChInA4MNWqWUYJXtnE",
  authDomain: "vadkul-f2cb2.firebaseapp.com",
  projectId: "vadkul-f2cb2",
  storageBucket: "vadkul-f2cb2.firebasestorage.app",
  messagingSenderId: "888495806926",
  appId: "1:888495806926:web:bd0fa8f04023927c61739f"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);