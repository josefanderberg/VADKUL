'use client';

import { useEffect, useRef, useCallback } from 'react';
import {
    doc, setDoc, deleteDoc, onSnapshot,
    collection, serverTimestamp, Timestamp, query, where,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';

export interface PresenceEntry {
    uid: string;
    lat: number;
    lng: number;
    displayName: string | null;
    photoURL: string | null;
    updatedAt: Timestamp | null;
    isVisible: boolean;
}

// Skriver aktuell position till presence/{uid} var 30:e sekund.
// Raderar posten när komponenten unmountas (tab stängs, logout).
export function usePublishPresence(isVisible: boolean) {
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const watchRef    = useRef<number | null>(null);
    const posRef      = useRef<{ lat: number; lng: number } | null>(null);

    const publish = useCallback(async (lat: number, lng: number) => {
        const user = auth.currentUser;
        // Anonyma tips-sessioner är inte medlemmar — de ska aldrig dyka upp som
        // en prick bland de närvarande (de har varken namn eller profilbild).
        if (!user || user.isAnonymous) return;
        posRef.current = { lat, lng };
        await setDoc(doc(db, 'presence', user.uid), {
            lat,
            lng,
            displayName: user.displayName ?? null,
            photoURL:    user.photoURL ?? null,
            updatedAt:   serverTimestamp(),
            isVisible,
        }, { merge: true });
    }, [isVisible]);

    const remove = useCallback(async () => {
        const user = auth.currentUser;
        if (!user) return;
        await deleteDoc(doc(db, 'presence', user.uid)).catch(() => {});
    }, []);

    useEffect(() => {
        if (!isVisible) {
            remove();
            return;
        }

        // Startpunkt: hämta GPS direkt
        watchRef.current = navigator.geolocation.watchPosition(
            (pos) => {
                publish(pos.coords.latitude, pos.coords.longitude);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 10_000 },
        );

        // Heartbeat var 30:e sek (håller posten "färsk" även utan rörelser)
        intervalRef.current = setInterval(() => {
            if (posRef.current) publish(posRef.current.lat, posRef.current.lng);
        }, 30_000);

        return () => {
            if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
            if (intervalRef.current !== null) clearInterval(intervalRef.current);
            remove();
        };
    }, [isVisible, publish, remove]);
}

// Lyssnar på alla synliga användare — filtrera på klientsidan (< 100 users = ok).
export function useNearbyPresence(
    onChange: (entries: PresenceEntry[]) => void,
    enabled = true,
) {
    useEffect(() => {
        if (!enabled) return;

        const q = query(
            collection(db, 'presence'),
            where('isVisible', '==', true),
        );

        const unsub = onSnapshot(q, (snap) => {
            const me = auth.currentUser?.uid;
            const entries: PresenceEntry[] = snap.docs
                .filter(d => d.id !== me)
                .map(d => ({ uid: d.id, ...d.data() } as PresenceEntry));
            onChange(entries);
        });

        return unsub;
    }, [enabled, onChange]);
}
