'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, UserPlus, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { EventRsvpStatus, LinkEvent } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { getEventEngagement } from '@/services/eventStatsService';
import { fetchRsvpFaces, type RsvpFace } from '@/services/rsvpService';
import { fetchMyFriendship, fetchUserLite, sendFriendRequest } from '@/services/friendService';
import { displayedLikeCount } from '@/utils/likeCount';
import { rsvpShareId } from '@/utils/rsvpTransition';
import { AFFILIATE_DISCLOSURE } from '@/utils/affiliateLink';
import { eventEmoji } from './EventListRow';

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
    /** ANMÄL/BOKA längst till höger (7/10: "anmäl direkt i anslutning till
     *  det") — flyttad hit från knappraden. Guld = Ticketmaster (BOKA).
     *  affiliate: provisionslänk → Annons-raden visas (marknadsföringslagen
     *  + Impact-villkoren; märkningen följde med när kortets breda CTA revs). */
    cta?: RsvpCta | null;
    /** Klickstatistiken (recordEventClick) — fire-and-forget hos föräldern. */
    onVisitCta?: () => void;
    /** Vänknappen i inbjudningsbannern för utloggade: öppna inloggningen. */
    onRequireLogin?: () => void;
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

// Lite större knappar sedan 7/10 (Josef: "de knapparna vara lite större, och
// inte med emojis") - 🤔-emojin är borta, ikonerna (lucide) står kvar.
const BTN = 'pointer-events-auto inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-black transition active:scale-95 border';
const BTN_ON = 'bg-[#006AA7] text-white border-[#005590] shadow-md';
const BTN_OFF = 'bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 border-border hover:bg-slate-50 dark:hover:bg-zinc-700';

type RsvpCounts = { going: number; interested: number; myAtFetch: EventRsvpStatus | null };

// Räknarna per serie-id, sparade vid FÖRSTA hämtningen i sessionen. Raden i
// kortet och toppraden (EventRsvpTopBar) monteras vid olika tillfällen men
// läser samma cachade getDoc - utan den här mappen hade toppraden tagit sitt
// eget "var-jag-med" efter ett tryck och tappat ens egen etta i siffran.
// Nollas aldrig, precis som getEventEngagements sessionscache.
const countsMemo = new Map<string, RsvpCounts>();

/** Kommer/Intresserad-siffrorna: samma läsning/cache som hjärtats siffra
 *  (getEventEngagement). Egna tryck justeras ±1 lokalt (displayedLikeCount
 *  är generell: bas + var-jag-med-vid-hämtning / är-jag-med-nu). */
