import Image from 'next/image';
import type { AppEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { calculateDistance, loadLocationFromLocalStorage } from '../../utils/mapUtils';
import { EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';
import { MapPin, CheckCircle2, Clock, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';
import { EventBottomSheet } from './EventBottomSheet';

interface EventCardProps {
    event: AppEvent;
    compact?: boolean;
}

export default function EventCard({ event, compact = false }: EventCardProps) {
    const [isSheetOpen, setIsSheetOpen] = useState(false);
    const [distance, setDistance] = useState<number | null>(null);

    const category = EVENT_CATEGORIES[event.type as EventCategoryType] || EVENT_CATEGORIES.other;
    const rawCoverImage = event.coverImage || category.defaultImage;
    const coverImage = typeof rawCoverImage === 'string' ? rawCoverImage : rawCoverImage.src;

    useEffect(() => {
        const userLoc = loadLocationFromLocalStorage();
        if (userLoc && event.lat && event.lng) {
            setDistance(calculateDistance(userLoc.lat, userLoc.lng, event.lat, event.lng));
        }
    }, [event.lat, event.lng]);

    const formatDistance = (d: number) => {
        if (d < 1) return `${Math.round(d * 1000)} m`;
        return `${d.toFixed(1)} km`;
    };

    const confirmedAttendees = event.attendees.filter(a => a.status !== 'pending');
    const spotsLeft = event.maxParticipants - confirmedAttendees.length;
    const isFull = confirmedAttendees.length >= event.maxParticipants;
    const isGuaranteed = confirmedAttendees.length >= event.minParticipants;

    return (
        <>
            {/* Card in list — always compact, click to open sheet */}
            <div
                className="w-full bg-card border-b border-border flex flex-col group cursor-pointer"
                onClick={() => setIsSheetOpen(true)}
            >
                {/* Header */}
                <div className="p-4 md:p-6 pt-5 flex flex-col w-full relative">
                    <div className="flex justify-between items-start mb-3">
                        <h3 className="font-black text-black dark:text-white leading-tight text-lg md:text-xl group-hover:text-primary transition-colors pr-2">
                            {event.title}
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs font-bold text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                            <Clock size={14} className="text-primary" />
                            <span>{formatEventDate(event.time, (event as any).hasSpecificTime !== false)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-primary" />
                            <span className="text-sm">{event.location.name}</span>
                            {distance !== null && (
                                <span className="text-[10px] text-muted-foreground font-normal">• {formatDistance(distance)} bort</span>
                            )}
                        </div>
                        {isGuaranteed && (
                            <div className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                                <CheckCircle2 size={9} strokeWidth={3} />
                                <span>Blir av!</span>
                            </div>
                        )}
                    </div>

                    {/* Host + attendees row */}
                    <div className="border-t border-border pt-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest shrink-0">Värd:</span>
                            <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center border border-border overflow-hidden shrink-0">
                                {event.host.photoURL ? (
                                    <img src={event.host.photoURL} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="font-bold text-[8px]">{event.host.initials}</span>
                                )}
                            </div>
                            <span className="text-xs font-black text-black dark:text-white truncate">{event.host.name}</span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Status</span>
                                <span className="text-[10px] font-bold text-slate-600 leading-none mt-0.5">{isFull ? 'Fullt' : `${spotsLeft} kvar`}</span>
                            </div>

                            <div className="flex -space-x-2 overflow-hidden py-1">
                                {(event.attendees || []).slice(0, 4).map((attendee, i) => (
                                    <div key={i} className="inline-block h-7 w-7 rounded-full ring-2 ring-card bg-slate-100 overflow-hidden border border-border/10">
                                        {attendee.photoURL ? (
                                            <img src={attendee.photoURL} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-[9px] font-bold bg-slate-200 text-slate-600">
                                                {attendee.displayName?.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(event.attendees || []).length > 4 && (
                                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 ring-2 ring-card text-[9px] font-bold text-white">
                                        +{(event.attendees || []).length - 4}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Image peek strip — always shows, invites tap */}
                <div className="w-full h-14 relative overflow-hidden border-t border-border/50 group-hover:h-20 transition-all duration-500">
                    <Image
                        unoptimized
                        src={coverImage}
                        alt=""
                        fill
                        className="object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                    {/* Tap hint */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="flex items-center gap-1 bg-black/50 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full backdrop-blur-sm">
                            <ChevronDown size={10} />
                            <span>Visa mer</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom sheet overlay */}
            <EventBottomSheet
                event={isSheetOpen ? event : null}
                onClose={() => setIsSheetOpen(false)}
            />
        </>
    );
}