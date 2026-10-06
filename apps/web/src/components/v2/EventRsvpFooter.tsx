'use client';

import { useEffect, useState } from 'react';
import { Check, UserPlus, X } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EventRsvpStatus, LinkEvent } from '@/types';
import { getEventEngagement } from '@/services/eventStatsService';
import { fetchRsvpFaces, type RsvpFace } from '@/services/rsvpService';
import { displayedLikeCount } from '@/utils/likeCount';
import { rsvpShareId } from '@/utils/rsvpTransition';

interface EventRsvpFooterProps {
    event: LinkEvent;
    /** Eget svar (page.tsx äger statet — speglas i konto + localStorage). */
    myRsvp: EventRsvpStatus | null;
    onSetRsvp: (status: EventRsvpStatus) => void;
    /** "Bjud med" — sätter Kommer och öppnar delningsarket (page.tsx). */
    onInvite: () => void;
    /** Kortet öppnades via en inbjudningslänk (?inb=1): bannern "X undrar om
     *  du följer med". fran = inbjudarens uid (kan saknas). */
    invite?: { fran: string | null } | null;
    onDismissInvite?: () => void;
}

// Sessionscache för inbjudarnamnen (users är publikt läsbar) — en läsning per
// inbjudare och besök.
const inviterNameCache = new Map<string, Promise<string | null>>();

function fetchInviterName(uid: string): Promise<string | null> {
    let p = inviterNameCache.get(uid);
    if (!p) {
        p = getDoc(doc(db, 'users', uid))
            .then(snap => {
                const name = snap.exists() ? (snap.data() as { displayName?: unknown }).displayName : null;
                return typeof name === 'string' && name.trim() ? name.trim() : null;
            })
            .catch(() => null);
        inviterNameCache.set(uid, p);
    }
    return p;
}

/** Liten profilbild i avatarraden — grå siluett för anonyma svar (inbjudna
 *  utan konto räknas med, Josef 6/10). */
function FaceDot({ face }: { face: RsvpFace }) {
    return face.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={face.photoURL}
            alt={face.name ?? ''}
            title={face.name ?? undefined}
            className="w-6 h-6 rounded-full object-cover border-2 border-card bg-slate-200"
        />
    ) : (
        <span
            title={face.name ?? undefined}
            aria-hidden={!face.name}
            className="w-6 h-6 rounded-full border-2 border-card bg-slate-300 dark:bg-zinc-600 text-slate-600 dark:text-zinc-300 flex items-center justify-center text-[10px] font-black"
        >
            {face.name ? face.name.trim().charAt(0).toUpperCase() : '👤'}
        </span>
    );
}

const BTN = 'pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black transition active:scale-95 border';
const BTN_ON = 'bg-[#006AA7] text-white border-[#005590] shadow-md';
const BTN_OFF = 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-border hover:bg-slate-50 dark:hover:bg-zinc-700';

/**
 * KOMMER/INTRESSERAD-FOOTERN (ägarbeslut 6/10, spår 3: "kommer och
 * intresserad, de kan vara längst ner som en footer"): fast fält i botten av
 * eventkortets ark med avatarraden ("man visar på eventet att man kommer"),
 * Kommer/Intresserad (ömsesidigt uteslutande, utils/rsvpTransition) och Bjud
 * med (sätter Kommer + delar /e/-länken med ?inb=1). Svar kräver INGET konto
 * — anonyma sessioner räknas och visas som grå avatar. Döljs i kompaktläget
 * (EventCard) så sträck-stoppet fortfarande visar titel + tid.
 */
