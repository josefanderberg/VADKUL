import { ExternalLink, Trash2, Clock, MapPin } from 'lucide-react';
import Image from 'next/image';
import type { LinkEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { linkEventService } from '../../services/linkEventService';
import { useState, useMemo, useEffect } from 'react';
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
}

export default function LinkEventCard({ linkEvent, isAdmin = false, distance, onDelete, isPanelMode = false, showFullAddress = false, onRevealStepChange }: LinkEventCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [revealStep, setRevealStep] = useState(0); // 0: header, 1: +img/truncated, 2: +full

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

    const handleHeaderClick = () => {
        setRevealStep(prev => prev === 0 ? 1 : 0);
    };

    const handleContentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRevealStep(prev => prev === 1 ? 2 : 1);
    };

    const getHash = (str: string) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) hash = ((hash << 5) + hash) + str.charCodeAt(i);
        return Math.abs(hash);
    };

    const patternIndex = getHash(linkEvent.id || linkEvent.title || '') % ALL_PATTERNS.length;
    const coverSrc = linkEvent.coverImage || ALL_PATTERNS[patternIndex];

    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        } catch { return null; }
    };
    const faviconUrl = getFaviconUrl(linkEvent.url);

    // DETERMINISTISKA fejk-avatarer (2 st + 1 bubbla med resten)
    const dummyAvatars = useMemo(() => {
        const seed = getHash(linkEvent.id || linkEvent.title || 'default');
        const initials = ['JS', 'ML', 'KB', 'AD', 'EN', 'PT', 'SR', 'HL'];
        return [0, 1].map(n => {
            const initial = initials[(seed + n) % initials.length];
            return `https://ui-avatars.com/api/?name=${initial}&background=random&color=fff&size=64&font-size=0.45&bold=true`;
        });
    }, [linkEvent.id, linkEvent.title]);

    const attendeeCount = linkEvent.attendees !== undefined ? linkEvent.attendees : 0;

    return (
        <div className="w-full bg-card border-b border-border flex flex-col group">
            {/* 1. Header (Always visible) */}
            <div
                className="p-4 md:p-6 pt-5 flex flex-col w-full relative cursor-pointer sticky top-0 bg-card z-10"
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
                        <button
                            onClick={handleVisitSite}
                            className="shrink-0 bg-[#006AA7] hover:bg-[#005590] text-white text-[10px] font-black px-3 py-1.5 rounded shadow-lg animate-in fade-in zoom-in duration-300"
                        >
                            ANMÄL
                        </button>
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

                <div className="border-t border-border pt-2 flex items-end justify-between gap-4">
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

                    {/* Kommer — fast höjd så raden inte hoppar mellan events med/utan anmälda */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Kommer</span>
                        <div className="h-8 flex items-center">
                            {attendeeCount > 0 ? (
                                <div className="flex -space-x-2 overflow-hidden">
                                    {dummyAvatars.map((src, i) => (
                                        <div key={i} className="inline-block h-7 w-7 rounded-full ring-2 ring-card bg-slate-100 overflow-hidden border border-border/10">
                                            <img src={src} alt="" className="h-full w-full object-cover" />
                                        </div>
                                    ))}
                                    <div className="flex h-7 px-1.5 min-w-[28px] items-center justify-center rounded-full bg-slate-800 ring-2 ring-card text-[9px] font-black text-white shadow-lg">
                                        {attendeeCount > 2 ? `+${attendeeCount - 2}` : `+${attendeeCount}`}
                                    </div>
                                </div>
                            ) : (
                                <span className="text-[10px] text-slate-300 font-medium">Inga anmälda</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Step 0 Peek: Small slice of the image at the bottom when collapsed */}
            {revealStep === 0 && (
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
                    {/* Image */}
                    <div 
                        className="relative w-full h-48 md:h-64 bg-muted/30 border-t border-border cursor-pointer overflow-hidden"
                        onClick={handleContentClick}
                    >
                        <Image unoptimized
                            src={coverSrc}
                            alt={linkEvent.title}
                            fill
                            sizes="100vw"
                            className="object-cover transition-transform duration-700 hover:scale-105"
                        />
                    </div>

                    {/* Description Section */}
                    <div 
                        className="p-4 md:p-8 bg-slate-50 dark:bg-slate-900/50 border-t border-border cursor-pointer"
                        onClick={handleContentClick}
                    >
                        <p className={`text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed font-medium ${revealStep === 1 ? 'line-clamp-3' : ''}`}>
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
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setRevealStep(0); }}
                                    className="text-[10px] text-slate-400 hover:text-slate-600 font-bold py-2 uppercase tracking-widest text-center"
                                >
                                    Stäng detaljer
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
