import { ExternalLink, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type { LinkEvent } from '../../types';
import type { EventCategoryType } from '../../utils/categories';
import { formatEventDate } from '../../utils/dateUtils';
import { linkEventService } from '../../services/linkEventService';
import { useState } from 'react';
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
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

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

    const handleToggleExpand = () => {
        const nextState = !isExpanded;
        setIsExpanded(nextState);
        if (!nextState) {
            // Återställ beskrivningen om kortet fälls ihop
            setIsDescriptionExpanded(false);
        }
    };

    // djb2 hash for better distribution than simple char summation
    const getHash = (str: string) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return Math.abs(hash);
    };

    const patternIndex = getHash(linkEvent.id || linkEvent.title || '') % ALL_PATTERNS.length;
    const coverSrc = linkEvent.coverImage || ALL_PATTERNS[patternIndex];
    const isCustomImage = !!linkEvent.coverImage;

    // Helper to get DuckDuckGo Favicon (more reliable than Google for some Swedish sites)
    const getFaviconUrl = (url: string) => {
        try {
            const domain = new URL(url).hostname;
            return `https://icons.duckduckgo.com/ip3/${domain}.ico`;
        } catch {
            return null; // Fallback to initial
        }
    };
    const faviconUrl = getFaviconUrl(linkEvent.url);

    return (
        <div 
            className="flex flex-col h-full cursor-pointer group"
            onClick={handleToggleExpand}
        >
            <div 
                className={`flex flex-col bg-card overflow-hidden w-full transition-all duration-300 ${isPanelMode ? 'rounded-t-3xl rounded-b-none border-0 shadow-none' : 'rounded-lg border border-border shadow-sm'}`}
            >
                {/* Admin Delete Button */}
                {isAdmin && (
                    <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="absolute top-3 right-3 z-50 opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg disabled:opacity-50"
                        title="Ta bort länk-event"
                    >
                        <Trash2 size={16} />
                    </button>
                )}

                {/* Compact Content Header */}
                <div className="flex flex-col p-5 pt-4">
                    {/* Title */}
                    <h3 className="font-bold text-black dark:text-white leading-tight mb-3 text-xl">
                        {linkEvent.title}
                    </h3>

                    {/* Info row: Time, Location, Distance, Price */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-5 text-xs font-medium text-black dark:text-white">
                        {/* Time */}
                        <div className="flex items-center gap-1.5">
                            <span>{formatEventDate(linkEvent.time, linkEvent.hasSpecificTime !== false)}</span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5">
                            <div className={`p-1 rounded ${linkEvent.isLocationVerified ? 'bg-green-100 text-green-700' : 'bg-muted/50 text-muted-foreground'}`}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={linkEvent.isLocationVerified ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                    <circle cx="12" cy="10" r="3" fill={linkEvent.isLocationVerified ? 'white' : 'none'} />
                                </svg>
                            </div>
                            <span className="flex-1 min-w-0 break-words">{linkEvent.locationName}</span>
                        </div>

                        {/* Distance */}
                        {distance !== undefined && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>•</span>
                                <span>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</span>
                            </div>
                        )}

                        {/* Price */}
                        {linkEvent.price !== undefined && linkEvent.price !== null && linkEvent.price !== '' && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                                <span>•</span>
                                <span>{linkEvent.price === 0 || String(linkEvent.price).toLowerCase() === 'gratis' ? 'Gratis' : `${linkEvent.price} kr`}</span>
                            </div>
                        )}
                    </div>

                    {/* Bottom Section */}
                    <div className="border-t border-border pt-4 flex items-center justify-between">
                        {/* Host Info */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider">
                                Värd
                            </span>
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium overflow-hidden border border-border bg-white">
                                    {faviconUrl ? (
                                        /* eslint-disable-next-line @next/next/no-img-element */
                                        <img src={faviconUrl} alt={linkEvent.hostName} className="w-4 h-4 object-contain" />
                                    ) : (
                                        linkEvent.hostName?.charAt(0).toUpperCase() || '?'
                                    )}
                                </div>
                                <span className="text-xs font-medium text-black dark:text-white">
                                    {linkEvent.hostName || 'Okänd'}
                                </span>
                            </div>
                        </div>

                        {/* Attendees / Vilka som kommer */}
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider mr-1">
                                Kommer
                            </span>
                            <div className="flex -space-x-1.5">
                                {/* Mock Avatars */}
                                {[...Array(Math.min(3, ((linkEvent as any).attendees || 3)))].map((_, i) => (
                                    <div key={i} className={`w-6 h-6 rounded-full border border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${['bg-green-500', 'bg-emerald-400', 'bg-teal-500'][i]}`}>
                                        {['A', 'J', 'M'][i]}
                                    </div>
                                ))}
                                {((linkEvent as any).attendees || 0) > 3 && (
                                    <div className="w-6 h-6 rounded-full border border-white dark:border-slate-900 bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[8px] font-bold text-gray-600 dark:text-gray-300 shadow-sm z-10">
                                        +{(linkEvent as any).attendees - 3}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Expanded Accordion Content */}
                {isExpanded && (
                    <div 
                        className="px-5 pb-5 flex flex-col gap-4 animate-in slide-in-from-top-4 fade-in duration-300 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Image */}
                        <div className="relative w-full h-32 overflow-hidden bg-muted/50 rounded-md">
                            <Image unoptimized
                                src={coverSrc}
                                alt=""
                                fill
                                sizes="(max-width: 768px) 100vw, 300px"
                                className={`object-cover ${!isCustomImage ? 'opacity-40 grayscale' : 'opacity-100'}`}
                                aria-hidden="true"
                            />
                        </div>

                        {/* Description */}
                        <div className="flex flex-col items-start max-w-full overflow-hidden">
                            <p className={`text-sm text-muted-foreground whitespace-pre-wrap break-words leading-relaxed ${isDescriptionExpanded ? '' : 'line-clamp-3'}`}>
                                {(linkEvent as any).description || 'Ingen beskrivning tillgänglig för detta event.'}
                            </p>
                            {/* Visa mer knapp */}
                            {(linkEvent as any).description && (
                                <button 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setIsDescriptionExpanded(!isDescriptionExpanded);
                                    }}
                                    className="text-xs font-semibold text-green-600 mt-2 hover:text-green-700 hover:underline transition-colors"
                                >
                                    {isDescriptionExpanded ? 'Visa mindre' : 'Visa mer...'}
                                </button>
                            )}
                        </div>

                        {/* Visit Site Button */}
                        <button
                            onClick={handleVisitSite}
                            className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-md transition-all active:scale-[0.98]"
                        >
                            <span>Anmäl</span>
                            <ExternalLink size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