function useRsvpCounts(event: LinkEvent, myRsvp: EventRsvpStatus | null) {
    // Seriens dokument för veckoserietillfällen (rsvpShareId) - samma id som
    // räknarskrivningen och svarsdokumentet.
    const shareId = rsvpShareId(event.id, event.userCreated);
    const [counts, setCounts] = useState<RsvpCounts | null>(() => countsMemo.get(shareId) ?? null);
    useEffect(() => {
        const known = countsMemo.get(shareId);
        if (known) { setCounts(known); return; }
        let mounted = true;
        setCounts(null);
        const my = myRsvp;
        const timer = setTimeout(() => {
            getEventEngagement(shareId).then(e => {
                if (e === null) return;
                if (!countsMemo.has(shareId)) countsMemo.set(shareId, { going: e.going, interested: e.interested, myAtFetch: my });
                if (mounted) setCounts(countsMemo.get(shareId) ?? null);
            });
        }, 400);
        return () => { mounted = false; clearTimeout(timer); };
        // Medvetet BARA shareId: egna tryck ska inte elda nya läsningar,
        // de justeras lokalt nedan.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shareId]);
    return {
        goingCount: counts === null ? null
            : displayedLikeCount(counts.going, counts.myAtFetch === 'going', myRsvp === 'going'),
        interestedCount: counts === null ? null
            : displayedLikeCount(counts.interested, counts.myAtFetch === 'interested', myRsvp === 'interested'),
    };
}

interface RsvpButtonsProps {
    myRsvp: EventRsvpStatus | null;
    goingCount: number | null;
    interestedCount: number | null;
    onSetRsvp: (status: EventRsvpStatus) => void;
    onInvite: () => void;
}

/** Intresserad · Kommer · Bjud med - EN uppsättning, delad av raden i kortet
 *  och toppraden. INTRESSERAD FÖRE KOMMER (Josef 7/10: "kan inte intresserad
 *  vara före kommer?") - trappan går mjuk → skarp. */
function RsvpButtons({ myRsvp, goingCount, interestedCount, onSetRsvp, onInvite }: RsvpButtonsProps) {
    return (
        <>
            <button
                type="button"
                aria-pressed={myRsvp === 'interested'}
                onClick={() => onSetRsvp('interested')}
                className={`${BTN} ${myRsvp === 'interested' ? BTN_ON : BTN_OFF}`}
            >
                Intresserad
                {interestedCount !== null && interestedCount > 0 && (
                    <span className={`tabular-nums ${myRsvp === 'interested' ? 'text-white/70' : 'text-slate-400'}`}>{interestedCount}</span>
                )}
            </button>
            <button
                type="button"
                aria-pressed={myRsvp === 'going'}
                onClick={() => onSetRsvp('going')}
                className={`${BTN} ${myRsvp === 'going' ? BTN_ON : BTN_OFF}`}
            >
                <Check size={15} strokeWidth={3} aria-hidden />
                Kommer
                {goingCount !== null && goingCount > 0 && (
                    <span className={`tabular-nums ${myRsvp === 'going' ? 'text-white/70' : 'text-slate-400'}`}>{goingCount}</span>
                )}
            </button>
            <button
                type="button"
                onClick={onInvite}
                aria-label="Bjud med någon - dela eventet"
                title="Bjud med någon"
                className={`${BTN} ${BTN_OFF}`}
            >
                {/* Ikon-bara sedan 7/10: ANMÄL/BOKA tog platsen i raden
                    (och delningen bor HÄR sedan dela-knappen i knappraden
                    revs samma dag). */}
                <UserPlus size={15} strokeWidth={2.5} aria-hidden />
            </button>
        </>
    );
}

type RsvpCta = { href: string; label: string; gold: boolean; affiliate?: boolean };

/** ANMÄL/BOKA-pillret (guld = Ticketmaster). */
function CtaPill({ cta, onVisitCta }: { cta: RsvpCta; onVisitCta?: () => void }) {
    return (
        <a
            href={cta.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onVisitCta}
            className={`pointer-events-auto shrink-0 inline-flex items-center gap-1 rounded-full pl-3 pr-2 py-1.5 text-xs font-black uppercase tracking-wider shadow-md ring-1 ring-inset transition active:scale-95 ${
                cta.gold
                    ? 'bg-gradient-to-r from-[#fbbf24] to-[#d97706] text-amber-950 ring-white/40 hover:from-[#fcd34d] hover:to-[#f59e0b]'
                    : 'bg-gradient-to-r from-[#0077BC] to-[#005590] text-white ring-white/25 hover:from-[#0083CE] hover:to-[#00619F]'
            }`}
        >
            {cta.label}
            <ArrowRight size={13} aria-hidden />
        </a>
    );
}

interface EventRsvpTopBarProps {
    event: LinkEvent;
    myRsvp: EventRsvpStatus | null;
    onSetRsvp: (status: EventRsvpStatus) => void;
    onInvite: () => void;
    cta?: RsvpCta | null;
    onVisitCta?: () => void;
    /** Radens höjd i px (ResizeObserver) - EventCard flyttar listans
     *  sticky-rubriker ner under den. */
    onHeight?: (px: number) => void;
}

/**
 * TOPPRADEN NÄR MAN SCROLLAT FÖRBI (ägarbeslut 7/10 kväll, Josef: "längst
 * uppe om man scrollat förbi ett eventkort. då ska fortfarande intresserad,
 * kommer, .... Alla de ska synas, samt emojin och titeln ska vara kvar"):
 * emoji + titel och ANMÄL/BOKA på första raden, Intresserad · Kommer ·
 * Bjud med på andra (alla fyra får plats på 375 px bara så - på en rad
 * trängs de ut av titeln). EventCard visar den när svarsraden i kortet
 * scrollat ut över överkanten och låter den stå kvar genom chatt,
 * arrangörsrad och listan. Ingen avatarrad och ingen inbjudningsbanner -
 * de bor kvar i raden i kortet.
 */
export function EventRsvpTopBar({ event, myRsvp, onSetRsvp, onInvite, cta = null, onVisitCta, onHeight }: EventRsvpTopBarProps) {
    const { goingCount, interestedCount } = useRsvpCounts(event, myRsvp);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || !onHeight) return;
        onHeight(el.offsetHeight);
        const ro = new ResizeObserver(() => onHeight(el.offsetHeight));
        ro.observe(el);
        return () => ro.disconnect();
    }, [onHeight]);
    return (
        <div
            ref={ref}
            className="bg-card border-b border-border shadow-md px-3 pt-2 pb-2.5 flex flex-col gap-2 animate-in fade-in slide-in-from-top-1 duration-200"
        >
            <div className="flex items-center gap-2 min-w-0">
                <span aria-hidden className="shrink-0 text-xl leading-none">{eventEmoji(event)}</span>
                <p className="flex-1 min-w-0 truncate text-sm font-black text-black dark:text-white">{event.title}</p>
                {cta && (
                    <>
                        {/* Annons-märkningen följer provisionslänken även här
                            (den långa texten bor i raden i kortet). */}
                        {cta.affiliate && (
                            <span title={AFFILIATE_DISCLOSURE} className="shrink-0 text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                                Annons
                            </span>
                        )}
                        <CtaPill cta={cta} onVisitCta={onVisitCta} />
                    </>
                )}
            </div>
            <div className="flex items-center gap-2">
                <RsvpButtons
                    myRsvp={myRsvp}
                    goingCount={goingCount}
                    interestedCount={interestedCount}
                    onSetRsvp={onSetRsvp}
                    onInvite={onInvite}
                />
            </div>
        </div>
    );
}

