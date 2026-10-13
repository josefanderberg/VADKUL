'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, UserPlus, UserX, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { LinkEvent } from '@/types';
import { acceptFriendRequest, fetchFriendProfile, fetchMyFriends, removeFriend } from '@/services/friendService';
import { bucketFriendRows, type FriendRow } from '@/utils/friendStatus';
import { friendRsvpVisible, upcomingFriendEvents, type FriendUpcomingEvent } from '@/utils/friendEvents';
import { fetchDeepLinkEvent } from '@/utils/eventSeed';
import { genitive, sortBlocked, type BlockRow } from '@/utils/chatModeration';
import { blockUser, unblockUser, useModeration } from '@/services/moderationService';
import { FRIEND_INVITE_TEXT, friendInviteUrl } from '@/utils/friendInvite';

/**
 * VÄNNER i profilpanelen (spår 3, 7/10 kväll - "man kan gå in på sina
 * vänners profiler och se vilka de är intresserade av, kommer på").
 * Utfällbar mapp som Inställningar: ingen Firestore-läsning förrän den
 * fälls ut (reads-budgeten). Innehåll: förfrågningar (acceptera/avböj),
 * vänlistan där varje vän fälls ut till sin "profil" (kommande event hen
 * svarat Kommer/Intresserad på), och integritetsreglaget "Visa vad jag
 * kommer på för mina vänner" (users.rsvpVisibleToFriends - grinden läses
 * i fetchFriendProfile/friendEvents).
 *
 * Vännens event slås upp i den redan laddade kartdatan först och därefter
 * via /api/event?id= (samma ~1 kB-uppslag som djuplänken) - ALDRIG
 * Firestore per event. Finns eventet i datan hoppar klicket dit
 * (onPickEvent); annars blir raden en vanlig ?event=-djuplänk.
 *
 * BLOCKERING (12/10, port av appens VannerSektion, services/
 * moderationService): "Blockera" i den utfällda vänprofilen och på en
 * förfrågan, med en bekräftelseruta i raden. Att blockera tar bort
 * vänskapen/förfrågan och döljer personens chattmeddelanden; de blockerade
 * listas sist med "Häv". Blockeringslistan hämtas först när mappen fälls ut.
 */

interface FriendsSectionProps {
    /** Panelen är öppen - vid stängning fälls sektionen ihop igen. */
    panelOpen: boolean;
    allEvents?: LinkEvent[];
    onPickEvent?: (evt: LinkEvent) => void;
}

interface FriendDetail {
    state: 'loading' | 'ready' | 'hidden';
    events: FriendUpcomingEvent[];
}

