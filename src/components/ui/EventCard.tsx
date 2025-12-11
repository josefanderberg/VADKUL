import { Link, useNavigate } from 'react-router-dom';
import type { AppEvent } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { calculateDistance, loadLocationFromLocalStorage } from '../../utils/mapUtils';
import { EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';
import { MapPin, CheckCircle2, Star, Clock, ArrowRight } from 'lucide-react';
import { useMemo } from 'react';

interface EventCardProps {
    event: AppEvent;
    compact?: boolean;
}

export default function EventCard({ event, compact = false }: EventCardProps) {
    const navigate = useNavigate();

    // --- DATA ---
    const category = EVENT_CATEGORIES[event.type as EventCategoryType] || EVENT_CATEGORIES.other;
    const emoji = category.emoji;

    // Bild-logik (prioritera eventets bild, annars kategori-default)
    const coverImage = event.coverImage || category.defaultImage;

    // --- DISTANS BERÄKNING (NYTT) ---
    const distance = useMemo(() => {
        const userLoc = loadLocationFromLocalStorage();
        if (userLoc && event.lat && event.lng) {
            return calculateDistance(userLoc.lat, userLoc.lng, event.lat, event.lng);
        }
        return null;
    }, [event.lat, event.lng]);

    const formatDistance = (d: number) => {
        if (d < 1) return `${Math.round(d * 1000)} m`;
        return `${d.toFixed(1)} km`;
    };

    // --- STATUS LOGIK ---
    const currentCount = event.attendees.length;
    const spotsLeft = event.maxParticipants - currentCount;
    const isFull = currentCount >= event.maxParticipants;
    const isGuaranteed = currentCount >= event.minParticipants;

    // --- DELTAGAR LOGIK ---
    const visibleAttendees = event.attendees.slice(0, 3);
    const hiddenCount = event.attendees.length - visibleAttendees.length;

    // --- TICKET STYLING VARIABLES ---
    const notchSize = 12; // px
    const imageHeight = compact ? 80 : 96; // h-20 (80px) vs h-24 (96px)

    const ticketStyle: React.CSSProperties = {
        maskImage: `radial-gradient(circle ${notchSize}px at 0 ${imageHeight}px, transparent ${notchSize - 1}px, black ${notchSize}px), radial-gradient(circle ${notchSize}px at 100% ${imageHeight}px, transparent ${notchSize - 1}px, black ${notchSize}px)`,
        maskPosition: '0 0, 100% 0',
        maskSize: '51% 100%',
        maskRepeat: 'no-repeat',
        WebkitMaskImage: `radial-gradient(circle ${notchSize}px at 0 ${imageHeight}px, transparent ${notchSize - 1}px, black ${notchSize}px), radial-gradient(circle ${notchSize}px at 100% ${imageHeight}px, transparent ${notchSize - 1}px, black ${notchSize}px)`,
        WebkitMaskPosition: '0 0, 100% 0',
        WebkitMaskSize: '51% 100%',
        WebkitMaskRepeat: 'no-repeat',
    };

    return (
        <Link to={`/event/${event.id}`} className="block h-full group relative">
            <div
                className="relative flex flex-col h-full transition-transform duration-300 hover:-translate-y-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:drop-shadow-[0_8px_16px_rgba(0,0,0,0.12)]"
                style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }}
            >
                {/* The Ticket Itself (Masked) */}
                <div
                    className="flex flex-col h-full bg-card overflow-hidden"
                    style={ticketStyle}
                >
                    {/* --- OMSLAGSBILD --- */}
                    <div className={`relative w-full bg-muted overflow-hidden ${compact ? 'h-20' : 'h-24'}`}>
                        {/* Bilden */}
                        <img
                            src={coverImage}
                            alt={event.title}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>

                        {/* Kategori Badge */}
                        <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-md backdrop-blur-md bg-white/90 text-slate-900`}>
                            <span className="text-sm">{emoji}</span>
                            {category.label}
                        </div>

                        {/* Datum Badge */}
                        <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md text-slate-900 font-bold px-2 py-1 rounded-lg text-xs shadow-sm flex flex-col items-center leading-tight">
                            <span className="text-[9px] uppercase text-red-500">{event.time.toLocaleDateString('sv-SE', { month: 'short' })}</span>
                            <span className="text-lg">{event.time.getDate()}</span>
                        </div>
                    </div>

                    {/* --- PERFORATION LINE --- */}
                    <div className="relative w-full px-2" style={{ marginTop: -1 }}>
                        <div className="w-full border-t-2 border-dashed border-border opacity-50"></div>
                    </div>

                    {/* --- CONTENT --- */}
                    <div className={`flex flex-col flex-1 ${compact ? 'p-3' : 'p-5'} pt-4`}>
                        <h3 className={`font-bold text-card-foreground leading-tight mb-3 group-hover:text-primary transition-colors line-clamp-2 ${compact ? 'text-base' : 'text-lg'}`}>
                            {event.title}
                        </h3>

                        {/* --- INFO --- */}
                        <div className="space-y-2 mb-5">
                            <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                <div className={`p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 ${category.iconColor}`}>
                                    <Clock size={14} strokeWidth={2.5} />
                                </div>
                                <span>{formatTime(event.time)}</span>
                            </div>

                            <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                                <div className={`p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 ${category.iconColor}`}>
                                    <MapPin size={14} strokeWidth={2.5} />
                                </div>
                                <div className="flex items-center justify-between flex-1 min-w-0">
                                    <div className="flex items-center gap-1 overflow-hidden">
                                        <span className="truncate">{event.location.name}</span>
                                        {distance !== null && (
                                            <span className="shrink-0 text-[10px] text-muted-foreground/80 font-normal">
                                                • {formatDistance(distance)} bort
                                            </span>
                                        )}
                                    </div>
                                    {isGuaranteed ? (
                                        <div className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 rounded-md ml-2">
                                            <CheckCircle2 size={10} strokeWidth={3} />
                                            <span>Blir av!</span>
                                        </div>
                                    ) : (
                                        spotsLeft > 0 && (
                                            (event.minParticipants - currentCount) <= 0 ? (
                                                <div className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2 py-0.5 rounded-md ml-2">
                                                    <CheckCircle2 size={10} strokeWidth={3} />
                                                    <span>Blir av!</span>
                                                </div>
                                            ) : (event.minParticipants - currentCount) === 1 ? (
                                                <div className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-300 px-2 py-0.5 rounded-md ml-2">
                                                    <Clock size={10} strokeWidth={3} />
                                                    <span>Söker 1 till!</span>
                                                </div>
                                            ) : (
                                                <div className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-100 dark:bg-orange-500/20 dark:text-orange-300 px-2 py-0.5 rounded-md ml-2">
                                                    <Clock size={10} strokeWidth={3} />
                                                    <span>Söker {event.minParticipants - currentCount} till</span>
                                                </div>
                                            )
                                        )
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* --- BOTTOM SECTION --- */}
                        <div className="mt-auto border-t border-border pt-4 flex items-end justify-between">

                            {/* VÄNSTER: Värd Info */}
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Värd</span>
                                <div
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (event.host.uid) navigate(`/public-profile/${event.host.uid}`);
                                    }}
                                    className="flex items-center gap-2 cursor-pointer group/host"
                                >
                                    {event.host.photoURL ? (
                                        <img src={event.host.photoURL} alt={event.host.name} className="w-6 h-6 rounded-full object-cover ring-1 ring-border" />
                                    ) : (
                                        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                                            {event.host.initials}
                                        </div>
                                    )}
                                    <span className="text-xs font-semibold text-foreground group-hover/host:text-primary transition-colors">
                                        {event.host.name.split(' ')[0]}
                                    </span>
                                    <div className="flex items-center text-[10px] text-amber-500 bg-amber-500/15 dark:bg-amber-500/20 px-1 rounded">
                                        <Star size={8} fill="currentColor" className="mr-0.5" />
                                        {event.host.rating.toFixed(1)}
                                    </div>
                                </div>
                            </div>

                            {/* HÖGER: Deltagare */}
                            <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] font-bold text-muted-foreground/70">
                                    {isFull ? 'Fullbokat' : `${spotsLeft} platser kvar`}
                                </span>

                                <div className="flex items-center pl-2">
                                    <div className="flex -space-x-2">
                                        {visibleAttendees.map((attendee, i) => (
                                            <div key={i} className="relative z-10 hover:z-20 transition-transform hover:scale-110">
                                                {attendee.photoURL ? (
                                                    <img
                                                        src={attendee.photoURL}
                                                        alt={attendee.displayName}
                                                        className="w-7 h-7 rounded-full object-cover ring-2 ring-card bg-muted"
                                                        title={attendee.displayName}
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-7 h-7 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-bold text-muted-foreground cursor-default"
                                                        title={attendee.displayName}
                                                    >
                                                        {attendee.displayName?.charAt(0).toUpperCase() || '?'}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        {hiddenCount > 0 && (
                                            <div className="w-7 h-7 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-bold text-muted-foreground z-0">
                                                +{hiddenCount}
                                            </div>
                                        )}

                                        {event.attendees.length === 0 && (
                                            <span className="text-xs text-muted-foreground/60 italic pr-1">Bli först!</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Hover Arrow */}
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 translate-x-3 group-hover:translate-x-0 transition-all duration-300">
                            <ArrowRight size={20} className="text-primary" />
                        </div>

                    </div>
                </div>
            </div>
        </Link>
    );
}