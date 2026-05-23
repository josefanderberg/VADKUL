import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import type { AppEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { calculateDistance, loadLocationFromLocalStorage } from '../../utils/mapUtils';
import { EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';
import { MapPin, CheckCircle2, Star, Clock, ArrowRight } from 'lucide-react';
import { useState, useEffect } from 'react';

import { useAuth } from '../../context/AuthContext';

interface EventCardProps {
    event: AppEvent;
    compact?: boolean;
}

export default function EventCard({ event, compact = false }: EventCardProps) {
    const router = useRouter();
    const { user } = useAuth();
    const [revealStep, setRevealStep] = useState(0);

    const category = EVENT_CATEGORIES[event.type as EventCategoryType] || EVENT_CATEGORIES.other;
    const rawCoverImage = event.coverImage || category.defaultImage;
    const coverImage = typeof rawCoverImage === 'string' ? rawCoverImage : rawCoverImage.src;

    const [distance, setDistance] = useState<number | null>(null);
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

    const handleHeaderClick = () => {
        setRevealStep(prev => prev === 0 ? 1 : 0);
    };

    const handleContentClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setRevealStep(prev => prev === 1 ? 2 : 1);
    };

    return (
        <div className="w-full bg-card border-b border-border flex flex-col group">
            {/* 1. Header (Always visible) */}
            <div 
                className="p-4 md:p-6 pt-5 flex flex-col w-full relative cursor-pointer"
                onClick={handleHeaderClick}
            >
                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-black text-black dark:text-white leading-tight text-lg md:text-xl group-hover:text-primary transition-colors pr-10">
                        {event.title}
                    </h3>
                    {revealStep >= 1 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); router.push(`/event/${event.id}`); }}
                            className="shrink-0 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black px-3 py-1.5 rounded shadow-lg animate-in fade-in zoom-in duration-300"
                        >
                            GÅ TILL
                        </button>
                    )}
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

            {/* Step 0 Peek: Small slice of the image at the bottom when collapsed */}
            {revealStep === 0 && (
                <div 
                    className="w-full h-12 relative cursor-pointer overflow-hidden border-t border-border/50 group-hover:h-16 transition-all duration-500"
                    onClick={handleHeaderClick}
                >
                    <Image unoptimized
                        src={coverImage}
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
                            src={coverImage}
                            alt={event.title}
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
                            {event.description || 'Ingen beskrivning tillgänglig.'}
                        </p>
                        
                        {revealStep === 1 && event.description && (
                            <div className="mt-3 text-green-600 font-black flex items-center gap-1 text-[10px] uppercase tracking-widest">
                                <span>Läs hela beskrivningen</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                            </div>
                        )}

                        {revealStep === 2 && (
                            <div className="mt-6 flex flex-col gap-4">
                                <button
                                    onClick={() => router.push(`/event/${event.id}`)}
                                    className="flex items-center justify-center gap-4 w-full py-4 bg-green-600 hover:bg-green-700 text-white text-lg md:text-xl font-black shadow-2xl transition-all active:scale-[0.97]"
                                >
                                    <span>GÅ TILL EVENT</span>
                                    <ArrowRight size={24} />
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