/**
 * KOMMER/INTRESSERAD-RADEN (ägarbeslut 6/10, spår 3: "kommer och
 * intresserad, de kan vara längst ner som en footer"): avatarraden ("man
 * visar på eventet att man kommer"), Intresserad/Kommer (ömsesidigt
 * uteslutande, utils/rsvpTransition), Bjud med (sätter Kommer + delar
 * /e/-länken med ?inb=1) och ANMÄL/BOKA. Svar kräver INGET konto - anonyma
 * sessioner räknas och visas som grå avatar.
 *
 * MELLAN BESKRIVNINGEN OCH CHATTEN sedan 7/10 sent (Josef: "intresserad,
 * kommer.... att de är mellan beskrivning och chatt") - var precis före
 * listan. Fortfarande `sticky bottom-0` (Josef samma kväll: "den kan ju
 * vara där nere i footern tills dess att vi kommer fram till där de syns i
 * eventkortet och lossna ifrån sin stickiness då"): fast i arkets botten
 * tills man scrollat fram till radens plats under beskrivningen, där den
 * släpper. Scrollar den sedan ut över överkanten tar toppraden
 * (EventRsvpTopBar) över - knapparna syns alltså hela vägen.
 * Döljs i kompaktläget (EventCard) så sträck-stoppet visar titel + tid.
 */
