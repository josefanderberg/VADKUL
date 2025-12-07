// src/components/ui/EventCard.tsx
import { Link, useNavigate } from 'react-router-dom';
import type { AppEvent } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { getEventEmoji, getEventColor } from '../../utils/mapUtils';
import { MapPin, CheckCircle2, Star, Clock, Users, ArrowRight } from 'lucide-react';

interface EventCardProps {
  event: AppEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();

  // Beräkna status
  const currentCount = event.attendees.length;
  const isFull = currentCount >= event.maxParticipants;
  const isGuaranteed = currentCount >= event.minParticipants;
  const percentFull = Math.min(100, (currentCount / event.maxParticipants) * 100);
  
  // Hämta styling
  const emoji = getEventEmoji(event.type);
  // Vi hämtar färgen men gör den lite subtilare för text
  const colorClasses = getEventColor(event.type); 
  const colorBase = colorClasses.split(' ')[0].split('-')[1]; // t.ex. "green"
  const avatarBgClass = `bg-${colorBase}-500`;
  const iconColorClass = `text-${colorBase}-600 dark:text-${colorBase}-400`;

  // Enkel mappning för kategorinamn på svenska (om du inte har en utility för detta)
  const categoryNames: Record<string, string> = {
    sports: 'Sport',
    food: 'Mat & Dryck',
    culture: 'Kultur',
    outdoor: 'Utomhus',
    social: 'Socialt',
    gaming: 'Spel',
    other: 'Övrigt'
    // Lägg till fler vid behov
  };
  const categoryName = categoryNames[event.type] || event.type.charAt(0).toUpperCase() + event.type.slice(1);

  // Ålderslogik
  let ageText = "Alla åldrar";
  if (event.minAge > 0) {
      if (event.maxAge < 99) ageText = `${event.minAge}–${event.maxAge} år`;
      else ageText = `${event.minAge}+ år`;
  }

  return (
    <Link to={`/event/${event.id}`} className="block h-full group">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 relative flex flex-col h-full transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-slate-200 dark:hover:border-slate-600">
        
        {/* --- HEADER: Host & Status (Oförändrad layout-mässigt men polerad) --- */}
        <div className="flex justify-between items-start mb-4">
          {/* Värd */}
          <div 
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (event.host.uid) navigate(`/profile/${event.host.uid}`);
            }}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <div className={`w-9 h-9 rounded-full ${avatarBgClass} flex items-center justify-center text-xs font-bold text-white shadow-sm ring-2 ring-white dark:ring-slate-800`}>
              {event.host.initials}
            </div>
            <div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-none block">
                {event.host.name.split(' ')[0]}
              </span>
              <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                <span className="text-amber-500 flex items-center gap-0.5 mr-1.5">
                  {event.host.rating.toFixed(1)} <Star size={8} fill="currentColor" />
                </span>
                {event.host.verified && (
                   <span className="flex items-center gap-0.5 text-slate-400">
                     <CheckCircle2 size={10} className="text-green-500" />
                     Verifierad
                   </span>
                )}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {isGuaranteed ? (
            <div className="text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full flex items-center gap-1 border border-emerald-100 dark:border-emerald-800">
               <CheckCircle2 size={11} />
               Garanterat
           </div>
          ) : (
            <div className="text-[10px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full border border-amber-100 dark:border-amber-800">
               Söker {event.minParticipants - currentCount} till
           </div>
          )}
        </div>

        {/* --- TITEL --- */}
        <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-snug mb-3 pr-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
            {event.title}
        </h3>

        {/* --- GRID: 2 Kolumner --- */}
        <div className="grid grid-cols-[1.5fr_1fr] gap-4 mb-4">
            
            {/* VÄNSTER: Info (Kategori, Tid, Plats) */}
            <div className="flex flex-col gap-2.5">
                {/* Kategori */}
                <div className={`flex items-center gap-2 text-xs font-semibold ${iconColorClass}`}>
                    <span className="text-sm filter drop-shadow-sm">{emoji}</span>
                    <span>{categoryName}</span>
                </div>

                {/* Tid */}
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Clock size={14} className="text-slate-400 shrink-0" />
                    <span>{formatTime(event.time)}</span>
                </div>

                {/* Plats */}
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <MapPin size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">{event.location.name}</span>
                </div>
            </div>

            {/* HÖGER: Taggar (Pris, Ålder) */}
            <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-md text-right w-fit ${
                    event.price > 0 
                    ? 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200' 
                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                    {event.price > 0 ? `${event.price} kr` : 'Gratis'}
                </span>
                
                <span className="text-[10px] font-medium px-2.5 py-1 rounded-md bg-slate-50 text-slate-500 border border-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-right w-fit whitespace-nowrap">
                    {ageText}
                </span>
            </div>
        </div>

        {/* --- FOOTER: Progress & Deltagare --- */}
        <div className="mt-auto pt-3 border-t border-slate-50 dark:border-slate-700">
            <div className="flex justify-between items-end mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                    <Users size={14} />
                    <span>
                        <b className="text-slate-900 dark:text-white">{currentCount}</b>
                        <span className="text-slate-400">/{event.maxParticipants}</span>
                    </span>
                </div>
                
                {/* "Läs mer" indikator (Visas vid hover) */}
                <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-[-10px] group-hover:translate-x-0">
                    Gå till event <ArrowRight size={12} />
                </div>
            </div>

            {/* Slimmad Progress Bar */}
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div 
                    className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${percentFull}%` }} 
                />
            </div>
        </div>

      </div>
    </Link>
  );
}