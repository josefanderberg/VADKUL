// src/pages/EventDetails.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { 
  Clock, MapPin, ChevronLeft, 
  CheckCircle2, Share2, AlertCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import type { AppEvent } from '../types'; 
import { formatTime } from '../utils/dateUtils';
import { getEventEmoji, getEventColor } from '../utils/mapUtils';
import { notificationService } from '../services/notificationService';

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<AppEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  // Ladda eventet
  useEffect(() => {
    async function load() {
      if (!id) return;
      const data = await eventService.getById(id);
      if (data) {
        setEvent(data);
      } else {
        setError('Eventet kunde inte hittas.');
      }
      setLoading(false);
    }
    load();
  }, [id]);

  // Hantera Anmälan/Avanmälan (UPPDATERAD FÖR OBJEKT)
  const handleJoinToggle = async () => {
    if (!user) {
        toast.error("Du måste logga in för att anmäla dig!");
        return;
    }
    if (!event) return;

    setJoining(true);
    try {
        // KOLLA OM JAG ÄR MED (Jämför email eller UID)
        const isJoined = event.attendees.some(a => a.email === user.email);
        let newAttendees = [...event.attendees];

        if (isJoined) {
            // AVANMÄL: Ta bort mig från listan
            newAttendees = newAttendees.filter(a => a.email !== user.email);
        } else {
            // ANMÄL: Lägg till mig som OBJEKT
            if (newAttendees.length >= event.maxParticipants) {
                toast.error("Tyvärr, eventet är fullbokat.");
                setJoining(false);
                return;
            }
            newAttendees.push({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Deltagare'
            });
        }

        // Uppdatera lokalt state
        const updatedEvent = { ...event, attendees: newAttendees };
        setEvent(updatedEvent);

        // Spara till Firebase
        await eventService.update(updatedEvent);

// ... inuti handleJoinToggle, i else-blocket (när man går med) ...

if (isJoined) {
    toast.success("Du har avbokat din plats.");
} else {
    toast.success("Hurra! Du är anmäld! 🚀");

    // --- SKICKA NOTIS TILL VÄRDEN ---
    if (event.host.uid && event.host.uid !== user.uid) {
        await notificationService.send({
            recipientId: event.host.uid,
            senderId: user.uid,
            senderName: user.displayName || user.email || 'Någon',
            senderImage: user.photoURL || undefined, // Om du har detta i Auth-objektet
            type: 'join',
            message: `har anmält sig till "${event.title}"!`,
            link: `/event/${event.id}`
        });
    }
}
        
    } catch (err) {
        console.error("Kunde inte uppdatera anmälan:", err);
    } finally {
        setJoining(false);
    }
  };

  if (loading) return <Layout><div className="p-10 text-center">Laddar...</div></Layout>;
  if (error || !event) return <Layout><div className="p-10 text-center text-red-500">{error}</div></Layout>;

  // Beräknade värden (UPPDATERAD LOGIK)
  const isJoined = user?.email && event ? event.attendees.some(a => a.email === user.email) : false;
  
  const isFull = event.attendees.length >= event.maxParticipants;
  const percentFull = Math.min(100, (event.attendees.length / event.maxParticipants) * 100);
  
  // Styling
  const emoji = getEventEmoji(event.type);
  const colorClasses = getEventColor(event.type);
  const bgClass = colorClasses.split(' ')[0];
  const textClass = colorClasses.split(' ')[1];

  const markerIcon = L.divIcon({
    className: 'custom-detail-marker',
    html: `<div class="w-12 h-12 rounded-full border-4 border-white shadow-xl flex items-center justify-center text-2xl ${bgClass}" style="background-color: white;">
             <span class="transform -translate-y-0.5">${emoji}</span>
           </div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24]
  });

  return (
    <Layout>
      <div className="max-w-3xl mx-auto pb-24">
        
        {/* TOP NAV */}
        <div className="p-4 flex items-center justify-between sticky bg-white/90 dark:bg-slate-900/90 backdrop-blur z-20">
             <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 hover:text-indigo-600 transition-colors">
                <ChevronLeft size={20} />
                <span className="font-bold text-sm ml-1">Tillbaka</span>
             </button>
             <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
                <Share2 size={20} />
             </button>
        </div>

        <div className="px-4 md:px-8">
            
            {/* TITEL & HOST */}
            <div className="flex gap-4 items-start mb-6">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-sm border border-slate-100 dark:border-slate-700 shrink-0 ${bgClass} ${textClass}`}>
                    {emoji}
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">
                        {event.title}
                    </h1>
                    
                    {/* --- KLICKBAR VÄRD --- */}
                    <button 
                        onClick={() => {
                            if (event.host.uid) navigate(`/profile/${event.host.uid}`);
                            else toast.error("Kan inte visa profil (gammalt event)");
                        }}
                        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -ml-2 rounded-lg transition-colors group text-left"
                    >
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                            {event.host.initials}
                        </div>
                        <span className="font-semibold group-hover:text-indigo-600 group-hover:underline decoration-indigo-600 underline-offset-2">
                            {event.host.name}
                        </span>
                        {event.host.verified && <CheckCircle2 size={14} className="text-blue-500" />}
                    </button>
                    {/* --------------------- */}

                </div>
            </div>

            {/* INFO GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Tid</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{formatTime(event.time)}</p>
                    </div>
                </div>
                
                <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-3">
                    <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
                        <MapPin size={20} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Plats</p>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">{event.location.name}</p>
                    </div>
                </div>
            </div>

            {/* BESKRIVNING */}
            <div className="mb-8">
                <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Om eventet</h3>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {event.description || "Ingen beskrivning angiven."}
                </p>
            </div>

            {/* ATTENDEES (KLICKBARA) */}
            <div className="mb-8 p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                <div className="flex justify-between items-end mb-2">
                    <h3 className="font-bold text-slate-900 dark:text-white">Vilka kommer?</h3>
                    <span className="text-sm font-bold text-slate-500">
                        {event.attendees.length} / {event.maxParticipants}
                    </span>
                </div>
                
                <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-4">
                    <div 
                        className={`h-full ${isFull ? 'bg-rose-500' : 'bg-emerald-500'} transition-all duration-500`} 
                        style={{ width: `${percentFull}%` }} 
                    />
                </div>

                <div className="flex flex-wrap gap-2">
                    {event.attendees.length === 0 ? (
                        <span className="text-sm text-slate-400 italic">Inga anmälda ännu. Bli den första!</span>
                    ) : (
                        event.attendees.map((attendee: any, i) => {
                            // SÄKERHETSKOLL: Hantera både gamla (string) och nya (object) dataformat
                            const isObject = typeof attendee === 'object' && attendee !== null;
                            
                            // Hämta namn/email säkert
                            const displayStr = isObject 
                                ? (attendee.displayName || attendee.email || 'Anonym') 
                                : attendee; // Om det är en sträng (gammal data)
                            
                            // Hämta UID säkert
                            const uid = isObject ? attendee.uid : null;

                            return (
                                <button 
                                    key={i} 
                                    onClick={() => {
                                        if (uid) navigate(`/profile/${uid}`);
                                        else toast.error("Kan inte visa profil (gammalt dataformat)");
                                    }}
                                    className={`flex items-center gap-2 bg-white dark:bg-slate-700 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-all
                                        ${uid ? 'hover:ring-2 hover:ring-indigo-500 cursor-pointer' : 'cursor-default opacity-80'}
                                    `}
                                >
                                    <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
                                        {/* Nu kraschar inte charAt eftersom displayStr alltid är en sträng */}
                                        {displayStr && displayStr.length > 0 ? displayStr.charAt(0).toUpperCase() : '?'}
                                    </div>
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                        {displayStr.includes('@') ? displayStr.split('@')[0] : displayStr}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* KARTA */}
            <div className="h-64 rounded-xl overflow-hidden shadow-md border border-slate-200 dark:border-slate-700 relative z-0 mb-8">
                 <MapContainer 
                    center={[event.lat, event.lng]} 
                    zoom={14} 
                    scrollWheelZoom={false}
                    dragging={false}
                    style={{ height: '100%', width: '100%' }}
                 >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[event.lat, event.lng]} icon={markerIcon} />
                 </MapContainer>
            </div>

        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
            <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                <div className="hidden md:block">
                     <p className="text-xs text-slate-500 uppercase font-bold">Kostnad</p>
                     <p className="font-bold text-xl dark:text-white">{event.price > 0 ? `${event.price} kr` : 'Gratis'}</p>
                </div>
                
                <button
                    onClick={handleJoinToggle}
                    disabled={joining || (isFull && !isJoined)}
                    className={`flex-grow py-3.5 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2
                        ${isJoined 
                            ? 'bg-slate-400 hover:bg-slate-500' // Avanmäl färg
                            : isFull 
                                ? 'bg-rose-400 cursor-not-allowed' // Fullbokat färg
                                : 'bg-emerald-600 hover:bg-emerald-700' // Anmäl färg
                        }
                    `}
                >
                    {joining ? (
                        <span>Sparar...</span>
                    ) : isJoined ? (
                        <>Avboka min plats <AlertCircle size={18}/></>
                    ) : isFull ? (
                        <>Fullbokat</>
                    ) : (
                        <>Anmäl mig nu <CheckCircle2 size={18}/></>
                    )}
                </button>
            </div>
        </div>

      </div>
    </Layout>
  );
}