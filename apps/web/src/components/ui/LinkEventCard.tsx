import { ExternalLink, Trash2, Clock, MapPin, Ticket, Share2, Heart, Navigation, CalendarPlus, Sparkles, Users, Check, Rocket, ArrowRight, Star, Eye } from 'lucide-react';
import { isVadkulHostedEvent, type LinkEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { normalizePriceLabel } from '../../utils/priceLabel';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import { googleCalendarUrl, downloadIcs } from '../../utils/calendarLinks';
import { eventShareSlug } from '../../utils/eventShareSlug';
import { linkEventService, isEventFeatured, type RsvpAttendee } from '../../services/linkEventService';
import { getEventViews, recordEventClick } from '../../services/eventStatsService';
import { feedbackService } from '../../services/feedbackService';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Adresser som indikerar en geokod-fallback (bara stadsnamn, inte en faktisk gatuadress).
const ADDRESS_FALLBACKS = new Set(['växjö', 'vaxjo', 'stockholm', 'sverige', 'sweden', '']);

/**
 * Äldre skrapade beskrivningar tappade radbrytningarna HELT — styckena sitter
 * ihop utan ens mellanslag ("…intresseklubb.Tävlingsområde…", "…11:30Klasserna…").
 * Saknar texten \n men har sådana skarvar (skiljetecken/siffra direkt följt av
 * versal) stoppar vi in radbrytningar där. Nyskrapat innehåll har riktiga \n
 * (skraperfix 2026-07-11) och lämnas orört.
 */
function withRecoveredLineBreaks(text: string): string {
    if (!text || text.includes('\n')) return text;
    return text
        .replace(/([.!?…)])(?=[A-ZÅÄÖ"“])/g, '$1\n')
        .replace(/(\d)(?=[A-ZÅÄÖ])/g, '$1\n');
}

function isSpecificAddress(addr: string | undefined | null): boolean {
    if (!addr) return false;
    const trimmed = addr.trim();
    if (trimmed.length === 0) return false;
    return !ADDRESS_FALLBACKS.has(trimmed.toLowerCase());
}

// Avstånd från användarens position — samma formatregler som EventCards
// närhetslista (<1 km → jämna tiotal meter, <10 km → en decimal).
function formatDistanceKm(km: number): string {
    if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
    if (km < 10) return `${km.toFixed(1)} km`;
    return `${Math.round(km)} km`;
}

interface LinkEventCardProps {
    linkEvent: LinkEvent;
    isAdmin?: boolean;
    distance?: number;
    onDelete?: () => void;
    isPanelMode?: boolean;
    showFullAddress?: boolean;
    onRevealStepChange?: (step: number) => void;
    // När true: kortet är alltid fullt utvecklat. peek-bilden + "Stäng
    // detaljer"-knappen visas inte. Klick på header/bild/beskrivning fäller i
    // stället ihop bottensheeten via onContentTap (se nedan).
    alwaysExpanded?: boolean;
    // I alwaysExpanded-läget: fyrar när man klickar på header, bild eller
    // beskrivning. Föräldern (bottensheeten) använder det för att fälla ihop
    // kortet — så man kan stänga den uppfällda bilden genom att klicka igen.
    onContentTap?: () => void;
    /** Hjärtat på kortet: nuvarande status + toggle. Utan handler → ingen knapp. */
    saved?: boolean;
    onToggleSave?: () => void;
    /** Ägaren av ett användarskapat event får ta bort det (reglerna verifierar). */
    canDelete?: boolean;
    onDeleteOwn?: () => void;
    /** Ägaren får boosta sitt event (Stripe Checkout). Visas bredvid "Ta bort". */
    onBoost?: () => void;
    /** Fler event på SAMMA plats (multi-event-hög): position + antal → pager på
     *  platsraden ("3/7"). onGroupNext stegar till nästa i högen. groupTotal ≤ 1
     *  döljer pagern. */
    groupIndex?: number;
    groupTotal?: number;
    onGroupNext?: () => void;
    /** Stjärn-gåvan ⭐: eventet har redan (någons) stjärna → guld-indikator. */
    hasStar?: boolean;
    /** Inloggad + oanvänd stjärna (och eventet inte passerat) → ⭐-knappen är
     *  klickbar och placerar stjärnan (bekräftelsedialog, går inte att ångra). */
    canPlaceStar?: boolean;
    onPlaceStar?: () => void;
}

export default function LinkEventCard({ linkEvent, isAdmin = false, distance, onDelete, isPanelMode = false, showFullAddress = false, onRevealStepChange, alwaysExpanded = false, onContentTap, saved = false, onToggleSave, canDelete = false, onDeleteOwn, onBoost, groupIndex = 0, groupTotal = 1, onGroupNext, hasStar = false, canPlaceStar = false, onPlaceStar }: LinkEventCardProps) {
    const { user } = useAuth();
    const [isDeleting, setIsDeleting] = useState(false);
    const [internalRevealStep, setInternalRevealStep] = useState(0); // 0: header, 1: +img/truncated, 2: +full
    const revealStep = alwaysExpanded ? 2 : internalRevealStep;

    // VADKUL-värdat = skapat här UTAN länk (anmälan sker på sidan). Användar-
    // skapade event MED länk är TIPS — de presenteras som vanliga länk-event
    // (favicon-värd, ANMÄL ut) så tipsaren aldrig ser ut som arrangör.
    const vadkulHosted = isVadkulHostedEvent(linkEvent);
    const isTip = !!linkEvent.userCreated && !vadkulHosted;

    // Anmälningar (RSVP) — bara för VADKUL-värdade event (de länkar inte ut, allt
    // sker här på sidan). Live-lyssnare på linkEvents/{id}/attendees.
    const [attendees, setAttendees] = useState<RsvpAttendee[]>([]);
    const [rsvpBusy, setRsvpBusy] = useState(false);
    useEffect(() => {
        if (!vadkulHosted) { setAttendees([]); return; }
        const unsub = linkEventService.subscribeAttendees(linkEvent.id, setAttendees);
        return () => unsub();
    }, [linkEvent.id, vadkulHosted]);
    const isAttending = !!user && attendees.some(a => a.uid === user.uid);
    const handleRsvpToggle = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!user) { toast('Logga in för att anmäla dig.', { icon: '🔑' }); return; }
        setRsvpBusy(true);
        try {
            if (isAttending) {
                await linkEventService.cancelRsvp(linkEvent.id, user.uid);
            } else {
                await linkEventService.rsvp(linkEvent.id, {
                    uid: user.uid,
                    name: user.displayName || user.email || 'VADKUL-användare',
                    photoURL: user.photoURL,
                });
            }
        } catch (err) {
            console.error('RSVP misslyckades:', err);
            toast.error('Kunde inte uppdatera anmälan. Försök igen.');
        } finally {
            setRsvpBusy(false);
        }
    };
    // Sant när den RIKTIGA omslagsbilden inte gick att ladda (t.ex. ett
    // facebook-event utan bild bakom URL:en). Då har vi ingen fallback att visa
    // → rendera INGEN bild i stället för webbläsarens trasiga bild-ikon med
    // titeln (alt-texten) bredvid.
    const [coverFailed, setCoverFailed] = useState(false);
    // Nollställ när eventet (eller dess bild-URL) byts så felet inte "fastnar".
    useEffect(() => { setCoverFailed(false); }, [linkEvent.id, linkEvent.coverImage]);

    // 👁 Visningar — läses från eventStats (increment:et fyras när kortet öppnas,
    // i (v2)/page.tsx). Kort fördröjning så vår egen visning hinner räknas med.
    // null = okänt (offline/regler ej deployade) → badgen visas inte alls.
    const [viewCount, setViewCount] = useState<number | null>(null);
    useEffect(() => {
        setViewCount(null);
        let cancelled = false;
        const t = setTimeout(async () => {
            const n = await getEventViews(linkEvent.id);
            if (!cancelled) setViewCount(n);
        }, 600);
        return () => { cancelled = true; clearTimeout(t); };
    }, [linkEvent.id]);
    // Byt event (Nästa/Bakåt): var kortet redan uppfällt ska det FÖRBLI uppfällt
    // så bilden fortsatt syns — men i topp-läget (steg 1). Var det hopfällt börjar
    // det hopfällt som vanligt. (Sheet-höjden bevaras separat i föräldern.)
    useEffect(() => { setInternalRevealStep(prev => (prev >= 1 ? 1 : 0)); }, [linkEvent.id]);

    // Rapportera event: liten textknapp → orsaksval → tack. Nollställs per event.
    const [reportOpen, setReportOpen] = useState(false);
    const [reportSent, setReportSent] = useState(false);
    useEffect(() => { setReportOpen(false); setReportSent(false); }, [linkEvent.id]);
    const handleReport = async (e: React.MouseEvent, reason: string) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            // Inloggad → namn/e-post följer med rapporten så vi kan återkoppla;
            // utloggade kan fortfarande rapportera anonymt (medvetet).
            await feedbackService.reportEvent(
                linkEvent,
                reason,
                user?.uid,
                user ? { name: user.displayName, email: user.email } : undefined,
            );
            setReportSent(true);
        } catch (err) {
            console.error('Kunde inte skicka eventrapporten:', err);
            toast.error('Kunde inte skicka rapporten. Försök igen.');
        }
    };

    // Notifiera förälder när expansionsnivån ändras (för t.ex. karta-offset)
    useEffect(() => {
        onRevealStepChange?.(revealStep);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revealStep]);

    const secondaryAddress = (() => {
        if (!showFullAddress) return null;
        if (isSpecificAddress(linkEvent.extractedAddress)
            && linkEvent.extractedAddress !== linkEvent.locationName) {
            return linkEvent.extractedAddress as string;
        }
        return null;
    })();

    const handleDelete = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Vill du ta bort "${linkEvent.title}"?`)) return;
        setIsDeleting(true);
        try {
            await linkEventService.delete(linkEvent.id);
            toast.success('Länk-event borttaget!');
            if (onDelete) onDelete();
        } catch (error) {
            console.error('Error deleting link event:', error);
            toast.error('Kunde inte ta bort länk-event');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleVisitSite = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Vidarelänknings-statistik (fire-and-forget): hur många vi skickar
        // till vilken arrangör — underlaget för outreach-mejlen. Får aldrig
        // fördröja eller stoppa själva öppningen.
        recordEventClick({
            id: linkEvent.id,
            url: linkEvent.url,
            title: linkEvent.title,
            hostName: linkEvent.hostName,
        });
        window.open(linkEvent.url, '_blank', 'noopener,noreferrer');
    };

    // Vägbeskrivning i Google Maps (öppnar appen på mobil). Koordinaterna är
    // pålitligare än adressträngen, så de används som destination.
    const hasCoords = typeof linkEvent.lat === 'number' && typeof linkEvent.lng === 'number'
        && !(linkEvent.lat === 0 && linkEvent.lng === 0);
    const handleDirections = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(
            `https://www.google.com/maps/dir/?api=1&destination=${linkEvent.lat},${linkEvent.lng}`,
            '_blank', 'noopener,noreferrer'
        );
    };

    const handleToggleSave = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleSave?.();
    };

    // Stjärn-gåvan ⭐: placeringen är ENGÅNGS (kan aldrig ångras eller flyttas)
    // → alltid bekräftelsedialog innan Cloud-funktionen kallas.
    const handlePlaceStar = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!confirm(`Sätt din stjärna på "${linkEvent.title}"? Det går inte att ångra.`)) return;
        onPlaceStar?.();
    };

    // Dela eventet: native share-dialog på mobil, annars kopiera länken.
    // Skrapade event delas som /e/<slug> — den sidan serverar eventets EGEN
    // delningsbild (titel/emoji/plats) till FB/Messenger och skickar människor
    // vidare till kartan. User-skapade event finns inte i aggregat-datat som
    // /e/-uppslaget läser, så de behåller den direkta ?event=-länken.
    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const shareUrl = linkEvent.userCreated
            ? `${window.location.origin}/?event=${encodeURIComponent(linkEvent.id)}`
            : `${window.location.origin}/e/${eventShareSlug(linkEvent.id)}`;
        try {
            if (navigator.share) {
                await navigator.share({ title: linkEvent.title, url: shareUrl });
                return;
            }
            await navigator.clipboard.writeText(shareUrl);
            toast.success('Länk kopierad!');
        } catch {
            // Avbruten share-dialog är inget fel — gör inget.
        }
    };

    const handleHeaderClick = () => {
        if (alwaysExpanded) { onContentTap?.(); return; }
        setInternalRevealStep(prev => prev === 0 ? 1 : 0);
    };

    const handleContentClick = (e: React.MouseEvent) => {
        if (alwaysExpanded) { onContentTap?.(); return; }
        e.stopPropagation();
        setInternalRevealStep(prev => prev === 1 ? 2 : 1);
    };

    // Bara den riktiga omslagsbilden visas — saknas den visas ingen bild alls
    // (ingen fallback-platshållare längre).
    const hasRealCover = !!linkEvent.coverImage;

    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        } catch { return null; }
    };
    const faviconUrl = getFaviconUrl(linkEvent.url);

    // Formatera pris för visning. Normaliserar de vanliga svenska varianter vi
    // ser i scraper-datan: "Fri entré"/"Avgiftsfritt"/"kostnadsfritt" → "Gratis";
    // "30kr"/"160:-"/"40 SEK" → "X kr"; rena siffror/intervall får "kr" påsatt.
    const priceLabel = normalizePriceLabel(linkEvent.price);

    // Eventets emoji (samma logik som kartnålen/EventCard): per-event-emoji, annars
    // kategori-fallback. Visas i början av titeln.
    const catKey = (linkEvent.category && linkEvent.category in EVENT_CATEGORIES ? linkEvent.category : 'other') as EventCategoryType;
    const titleEmoji = linkEvent.emoji || (EVENT_CATEGORIES[catKey]?.emoji ?? '🎫');

    return (
        <div className="w-full bg-card border-b border-border flex flex-col group">
            {/* 1. Header (Always visible) */}
            <div
                className={`p-4 md:p-6 pt-10 flex flex-col w-full relative bg-card ${alwaysExpanded ? '' : 'cursor-pointer sticky top-0 z-10'}`}
                onClick={handleHeaderClick}
            >
                {isAdmin && (
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="absolute top-4 right-4 z-50 bg-red-500 text-white p-2 rounded disabled:opacity-50"
                    >
                        <Trash2 size={16} />
                    </button>
                )}

                {/* Event VÄRDADE på VADKUL lyfts fram med en grön badge — de är
                    sajtens kärna och ska kännas igen direkt. (Tips får den INTE:
                    de ska smälta in bland de vanliga länk-eventen.) */}
                {vadkulHosted && (
                    <span className="self-start inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                        <Sparkles size={11} className="shrink-0" />
                        Skapat på VADKUL
                    </span>
                )}

                <div className="flex justify-between items-center mb-3">
                    {/* Fixed 2-line height — single-line titles center vertically */}
                    <div className="flex-1 min-w-0 h-[2.8rem] md:h-[3.2rem] flex items-center overflow-hidden">
                        <h3 className="font-black text-black dark:text-white leading-tight text-lg md:text-xl group-hover:text-primary transition-colors pr-10 line-clamp-2 w-full">
                            <span aria-hidden className="mr-2 text-[1.5em] leading-none align-middle">{titleEmoji}</span>{linkEvent.title}
                        </h3>
                    </div>
                    {/* Hjärta för att spara samt primär ANMÄL-knapp till höger om titeln. */}
                    <div className="shrink-0 flex items-center gap-2">
                        {/* Stjärn-gåvan ⭐ bredvid hjärtat: klickbar när man har en
                            oanvänd stjärna, annars ren guld-indikator på event som
                            redan HAR en stjärna (syns för alla). */}
                        {canPlaceStar && onPlaceStar ? (
                            <button
                                onClick={handlePlaceStar}
                                aria-label="Sätt din stjärna på eventet"
                                title="Sätt din stjärna här — eventet lyser då för alla"
                                className="w-8 h-8 rounded-full border transition-all active:scale-[0.95] flex items-center justify-center shrink-0 bg-amber-50 border-amber-300 text-amber-500 hover:bg-amber-100 hover:border-amber-400 dark:bg-amber-950/30 dark:border-amber-900/60 dark:text-amber-400"
                            >
                                <Star size={15} fill={hasStar ? 'currentColor' : 'none'} />
                            </button>
                        ) : hasStar ? (
                            <span
                                aria-label="Det här eventet har fått en stjärna"
                                title="Det här eventet har fått en stjärna av en tidig VADKUL-användare"
                                className="w-8 h-8 rounded-full border flex items-center justify-center shrink-0 bg-amber-100 border-amber-300 text-amber-500 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-400"
                            >
                                <Star size={15} fill="currentColor" />
                            </span>
                        ) : null}
                        {onToggleSave && (
                            <button
                                onClick={handleToggleSave}
                                aria-label={saved ? 'Ta bort från sparade' : 'Spara eventet'}
                                className={`w-8 h-8 rounded-full border transition-all active:scale-[0.95] flex items-center justify-center shrink-0 ${
                                    saved
                                        ? 'bg-rose-50 border-rose-200 text-rose-500 dark:bg-rose-950/30 dark:border-rose-900/50'
                                        : 'bg-white border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 dark:hover:text-rose-400 dark:hover:border-rose-900/50'
                                }`}
                            >
                                <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
                            </button>
                        )}
                        {linkEvent.url && (
                            <button
                                onClick={handleVisitSite}
                                className="bg-[#006AA7] hover:bg-[#005590] text-white text-[10px] font-black px-3 rounded shadow-lg h-8 flex items-center justify-center"
                            >
                                ANMÄL
                            </button>
                        )}
                    </div>
                </div>

                {/* VADKUL-värdade event länkar inte ut någonstans — platsen är
                    enda sättet att hitta dit och får därför ALDRIG trunkeras:
                    den får en egen rad (nedan) som radbryts fritt. Skrapade
                    event och tips behåller platsen inline (trunkerad) — där
                    finns alltid ANMÄL-länken med fullständig info. */}
                <div className={`flex items-center gap-x-4 text-xs font-bold text-slate-600 dark:text-slate-300 overflow-hidden ${vadkulHosted ? 'mb-1.5' : 'mb-4'}`}>
                    <div className="flex items-center gap-2 shrink-0">
                        <Clock size={14} className="text-primary" />
                        <span className="whitespace-nowrap">{formatEventDate(linkEvent.time, linkEvent.hasSpecificTime !== false)}</span>
                    </div>
                    {/* Avstånd från användarens plats (kartans blå prick) — visas
                        bara när positionen är känd (distance-propen satt). */}
                    {typeof distance === 'number' && (
                        <div className="flex items-center gap-1.5 shrink-0" title="Avstånd från din plats">
                            <Navigation size={13} className="text-primary" />
                            <span className="whitespace-nowrap">{formatDistanceKm(distance)}</span>
                        </div>
                    )}
                    {vadkulHosted ? (
                        <div className="flex-1 min-w-0" />
                    ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                            <MapPin size={14} className="text-primary shrink-0" />
                            <span className="text-sm truncate">{linkEvent.locationName}</span>
                            {secondaryAddress && (
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                                    · {secondaryAddress}
                                </span>
                            )}
                        </div>
                    )}
                    {/* 👁 Antal visningar (eventStats). Visas först när siffran
                        är hämtad och > 0 — aldrig en ljugande nolla. */}
                    {viewCount !== null && viewCount > 0 && (
                        <div
                            className="flex items-center gap-1.5 shrink-0"
                            title={`${viewCount.toLocaleString('sv-SE')} visningar`}
                        >
                            <Eye size={13} className="text-primary" />
                            <span className="whitespace-nowrap tabular-nums">{viewCount.toLocaleString('sv-SE')}</span>
                        </div>
                    )}
                    {/* Fler event på samma plats → pager längst till höger på platsraden:
                        antal ("3/7") + pil som stegar till nästa event i högen. */}
                    {groupTotal > 1 && onGroupNext && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onGroupNext(); }}
                            aria-label={`Nästa av ${groupTotal} event på samma plats`}
                            title="Fler event på samma plats"
                            className="shrink-0 flex items-center gap-1 pl-2.5 pr-2 py-1 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 active:scale-95 transition-all"
                        >
                            <span className="text-[11px] font-black tabular-nums leading-none">{groupIndex + 1}/{groupTotal}</span>
                            <ArrowRight size={13} className="shrink-0" />
                        </button>
                    )}
                </div>

                {vadkulHosted && (
                    <div className="flex items-start gap-2 mb-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <MapPin size={14} className="text-primary shrink-0 mt-0.5" />
                        <span className="text-sm min-w-0 break-words">
                            {linkEvent.locationName}
                            {secondaryAddress && (
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                    {' '}· {secondaryAddress}
                                </span>
                            )}
                        </span>
                    </div>
                )}

                <div data-peek-boundary className="border-t border-border pt-2 flex items-end justify-between gap-4">
                    {/* Värd */}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Värd</span>
                        <div className="flex items-center gap-2">
                            {/* VADKUL-värdade event: grön avatar med värdens initial
                                (de saknar favicon — ingen extern sajt). Tips har en
                                länk → favicon som de skrapade eventen. */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border overflow-hidden shrink-0 ${
                                vadkulHosted
                                    ? 'bg-emerald-500 border-emerald-400 text-white'
                                    : 'bg-white border-border'
                            }`}>
                                {!vadkulHosted && faviconUrl ? (
                                    <img src={faviconUrl} alt="" className="w-4 h-4 object-contain" />
                                ) : (
                                    <span className="font-bold text-[8px]">{linkEvent.hostName?.charAt(0).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="text-xs font-black text-black dark:text-white truncate">{linkEvent.hostName || 'Okänd'}</span>
                        </div>
                    </div>

                    {/* Pris — ersätter "Kommer" (vi har sällan riktig anmälningsdata,
                        t.ex. från Tickster). Visas bara när vi faktiskt har ett pris. */}
                    {priceLabel && (
                        <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Pris</span>
                            <span className="inline-flex items-center gap-1 text-sm font-black text-black dark:text-white whitespace-nowrap">
                                <Ticket size={14} className="text-primary" />
                                {priceLabel}
                            </span>
                        </div>
                    )}
                </div>
            </div>


            {/* 2. Innehåll (bild + beskrivning + åtgärder) — ALLTID renderat, så
                hopfällt och uppfällt skiljer sig BARA i sheet-höjd: drar man upp
                det hopfällda kortet syns samma bild/beskrivning. */}
            <div className="flex flex-col w-full">
                    {/* Omslagsbild — visas BARA när eventet har en riktig bild
                        (ingen fallback). Object-contain så hela motivet syns,
                        höjd-capad. Ligger under värd/pris-raden i kortet. */}
                    {hasRealCover && !coverFailed && (
                        <div
                            className="w-full bg-muted/30 border-t border-border overflow-hidden flex justify-center cursor-pointer"
                            onClick={handleContentClick}
                        >
                            <img
                                data-cover-img
                                src={linkEvent.coverImage as string}
                                alt={linkEvent.title}
                                onError={() => setCoverFailed(true)}
                                className="w-full h-auto max-h-[60vh] object-contain"
                            />
                        </div>
                    )}

                    {/* Description Section */}
                    <div
                        className={`p-4 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-border ${alwaysExpanded ? '' : 'cursor-pointer'}`}
                        onClick={handleContentClick}
                    >
                        <p data-event-description className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed font-medium">
                            {withRecoveredLineBreaks((linkEvent as any).description) || 'Ingen beskrivning tillgänglig.'}
                        </p>
                        
                        <div className="mt-6 flex flex-col gap-3">
                                {/* Skrapade event länkar ut till arrangörens sida. */}
                                {linkEvent.url && (
                                    <button
                                        onClick={handleVisitSite}
                                        className="flex items-center justify-center gap-4 w-full py-4 bg-[#006AA7] hover:bg-[#005590] text-white text-lg md:text-xl font-black shadow-2xl transition-all active:scale-[0.97]"
                                    >
                                        <span>ANMÄL DIG HÄR</span>
                                        <ExternalLink size={24} />
                                    </button>
                                )}

                                {/* VADKUL-värdade event: anmälan sker HÄR på sidan, ingen
                                    extern länk. Knappen togglar din anmälan och listan visar
                                    vilka som kommer. (Tips har url → ANMÄL-knappen ovan.) */}
                                {vadkulHosted && (
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={handleRsvpToggle}
                                            disabled={rsvpBusy}
                                            aria-pressed={isAttending}
                                            className={`flex items-center justify-center gap-3 w-full py-4 text-lg md:text-xl font-black shadow-2xl transition-all active:scale-[0.97] disabled:opacity-60 ${
                                                isAttending
                                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                                    : 'bg-[#006AA7] hover:bg-[#005590] text-white'
                                            }`}
                                        >
                                            {isAttending ? <Check size={24} /> : <Users size={24} />}
                                            <span>{isAttending ? 'DU ÄR ANMÄLD' : 'ANMÄL DIG'}</span>
                                        </button>

                                        <div>
                                            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                                                <Users size={13} />
                                                {attendees.length === 0
                                                    ? 'Ingen anmäld än — bli först!'
                                                    : `${attendees.length} ${attendees.length === 1 ? 'anmäld' : 'anmälda'}`}
                                            </p>
                                            {attendees.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {attendees.map(a => (
                                                        <span
                                                            key={a.uid}
                                                            className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                                                        >
                                                            {a.photoURL ? (
                                                                // eslint-disable-next-line @next/next/no-img-element
                                                                <img src={a.photoURL} alt="" className="w-6 h-6 rounded-full object-cover" />
                                                            ) : (
                                                                <span className="w-6 h-6 rounded-full bg-[#006AA7] text-white text-[11px] font-black flex items-center justify-center">
                                                                    {a.name.charAt(0).toUpperCase()}
                                                                </span>
                                                            )}
                                                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 max-w-[120px] truncate">{a.name}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {/* Spara / Hitta hit / Dela — samlade direkt under
                                    anmälningsknappen i stället för utspridda
                                    småknappar uppe vid titeln. */}
                                <div className="flex gap-3">
                                    {/* Stjärn-gåvan ⭐ bredvid Spara: samma logik som
                                        header-stjärnan (knapp när man kan placera,
                                        annars indikator på stjärnmärkta event). */}
                                    {canPlaceStar && onPlaceStar ? (
                                        <button
                                            onClick={handlePlaceStar}
                                            aria-label="Sätt din stjärna på eventet"
                                            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 border-2 text-xs font-black uppercase tracking-wide transition-all active:scale-[0.97] border-amber-400 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                        >
                                            <Star size={20} fill={hasStar ? 'currentColor' : 'none'} />
                                            Sätt stjärna
                                        </button>
                                    ) : hasStar ? (
                                        <div
                                            aria-label="Det här eventet har fått en stjärna"
                                            title="Det här eventet har fått en stjärna av en tidig VADKUL-användare"
                                            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 border-2 text-xs font-black uppercase tracking-wide border-amber-300 bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:border-amber-900/60"
                                        >
                                            <Star size={20} fill="currentColor" />
                                            Stjärnmärkt
                                        </div>
                                    ) : null}
                                    {onToggleSave && (
                                        <button
                                            onClick={handleToggleSave}
                                            aria-label={saved ? 'Ta bort från sparade' : 'Spara eventet'}
                                            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-3 border-2 text-xs font-black uppercase tracking-wide transition-all active:scale-[0.97] ${
                                                saved
                                                    ? 'bg-rose-500 border-rose-500 text-white hover:bg-rose-400'
                                                    : 'border-rose-300 text-rose-500 hover:bg-rose-50'
                                            }`}
                                        >
                                            <Heart size={20} fill={saved ? 'currentColor' : 'none'} />
                                            {saved ? 'Sparad' : 'Spara'}
                                        </button>
                                    )}
                                    {hasCoords && (
                                        <button
                                            onClick={handleDirections}
                                            aria-label="Vägbeskrivning (Google Maps)"
                                            className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 border-2 border-[#006AA7] text-[#006AA7] hover:bg-[#006AA7]/5 text-xs font-black uppercase tracking-wide transition-all active:scale-[0.97]"
                                        >
                                            <Navigation size={20} />
                                            Hitta hit
                                        </button>
                                    )}
                                    <button
                                        onClick={handleShare}
                                        aria-label="Dela eventet"
                                        className="flex-1 flex flex-col items-center justify-center gap-1.5 py-3 border-2 border-[#006AA7] text-[#006AA7] hover:bg-[#006AA7]/5 text-xs font-black uppercase tracking-wide transition-all active:scale-[0.97]"
                                    >
                                        <Share2 size={20} />
                                        Dela
                                    </button>
                                </div>

                                {/* Lägg till i kalender — Google-länk + .ics för Apple/Outlook */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(googleCalendarUrl(linkEvent), '_blank', 'noopener,noreferrer'); }}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold transition-colors"
                                    >
                                        <CalendarPlus size={16} className="shrink-0" />
                                        Google Kalender
                                    </button>
                                    <button
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); downloadIcs(linkEvent); }}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold transition-colors"
                                    >
                                        <CalendarPlus size={16} className="shrink-0" />
                                        Kalenderfil (.ics)
                                    </button>
                                </div>

                                {/* Småtext-åtgärder: rapportera (alla) + ta bort (ägaren) */}
                                <div className="flex flex-col items-center gap-1 pt-1">
                                    {/* Transparens för TIPS: inlagt av en användare, men
                                        anonymt — tipsaren ska aldrig se ut som arrangör. */}
                                    {isTip && (
                                        <p className="text-[10px] font-semibold text-slate-400 py-0.5">
                                            💡 Tipsat av en VADKUL-användare
                                        </p>
                                    )}
                                    {reportSent ? (
                                        <p className="text-xs font-bold text-emerald-600 py-1.5">Tack! Vi tittar på det. 🙏</p>
                                    ) : reportOpen ? (
                                        <div className="flex flex-wrap justify-center gap-2 py-1" onClick={(e) => e.stopPropagation()}>
                                            {['Fel information', 'Eventet finns inte', 'Olämpligt innehåll'].map(reason => (
                                                <button
                                                    key={reason}
                                                    onClick={(e) => handleReport(e, reason)}
                                                    className="text-[11px] font-bold px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                >
                                                    {reason}
                                                </button>
                                            ))}
                                        </div>
                                    ) : (
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setReportOpen(true); }}
                                            className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1.5 transition-colors"
                                        >
                                            Rapportera event
                                        </button>
                                    )}
                                    {canDelete && onBoost && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onBoost();
                                            }}
                                            className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 py-1.5 transition-colors"
                                        >
                                            <Rocket size={14} />
                                            {isEventFeatured(linkEvent) ? 'Förläng boost' : 'Boosta eventet'}
                                        </button>
                                    )}
                                    {canDelete && onDeleteOwn && (
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                if (confirm(`Ta bort "${linkEvent.title}" permanent?`)) onDeleteOwn();
                                            }}
                                            className="text-[10px] uppercase tracking-widest font-bold text-red-400 hover:text-red-600 py-1.5 transition-colors"
                                        >
                                            Ta bort eventet
                                        </button>
                                    )}
                                </div>
                            </div>
                    </div>
                </div>
        </div>
    );
}
