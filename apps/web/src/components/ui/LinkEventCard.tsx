import { ExternalLink, Trash2, Clock, MapPin, Ticket, Share2, Heart, Navigation, CalendarPlus, Sparkles, Users, Check, Rocket } from 'lucide-react';
import type { LinkEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { normalizePriceLabel } from '../../utils/priceLabel';
import { googleCalendarUrl, downloadIcs } from '../../utils/calendarLinks';
import { linkEventService, isEventFeatured, type RsvpAttendee } from '../../services/linkEventService';
import { feedbackService } from '../../services/feedbackService';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// Adresser som indikerar en geokod-fallback (bara stadsnamn, inte en faktisk gatuadress).
const ADDRESS_FALLBACKS = new Set(['växjö', 'vaxjo', 'stockholm', 'sverige', 'sweden', '']);

function isSpecificAddress(addr: string | undefined | null): boolean {
    if (!addr) return false;
    const trimmed = addr.trim();
    if (trimmed.length === 0) return false;
    return !ADDRESS_FALLBACKS.has(trimmed.toLowerCase());
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
}

export default function LinkEventCard({ linkEvent, isAdmin = false, distance, onDelete, isPanelMode = false, showFullAddress = false, onRevealStepChange, alwaysExpanded = false, onContentTap, saved = false, onToggleSave, canDelete = false, onDeleteOwn, onBoost }: LinkEventCardProps) {
    const { user } = useAuth();
    const [isDeleting, setIsDeleting] = useState(false);
    const [internalRevealStep, setInternalRevealStep] = useState(0); // 0: header, 1: +img/truncated, 2: +full
    const revealStep = alwaysExpanded ? 2 : internalRevealStep;

    // Anmälningar (RSVP) — bara för användarskapade event (de länkar inte ut, allt
    // sker här på sidan). Live-lyssnare på linkEvents/{id}/attendees.
    const [attendees, setAttendees] = useState<RsvpAttendee[]>([]);
    const [rsvpBusy, setRsvpBusy] = useState(false);
    useEffect(() => {
        if (!linkEvent.userCreated) { setAttendees([]); return; }
        const unsub = linkEventService.subscribeAttendees(linkEvent.id, setAttendees);
        return () => unsub();
    }, [linkEvent.id, linkEvent.userCreated]);
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
            await feedbackService.reportEvent(linkEvent, reason);
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

    // Dela eventet: native share-dialog på mobil, annars kopiera deep-länken
    // (?event=<id> återställer exakt detta event på kartan hos mottagaren).
    const handleShare = async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/?event=${encodeURIComponent(linkEvent.id)}`;
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

                {/* Event skapade direkt på VADKUL lyfts fram med en grön badge —
                    de är sajtens kärna och ska kännas igen direkt. */}
                {linkEvent.userCreated && (
                    <span className="self-start inline-flex items-center gap-1.5 mb-2 px-2.5 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                        <Sparkles size={11} className="shrink-0" />
                        Skapat på VADKUL
                    </span>
                )}

                <div className="flex justify-between items-center mb-3">
                    {/* Fixed 2-line height — single-line titles center vertically */}
                    <div className="flex-1 min-w-0 h-[2.8rem] md:h-[3.2rem] flex items-center overflow-hidden">
                        <h3 className="font-black text-black dark:text-white leading-tight text-lg md:text-xl group-hover:text-primary transition-colors pr-10 line-clamp-2 w-full">
                            {linkEvent.title}
                        </h3>
                    </div>
                    {/* Titelraden hålls ren — bara den primära ANMÄL-knappen.
                        Spara/Hitta hit/Dela ligger samlade under den stora
                        anmälningsknappen längre ner i kortet. Användarskapade
                        event saknar extern anmälningssida (ingen url). */}
                    {linkEvent.url && (
                        <div className="shrink-0">
                            <button
                                onClick={handleVisitSite}
                                className="bg-[#006AA7] hover:bg-[#005590] text-white text-[10px] font-black px-3 py-1.5 rounded shadow-lg"
                            >
                                ANMÄL
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-x-4 mb-4 text-xs font-bold text-slate-600 dark:text-slate-300 overflow-hidden">
                    <div className="flex items-center gap-2 shrink-0">
                        <Clock size={14} className="text-primary" />
                        <span className="whitespace-nowrap">{formatEventDate(linkEvent.time, linkEvent.hasSpecificTime !== false)}</span>
                    </div>
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        <MapPin size={14} className="text-primary shrink-0" />
                        <span className="text-sm truncate">{linkEvent.locationName}</span>
                        {secondaryAddress && (
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 shrink-0">
                                · {secondaryAddress}
                            </span>
                        )}
                    </div>
                </div>

                <div data-peek-boundary className="border-t border-border pt-2 flex items-end justify-between gap-4">
                    {/* Värd */}
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Värd</span>
                        <div className="flex items-center gap-2">
                            {/* VADKUL-skapade event: grön avatar med värdens initial
                                (de saknar favicon — ingen extern sajt). */}
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center border overflow-hidden shrink-0 ${
                                linkEvent.userCreated
                                    ? 'bg-emerald-500 border-emerald-400 text-white'
                                    : 'bg-white border-border'
                            }`}>
                                {!linkEvent.userCreated && faviconUrl ? (
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
                            {(linkEvent as any).description || 'Ingen beskrivning tillgänglig.'}
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

                                {/* Användarskapade event: anmälan sker HÄR på sidan, ingen
                                    extern länk. Knappen togglar din anmälan och listan visar
                                    vilka som kommer. */}
                                {!linkEvent.url && linkEvent.userCreated && (
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
