'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { EventRsvpStatus } from '@/types';
import { RSVP_EVENTS_KEY, nextRsvp, parseRsvpLocal, rsvpCountDeltas, rsvpShareId } from '@/utils/rsvpTransition';
import { getEventEngagement, recordEventRsvpCount } from '@/services/eventStatsService';
import { setRsvpStatus } from '@/services/rsvpService';
import { userService } from '@/services/userService';
import { displayedLikeCount } from '@/utils/likeCount';

/**
 * Kommer/Intresserad för EN yta utanför kartan (stadssidornas utfällda event,
 * 7/10 — "sen ska vi även ha intresserad och kommer"). Samma dataflöde som
 * kartans footer: eget svar i localStorage (RSVP_EVENTS_KEY, delad nyckel så
 * kartan ser valet vid nästa besök) + users-dokumentet (arrayUnion/arrayRemove
 * — skriver aldrig över andra enheters listor), publika svaret i eventRsvps
 * och räknarna i eventStats. INGET konto krävs (anonym session, som tips).
 *
 * Kartan ((v2)/page.tsx) har sitt eget set-baserade flöde — det här är för
 * fristående sidor där ett event i taget visas.
 */
export function useEventRsvp(eventId: string, userCreated?: boolean) {
    const { user, ensureTipIdentity } = useAuth();
    const [my, setMy] = useState<EventRsvpStatus | null>(null);
    const [counts, setCounts] = useState<{ going: number; interested: number; myAtFetch: EventRsvpStatus | null } | null>(null);
    const myRef = useRef(my);
    myRef.current = my;

    // Eget läge ur localStorage — efter mount (SSR-säkert).
    useEffect(() => {
        try {
            const local = parseRsvpLocal(window.localStorage.getItem(RSVP_EVENTS_KEY));
            setMy(local.going.includes(eventId) ? 'going'
                : local.interested.includes(eventId) ? 'interested' : null);
        } catch { setMy(null); }
    }, [eventId]);

    // Räknarna: samma läsning/cache som kortets footer (getEventEngagement).
    useEffect(() => {
        let mounted = true;
        setCounts(null);
        const timer = setTimeout(() => {
            getEventEngagement(rsvpShareId(eventId, userCreated)).then(e => {
                if (!mounted || e === null) return;
                setCounts({ going: e.going, interested: e.interested, myAtFetch: myRef.current });
            });
        }, 400);
        return () => { mounted = false; clearTimeout(timer); };
    }, [eventId, userCreated]);

    const press = useCallback(async (pressed: EventRsvpStatus) => {
        const prev = myRef.current;
        const next = nextRsvp(prev, pressed);
        setMy(next);
        // Enhetens kopia: ta bort ur båda listorna, lägg i den nya.
        try {
            const local = parseRsvpLocal(window.localStorage.getItem(RSVP_EVENTS_KEY));
            const cleaned = {
                going: local.going.filter(x => x !== eventId),
                interested: local.interested.filter(x => x !== eventId),
            };
            if (next) cleaned[next].push(eventId);
            window.localStorage.setItem(RSVP_EVENTS_KEY, JSON.stringify(cleaned));
        } catch { /* privat läge — valet gäller besöket */ }
        recordEventRsvpCount(rsvpShareId(eventId, userCreated), rsvpCountDeltas(prev, next));
        // Kontospegeln direkt (inte vid nästa kartbesök) — som stadssidornas
        // hjärtan (addSavedEventId-resonemanget i userService).
        if (user) {
            void userService.applyRsvpEventId(user.uid, eventId, next).catch(err =>
                console.warn('Kunde inte spegla svaret till kontot:', err));
        }
        try {
            const uid = await ensureTipIdentity();
            await setRsvpStatus(eventId, userCreated, uid, next, {
                name: user?.displayName || null,
                photoURL: user?.photoURL || null,
            });
        } catch (err) {
            console.warn('Kunde inte spara svaret:', err);
        }
    }, [eventId, userCreated, user, ensureTipIdentity]);

    const goingCount = counts === null ? null
        : displayedLikeCount(counts.going, counts.myAtFetch === 'going', my === 'going');
    const interestedCount = counts === null ? null
        : displayedLikeCount(counts.interested, counts.myAtFetch === 'interested', my === 'interested');

    return { my, press, goingCount, interestedCount };
}
