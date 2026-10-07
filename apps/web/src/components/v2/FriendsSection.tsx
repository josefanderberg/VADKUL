'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import type { LinkEvent } from '@/types';
import { acceptFriendRequest, fetchFriendProfile, fetchMyFriends, removeFriend } from '@/services/friendService';
import { bucketFriendRows, type FriendRow } from '@/utils/friendStatus';
import { friendRsvpVisible, upcomingFriendEvents, type FriendUpcomingEvent } from '@/utils/friendEvents';
import { fetchDeepLinkEvent } from '@/utils/eventSeed';

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

function FriendAvatar({ row }: { row: FriendRow }) {
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

    const buckets = useMemo(() => bucketFriendRows(rows ?? []), [rows]);

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

    // Vännens "profil": users-läsning (namn + listorna) och eventuppslag.
    const openFriend = async (row: FriendRow) => {
        if (openFriendUid === row.uid) { setOpenFriendUid(null); return; }
        setOpenFriendUid(row.uid);
        setConfirmRemoveUid(null);
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
                    {rows === null ? (
                        <p className="px-4 pb-2 text-xs font-semibold text-slate-400">Hämtar…</p>
                    ) : (
                        <>
                            {/* Förfrågningar TILL mig - överst, de kräver svar. */}
                            {buckets.incoming.map(row => (
                                <div key={row.uid} className="flex items-center gap-2.5 px-4 py-2">
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
                                </div>
                            ))}

                            {/* Vännerna - varje rad fälls ut till vännens kommande svar. */}
                            {buckets.accepted.length === 0 && buckets.incoming.length === 0 && (
                                <p className="px-4 pb-1 text-xs font-semibold text-slate-400">
                                    Inga vänner än - bjud med någon på ett event, så kan ni lägga till varandra där.
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
                                                <button
                                                    type="button"
                                                    onClick={() => confirmRemoveUid === row.uid ? void handleRemove(row) : setConfirmRemoveUid(row.uid)}
                                                    disabled={busyUid === row.uid}
                                                    className={`mt-1.5 text-[10px] font-bold transition-colors ${confirmRemoveUid === row.uid ? 'text-red-600' : 'text-slate-400 hover:text-red-500'}`}
                                                >
                                                    {confirmRemoveUid === row.uid ? 'Säkert? Tryck igen för att ta bort' : 'Ta bort vän'}
                                                </button>
                                            </div>
                                        )}
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
