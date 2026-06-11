import { ExternalLink, Trash2, Clock, MapPin, Ticket, Share2 } from 'lucide-react';
import Image from 'next/image';
import type { LinkEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { normalizePriceLabel } from '../../utils/priceLabel';
import { linkEventService } from '../../services/linkEventService';
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

// ─── Category patterns ────────────────────────────────────────────────────────
import patternBoardgame from '../../assets/categories/patterns/pattern_boardgame.png';
import patternCampus from '../../assets/categories/patterns/pattern_campus.png';
import patternCommunity from '../../assets/categories/patterns/pattern_community.png';
import patternCreative from '../../assets/categories/patterns/pattern_creative.png';
import patternCulture from '../../assets/categories/patterns/pattern_culture.png';
import patternFood from '../../assets/categories/patterns/pattern_food.png';
import patternGame from '../../assets/categories/patterns/pattern_game.png';
import patternMarket from '../../assets/categories/patterns/pattern_market.png';
import patternMingle from '../../assets/categories/patterns/pattern_mingle.png';
import patternMovie from '../../assets/categories/patterns/pattern_movie.png';
import patternOther from '../../assets/categories/patterns/pattern_other.png';
import patternOutdoor from '../../assets/categories/patterns/pattern_outdoor.png';
import patternParty from '../../assets/categories/patterns/pattern_party.png';
import patternPlay from '../../assets/categories/patterns/pattern_play.png';
import patternSocial from '../../assets/categories/patterns/pattern_social.png';
import patternSport from '../../assets/categories/patterns/pattern_sport.png';
import patternStudy from '../../assets/categories/patterns/pattern_study.png';
import patternTraining from '../../assets/categories/patterns/pattern_training.png';

const ALL_PATTERNS = [
    patternBoardgame, patternCampus, patternCommunity, patternCreative,
    patternCulture, patternFood, patternGame, patternMarket,
    patternMingle, patternMovie, patternOther, patternOutdoor,
    patternParty, patternPlay, patternSocial, patternSport,
    patternStudy, patternTraining
];

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
}