function eventTimeLabel(evt: LinkEvent): string {
    const day = evt.time.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
    if (evt.hasSpecificTime === false) return day;
    return `${day} kl ${evt.time.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
}

function FriendAvatar({ row }: { row: { name: string | null; photoURL?: string | null } }) {
    return row.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.photoURL} alt="" className="w-8 h-8 rounded-full object-cover bg-slate-200 shrink-0" />
    ) : (
        <span className="w-8 h-8 rounded-full bg-[#006AA7] text-white text-xs font-black flex items-center justify-center shrink-0">
            {row.name ? row.name.trim().charAt(0).toUpperCase() : '?'}
        </span>
    );
}

export default function FriendsSection({ panelOpen, allEvents, onPickEvent }: FriendsSectionProps) {
    const { user } = useAuth();
    const [expanded, setExpanded] = useState(false);
    // null = inte hämtat än (visar "…" i stället för att ljuga "0 vänner").
    const [rows, setRows] = useState<FriendRow[] | null>(null);
    const [busyUid, setBusyUid] = useState<string | null>(null);
    const [openFriendUid, setOpenFriendUid] = useState<string | null>(null);
    const [details, setDetails] = useState<Record<string, FriendDetail>>({});
    const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
    // Bekräftelserutan för Blockera (under raden) och tvåtrycket för Häv.
    const [confirmBlockUid, setConfirmBlockUid] = useState<string | null>(null);
    const [confirmUnblockUid, setConfirmUnblockUid] = useState<string | null>(null);
    // Integritetsgrinden - null tills users-dokumentet lästs.
    const [rsvpVisible, setRsvpVisible] = useState<boolean | null>(null);
    const [visibleBusy, setVisibleBusy] = useState(false);
    const allEventsRef = useRef(allEvents);
    allEventsRef.current = allEvents;

    // Panelstängning nollar utfällningen (som Inställningar-mappen beter sig
    // vid nästa öppning vill man se listan fräsch).
    useEffect(() => {
        if (!panelOpen) {
            setExpanded(false);
            setOpenFriendUid(null);
            setConfirmRemoveUid(null);
            setConfirmBlockUid(null);
            setConfirmUnblockUid(null);
        }
    }, [panelOpen]);

    const uid = user?.uid ?? null;
    const loadFriends = useCallback(async (myUid: string) => {
        const [friends, me] = await Promise.all([
            fetchMyFriends(myUid),
            getDoc(doc(db, 'users', myUid)).catch(() => null),
        ]);
        setRows(friends);
        setRsvpVisible(friendRsvpVisible(me?.exists() ? me.data() : null));
    }, []);

    // Hämta först när sektionen fälls ut - och hämta OM vid varje utfällning
    // (en förfrågan kan ha kommit sedan sist).
    useEffect(() => {
        if (!expanded || !uid) return;
        let alive = true;
        void (async () => {
            if (!alive) return;
            await loadFriends(uid);
        })();
        return () => { alive = false; };
    }, [expanded, uid, loadFriends]);

    // Blockeringslistan - hämtas först när mappen fälls ut (reads-budgeten).
    const { rows: blockRows, blocked } = useModeration(expanded ? uid : null);
    const blockList = useMemo(() => sortBlocked(blockRows), [blockRows]);

    // Blockerade försvinner ur vänlistan även om en gammal rad skulle finnas kvar.
    const buckets = useMemo(
        () => bucketFriendRows((rows ?? []).filter(r => !blocked.has(r.uid))),
        [rows, blocked],
    );

    const handleAccept = async (row: FriendRow) => {
        if (!uid) return;
        setBusyUid(row.uid);
        try {
            await acceptFriendRequest(uid, row.uid, row.status);
            setRows(prev => prev?.map(r => r.uid === row.uid ? { ...r, status: 'accepted' } : r) ?? prev);
            toast.success(`Ni är nu vänner${row.name ? `, du och ${row.name}` : ''}!`);
        } catch {
            toast.error('Kunde inte acceptera just nu. Försök igen.');
        } finally {
            setBusyUid(null);
        }
    };

    const handleRemove = async (row: FriendRow) => {
        if (!uid) return;
        setBusyUid(row.uid);
        try {
            await removeFriend(uid, row.uid);
            setRows(prev => prev?.filter(r => r.uid !== row.uid) ?? prev);
            setOpenFriendUid(cur => cur === row.uid ? null : cur);
        } catch {
            toast.error('Kunde inte ta bort just nu. Försök igen.');
        } finally {
            setBusyUid(null);
            setConfirmRemoveUid(null);
        }
    };

    /** Blockera - vänskapen/förfrågan rivs i samma batch (moderationService). */
    const handleBlock = async (row: FriendRow) => {
        if (!uid) return;
        setBusyUid(row.uid);
        try {
            await blockUser(uid, { uid: row.uid, name: row.name });
            setRows(prev => prev?.filter(r => r.uid !== row.uid) ?? prev);
            setOpenFriendUid(cur => cur === row.uid ? null : cur);
            toast.success(`${row.name ?? 'Personen'} är blockerad.`);
        } catch {
            toast.error('Kunde inte blockera just nu. Försök igen.');
        } finally {
            setBusyUid(null);
            setConfirmBlockUid(null);
        }
    };

    const handleUnblock = async (row: BlockRow) => {
        if (!uid) return;
        setBusyUid(row.uid);
        try {
            await unblockUser(uid, row.uid);
        } catch {
            toast.error('Kunde inte häva blockeringen just nu. Försök igen.');
        } finally {
            setBusyUid(null);
            setConfirmUnblockUid(null);
        }
    };

    /** Bekräftelserutan under en rad - blockeringen är för allvarlig för ett
     *  ensamt klick, men ingen window.confirm (kortets stil). */
    const blockConfirm = (row: FriendRow) => {
        if (confirmBlockUid !== row.uid) return null;
        const name = row.name ?? 'personen';
        const relation = row.status === 'accepted' ? 'Ni är inte vänner längre' : 'Förfrågan tas bort';
        return (
            <div className="mx-4 mb-2 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 px-3 py-2.5">
                <p className="text-[11px] font-semibold leading-relaxed text-slate-600 dark:text-slate-300">
                    <span className="font-black text-slate-800 dark:text-slate-100">Blockera {name}?</span>{' '}
                    {relation} och du ser inte {genitive(name)} meddelanden i chattarna. {name} får inget besked om det.
                </p>
                <div className="mt-2 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => void handleBlock(row)}
                        disabled={busyUid === row.uid}
                        className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-black text-white hover:bg-red-700 disabled:opacity-50 transition"
                    >
                        {busyUid === row.uid ? 'Blockerar…' : 'Blockera'}
                    </button>
                    <button
                        type="button"
                        onClick={() => setConfirmBlockUid(null)}
                        disabled={busyUid === row.uid}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    >
                        Avbryt
                    </button>
                </div>
            </div>
        );
    };

    // Vännens "profil": users-läsning (namn + listorna) och eventuppslag.
    const openFriend = async (row: FriendRow) => {
        if (openFriendUid === row.uid) { setOpenFriendUid(null); return; }
        setOpenFriendUid(row.uid);
        setConfirmRemoveUid(null);
        setConfirmBlockUid(null);
        if (details[row.uid]?.state === 'ready' || details[row.uid]?.state === 'hidden') return;
        setDetails(prev => ({ ...prev, [row.uid]: { state: 'loading', events: [] } }));
        const profile = await fetchFriendProfile(row.uid);
        if (!profile.visible) {
            setDetails(prev => ({ ...prev, [row.uid]: { state: 'hidden', events: [] } }));
            return;
        }
        // Slå upp eventen: laddade datan först, /api/event som reserv.
        const loaded = new Map((allEventsRef.current ?? []).map(e => [e.id, e] as const));
        const resolved = new Map<string, LinkEvent>();
        await Promise.all(profile.picks.map(async p => {
            const hit = loaded.get(p.id) ?? await fetchDeepLinkEvent(p.id);
            if (hit) resolved.set(p.id, hit);
        }));
        setDetails(prev => ({
            ...prev,
            [row.uid]: { state: 'ready', events: upcomingFriendEvents(profile.picks, resolved, Date.now()) },
        }));
    };

    const handleToggleVisible = async () => {
        if (!uid || rsvpVisible === null) return;
        const next = !rsvpVisible;
        setVisibleBusy(true);
        setRsvpVisible(next);
        try {
            await setDoc(doc(db, 'users', uid), { rsvpVisibleToFriends: next }, { merge: true });
        } catch {
            setRsvpVisible(!next);
            toast.error('Kunde inte spara inställningen.');
        } finally {
            setVisibleBusy(false);
        }
    };

    // BJUD IN EN VÄN (Josef 13/10): länken vadkul.se/?van=<uid> - den som
    // går med via den blir din vän direkt, och nya konton ger en stjärna var
    // (du högst 5 gånger; acceptFriendInvite i functions). Delningsarket
    // när det finns, annars urklipp (samma mönster som chattens Bjud in).
    const handleInvite = async () => {
        if (!uid) return;
        const url = friendInviteUrl(window.location.origin, uid);
        try {
            if (navigator.share) {
                await navigator.share({ title: 'VADKUL', text: FRIEND_INVITE_TEXT, url });
                return;
            }
            await navigator.clipboard.writeText(`${FRIEND_INVITE_TEXT} ${url}`);
            toast.success('Inbjudningslänken är kopierad - skicka den till en vän!');
        } catch { /* avbruten delning är inget fel */ }
    };

    if (!user) return null;

    const incomingBadge = rows !== null && buckets.incoming.length > 0;

    return (
        <div className="border-t border-slate-100 dark:border-slate-800">
            <button
                type="button"
                onClick={() => setExpanded(o => !o)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60 transition-colors text-left"
            >
                <Users size={16} className="text-[#006AA7] shrink-0" />
                <span className="flex-1">Vänner</span>
                {incomingBadge && (
                    <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[#006AA7] text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                        {buckets.incoming.length}
                    </span>
                )}
                {expanded
                    ? <ChevronDown size={15} className="text-slate-400 shrink-0" />
                    : <ChevronRight size={15} className="text-slate-400 shrink-0" />}
            </button>

            {expanded && (
                <div className="pb-2">
                    <div className="px-4 pb-2">
                        <button
                            type="button"
                            onClick={() => void handleInvite()}
                            className="w-full inline-flex items-center justify-center gap-1.5 rounded-full bg-[#006AA7] text-white px-3 py-2 text-xs font-black hover:bg-[#005590] active:scale-[0.99] transition"
                        >
                            <UserPlus size={14} aria-hidden />
                            Bjud in en vän
                        </button>
                        <p className="mt-1.5 text-[10px] font-semibold text-slate-400 text-center">
                            Ni får en stjärna var ⭐ när en vän skapar konto via länken (upp till 5).
                        </p>
                    </div>
                    {rows === null ? (
                        <p className="px-4 pb-2 text-xs font-semibold text-slate-400">Hämtar…</p>
                    ) : (
                        <>
                            {/* Förfrågningar TILL mig - överst, de kräver svar. */}
                            {buckets.incoming.map(row => (
                                <div key={row.uid}>
                                    <div className="flex items-center gap-2.5 px-4 py-2">
                                        <FriendAvatar row={row} />
                                        <span className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                            {row.name ?? 'En VADKUL-användare'}
                                            <span className="block text-[10px] font-semibold text-slate-400">vill bli din vän</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => void handleAccept(row)}
                                            disabled={busyUid === row.uid}
                                            className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[#006AA7] text-white px-2.5 py-1.5 text-[11px] font-black hover:bg-[#005590] disabled:opacity-50 transition"
                                        >
                                            <Check size={12} strokeWidth={3} aria-hidden />
                                            Acceptera
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => void handleRemove(row)}
                                            disabled={busyUid === row.uid}
                                            aria-label="Avböj vänförfrågan"
                                            title="Avböj"
                                            className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                        >
                                            <X size={14} aria-hidden />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfirmBlockUid(cur => cur === row.uid ? null : row.uid)}
                                            disabled={busyUid === row.uid}
                                            aria-label={`Blockera ${row.name ?? 'personen'}`}
                                            title="Blockera"
                                            className="shrink-0 p-1.5 -ml-1.5 rounded-full text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                                        >
                                            <UserX size={14} aria-hidden />
                                        </button>
                                    </div>
                                    {blockConfirm(row)}
                                </div>
                            ))}

                            {/* Vännerna - varje rad fälls ut till vännens kommande svar. */}
                            {buckets.accepted.length === 0 && buckets.incoming.length === 0 && (
                                <p className="px-4 pb-1 text-xs font-semibold text-slate-400">
                                    Inga vänner än - bjud in någon med knappen ovan, eller bjud med någon på ett event.
                                </p>
                            )}
                            {buckets.accepted.map(row => {
                                const open = openFriendUid === row.uid;
                                const detail = details[row.uid];
                                return (
                                    <div key={row.uid}>
                                        <button
                                            type="button"
                                            onClick={() => void openFriend(row)}
                                            aria-expanded={open}
                                            className="w-full flex items-center gap-2.5 px-4 py-2 text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                                        >
                                            <FriendAvatar row={row} />
                                            <span className="flex-1 min-w-0 text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                                {row.name ?? 'En VADKUL-användare'}
                                            </span>
                                            {open
                                                ? <ChevronDown size={14} className="text-slate-400 shrink-0" />
                                                : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
                                        </button>
                                        {open && (
                                            <div className="pl-[52px] pr-4 pb-2">
                                                {detail?.state === 'loading' || !detail ? (
                                                    <p className="text-[11px] font-semibold text-slate-400">Hämtar…</p>
                                                ) : detail.state === 'hidden' ? (
                                                    <p className="text-[11px] font-semibold text-slate-400">
                                                        {row.name ?? 'Hen'} delar inte sina event.
                                                    </p>
                                                ) : detail.events.length === 0 ? (
                                                    <p className="text-[11px] font-semibold text-slate-400">
                                                        Inga kommande svar än.
                                                    </p>
                                                ) : (
                                                    <ul className="space-y-0.5">
                                                        {detail.events.map(({ evt, status }) => {
                                                            const inData = (allEvents ?? []).some(e => e.id === evt.id);
                                                            const inner = (
                                                                <>
                                                                    <span className="shrink-0 text-sm leading-none" aria-hidden>{evt.emoji || '📍'}</span>
                                                                    <span className="flex-1 min-w-0">
                                                                        <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">{evt.title}</span>
                                                                        <span className="block text-[10px] font-semibold text-slate-400 first-letter:uppercase">
                                                                            {eventTimeLabel(evt)} · {status === 'going' ? 'Kommer' : 'Intresserad'}
                                                                        </span>
                                                                    </span>
                                                                </>
                                                            );
                                                            const cls = 'w-full flex items-center gap-2 py-1 text-left hover:text-[#006AA7] transition-colors';
                                                            return (
                                                                <li key={evt.id}>
                                                                    {inData && onPickEvent ? (
                                                                        <button type="button" onClick={() => onPickEvent(evt)} className={cls}>{inner}</button>
                                                                    ) : (
                                                                        <a href={`/?event=${encodeURIComponent(evt.id)}`} className={cls}>{inner}</a>
                                                                    )}
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                                <div className="mt-1.5 flex items-center gap-4">
                                                    <button
                                                        type="button"
                                                        onClick={() => confirmRemoveUid === row.uid ? void handleRemove(row) : setConfirmRemoveUid(row.uid)}
                                                        disabled={busyUid === row.uid}
                                                        className={`text-[10px] font-bold transition-colors ${confirmRemoveUid === row.uid ? 'text-red-600' : 'text-slate-400 hover:text-red-500'}`}
                                                    >
                                                        {confirmRemoveUid === row.uid ? 'Säkert? Tryck igen för att ta bort' : 'Ta bort vän'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfirmBlockUid(cur => cur === row.uid ? null : row.uid)}
                                                        disabled={busyUid === row.uid}
                                                        className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
                                                    >
                                                        Blockera
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                        {open && blockConfirm(row)}
                                    </div>
                                );
                            })}

                            {/* Skickade, obesvarade förfrågningar - dämpade, med ångra. */}
                            {buckets.outgoing.map(row => (
                                <div key={row.uid} className="flex items-center gap-2.5 px-4 py-1.5 opacity-70">
                                    <FriendAvatar row={row} />
                                    <span className="flex-1 min-w-0 text-xs font-semibold text-slate-500 truncate">
                                        {row.name ?? 'En VADKUL-användare'}
                                        <span className="block text-[10px] text-slate-400">Förfrågan skickad</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleRemove(row)}
                                        disabled={busyUid === row.uid}
                                        aria-label="Ångra vänförfrågan"
                                        title="Ångra"
                                        className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                    >
                                        <X size={14} aria-hidden />
                                    </button>
                                </div>
                            ))}

                            {/* Blockerade - dämpade, med häv (tvåtryck som Ta bort vän). */}
                            {blockList.length > 0 && (
                                <p className="px-4 pt-2 pb-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Blockerade
                                </p>
                            )}
                            {blockList.map(row => (
                                <div key={row.uid} className="flex items-center gap-2.5 px-4 py-1.5 opacity-70">
                                    <FriendAvatar row={row} />
                                    <span className="flex-1 min-w-0 text-xs font-semibold text-slate-500 truncate">
                                        {row.name ?? 'En VADKUL-användare'}
                                        <span className="block text-[10px] text-slate-400">Blockerad</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => confirmUnblockUid === row.uid ? void handleUnblock(row) : setConfirmUnblockUid(row.uid)}
                                        disabled={busyUid === row.uid}
                                        aria-label={`Häv blockeringen av ${row.name ?? 'användaren'}`}
                                        className={`shrink-0 text-[11px] font-black transition-colors ${confirmUnblockUid === row.uid ? 'text-red-600' : 'text-[#006AA7] hover:text-[#005590]'}`}
                                    >
                                        {confirmUnblockUid === row.uid ? 'Säkert? Tryck igen' : 'Häv'}
                                    </button>
                                </div>
                            ))}

                            {/* Integritetsgrinden - vad VÄNNERNA ser på min profil. */}
                            <button
                                type="button"
                                onClick={() => void handleToggleVisible()}
                                disabled={visibleBusy || rsvpVisible === null}
                                className="w-full flex items-center gap-3 px-4 py-2.5 mt-1 text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors disabled:opacity-60 border-t border-slate-100 dark:border-slate-800"
                            >
                                <span className="flex-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                                    Visa vad jag kommer på för mina vänner
                                </span>
                                <span
                                    aria-hidden
                                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${rsvpVisible ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                >
                                    <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${rsvpVisible ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                </span>
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
