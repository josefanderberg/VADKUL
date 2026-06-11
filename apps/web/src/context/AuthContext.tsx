'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    onAuthStateChanged,
    signOut as firebaseSignOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    updateProfile,
    sendPasswordResetEmail,
    deleteUser,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  /** E-post + lösenord — samma flöde som gamla login-sidan, fast i modal. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Skapa konto + sätt visningsnamn (används i chatt och som event-värd). */
  register: (name: string, email: string, password: string) => Promise<void>;
  /** Byt visningsnamn (profilpanelen). Speglas lokalt direkt. */
  updateDisplayName: (name: string) => Promise<void>;
  /** Skicka lösenordsåterställning till kontots e-post. */
  resetPassword: () => Promise<void>;
  /** Radera kontot i Firebase Auth. Kan kasta auth/requires-recent-login. */
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (name: string, email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      // onAuthStateChanged fyrar före updateProfile hinner slå igenom — spegla lokalt.
      setUser({ ...cred.user, displayName: name.trim() } as User);
    }
  };

  const updateDisplayName = async (name: string) => {
    if (!auth.currentUser) throw new Error('Inte inloggad');
    await updateProfile(auth.currentUser, { displayName: name.trim() });
    setUser({ ...auth.currentUser, displayName: name.trim() } as User);
  };

  const resetPassword = async () => {
    if (!auth.currentUser?.email) throw new Error('Kontot saknar e-post');
    await sendPasswordResetEmail(auth, auth.currentUser.email);
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) throw new Error('Inte inloggad');
    await deleteUser(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, signIn, register, updateDisplayName, resetPassword, deleteAccount }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
