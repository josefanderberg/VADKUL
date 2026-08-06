'use client';

import { useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { nearestCity } from '@/lib/cityUtils';

/** localStorage-nyckel med senast GPS-härledda stad ({ name, slug }) —
 *  läses av AuthModal för att förifylla stadsfältet vid registrering. */
export const DERIVED_CITY_KEY = 'vadkul_derived_city';

const SAVE_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Härleder närmaste stad ur kartans GPS-position och speglar den till
 * users/{uid} (city/citySlug/citySource/cityUpdatedAt) — underlag för
 * stadssegmenterade medlemsutskick.
 *
 *  - Skriver max en gång per dygn (localStorage-stämpel per uid).
 *  - citySource 'manual' (valt/rensat i profilen) skrivs ALDRIG över —
 *    GPS-vägen gäller bara den som inte tagit ställning själv.
 *  - Utloggad: staden stashas ändå i localStorage så registrerings-
 *    formuläret kan förifyllas.
 */
export function useSaveUserCity(userPos: { lat: number; lng: number } | null) {
    const { user } = useAuth();
    // Max ett skrivförsök per sidladdning — dygnsstämpeln sätts först när
    // skrivningen lyckats, så en flakig anslutning inte bränner dygnskvoten.
    const attemptedRef = useRef(false);

    useEffect(() => {
        if (!userPos) return;
        const city = nearestCity(userPos.lat, userPos.lng);
        if (!city) return;

        try {
            localStorage.setItem(DERIVED_CITY_KEY, JSON.stringify({ name: city.name, slug: city.slug }));
        } catch { /* privat läge — prefill uteblir, inget mer */ }

        if (!user || attemptedRef.current) return;
        const stampKey = `vadkul_city_saved_${user.uid}`;
        try {
            const last = Number(localStorage.getItem(stampKey) || 0);
            if (Date.now() - last < SAVE_INTERVAL_MS) return;
        } catch { /* utan localStorage: skriv ändå, attemptedRef håller det till 1/laddning */ }
        attemptedRef.current = true;

        (async () => {
            try {
                const ref = doc(db, 'users', user.uid);
                const snap = await getDoc(ref);
                if (snap.exists() && snap.data().citySource === 'manual') {
                    try { localStorage.setItem(stampKey, String(Date.now())); } catch { }
                    return;
                }
                await setDoc(ref, {
                    city: city.name,
                    citySlug: city.slug,
                    citySource: 'gps',
                    cityUpdatedAt: serverTimestamp(),
                }, { merge: true });
                try { localStorage.setItem(stampKey, String(Date.now())); } catch { }
            } catch (e) {
                // Best-effort statistikunderlag — får aldrig störa kartan.
                console.warn('Kunde inte spara härledd stad:', e);
            }
        })();
    }, [userPos, user]);
}
