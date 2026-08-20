'use client';

import { useEffect, useRef, useState } from 'react';
import { LinkEvent } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { userService } from '@/services/userService';
import { storageService } from '@/services/storageService';
import { feedbackService } from '@/services/feedbackService';
import EventListRow from './EventListRow';
import { X, Pencil, Check, Heart, KeyRound, LogOut, Trash2, ChevronRight, ChevronDown, Settings, ShieldCheck, Camera, MessageSquare, Send, Bell, BellOff, MapPin, Baby } from 'lucide-react';
import toast from 'react-hot-toast';
import { getNotisStatus, enableEventReminders, disableEventReminders, NotisStatus } from '@/utils/fcm';
import { doc, getDoc, setDoc, deleteField, serverTimestamp, collection, getDocs, query, where, limit, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CITIES, getCity } from '@/lib/cityUtils';
import { eventShareSlug } from '@/utils/eventShareSlug';
import { boostedUntilLabel } from '@/utils/boostLabel';

/** En rad i "Mina boostar": eventets namn + hur länge boosten syns. */
interface MyBoost {
    key: string;
    title: string;
    until: Date | null;
    active: boolean;
    /** Eventet ur den laddade datan — finns det är raden klickbar (hoppa dit). */
    evt: LinkEvent | null;
}

interface ProfilePanelProps {
    open: boolean;
    onClose: () => void;
    /** Användarens egna skapade event (filtrerade ur eventlistan i page). */
    myEvents: LinkEvent[];
    /** HELA laddade eventlistan — boost-raderna slår upp titel + hoppmål här
     *  (kvittona bär bara eventId; domännamn i stället för titel var obegripligt). */
    allEvents: LinkEvent[];
    onPickEvent: (evt: LinkEvent) => void;
    onDeleteEvent: (id: string) => void;
    savedCount: number;
    /** Byt till sparat-panelen (stänger profilen). */
    onOpenSaved: () => void;
}

/**
 * Hela kontot på ett ställe, utan att lämna kartan: namn (redigerbart),
 * e-post, egna event, sparat-genväg, lösenordsbyte, logga ut och radera
 * konto. Ersätter gamla profilmenyn + v1-profilsidan.
 */