export default function LinkEventCard({ linkEvent, isAdmin = false, distance, onDelete, isPanelMode = false, showFullAddress = false, onRevealStepChange, alwaysExpanded = false, onContentTap }: LinkEventCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [internalRevealStep, setInternalRevealStep] = useState(0); // 0: header, 1: +img/truncated, 2: +full
    const revealStep = alwaysExpanded ? 2 : internalRevealStep;
    // Sant när den RIKTIGA omslagsbilden inte gick att ladda (t.ex. ett
    // facebook-event utan bild bakom URL:en). Då har vi ingen fallback att visa
    // → rendera INGEN bild i stället för webbläsarens trasiga bild-ikon med
    // titeln (alt-texten) bredvid.
    const [coverFailed, setCoverFailed] = useState(false);
    // Nollställ när eventet (eller dess bild-URL) byts så felet inte "fastnar".
    useEffect(() => { setCoverFailed(false); }, [linkEvent.id, linkEvent.coverImage]);

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

    const getHash = (str: string) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
        return Math.abs(hash);
    };

    const patternIndex = getHash(linkEvent.id || linkEvent.title || '') % ALL_PATTERNS.length;
    const coverSrc = linkEvent.coverImage || ALL_PATTERNS[patternIndex];
    // Sant bara när eventet har en riktig omslagsbild. Fallback-mönstren ska
    // INTE visas i full höjd — de är bara dekorativa platshållare och beskärs
    // som tidigare.
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
                className={`p-4 md:p-6 pt-2 flex flex-col w-full relative bg-card ${alwaysExpanded ? '' : 'cursor-pointer sticky top-0 z-10'}`}
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

                <div className="flex justify-between items-center mb-3">
                    {/* Fixed 2-line height — single-line titles center vertically */}
                    <div className="flex-1 min-w-0 h-[2.8rem] md:h-[3.2rem] flex items-center overflow-hidden">
                        <h3 className="font-black text-black dark:text-white leading-tight text-lg md:text-xl group-hover:text-primary transition-colors pr-10 line-clamp-2 w-full">
                            {linkEvent.title}
                        </h3>
                    </div>
                    {revealStep >= 1 && (
                        <div className="shrink-0 flex items-center gap-1.5 animate-in fade-in zoom-in duration-300">
                            <button
                                onClick={handleShare}
                                aria-label="Dela eventet"
                                className="bg-white hover:bg-slate-50 text-[#006AA7] border border-slate-200 p-1.5 rounded shadow-lg transition-colors"
                            >
                                <Share2 size={14} />
                            </button>
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
                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-border overflow-hidden shrink-0">
                                {faviconUrl ? (
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

            {/* Step 0 Peek: Small slice of the image at the bottom when collapsed */}
            {!alwaysExpanded && revealStep === 0 && (
                <div
                    className="w-full h-14 relative cursor-pointer overflow-hidden border-t border-border/50 group-hover:h-18 transition-all duration-500"
                    onClick={handleHeaderClick}
                >
                    <Image unoptimized
                        src={coverSrc}
                        alt=""
                        fill
                        className="object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 left-0 right-0 flex items-center justify-center gap-1 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <span>Se mer</span>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            )}

            {/* 2. Revealed Content (Image + Description) */}
            {revealStep >= 1 && (
                <div className="flex flex-col w-full animate-in fade-in slide-in-from-top-2 duration-300">
                    {/* Image — i panel-/sheet-läget (alwaysExpanded) visas HELA
                        den RIKTIGA omslagsbilden (object-contain, höjd-capad till
                        48vh) i stället för en beskuren remsa, så man ser hela
                        motivet. Fallback-mönster (utan riktig coverImage) och alla
                        övriga lägen behåller den beskurna h-48/h-64-remsan. */}
                    {/* Riktig omslagsbild som inte gick att ladda (coverFailed) och
                        inget fallback-mönster → rendera INGEN bild i stället för
                        webbläsarens trasiga bild-ikon med titeln bredvid. */}
                    {hasRealCover && coverFailed ? null : alwaysExpanded && hasRealCover ? (
                        <div
                            className="w-full bg-muted/30 border-t border-border overflow-hidden flex justify-center cursor-pointer"
                            onClick={handleContentClick}
                        >
                            <img
                                data-cover-img
                                src={coverSrc as string}
                                alt={linkEvent.title}
                                onError={() => setCoverFailed(true)}
                                className="w-full h-auto max-h-[48vh] object-contain"
                            />
                        </div>
                    ) : (
                        <div
                            className="relative w-full h-48 md:h-64 bg-muted/30 border-t border-border overflow-hidden cursor-pointer"
                            onClick={handleContentClick}
                        >
                            <Image unoptimized
                                src={coverSrc}
                                alt={linkEvent.title}
                                fill
                                sizes="100vw"
                                onError={() => { if (hasRealCover) setCoverFailed(true); }}
                                className="object-cover transition-transform duration-700 hover:scale-105"
                            />
                        </div>
                    )}

                    {/* Description Section */}
                    <div
                        className={`p-4 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-border ${alwaysExpanded ? '' : 'cursor-pointer'}`}
                        onClick={handleContentClick}
                    >
                        <p data-event-description className={`text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed font-medium ${revealStep === 1 ? 'line-clamp-3' : ''}`}>
                            {(linkEvent as any).description || 'Ingen beskrivning tillgänglig.'}
                        </p>
                        
                        {revealStep === 1 && (linkEvent as any).description && (
                            <div className="mt-3 text-[#006AA7] font-black flex items-center gap-1 text-[10px] uppercase tracking-widest">
                                <span>Läs hela beskrivningen</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        )}

                        {revealStep === 2 && (
                            <div className="mt-6 flex flex-col gap-4">
                                <button
                                    onClick={handleVisitSite}
                                    className="flex items-center justify-center gap-4 w-full py-4 bg-[#006AA7] hover:bg-[#005590] text-white text-lg md:text-xl font-black shadow-2xl transition-all active:scale-[0.97]"
                                >
                                    <span>ANMÄL DIG HÄR</span>
                                    <ExternalLink size={24} />
                                </button>
                                {!alwaysExpanded && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setInternalRevealStep(0); }}
                                        className="text-[10px] text-slate-400 hover:text-slate-600 font-bold py-2 uppercase tracking-widest text-center"
                                    >
                                        Stäng detaljer
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
