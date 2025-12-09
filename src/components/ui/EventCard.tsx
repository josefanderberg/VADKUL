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
}

export default function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();

  // --- DATA ---
  const category = EVENT_CATEGORIES[event.type as EventCategoryType] || EVENT_CATEGORIES.other;
  const emoji = category.emoji;
  
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
  
  // --- FÄRGER ---
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
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] border border-slate-100 dark:border-slate-700 flex flex-col h-full transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-slate-200 dark:hover:border-slate-600">
        
        {/* --- TOP: Kategori & Status --- */}
        <div className="flex justify-between items-start mb-3">
        <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 border ${category.badgeStyle}`}>
                <span className="text-sm">{emoji}</span>
                {category.label}
            </div>

            {isGuaranteed ? (
                <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20 px-2 py-1 rounded-full border border-emerald-500/20 dark:border-emerald-500/30">
                    <CheckCircle2 size={10} strokeWidth={3} />
                    <span>Garanterat</span>
                </div>
            ) : (
                <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/15 dark:bg-amber-500/20 px-2 py-1 rounded-full border border-amber-500/20 dark:border-amber-500/30">
                    <span>{event.minParticipants - currentCount} till behövs</span>
                </div>
            )}
        </div>

        {/* --- TITEL --- */}
        <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight mb-3 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
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
            <ArrowRight size={60} className="text-indigo-600 dark:text-white" />
        </div>

      </div>
    </Link>
  );
}