export default function EventRsvpFooter({ event, myRsvp, onSetRsvp, onInvite, invite, onDismissInvite }: EventRsvpFooterProps) {
    // Räknarna: samma läsning/cache som hjärtats siffra (getEventEngagement).
    // Egna tryck justeras ±1 lokalt (displayedLikeCount är generell:
    // bas + var-jag-med-vid-hämtning / är-jag-med-nu).
    const [counts, setCounts] = useState<{ going: number; interested: number; myAtFetch: EventRsvpStatus | null } | null>(null);
    useEffect(() => {
        let mounted = true;
        setCounts(null);
        const my = myRsvp;
        const timer = setTimeout(() => {
            // Seriens dokument för veckoserietillfällen (rsvpShareId) — samma
            // id som räknarskrivningen och svarsdokumentet.
            getEventEngagement(rsvpShareId(event.id, event.userCreated)).then(e => {
                if (!mounted || e === null) return;
                setCounts({ going: e.going, interested: e.interested, myAtFetch: my });
            });
        }, 400);
        return () => { mounted = false; clearTimeout(timer); };
        // Medvetet BARA event.id: egna tryck ska inte elda nya läsningar,
        // de justeras lokalt nedan.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [event.id]);
    const goingCount = counts === null ? null
        : displayedLikeCount(counts.going, counts.myAtFetch === 'going', myRsvp === 'going');
    const interestedCount = counts === null ? null
        : displayedLikeCount(counts.interested, counts.myAtFetch === 'interested', myRsvp === 'interested');

    // Avatarraden: hämtas lite senare än räknarna och hämtas OM efter eget
    // svar (setRsvpStatus invaliderar sessionscachen) så man ser sig själv.
    const [faces, setFaces] = useState<RsvpFace[]>([]);
    useEffect(() => {
        let mounted = true;
        const timer = setTimeout(() => {
            fetchRsvpFaces(event.id, event.userCreated).then(list => { if (mounted) setFaces(list); });
        }, myRsvp === null ? 600 : 1200);
        return () => { mounted = false; clearTimeout(timer); };
    }, [event.id, event.userCreated, myRsvp]);

    // Inbjudarens namn ("Josef undrar om du följer med").
    const [inviterName, setInviterName] = useState<string | null>(null);
    useEffect(() => {
        setInviterName(null);
        if (!invite?.fran) return;
        let mounted = true;
        fetchInviterName(invite.fran).then(name => { if (mounted) setInviterName(name); });
        return () => { mounted = false; };
    }, [invite?.fran]);

    return (
        <div className="absolute inset-x-0 bottom-0 z-[55] pointer-events-none">
            {/* Inbjudningsbannern — ovanpå footern så svaret är ett tryck bort. */}
            {invite && (
                <div className="pointer-events-auto mx-3 mb-1.5 flex items-center gap-2 rounded-2xl bg-[#006AA7] text-white px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span aria-hidden>👋</span>
                    <p className="flex-1 text-xs font-bold leading-snug">
                        {inviterName ? `${inviterName} undrar om du följer med` : 'Du är bjuden — följer du med?'}
                        <span className="block text-[10px] font-semibold text-white/75">Svara här nedanför — inget konto behövs.</span>
                    </p>
                    {onDismissInvite && (
                        <button
                            type="button"
                            onClick={onDismissInvite}
                            aria-label="Stäng inbjudan"
                            className="shrink-0 p-1 rounded-full hover:bg-white/15 transition-colors"
                        >
                            <X size={14} strokeWidth={3} aria-hidden />
                        </button>
                    )}
                </div>
            )}
            {/* Själva footern: solid platta med border-t, som kortets övriga ytor. */}
            <div className="pointer-events-auto bg-card border-t border-border px-3 py-2 flex items-center gap-2">
                {/* Avatarraden: de som kommer/är intresserade — överlappade
                    små profilbilder, anonyma som grå siluett. */}
                {faces.length > 0 && (
                    <div className="flex items-center shrink-0 -space-x-2" aria-label={`${faces.length} personer har svarat`}>
                        {faces.slice(0, 4).map(f => <FaceDot key={f.uid} face={f} />)}
                        {faces.length > 4 && (
                            <span className="w-6 h-6 rounded-full border-2 border-card bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-300 flex items-center justify-center text-[9px] font-black">
                                +{faces.length - 4}
                            </span>
                        )}
                    </div>
                )}
                <div className="flex-1" />
                <button
                    type="button"
                    aria-pressed={myRsvp === 'going'}
                    onClick={() => onSetRsvp('going')}
                    className={`${BTN} ${myRsvp === 'going' ? BTN_ON : BTN_OFF}`}
                >
                    <Check size={14} strokeWidth={3} aria-hidden />
                    Kommer
                    {goingCount !== null && goingCount > 0 && (
                        <span className={`tabular-nums ${myRsvp === 'going' ? 'text-white/70' : 'text-slate-400'}`}>{goingCount}</span>
                    )}
                </button>
                <button
                    type="button"
                    aria-pressed={myRsvp === 'interested'}
                    onClick={() => onSetRsvp('interested')}
                    className={`${BTN} ${myRsvp === 'interested' ? BTN_ON : BTN_OFF}`}
                >
                    <span aria-hidden>🤔</span>
                    Intresserad
                    {interestedCount !== null && interestedCount > 0 && (
                        <span className={`tabular-nums ${myRsvp === 'interested' ? 'text-white/70' : 'text-slate-400'}`}>{interestedCount}</span>
                    )}
                </button>
                <button
                    type="button"
                    onClick={onInvite}
                    aria-label="Bjud med någon — dela eventet"
                    title="Bjud med någon"
                    className={`${BTN} ${BTN_OFF}`}
                >
                    <UserPlus size={14} strokeWidth={2.5} aria-hidden />
                    <span className="hidden sm:inline">Bjud med</span>
                </button>
            </div>
        </div>
    );
}
