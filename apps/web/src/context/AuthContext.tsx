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
  /** Byt profilbild (URL från Storage). Uppdaterar Auth-profilen + speglas lokalt. */
  updatePhotoURL: (url: string) => Promise<void>;
  /**
   * Skicka lösenordsåterställning. Utan argument: till inloggat kontos e-post
   * (profilpanelen). Med `email`: till valfri adress — för "glömt lösenord"
   * när man inte kan logga in.
   */
  resetPassword: (email?: string) => Promise<void>;
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

  const updatePhotoURL = async (url: string) => {
    if (!auth.currentUser) throw new Error('Inte inloggad');
    await updateProfile(auth.currentUser, { photoURL: url });
    setUser({ ...auth.currentUser, photoURL: url } as User);
  };

  const resetPassword = async (email?: string) => {
    const target = email?.trim() || auth.currentUser?.email;
    if (!target) throw new Error('Ingen e-postadress angiven');
    await sendPasswordResetEmail(auth, target);
  };

  const deleteAccount = async () => {
    if (!auth.currentUser) throw new Error('Inte inloggad');
    await deleteUser(auth.currentUser);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, signIn, register, updateDisplayName, updatePhotoURL, resetPassword, deleteAccount }}>
      {/* Rendera ALLTID children. `!loading && children` dolde hela appen under
          SSR (loading är alltid true på servern) → varje sida serverades som
          TOMT HTML-skal, osynligt för Google. Konsumenter som behöver vänta på
          auth läser `loading` ur contexten i stället. */}
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
