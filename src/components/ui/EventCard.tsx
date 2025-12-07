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
  const getCategoryStyles = (id: string) => {
      switch(id) {
          // Social & Mingel
          case 'social': return { badge: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30', icon: 'text-amber-500' };
          case 'party': return { badge: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/30', icon: 'text-indigo-500' };
          case 'mingle': return { badge: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-500/30', icon: 'text-teal-500' };
          case 'movie': return { badge: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/30', icon: 'text-cyan-500' };

          // Aktiviteter
          case 'game': return { badge: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/30', icon: 'text-purple-500' };
          case 'sport': return { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30', icon: 'text-emerald-500' };
          case 'food': return { badge: 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/20 dark:text-pink-300 dark:border-pink-500/30', icon: 'text-pink-500' };
          case 'outdoor': return { badge: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30', icon: 'text-green-500' };
          case 'creative': return { badge: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30', icon: 'text-orange-500' };
          case 'culture': return { badge: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-500/30', icon: 'text-fuchsia-500' };

          // Akademiskt
          case 'study': return { badge: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30', icon: 'text-blue-500' };
          case 'campus': return { badge: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30', icon: 'text-red-500' };
          case 'workshop': return { badge: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30', icon: 'text-sky-500' };

          // Övrigt
          case 'market': return { badge: 'bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-500/20 dark:text-lime-300 dark:border-lime-500/30', icon: 'text-lime-600' };
          case 'other': 
          default:
            return { badge: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/30', icon: 'text-slate-500' };
      }
  };

  const styles = getCategoryStyles(category.id);

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
            <div className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide flex items-center gap-1.5 border ${styles.badge}`}>
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
                <div className={`p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 ${styles.icon}`}>
                    <Clock size={14} strokeWidth={2.5} />
                </div>
                <span>{formatTime(event.time)}</span>
            </div>
            
            <div className="flex items-center gap-2.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <div className={`p-1 rounded-md bg-slate-50 dark:bg-slate-700/50 ${styles.icon}`}>
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