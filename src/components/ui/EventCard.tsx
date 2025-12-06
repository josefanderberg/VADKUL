// src/components/ui/EventCard.tsx
import { Link, useNavigate } from 'react-router-dom';
import type { AppEvent } from '../../types';
import { formatTime } from '../../utils/dateUtils';
import { getEventEmoji, getEventColor } from '../../utils/mapUtils';
import { MapPin, CheckCircle2, Star, Clock } from 'lucide-react';

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
  const colorClasses = getEventColor(event.type).replace('bg-', 'bg-').replace('text-', 'text-'); 

  // Ålderslogik
  let ageText = "Alla";
  if (event.minAge > 0) {
      if (event.maxAge < 99) ageText = `${event.minAge}–${event.maxAge} år`;
      else ageText = `${event.minAge}+`;
  }

  // Pin bakgrundsfärg
  const colorBase = colorClasses.split(' ')[0].split('-')[1]; // "green"
  const avatarBgClass = `bg-${colorBase}-500`;

  return (
    <Link to={`/event/${event.id}`} className="block h-full">
      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 relative flex flex-col h-full transition-all hover:shadow-xl hover:-translate-y-1 duration-200">
        
        {/* HEADER: Host & Status */}
        <div className="flex justify-between items-center mb-3 border-b pb-3 border-slate-100 dark:border-slate-700">
          
          {/* --- KLICKBAR VÄRD --- */}
          <div 
            onClick={(e) => {
                e.preventDefault(); // Hindra länken till eventet
                e.stopPropagation(); // Hindra bubbling
                // Navigera bara om UID finns (gamla event kan sakna det)
                if (event.host.uid) navigate(`/profile/${event.host.uid}`);
            }}
            className="flex items-center gap-2 cursor-pointer group hover:opacity-80 transition-opacity"
            title="Gå till profil"
          >
             {/* Initials Circle */}
            <div className={`w-8 h-8 rounded-full ${avatarBgClass} flex items-center justify-center text-xs font-bold text-white shrink-0 group-hover:scale-105 transition-transform`}>
              {event.host.initials}
            </div>
            <div>
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-none block group-hover:text-indigo-600 group-hover:underline">
                {event.host.name.split(' ')[0]}
              </span>
              <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                <span className="font-bold text-amber-500 flex items-center gap-0.5 mr-1">
                  {event.host.rating.toFixed(1)} <Star size={8} fill="currentColor" />
                </span>
                {event.host.verified && (
                   <CheckCircle2 size={10} className="text-green-500" />
                )}
              </div>
            </div>
          </div>
          {/* --------------------- */}

          {/* Garanterad Badge */}
          {isGuaranteed ? (
            <div className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
               <CheckCircle2 size={10} />
               Garanterat
           </div>
          ) : (
            <div className="text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
               Söker {event.minParticipants - currentCount} till
           </div>
          )}
        </div>

        {/* CONTENT: Title & Info */}
        <div className="mb-2 flex-grow">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg leading-tight mb-1">
                {event.title}
            </h3>
            
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-medium mt-1">
                <span className="text-base">{emoji}</span>
                <div className="flex items-center gap-1">
                    <Clock size={12} />
                    <span>{formatTime(event.time)}</span>
                </div>
            </div>

            <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 mt-1">
                <MapPin size={12} className="mr-1 shrink-0" />
                <span className="truncate">{event.location.name}</span>
                <span className="font-medium text-slate-500 dark:text-slate-400 ml-1">
                    ({event.location.distance?.toFixed(1) ?? '?'} km)
                </span>
            </div>
        </div>

        {/* FOOTER: Price, Progress, Button */}
        <div className="mt-auto pt-3 border-t border-slate-50 dark:border-slate-700">
            <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-center">
                        {event.price > 0 ? `${event.price} kr` : 'Gratis'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600">
                        {ageText}
                    </span>
                </div>
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                    {currentCount}/{event.maxParticipants}
                </span>
            </div>

            {/* Progress Bar */}
            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mb-3">
                <div 
                    className={`h-full rounded-full ${isFull ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                    style={{ width: `${percentFull}%` }} 
                />
            </div>

            <div className="w-full py-2 bg-green-600 group-hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm flex items-center justify-center gap-2">
                Visa Detaljer & Anmäl
            </div>
        </div>

      </div>
    </Link>
  );
}