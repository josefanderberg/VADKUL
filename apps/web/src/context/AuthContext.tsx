'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
    onAuthStateChanged,
    signOut as firebaseSignOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    linkWithCredential,
    EmailAuthProvider,
    updateProfile,
    sendPasswordResetEmail,
    deleteUser,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
  /**
   * Den INLOGGADE användaren — alltid null för en anonym session.
   *
   * Tips får lämnas utan konto (se ensureTipIdentity), och en anonym Firebase-
   * session är ändå en User. Om den läckte ut här skulle varenda `!user`-grind
   * i appen (RSVP, önskningar, chatt, profil, boost) plötsligt släppa igenom
   * tipsare som inte har något konto. Därför filtreras anonyma bort på vägen
   * ut: allt som fanns innan beter sig exakt som förut, och bara det som
   * uttryckligen frågar efter tips-identiteten nedan ser den.
   */
  user: User | null;
  loading: boolean;
  /** True medan en anonym tips-session är aktiv (inget konto, men ett uid). */
  isAnonymousSession: boolean;
  /**
   * Ge mig ett uid att skriva ett TIPS med — utan att be om konto.
   * Finns redan en inloggad användare används den; annars skapas (eller
   * återanvänds) en anonym session. Reglerna kräver fortfarande
   * `hostUid == request.auth.uid`, så formkraven står kvar oförändrade och
   * en enskild spammare går att spärra på sitt uid.
   */
  ensureTipIdentity: () => Promise<string>;
  logout: () => Promise<void>;
  /** E-post + lösenord — samma flöde som gamla login-sidan, fast i modal. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Skapa konto + sätt visningsnamn (används i chatt och som event-värd).
   *  Ålder + kön (statistikunderlag) speglas till users/{uid} i Firestore.
   *  hasChildren = "Jag har barn"-kryssrutan — åldrarna kompletteras i
   *  profilen (registreringen hålls lätt). */
  register: (name: string, email: string, password: string, stats?: { age?: number; gender?: string; city?: string; citySlug?: string; citySource?: 'gps' | 'manual'; hasChildren?: boolean }) => Promise<void>;
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
  // rawUser = vad Firebase faktiskt har (kan vara en anonym tips-session).
  // `user` nedan är den filtrerade vyn som resten av appen ser.
  const [rawUser, setRawUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setRawUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const isAnonymousSession = !!rawUser?.isAnonymous;
  const user = isAnonymousSession ? null : rawUser;

  const setUser = setRawUser;

  const ensureTipIdentity = async (): Promise<string> => {
    if (auth.currentUser) return auth.currentUser.uid;
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  };

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const register = async (name: string, email: string, password: string, stats?: { age?: number; gender?: string; city?: string; citySlug?: string; citySource?: 'gps' | 'manual'; hasChildren?: boolean }) => {
    // Har personen redan tipsat anonymt sitter hen på en anonym session med ett
    // uid som står som hostUid på tipsen. LÄNKA kontot till det uid:t i stället
    // för att skapa ett nytt — annars blir tipsen föräldralösa och hen tappar
    // rätten att redigera/ta bort dem. Faller tillbaka på vanlig registrering
    // om länkningen inte går (t.ex. e-posten redan använd på ett annat konto).
    const anon = auth.currentUser?.isAnonymous ? auth.currentUser : null;
    let cred;
    if (anon) {
      try {
        cred = await linkWithCredential(anon, EmailAuthProvider.credential(email, password));
      } catch (e) {
        console.warn('Kunde inte länka den anonyma sessionen — skapar nytt konto:', e);
        cred = await createUserWithEmailAndPassword(auth, email, password);
      }
    } else {
      cred = await createUserWithEmailAndPassword(auth, email, password);
    }
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      // onAuthStateChanged fyrar före updateProfile hinner slå igenom — spegla lokalt.
      setUser({ ...cred.user, displayName: name.trim() } as User);
    }
    // Spegla profilen (inkl. ålder/kön — statistikunderlag) till users/{uid}.
    // Best-effort: kontot ÄR redan skapat — ett Firestore-hicka får inte få
    // registreringen att se misslyckad ut.
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await setDoc(doc(db, 'users', cred.user.uid), {
        uid: cred.user.uid,
        email,
        displayName: name.trim(),
        ...(typeof stats?.age === 'number' && Number.isFinite(stats.age) ? { age: stats.age } : {}),
        ...(stats?.gender ? { gender: stats.gender } : {}),
        // Bara ikryssad ruta skrivs — en okryssad ruta vid registrering är
        // "inget svar", inte ett aktivt "har inga barn" (det sätts i profilen).
        ...(stats?.hasChildren ? { hasChildren: true } : {}),
        ...(stats?.city && stats?.citySlug ? {
          city: stats.city,
          citySlug: stats.citySlug,
          citySource: stats.citySource ?? 'manual',
          cityUpdatedAt: serverTimestamp(),
        } : {}),
        createdAt: serverTimestamp(),
      }, { merge: true });
    } catch (e) {
      console.warn('Kunde inte spara profildata (ålder/kön):', e);
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
    <AuthContext.Provider value={{ user, loading, isAnonymousSession, ensureTipIdentity, logout, signIn, register, updateDisplayName, updatePhotoURL, resetPassword, deleteAccount }}>
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