export default function ProfilePanel({ open, onClose, myEvents, allEvents, onPickEvent, onDeleteEvent, savedCount, onOpenSaved }: ProfilePanelProps) {
    const { user, logout, updateDisplayName, updatePhotoURL, resetPassword, deleteAccount } = useAuth();
    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const [feedbackText, setFeedbackText] = useState('');
    const [feedbackBusy, setFeedbackBusy] = useState(false);
    const [feedbackSent, setFeedbackSent] = useState(false);
    const photoInputRef = useRef<HTMLInputElement>(null);
    const [notisStatus, setNotisStatus] = useState<NotisStatus>('unsupported');
    const [notisBusy, setNotisBusy] = useState(false);
    // Min stad (stadssegmenterade utskick). '' = ingen stad vald/sparad.
    const [citySlug, setCitySlug] = useState('');
    const [cityBusy, setCityBusy] = useState(false);
    // "Jag har barn (0–13 år)" + barnens åldrar — styr STANDARDLÄGET för
    // kartans kategorifilter: utan barn göms Familj & barn bakom 🧸-opt-in-
    // cirkeln (utils/familyFilter), med barn syns kategorin som vanligt.
    // Åldrarna är underlag för framtida åldersmatchning av event.
    // Registreringen frågar bara ja/nej, åldrarna kompletteras här.
    const [hasChildren, setHasChildren] = useState(false);
    const [childAges, setChildAges] = useState<number[]>([]);
    const [childrenBusy, setChildrenBusy] = useState(false);
    // "Mina boostar": användarens boost-köp (boostPayments-kvitton) berikade
    // med eventtitel + featuredUntil. null = inte hämtat/inget att visa —
    // sektionen göms då helt (inklusive innan rules-deployen som öppnar
    // läsrätten på egna kvitton: permission denied ⇒ tyst tom lista).
    const [myBoosts, setMyBoosts] = useState<MyBoost[] | null>(null);

    // Läs av notis-läget varje gång panelen öppnas (kan ha ändrats i
    // webbläsarens inställningar sedan sist).
    useEffect(() => {
        if (open) setNotisStatus(getNotisStatus());
    }, [open]);

    // Hämta sparad stad + barn-fälten när panelen öppnas (staden kan ha
    // GPS-härletts sedan sist; samma läsning täcker båda — ingen extra read).
    useEffect(() => {
        if (!open || !user) return;
        let stale = false;
        getDoc(doc(db, 'users', user.uid))
            .then(snap => {
                if (stale) return;
                const data = snap.exists() ? snap.data() : null;
                setCitySlug(data?.citySlug ?? '');
                setHasChildren(data?.hasChildren === true);
                setChildAges(Array.isArray(data?.childAges)
                    ? data.childAges.filter((a: unknown): a is number => typeof a === 'number')
                    : []);
            })
            .catch(() => { /* visa tomt — valen funkar ändå */ });
        return () => { stale = true; };
    }, [open, user]);

    // "Mina boostar" när panelen öppnas: läs egna boostPayments-kvitton
    // (rules släpper bara igenom frågor filtrerade på eget uid), deduplicera
    // per event (förlängningar ger flera kvitton men ETT slutdatum) och slå
    // upp featuredUntil: användarskapade ur linkEvents-dokumentet, skrapade ur
    // eventBoosts-overlayn (samma slug-hash som /e/-länkarna).
    // TITELN + hoppmålet tas ur den redan laddade eventdatan (allEvents,
    // Josef 21/8: "facebook.com" sa ingenting — eventets titel ska stå, och
    // raden ska gå att klicka på). Domännamnet är bara fallback när eventet
    // inte (längre) finns i datan. RADERADE användarskapade event visas inte
    // alls — en kvittorad utan event att visa stod som "Borttaget event
    // aktiveras…" för alltid, vilket bara förvirrade.
    // Max ~10 uppslag per öppning — boost-köp är sällsynta, ingen egress-fälla.
    // allEvents läses via ref: strömmen pushar nya referenser hela tiden och
    // som dep hade effekten dragit om Firestore-uppslagen vid varje våg.
    const allEventsRef = useRef(allEvents);
    allEventsRef.current = allEvents;
    useEffect(() => {
        if (!open || !user) return;
        let stale = false;
        (async () => {
            try {
                const snap = await getDocs(query(
                    collection(db, 'boostPayments'),
                    where('uid', '==', user.uid),
                    limit(50),
                ));
                const receipts = snap.docs
                    .map(d => d.data() as { eventId?: unknown; appliedAt?: Timestamp })
                    .filter((r): r is { eventId: string; appliedAt?: Timestamp } => typeof r.eventId === 'string')
                    .sort((a, b) => (b.appliedAt?.toMillis?.() ?? 0) - (a.appliedAt?.toMillis?.() ?? 0));
                const byId = new Map(allEventsRef.current.map(e => [e.id, e]));
                const seen = new Set<string>();
                const out: MyBoost[] = [];
                for (const r of receipts) {
                    if (seen.has(r.eventId)) continue;
                    seen.add(r.eventId);
                    if (out.length >= 10) break;
                    const loaded = byId.get(r.eventId) ?? null;
                    let title: string;
                    let until: Date | null = null;
                    if (r.eventId.includes('/')) {
                        // Skrapat event (id = källans URL): featuredUntil bor i overlayn.
                        const b = await getDoc(doc(db, 'eventBoosts', eventShareSlug(r.eventId)));
                        const v = b.data();
                        until = v?.featuredUntil instanceof Timestamp ? v.featuredUntil.toDate() : null;
                        if (loaded) title = loaded.title;
                        else {
                            try { title = new URL(r.eventId).hostname.replace(/^www\./, ''); }
                            catch { title = 'Skrapat event'; }
                        }
                    } else {
                        const e = await getDoc(doc(db, 'linkEvents', r.eventId));
                        if (!e.exists()) continue; // eventet raderat → ingen rad
                        const v = e.data();
                        title = typeof v?.title === 'string' ? v.title : (loaded?.title ?? 'Borttaget event');
                        until = v?.featuredUntil instanceof Timestamp ? v.featuredUntil.toDate() : null;
                    }
                    out.push({ key: r.eventId, title, until, active: !!until && until.getTime() > Date.now(), evt: loaded });
                }
                // Aktiva överst (nyast först inom respektive grupp — listan är
                // redan appliedAt-sorterad).
                out.sort((a, b) => Number(b.active) - Number(a.active));
                if (!stale) setMyBoosts(out);
            } catch {
                // Ingen läsrätt (rules ej deployade) eller nätfel → göm sektionen.
                if (!stale) setMyBoosts(null);
            }
        })();
        return () => { stale = true; };
    }, [open, user]);

    const handleCityChange = async (slug: string) => {
        if (!user || cityBusy) return;
        const prev = citySlug;
        setCitySlug(slug);
        setCityBusy(true);
        try {
            const ref = doc(db, 'users', user.uid);
            if (!slug) {
                // Rensat = aktivt val: citySource 'manual' hindrar GPS-vägen
                // från att fylla i staden igen.
                await setDoc(ref, {
                    city: deleteField(),
                    citySlug: deleteField(),
                    citySource: 'manual',
                    cityUpdatedAt: serverTimestamp(),
                }, { merge: true });
                toast.success('Stad borttagen — vi gissar den inte åt dig igen.');
            } else {
                const city = getCity(slug);
                if (!city) throw new Error(`Okänd stad: ${slug}`);
                await setDoc(ref, {
                    city: city.name,
                    citySlug: city.slug,
                    citySource: 'manual',
                    cityUpdatedAt: serverTimestamp(),
                }, { merge: true });
                toast.success(`Din stad är ${city.name}!`);
            }
        } catch (err) {
            console.error(err);
            setCitySlug(prev);
            toast.error('Kunde inte spara staden. Försök igen.');
        } finally {
            setCityBusy(false);
        }
    };

    // Kryssrutan "Jag har barn". Urkryssad ⇒ åldrarna töms också — ett aktivt
    // "har inga barn" ska inte lämna gamla åldrar kvar i dokumentet.
    const handleHasChildrenToggle = async (next: boolean) => {
        if (!user || childrenBusy) return;
        const prevHas = hasChildren;
        const prevAges = childAges;
        setHasChildren(next);
        if (!next) setChildAges([]);
        setChildrenBusy(true);
        try {
            await setDoc(doc(db, 'users', user.uid), {
                hasChildren: next,
                ...(next ? {} : { childAges: [] }),
            }, { merge: true });
        } catch (err) {
            console.error(err);
            setHasChildren(prevHas);
            setChildAges(prevAges);
            toast.error('Kunde inte spara. Försök igen.');
        } finally {
            setChildrenBusy(false);
        }
    };

    // Ålders-chip (0–13): tryck togglar åldern. Flera barn = flera chips;
    // två barn med samma ålder behöver inte två chips — fältet är filter-
    // underlag, ingen familjeräkning. Hela listan skrivs varje gång (litet
    // fält, enklast korrekt).
    const handleChildAgeToggle = async (ageYears: number) => {
        if (!user || childrenBusy) return;
        const prev = childAges;
        const next = prev.includes(ageYears)
            ? prev.filter(a => a !== ageYears)
            : [...prev, ageYears].sort((a, b) => a - b);
        setChildAges(next);
        setChildrenBusy(true);
        try {
            await setDoc(doc(db, 'users', user.uid), { childAges: next }, { merge: true });
        } catch (err) {
            console.error(err);
            setChildAges(prev);
            toast.error('Kunde inte spara. Försök igen.');
        } finally {
            setChildrenBusy(false);
        }
    };

    const handleEnableNotiser = async () => {
        if (!user || notisBusy) return;
        setNotisBusy(true);
        const res = await enableEventReminders(user.uid);
        setNotisBusy(false);
        setNotisStatus(getNotisStatus());
        if (res === 'on') {
            toast.success('Notiser på! Du får en påminnelse 1 h innan dina gillade event börjar.');
        } else if (res === 'denied') {
            toast.error('Notiser är blockerade — tillåt dem för vadkul.se i webbläsarens inställningar.');
        } else if (res === 'no-sw') {
            // I dev finns aldrig någon service worker (avsiktligt) — notiser
            // kan bara testas på riktiga sajten. I prod betyder samma läge att
            // SW-registreringen inte hunnit/kunnat köra → omladdning brukar lösa.
            toast.error(process.env.NODE_ENV !== 'production'
                ? 'Notiser funkar inte i dev-miljön (ingen service worker) — testa på vadkul.se.'
                : 'Notiserna kunde inte kopplas — ladda om sidan och försök igen.');
        } else {
            toast.error('Kunde inte aktivera notiser. Försök igen.');
        }
    };

    const handleDisableNotiser = async () => {
        if (!user || notisBusy) return;
        setNotisBusy(true);
        const res = await disableEventReminders(user.uid);
        setNotisBusy(false);
        setNotisStatus(getNotisStatus());
        if (res === 'off') {
            toast.success('Notiser av på den här enheten. Slå på dem igen här när du vill.');
        } else {
            toast.error('Kunde inte stänga av notiser. Försök igen.');
        }
    };

    const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // tillåt att välja samma fil igen
        if (!file || !user) return;
        if (!file.type.startsWith('image/')) { toast.error('Välj en bildfil.'); return; }
        setUploadingPhoto(true);
        try {
            // Skriv över samma sökväg (ingen avslutande /) → en bild per användare.
            const url = await storageService.uploadFile(`users/${user.uid}/profile_pic`, file);
            // Cache-bust så <img> hämtar den nya bilden direkt (samma URL annars).
            const busted = `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}`;
            await updatePhotoURL(busted);
            await userService.updatePhotoURL(user.uid, busted).catch(() => {});
            toast.success('Profilbild uppdaterad!');
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte ladda upp bilden. Försök igen.');
        } finally {
            setUploadingPhoto(false);
        }
    };

    // Nollställ delstate när panelen stängs/öppnas så inget "fastnar".
    useEffect(() => {
        if (!open) {
            setEditingName(false); setConfirmingDelete(false); setSettingsOpen(false);
            setFeedbackOpen(false); setFeedbackText(''); setFeedbackSent(false);
        }
    }, [open]);

    if (!open || !user) return null;

    const displayName = user.displayName || 'VADKUL-användare';
    const initial = (user.displayName || user.email || '?').charAt(0).toUpperCase();

    const startEditName = () => {
        setNameDraft(user.displayName || '');
        setEditingName(true);
    };

    const saveName = async () => {
        const name = nameDraft.trim();
        if (!name || name === user.displayName) { setEditingName(false); return; }
        setSavingName(true);
        try {
            await updateDisplayName(name);
            // Spegla även till users-dokumentet (visas i chatt/profiler).
            await userService.updateDisplayName(user.uid, name).catch(() => { /* doc-spegling är best effort */ });
            toast.success('Namnet är uppdaterat!');
            setEditingName(false);
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte byta namn. Försök igen.');
        } finally {
            setSavingName(false);
        }
    };

    const handleResetPassword = async () => {
        try {
            await resetPassword();
            toast.success(`Återställningslänk skickad till ${user.email}`);
        } catch (err) {
            console.error(err);
            toast.error('Kunde inte skicka återställningslänken.');
        }
    };

    const handleLogout = async () => {
        await logout();
        onClose();
        toast.success('Du är utloggad.');
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        try {
            // Dokumentet först (kräver inloggning) — best effort, Auth-raderingen
            // är det viktiga. Sen försvinner sessionen av sig själv.
            await userService.deleteUserDoc(user.uid).catch(err =>
                console.warn('Kunde inte radera users-dokumentet:', err));
            await deleteAccount();
            onClose();
            toast.success('Ditt konto är raderat.');
        } catch (err: any) {
            console.error(err);
            if (String(err?.code).includes('requires-recent-login')) {
                toast.error('Av säkerhetsskäl: logga ut, logga in igen och radera kontot direkt efteråt.');
            } else {
                toast.error('Kunde inte radera kontot. Försök igen.');
            }
        } finally {
            setDeleting(false);
            setConfirmingDelete(false);
        }
    };

    const handleSubmitFeedback = async () => {
        const msg = feedbackText.trim();
        if (!msg) return;
        setFeedbackBusy(true);
        try {
            // Namn + e-post från kontot följer med så vi vet vem vi ska
            // återkoppla till (transparensraden under fältet berättar det).
            await feedbackService.submitFeedback(msg, user.uid, {
                name: user.displayName,
                email: user.email,
            });
            setFeedbackSent(true);
            setFeedbackText('');
        } catch (err) {
            console.error('Kunde inte skicka feedback:', err);
            toast.error('Kunde inte skicka. Försök igen.');
        } finally {
            setFeedbackBusy(false);
        }
    };

    const actionRow = 'w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800/60 transition-colors text-left';

    return (
        <>
            {/* Klick utanför stänger panelen. z-[1164]/[1165] som SavedPanel:
                panelen låg på 1040 — UNDER stadsrutan (1090), kategorikolumnen
                (1150) och navbaren (1160), så knapparna och plattan målades
                ovanpå panelinnehållet på mobilen (Josef 21/8). Nu över allt
                krom men under eventkortet (1250)/modalerna (1300); utanför-
                ytan fångar klick på kromet panelen täcker och stänger. */}
            <div className="fixed inset-0 z-[1164]" onClick={onClose} />
            <div className="absolute top-[4.6rem] left-4 right-4 sm:right-auto sm:w-[420px] z-[1165] pointer-events-auto">
                <div className="rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-white/60 dark:border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[min(70vh,34rem)] animate-in fade-in slide-in-from-top-2 duration-200">

                    {/* Identitet */}
                    <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 shrink-0">
                        <input
                            ref={photoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handlePhotoPick}
                            className="hidden"
                            aria-hidden
                        />
                        <button
                            type="button"
                            onClick={() => !uploadingPhoto && photoInputRef.current?.click()}
                            disabled={uploadingPhoto}
                            aria-label="Byt profilbild"
                            title="Byt profilbild"
                            className="relative w-11 h-11 rounded-full shrink-0 group overflow-visible"
                        >
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="" className="w-11 h-11 rounded-full object-cover" />
                            ) : (
                                <span className="w-11 h-11 rounded-full bg-[#006AA7] text-white font-black text-lg flex items-center justify-center">
                                    {initial}
                                </span>
                            )}
                            {/* Kamera-badge i hörnet visar att bilden är klickbar/bytbar. */}
                            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 flex items-center justify-center shadow-sm">
                                {uploadingPhoto
                                    ? <span className="w-3 h-3 rounded-full border-2 border-[#006AA7] border-t-transparent animate-spin" />
                                    : <Camera size={11} className="text-[#006AA7]" />}
                            </span>
                        </button>
                        <div className="flex-1 min-w-0">
                            {editingName ? (
                                <div className="flex items-center gap-1.5">
                                    <input
                                        type="text"
                                        value={nameDraft}
                                        onChange={e => setNameDraft(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                                        maxLength={50}
                                        autoFocus
                                        className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-white focus:border-[#006AA7] focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={saveName}
                                        disabled={savingName}
                                        aria-label="Spara namnet"
                                        className="p-1.5 rounded-full bg-[#006AA7] text-white hover:bg-[#005590] disabled:opacity-50 transition-colors shrink-0"
                                    >
                                        <Check size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="font-black text-base text-black dark:text-white truncate">{displayName}</p>
                                    <button
                                        type="button"
                                        onClick={startEditName}
                                        aria-label="Byt namn"
                                        title="Byt namn"
                                        className="p-1 text-slate-400 hover:text-[#006AA7] transition-colors shrink-0"
                                    >
                                        <Pencil size={13} />
                                    </button>
                                </div>
                            )}
                            <p className="text-xs font-semibold text-slate-500 truncate">{user.email}</p>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Stäng"
                            className="text-slate-400 hover:text-slate-600 transition-colors p-1 shrink-0"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar">
                        {/* Sparade event — genväg till hjärt-panelen */}
                        <button type="button" onClick={onOpenSaved} className={actionRow}>
                            <Heart size={16} className="text-rose-500 shrink-0" fill={savedCount > 0 ? 'currentColor' : 'none'} />
                            <span className="flex-1">Sparade event</span>
                            <span className="text-xs font-black text-slate-400 tabular-nums">{savedCount}</span>
                            <ChevronRight size={15} className="text-slate-400 shrink-0" />
                        </button>

                        {/* Notiser — påminnelse 1 h innan gillade event börjar.
                            Permission-frågan får BARA ställas härifrån (riktig
                            tap-gest) — se enableEventReminders i utils/fcm. */}
                        {notisStatus !== 'unsupported' && (
                            <div className="border-t border-slate-100 dark:border-slate-800">
                                {notisStatus === 'granted' || notisStatus === 'off' ? (
                                    <button
                                        type="button"
                                        onClick={notisStatus === 'granted' ? handleDisableNotiser : handleEnableNotiser}
                                        disabled={notisBusy}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors disabled:opacity-60"
                                    >
                                        {notisStatus === 'granted'
                                            ? <Bell size={16} className="text-emerald-600 shrink-0" />
                                            : <BellOff size={16} className="text-slate-400 shrink-0" />}
                                        <span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">Notiser</span>
                                        <span className="text-[10px] font-bold text-slate-400">
                                            {notisBusy ? '…' : notisStatus === 'granted' ? 'påminnelse 1 h innan' : 'av på den här enheten'}
                                        </span>
                                        <span
                                            aria-hidden
                                            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${notisStatus === 'granted' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                                        >
                                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${notisStatus === 'granted' ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                                        </span>
                                    </button>
                                ) : notisStatus === 'default' ? (
                                    <button type="button" onClick={handleEnableNotiser} disabled={notisBusy} className={actionRow}>
                                        <Bell size={16} className="text-[#006AA7] shrink-0" />
                                        <span className="flex-1">{notisBusy ? 'Aktiverar…' : 'Aktivera notiser'}</span>
                                        <span className="text-[10px] font-bold text-slate-400">påminnelse 1 h innan</span>
                                    </button>
                                ) : (
                                    <div className="flex items-start gap-3 px-4 py-3">
                                        <BellOff size={16} className="text-slate-400 shrink-0 mt-0.5" />
                                        <p className="flex-1 text-xs font-semibold text-slate-500">
                                            {notisStatus === 'denied'
                                                ? 'Notiser är blockerade — tillåt dem för vadkul.se i webbläsarens inställningar.'
                                                : 'Lägg till VADKUL på hemskärmen (Dela → Lägg till på hemskärmen) så kan du få påminnelser om dina gillade event.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mina event */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <div className="px-4 pt-3 pb-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    Mina event · {myEvents.length}
                                </span>
                            </div>
                            {myEvents.length === 0 ? (
                                <p className="px-4 pb-3 text-xs text-slate-400 font-semibold">
                                    Du har inte skapat några event än — tryck på + uppe till höger på kartan.
                                </p>
                            ) : (
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {myEvents.map(evt => (
                                        <EventListRow
                                            key={evt.id}
                                            evt={evt}
                                            onPick={onPickEvent}
                                            right={
                                                <button
                                                    type="button"
                                                    onClick={() => { if (confirm(`Ta bort "${evt.title}" permanent?`)) onDeleteEvent(evt.id); }}
                                                    title="Ta bort eventet"
                                                    aria-label="Ta bort eventet"
                                                    className="p-1.5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            }
                                        />
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Mina boostar — bara när det finns kvitton att visa: event
                            man boostat + hur länge guldstjärnan syns. Slutdatumet är
                            samma featuredUntil som kartan/kortet läser. */}
                        {myBoosts && myBoosts.length > 0 && (
                            <div className="border-t border-slate-100 dark:border-slate-800">
                                <div className="px-4 pt-3 pb-1.5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        Mina boostar · {myBoosts.length}
                                    </span>
                                </div>
                                <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {myBoosts.map(b => {
                                        // Finns eventet i laddade datan är raden en knapp som
                                        // hoppar dit (onPickEvent stänger panelen), annars en
                                        // stum rad — det finns inget att visa då.
                                        const inner = (
                                            <>
                                                <span aria-hidden className={b.active ? '' : 'grayscale opacity-50'}>⭐</span>
                                                <span className={`flex-1 min-w-0 truncate text-sm font-bold ${b.active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400'}`}>
                                                    {b.title}
                                                </span>
                                                <span className={`shrink-0 text-[11px] font-bold tabular-nums ${b.active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                                                    {b.until
                                                        ? (b.active ? `t.o.m. ${boostedUntilLabel(b.until)}` : `gick ut ${boostedUntilLabel(b.until)}`)
                                                        : 'aktiveras…'}
                                                </span>
                                            </>
                                        );
                                        const evt = b.evt;
                                        return (
                                            <li key={b.key}>
                                                {evt ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => onPickEvent(evt)}
                                                        className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-white dark:hover:bg-slate-800/60 transition-colors"
                                                    >
                                                        {inner}
                                                    </button>
                                                ) : (
                                                    <div className="px-4 py-2.5 flex items-center gap-2.5">{inner}</div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}

                        {/* Inställningar — utfällbar mapp: klick visar de 3 alternativen */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setSettingsOpen(o => !o)}
                                aria-expanded={settingsOpen}
                                className={actionRow}
                            >
                                <Settings size={16} className="text-slate-500 shrink-0" />
                                <span className="flex-1">Inställningar</span>
                                <ChevronDown
                                    size={16}
                                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {settingsOpen && (
                                <div className="bg-slate-50/70 dark:bg-slate-800/30">
                                    <button type="button" onClick={handleResetPassword} className={actionRow}>
                                        <KeyRound size={16} className="text-[#006AA7] shrink-0" />
                                        <span className="flex-1">Byt lösenord</span>
                                        <span className="text-[10px] font-bold text-slate-400">via e-post</span>
                                    </button>
                                    {/* Min stad — styr vilka event vi lyfter fram i utskick.
                                        GPS fyller i den automatiskt; ett val här vinner alltid. */}
                                    <div className="w-full flex items-center gap-3 px-4 py-3">
                                        <MapPin size={16} className="text-[#006AA7] shrink-0" />
                                        <span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">Min stad</span>
                                        <select
                                            value={citySlug}
                                            disabled={cityBusy}
                                            onChange={(e) => handleCityChange(e.target.value)}
                                            aria-label="Min stad"
                                            className="max-w-[45%] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 focus:border-[#006AA7] focus:outline-none disabled:opacity-50"
                                        >
                                            <option value="">Ingen stad</option>
                                            {[...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(c => (
                                                <option key={c.slug} value={c.slug}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {/* Jag har barn (0–13 år) + barnens åldrar — styr
                                        kartans standardfilter: utan barn göms Familj &
                                        barn bakom 🧸-opt-in-cirkeln, med barn syns den
                                        som vanligt. Manuella filterval vinner alltid. */}
                                    <div className="w-full flex flex-col gap-2 px-4 py-3">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <Baby size={16} className="text-[#006AA7] shrink-0" />
                                            <span className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">Jag har barn (0–13 år)</span>
                                            <input
                                                type="checkbox"
                                                checked={hasChildren}
                                                disabled={childrenBusy}
                                                onChange={(e) => handleHasChildrenToggle(e.target.checked)}
                                                className="w-4 h-4 accent-[#006AA7] shrink-0 disabled:opacity-50"
                                            />
                                        </label>
                                        {hasChildren && (
                                            <div className="pl-7 flex flex-col gap-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                    Barnens åldrar
                                                </span>
                                                <div className="flex flex-wrap gap-1">
                                                    {/* 0–13 (barn-definitionen i kryssrutan) + ev.
                                                        redan sparade högre åldrar, så gamla val
                                                        alltid går att kryssa ur. */}
                                                    {[...new Set([...Array.from({ length: 14 }, (_, a) => a), ...childAges])].sort((x, y) => x - y).map((a) => {
                                                        const on = childAges.includes(a);
                                                        return (
                                                            <button
                                                                key={a}
                                                                type="button"
                                                                onClick={() => handleChildAgeToggle(a)}
                                                                disabled={childrenBusy}
                                                                aria-pressed={on}
                                                                aria-label={`${a} år`}
                                                                className={`min-w-[30px] px-1.5 py-1 rounded-full border text-[11px] font-black tabular-nums leading-none transition-colors disabled:opacity-50 ${
                                                                    on
                                                                        ? 'bg-[#006AA7] border-[#006AA7] text-white'
                                                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-[#006AA7]'
                                                                }`}
                                                            >
                                                                {a}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <a href="/integritet" target="_blank" rel="noopener" className={actionRow}>
                                        <ShieldCheck size={16} className="text-slate-500 shrink-0" />
                                        <span className="flex-1">Integritet</span>
                                        <ChevronRight size={15} className="text-slate-400 shrink-0" />
                                    </a>
                                    {confirmingDelete ? (
                                        <div className="px-4 py-3 bg-red-50 dark:bg-red-500/10 flex flex-col gap-2">
                                            <p className="text-xs font-bold text-red-600">
                                                Säker? Kontot och din profil raderas permanent.
                                            </p>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleDeleteAccount}
                                                    disabled={deleting}
                                                    className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-500 text-white text-xs font-black disabled:opacity-50 transition-colors"
                                                >
                                                    {deleting ? 'Raderar…' : 'Ja, radera kontot'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmingDelete(false)}
                                                    className="px-3.5 py-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 text-xs font-bold transition-colors"
                                                >
                                                    Avbryt
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setConfirmingDelete(true)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors text-left"
                                        >
                                            <Trash2 size={16} className="shrink-0" />
                                            <span className="flex-1">Radera konto</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Logga ut — under mappen, egen rad */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <button type="button" onClick={handleLogout} className={actionRow}>
                                <LogOut size={16} className="text-slate-500 shrink-0" />
                                <span className="flex-1">Logga ut</span>
                            </button>
                        </div>

                        {/* Problem eller feedback — utfällbar: klick visar ett textfält
                            som skriver till samma feedback-collection som admin läser. */}
                        <div className="border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setFeedbackOpen(o => !o)}
                                aria-expanded={feedbackOpen}
                                className={actionRow}
                            >
                                <MessageSquare size={16} className="text-[#006AA7] shrink-0" />
                                <span className="flex-1">Problem eller feedback</span>
                                <ChevronDown
                                    size={16}
                                    className={`text-slate-400 shrink-0 transition-transform duration-200 ${feedbackOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                            {feedbackOpen && (
                                <div className="bg-slate-50/70 dark:bg-slate-800/30 px-4 py-3">
                                    {feedbackSent ? (
                                        <p className="flex items-center gap-2 text-sm font-bold text-emerald-600 py-1.5">
                                            <Check size={16} className="shrink-0" />
                                            Tack! Vi har fått din feedback. 🙏
                                        </p>
                                    ) : (
                                        <div className="flex flex-col gap-2">
                                            <textarea
                                                value={feedbackText}
                                                onChange={(e) => setFeedbackText(e.target.value)}
                                                rows={3}
                                                maxLength={1800}
                                                placeholder="Beskriv problemet eller din idé…"
                                                className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#006AA7]/40"
                                            />
                                            {/* Transparens: kontaktuppgifterna följer med
                                                utskicket så vi kan återkoppla. */}
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                                Ditt namn och din e-post ({user.email}) skickas med så vi kan återkoppla.
                                            </p>
                                            <button
                                                type="button"
                                                onClick={handleSubmitFeedback}
                                                disabled={feedbackBusy || !feedbackText.trim()}
                                                className="self-end inline-flex items-center gap-2 rounded-full bg-[#006AA7] hover:bg-[#005590] text-white text-xs font-black uppercase tracking-wide px-4 py-2 disabled:opacity-50 transition-colors active:scale-[0.97]"
                                            >
                                                <Send size={14} className="shrink-0" />
                                                {feedbackBusy ? 'Skickar…' : 'Skicka'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