export default function EventRsvpFooter({ event, myRsvp, onSetRsvp, onInvite, invite, onDismissInvite, cta = null, onVisitCta, onRequireLogin }: EventRsvpFooterProps) {
    const { user } = useAuth();
    const { goingCount, interestedCount } = useRsvpCounts(event, myRsvp);

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

    // Inbjudarens namn ("Josef undrar om du följer med") — samma cachade
    // users-läsning som vänförfrågan återanvänder (friendService.fetchUserLite).
    const [inviterName, setInviterName] = useState<string | null>(null);
    useEffect(() => {
        setInviterName(null);
        if (!invite?.fran) return;
        let mounted = true;
        fetchUserLite(invite.fran).then(lite => { if (mounted) setInviterName(lite.name); });
        return () => { mounted = false; };
    }, [invite?.fran]);

    // VÄNKNAPPEN i bannern (spår 3: "mottagaren kan lägga till inbjudaren").
    // Läget hämtas först när bannern faktiskt visas för en inloggad — en
    // läsning av ens EGEN friends-rad. 'idle' = inget att visa (utredning
    // pågår, eller inbjudaren är man själv).
    const fran = invite?.fran ?? null;
    const [friendState, setFriendState] = useState<'idle' | 'none' | 'outgoing' | 'incoming' | 'accepted' | 'busy'>('idle');
    useEffect(() => {
        setFriendState('idle');
        if (!fran || fran === user?.uid) return;
        if (!user) { setFriendState('none'); return; } // knappen öppnar inloggningen
        let mounted = true;
        fetchMyFriendship(user.uid, fran).then(row => {
            if (mounted) setFriendState(row?.status ?? 'none');
        });
        return () => { mounted = false; };
    }, [fran, user]);

    const handleFriendAction = async () => {
        if (!fran) return;
        if (!user) { onRequireLogin?.(); return; }
        if (friendState !== 'none' && friendState !== 'incoming') return;
        const accepting = friendState === 'incoming';
        setFriendState('busy');
        try {
            if (accepting) {
                const { acceptFriendRequest } = await import('@/services/friendService');
                await acceptFriendRequest(user.uid, fran, 'incoming');
                setFriendState('accepted');
                toast.success('Ni är nu vänner!');
            } else {
                await sendFriendRequest({ uid: user.uid, name: user.displayName, photoURL: user.photoURL }, fran);
                setFriendState('outgoing');
                toast.success('Vänförfrågan skickad!');
            }
        } catch {
            setFriendState(accepting ? 'incoming' : 'none');
            toast.error('Det gick inte just nu. Försök igen.');
        }
    };

    return (
        // z-30: över innehållets stickies (flikrad z-10, dagrubriker z-9/20),
        // under grip-zonen (39) och drag-strecken (40). -mt-px: på sin plats
        // under beskrivningen lägger sig border-t över kortets border-b i
        // stället för att bli ett dubbelstreck.
        <div className="sticky bottom-0 z-30 -mt-px pointer-events-none">
            {/* Inbjudningsbannern — ovanpå footern så svaret är ett tryck bort. */}
            {invite && (
                <div className="pointer-events-auto mx-3 mb-1.5 flex items-center gap-2 rounded-2xl bg-[#006AA7] text-white px-4 py-2.5 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <span aria-hidden>👋</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold leading-snug">
                            {inviterName ? `${inviterName} undrar om du följer med` : 'Du är bjuden — följer du med?'}
                            <span className="block text-[10px] font-semibold text-white/75">Svara här nedanför — inget konto behövs.</span>
                        </p>
                        {/* Vänvägen (spår 3): lägg till inbjudaren direkt ur bannern.
                            'idle' = man själv/okänt läge → ingen rad alls. */}
                        {friendState !== 'idle' && (
                            friendState === 'accepted' ? (
                                <p className="mt-1 text-[10px] font-bold text-white/85">
                                    <Check size={11} strokeWidth={3} aria-hidden className="inline -mt-0.5 mr-0.5" />
                                    Ni är vänner
                                </p>
                            ) : friendState === 'outgoing' ? (
                                <p className="mt-1 text-[10px] font-bold text-white/85">Vänförfrågan skickad ✓</p>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => void handleFriendAction()}
                                    disabled={friendState === 'busy'}
                                    className="mt-1 inline-flex items-center gap-1 rounded-full bg-white/15 hover:bg-white/25 px-2 py-0.5 text-[10px] font-black text-white transition disabled:opacity-60"
                                >
                                    <UserPlus size={11} strokeWidth={2.5} aria-hidden />
                                    {friendState === 'incoming'
                                        ? `Acceptera vänförfrågan${inviterName ? ` från ${inviterName}` : ''}`
                                        : `Lägg till ${inviterName ?? 'inbjudaren'} som vän`}
                                </button>
                            )
                        )}
                    </div>
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
            <div className="pointer-events-auto bg-card border-t border-border px-3 py-2 flex flex-col gap-1">
            <div className="flex items-center gap-2">
                {/* Avatarraden: de som kommer/är intresserade — överlappade
                    små profilbilder, anonyma som grå siluett. */}
                {faces.length > 0 && (
                    <div className="flex items-center shrink-0 -space-x-2" aria-label={`${faces.length} personer har svarat`}>
                        {faces.slice(0, 3).map(f => <FaceDot key={f.uid} face={f} />)}
                        {faces.length > 3 && (
                            <span className="w-6 h-6 rounded-full border-2 border-card bg-slate-100 dark:bg-zinc-700 text-slate-500 dark:text-zinc-300 flex items-center justify-center text-[9px] font-black">
                                +{faces.length - 3}
                            </span>
                        )}
                    </div>
                )}
                <div className="flex-1" />
                <RsvpButtons
                    myRsvp={myRsvp}
                    goingCount={goingCount}
                    interestedCount={interestedCount}
                    onSetRsvp={onSetRsvp}
                    onInvite={onInvite}
                />
                {cta && <CtaPill cta={cta} onVisitCta={onVisitCta} />}
            </div>
            {/* Annons-märkningen för provisionslänkar — följde med BOKA hit
                när kortets breda CTA revs (7/10 kväll). */}
            {cta?.affiliate && (
                <p className="text-center text-[9px] font-semibold text-slate-400 dark:text-zinc-500 leading-none">
                    {AFFILIATE_DISCLOSURE}
                </p>
            )}
            </div>
        </div>
    );
}
