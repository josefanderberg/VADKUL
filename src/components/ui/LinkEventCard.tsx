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
    onDelete?: () => void;
}

export default function LinkEventCard({ linkEvent, isAdmin = false, onDelete }: LinkEventCardProps) {
    const [isDeleting, setIsDeleting] = useState(false);

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

    // djb2 hash for better distribution than simple char summation
    const getHash = (str: string) => {
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
        }
        return Math.abs(hash);
    };

    const patternIndex = getHash(linkEvent.id || linkEvent.title || '') % ALL_PATTERNS.length;
    const coverSrc = ALL_PATTERNS[patternIndex];

    return (
        <div className="block h-full group relative">
            <div className="relative flex flex-col h-full">
                {/* The Card Itself — solid background for maximum contrast */}
                <div className="flex flex-col h-full bg-card overflow-hidden rounded-lg border border-border shadow-sm">

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

                    {/* ── Header: decorative pattern (grayscale look) ── */}
                    <div className="relative w-full h-24 overflow-hidden bg-muted/50">
                        {/* Pattern background — forced grayscale per user request */}
                        <Image
                            src={coverSrc}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 100vw, 300px"
                            className="object-cover opacity-60 grayscale contrast-125"
                            style={{ filter: 'saturate(0)' }}
                            aria-hidden="true"
                        />

                        {/* "Externt Event" badge */}
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded text-[10px] font-medium uppercase tracking-wide flex items-center gap-1.5 bg-black/30 text-white backdrop-blur-sm">
                            <ExternalLink size={12} />
                            Externt Event
                        </div>

                        {/* Date badge */}
                        <div className="absolute bottom-3 right-3 bg-black/30 backdrop-blur-sm text-white font-medium px-2 py-1 rounded text-xs flex flex-col items-center leading-tight">
                            <span className="text-[9px] uppercase opacity-80">
                                {linkEvent.time.toLocaleDateString('sv-SE', { month: 'short' })}
                            </span>
                            <span className="text-lg">{linkEvent.time.getDate()}</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex flex-col flex-1 p-5 pt-4">
                        {/* Title — white in dark mode, black in light mode */}
                        <h3 className="font-bold text-black dark:text-white leading-tight mb-3 line-clamp-2 text-lg">
                            {linkEvent.title}
                        </h3>

                        {/* Info rows */}
                        <div className="space-y-2 mb-5">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-black dark:text-white">
                                <div className="p-1 rounded bg-muted/50">
                                    <ExternalLink size={14} strokeWidth={2} />
                                </div>
                                <span>{formatEventDate(linkEvent.time)}</span>
                            </div>

                            {/* Location */}
                            <div className="flex items-center gap-2.5 text-xs font-medium text-black dark:text-white">
                                <div className="p-1 rounded bg-muted/50">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                </div>
                                <span className="truncate">{linkEvent.locationName}</span>
                            </div>
                        </div>

                        {/* Bottom Section */}
                        <div className="mt-auto border-t border-border pt-4 flex items-center justify-between">
                            {/* Host Info */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 tracking-wider">
                                    Värd
                                </span>
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                                        {linkEvent.hostName?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <span className="text-xs font-medium text-black dark:text-white">
                                        {linkEvent.hostName || 'Okänd'}
                                    </span>
                                </div>
                            </div>

                            {/* Visit Site Button */}
                            <button
                                onClick={handleVisitSite}
                                className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 text-black dark:text-white font-medium rounded text-sm border border-border"
                            >
                                <span>Gå till sida</span>
                                <ExternalLink size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
