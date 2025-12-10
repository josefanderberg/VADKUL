// src/components/ui/EventCard.tsx

import { Link, useNavigate } from 'react-router-dom';
import type { AppEvent } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { calculateDistance, loadLocationFromLocalStorage } from '../../utils/mapUtils'; // <--- NYTT
import { EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';
import { MapPin, CheckCircle2, Star, Clock, ArrowRight } from 'lucide-react';
import { useMemo } from 'react'; // <--- NYTT (valfritt, för prestanda)

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

    return (
        <Link to={`/event/${event.id}`} className="block h-full group relative">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-slate-200 dark:hover:border-slate-600 overflow-hidden">

                {/* --- NYTT: OMSLAGSBILD --- */}
                <div className={`relative w-full bg-slate-100 dark:bg-slate-700 overflow-hidden transition-all ${compact ? 'h-24' : 'h-40'}`}>
                    {/* Bilden */}
                    <img
                        src={coverImage}
                        alt={event.title}
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Overlay Gradient för läsbarhet */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>

                    {/* Kategori Badge Top Left */}
                    <div className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide flex items-center gap-1.5 shadow-md backdrop-blur-md bg-white/90 text-slate-800`}>
                        <span className="text-sm">{emoji}</span>
                        {category.label}
                    </div>

                    {/* Status Badge Top Right */}
                    {isGuaranteed ? (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500/90 backdrop-blur-md px-2 py-1 rounded-full shadow-sm">
                            <CheckCircle2 size={10} strokeWidth={3} />
                            <span>Blir av!</span>
                        </div>
                    ) : (
                        spotsLeft > 0 && (
                            (event.minParticipants - currentCount) <= 0 ? (
                                // Borde vara garanterad, men för säkerhets skull
                                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500/90 backdrop-blur-md px-2 py-1 rounded-full shadow-sm">
                                    <CheckCircle2 size={10} strokeWidth={3} />
                                    <span>Blir av!</span>
                                </div>
                            ) : (event.minParticipants - currentCount) === 1 ? (
                                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-white bg-amber-400/90 backdrop-blur-md px-2 py-1 rounded-full shadow-sm">
                                    <Clock size={10} strokeWidth={3} />
                                    <span>Söker 1 till!</span>
                                </div>
                            ) : (
                                <div className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold text-white bg-orange-500/90 backdrop-blur-md px-2 py-1 rounded-full shadow-sm">
                                    <Clock size={10} strokeWidth={3} />
                                    <span>Söker {event.minParticipants - currentCount} till</span>
                                </div>
                            )
                        )
                    )}

                    {/* Datum Badge Bottom Right */}
                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-md text-slate-900 font-bold px-2 py-1 rounded-lg text-xs shadow-sm flex flex-col items-center leading-tight">
                        <span className="text-[9px] uppercase text-red-500">{event.time.toLocaleDateString('sv-SE', { month: 'short' })}</span>
                        <span className="text-lg">{event.time.getDate()}</span>
                    </div>
                </div>

                {/* --- CONTENT START --- */}
                <div className={`flex flex-col flex-1 ${compact ? 'p-3' : 'p-5'}`}>

                    {/* --- TITEL --- */}
                    <h3 className={`font-bold text-slate-900 dark:text-white leading-tight mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 ${compact ? 'text-base' : 'text-lg'}`}>
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
                            {/* UPPDATERAD PLATSVISNING MED DISTANS */}
                            <div className="flex items-center gap-1 overflow-hidden">
                                <span className="truncate">{event.location.name}</span>
                                {distance !== null && (
                                    <span className="shrink-0 text-[10px] text-slate-400 font-normal">
                                        • {formatDistance(distance)} bort
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* --- BOTTOM SECTION --- */}
                    <div className="mt-auto border-t border-slate-100 dark:border-slate-700 pt-4 flex items-end justify-between">

                        {/* VÄNSTER: Värd Info */}
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Värd</span>
                            <div
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (event.host.uid) navigate(`/profile/${event.host.uid}`);
                                }}
                                className="flex items-center gap-2 cursor-pointer group/host"
                            >
                                {event.host.photoURL ? (
                                    <img src={event.host.photoURL} alt={event.host.name} className="w-6 h-6 rounded-full object-cover ring-1 ring-slate-100 dark:ring-slate-600" />
                                ) : (
                                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] font-bold text-slate-500">
                                        {event.host.initials}
                                    </div>
                                )}
                                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 group-hover/host:text-indigo-600 transition-colors">
                                    {event.host.name.split(' ')[0]}
                                </span>
                                <div className="flex items-center text-[10px] text-amber-500 bg-amber-500/15 dark:bg-amber-500/20 px-1 rounded">
                                    <Star size={8} fill="currentColor" className="mr-0.5" />
                                    {event.host.rating.toFixed(1)}
                                </div>
                            </div>
                        </div>

                        {/* HÖGER: Deltagare (De som anmält sig) */}
                        <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold text-slate-400">
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
                                                    className="w-7 h-7 rounded-full object-cover ring-2 ring-white dark:ring-slate-800 bg-slate-100"
                                                    title={attendee.displayName}
                                                />
                                            ) : (
                                                <div
                                                    className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-600 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 cursor-default"
                                                    title={attendee.displayName}
                                                >
                                                    {attendee.displayName?.charAt(0).toUpperCase() || '?'}
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {hiddenCount > 0 && (
                                        <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 ring-2 ring-white dark:ring-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-500 z-0">
                                            +{hiddenCount}
                                        </div>
                                    )}

                                    {event.attendees.length === 0 && (
                                        <span className="text-xs text-slate-400 italic pr-1">Bli först!</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Hover Arrow */}
                    <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-10 translate-x-2 group-hover:translate-x-0 transition-all duration-300">
                        <ArrowRight size={20} className="text-indigo-600 dark:text-white" />
                    </div>

                </div>
            </div> {/* Closes the "p-5 flex flex-col flex-1" div */}
        </Link>
    );
}