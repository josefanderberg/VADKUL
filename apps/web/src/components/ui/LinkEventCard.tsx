import { ExternalLink, Trash2, Clock, MapPin } from 'lucide-react';
import Image from 'next/image';
import type { LinkEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { linkEventService } from '../../services/linkEventService';
import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';

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
}

export default function LinkEventCard({ linkEvent, isAdmin = false, distance, onDelete, isPanelMode = false }: LinkEventCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [revealStep, setRevealStep] = useState(0); // 0: header, 1: +img/truncated, 2: +full

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
                className="p-4 md:p-6 pt-5 flex flex-col w-full relative cursor-pointer"
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

                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-black text-black dark:text-white leading-tight text-lg md:text-xl group-hover:text-primary transition-colors pr-10">
                        {linkEvent.title}
                    </h3>
                    {revealStep >= 1 && (
                        <button 
                            onClick={handleVisitSite}
                            className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black px-3 py-1.5 rounded shadow-lg animate-in fade-in zoom-in duration-300"
                        >
                            ANMÄL
                        </button>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-2">
                        <Clock size={14} className="text-primary" />
                        <span>{formatEventDate(linkEvent.time, linkEvent.hasSpecificTime !== false)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-primary" />
                        <span className="text-sm">{linkEvent.locationName}</span>
                    </div>
                </div>

                <div className="border-t border-border pt-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest shrink-0">Värd:</span>
                        <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-border overflow-hidden shrink-0">
                            {faviconUrl ? (
                                <img src={faviconUrl} alt="" className="w-4 h-4 object-contain" />
                            ) : (
                                <span className="font-bold text-[8px]">{linkEvent.hostName?.charAt(0).toUpperCase()}</span>
                            )}
                        </div>
                        <span className="text-xs font-black text-black dark:text-white truncate">{linkEvent.hostName || 'Okänd'}</span>
                    </div>

                    <div className="flex items-center shrink-0">
                        {attendeeCount > 0 && (
                            <div className="flex -space-x-2 overflow-hidden py-1">
                                {dummyAvatars.map((src, i) => (
                                    <div key={i} className="inline-block h-7 w-7 rounded-full ring-2 ring-card bg-slate-100 overflow-hidden border border-border/10">
                                        <img src={src} alt="" className="h-full w-full object-cover" />
                                    </div>
                                ))}
                                <div className="flex h-7 px-1.5 min-w-[28px] items-center justify-center rounded-full bg-slate-800 ring-2 ring-card text-[9px] font-black text-white shadow-lg">
                                    {attendeeCount > 2 ? `+${attendeeCount - 2}` : `+${attendeeCount}`}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Step 0 Peek: Small slice of the image at the bottom when collapsed */}
            {revealStep === 0 && (
                <div 
                    className="w-full h-12 relative cursor-pointer overflow-hidden border-t border-border/50 group-hover:h-16 transition-all duration-500"
                    onClick={handleHeaderClick}
                >
                    <Image unoptimized
                        src={coverSrc}
                        alt=""
                        fill
                        className="object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
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
                            <div className="mt-3 text-green-600 font-black flex items-center gap-1 text-[10px] uppercase tracking-widest">
                                <span>Läs hela beskrivningen</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        )}

                        {revealStep === 2 && (
                            <div className="mt-6 flex flex-col gap-4">
                                <button
                                    onClick={handleVisitSite}
                                    className="flex items-center justify-center gap-4 w-full py-4 bg-green-600 hover:bg-green-700 text-white text-lg md:text-xl font-black shadow-2xl transition-all active:scale-[0.97]"
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
