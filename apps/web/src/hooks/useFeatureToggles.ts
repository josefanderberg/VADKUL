'use client';

/**
 * useFeatureToggles — React-hook ovanpå featureToggles.ts.
 *
 * - localStorage är källan (synkron, fungerar utloggad och för kartkoden).
 * - Speglar valfritt till Firestore users/{uid}.featureToggles när inloggad,
 *   och hydrerar därifrån för värden som saknas lokalt (cross-device) utan att
 *   skriva över lokala val.
 */

import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
    FEATURE_CHANGE_EVENT,
    getAllToggles,
    hasLocalValue,
    isFeatureOn,
    setFeatureOn,
} from '../lib/featureToggles';

export function useFeatureToggles() {
    const { user } = useAuth();
    const [toggles, setToggles] = useState<Record<string, boolean>>(() => getAllToggles());

    // Håll state i synk med localStorage-ändringar (samma flik via custom-event,
    // andra flikar via 'storage'-event).
    useEffect(() => {
        const refresh = () => setToggles(getAllToggles());
        window.addEventListener(FEATURE_CHANGE_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(FEATURE_CHANGE_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    // Hydrera från Firestore vid inloggning — endast värden som saknas lokalt.
    useEffect(() => {
        if (!user || !db) return;
        let cancelled = false;
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                const remote = (snap.data()?.featureToggles ?? {}) as Record<string, boolean>;
                if (cancelled) return;
                for (const [id, on] of Object.entries(remote)) {
                    if (!hasLocalValue(id)) setFeatureOn(id, !!on);
                }
            } catch {
                /* best-effort */
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    const setToggle = useCallback(
        (id: string, on: boolean) => {
            setFeatureOn(id, on); // uppdaterar localStorage + state via event
            if (user && db) {
                setDoc(
                    doc(db, 'users', user.uid),
                    { featureToggles: { [id]: on } },
                    { merge: true },
                ).catch(() => { /* best-effort */ });
            }
        },
        [user],
    );

    const isOn = useCallback((id: string) => toggles[id] ?? isFeatureOn(id), [toggles]);

    return { toggles, isOn, setToggle };
}
