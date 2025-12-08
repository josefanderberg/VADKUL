// src/pages/EventDetails.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { 
  Clock, MapPin, ChevronLeft, 
  CheckCircle2, Share2, AlertCircle,
  MessageCircle, Info, X
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import EventChat from '../components/events/EventChat';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import type { AppEvent } from '../types'; 
import { formatTime } from '../utils/dateUtils';
import { getEventColor } from '../utils/mapUtils';
import { notificationService } from '../services/notificationService';
import { userService } from '../services/userService';

// VIKTIGT: Importera kategorier för att få rätt markör-färg
import { EVENT_CATEGORIES, type EventCategoryType } from '../utils/categories';

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [event, setEvent] = useState<AppEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');

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

  const isJoined = user?.email && event ? event.attendees.some(a => a.email === user.email) : false;
  const isFull = event ? event.attendees.length >= event.maxParticipants : false;
  const percentFull = event ? Math.min(100, (event.attendees.length / event.maxParticipants) * 100) : 0;
  
  const isHost = user?.uid === event?.host.uid;

  const handleJoinToggle = async () => {
    if (!user) {
        toast.error("Du måste logga in för att anmäla dig!");
        return;
    }
    if (!event) return;

    setJoining(true);
    try {
        let newAttendees = [...event.attendees];

        if (isJoined) {
            newAttendees = newAttendees.filter(a => a.email !== user.email);
            toast.success("Du har avbokat din plats.");
        } else {
            if (newAttendees.length >= event.maxParticipants) {
                toast.error("Tyvärr, eventet är fullbokat.");
                setJoining(false);
                return;
            }
            
            const userProfile = await userService.getUserProfile(user.uid);
            const correctPhotoURL = userProfile?.verificationImage || user.photoURL || null;

            newAttendees.push({
                uid: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Deltagare',
                photoURL: correctPhotoURL 
            });
            
            toast.success("Hurra! Du är anmäld! 🚀");

            if (event.host.uid && event.host.uid !== user.uid) {
                await notificationService.send({
                    recipientId: event.host.uid,
                    senderId: user.uid,
                    senderName: user.displayName || user.email || 'Någon',
                    senderImage: user.photoURL || null, 
                    type: 'join',
                    message: `har anmält sig till "${event.title}"!`,
                    link: `/event/${event.id}`
                });
            }
        }

        const updatedEvent = { ...event, attendees: newAttendees };
        setEvent(updatedEvent);
        await eventService.update(updatedEvent);
        
    } catch (err) {
        console.error("Kunde inte uppdatera anmälan:", err);
        toast.error("Något gick fel vid sparandet.");
    } finally {
        setJoining(false);
    }
  };

  const handleKickAttendee = async (attendeeUid: string, attendeeName: string) => {
    if (!event) return;
    
    if (!window.confirm(`Vill du ta bort ${attendeeName} från eventet?`)) {
        return;
    }

    try {
        const newAttendees = event.attendees.filter(a => a.uid !== attendeeUid);
        const updatedEvent = { ...event, attendees: newAttendees };
        
        setEvent(updatedEvent);
        await eventService.update(updatedEvent);
        toast.success(`${attendeeName} har tagits bort.`);
    } catch (error) {
        console.error("Kunde inte ta bort deltagare:", error);
        toast.error("Något gick fel.");
    }
  };
  
  if (loading) return <Layout><div className="p-10 text-center">Laddar...</div></Layout>;
  if (error || !event) return <Layout><div className="p-10 text-center text-red-500">{error}</div></Layout>;
  
  // Hämta färger för Header-ikonen
  const colorClasses = getEventColor(event.type);
  const bgClassHeader = colorClasses.split(' ')[0];
  const textClassHeader = colorClasses.split(' ')[1];

  // --- NY LOGIK FÖR MARKÖREN (Samma som Home.tsx) ---
  const categoryData = EVENT_CATEGORIES[event.type as EventCategoryType] || EVENT_CATEGORIES.other;
  const markerEmoji = categoryData.emoji;
  const markerBgClass = categoryData.markerColor; // T.ex "bg-emerald-500"

  const markerIcon = L.divIcon({
    className: 'custom-detail-marker',
    html: `
      <div class="relative group">
          <div class="w-12 h-12 ${markerBgClass} border-[3px] border-white shadow-md rounded-full rounded-br-none transform rotate-45 flex items-center justify-center overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent"></div>
              <div class="transform -rotate-45 text-2xl filter drop-shadow-sm">
                  ${markerEmoji}
              </div>
          </div>
          <div class="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-2 bg-black/20 blur-[3px] rounded-full"></div>
      </div>
    `,
    iconSize: [48, 65],
    iconAnchor: [24, 58], // Justerat ankare för teardrop-formen
    popupAnchor: [0, -50]
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
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-4xl shadow-sm border border-slate-100 dark:border-slate-700 shrink-0 ${bgClassHeader} ${textClassHeader}`}>
                    {markerEmoji}
                </div>
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight mb-2">
                        {event.title}
                    </h1>
                    
                    <button 
                        onClick={() => {
                            if (event.host.uid) navigate(`/profile/${event.host.uid}`);
                            else toast.error("Kan inte visa profil (gammalt event)");
                        }}
                        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 p-2 -ml-2 rounded-lg transition-colors group text-left"
                    >
                        {event.host.photoURL ? (
                             <img src={event.host.photoURL} className="w-6 h-6 rounded-full object-cover" alt={event.host.name} />
                        ) : (
                            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform">
                                {event.host.initials}
                            </div>
                        )}
                        <span className="font-semibold group-hover:text-indigo-600 group-hover:underline decoration-indigo-600 underline-offset-2">
                            {event.host.name}
                        </span>
                        {event.host.verified && <CheckCircle2 size={14} className="text-blue-500" />}
                    </button>
                </div>
            </div>

            {/* --- FLIKAR --- */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-6">
                <button
                onClick={() => setActiveTab('info')}
                className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 
                    ${activeTab === 'info' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                >
                <Info size={18} /> Info
                </button>
                <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 
                    ${activeTab === 'chat' 
                    ? 'border-indigo-600 text-indigo-600' 
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'}`}
                >
                <MessageCircle size={18} /> Gruppchatt
                </button>
            </div>

            {/* --- FLIKINNEHÅLL --- */}
            {activeTab === 'info' ? (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    
                    {/* 1. TID OCH PLATS GRID */}
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

                    {/* 2. KARTA (Flyttad hit) */}
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

                    {/* 3. BESKRIVNING (Flyttad hit) */}
                    <div className="mb-8">
                        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">Om eventet</h3>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                            {event.description || "Ingen beskrivning angiven."}
                        </p>
                    </div>

                    {/* 4. DELTAGARE (Flyttad hit) */}
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

                        {event.attendees.length === 0 ? (
                            <span className="text-sm text-slate-400 italic">Inga anmälda ännu.</span>
                        ) : (
                            <div className={isHost ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
                                {event.attendees.map((attendee, i) => {
                                    const isObject = typeof attendee === 'object' && attendee !== null;
                                    const displayStr = isObject ? (attendee.displayName || attendee.email || 'Anonym') : 'Okänd';
                                    const uid = isObject ? attendee.uid : null;
                                    const photo = isObject ? attendee.photoURL : null;
                                    const isMe = uid === user?.uid;

                                    const Avatar = photo ? (
                                        <img 
                                            src={photo} 
                                            alt={displayStr} 
                                            className={isHost ? "w-8 h-8 rounded-full object-cover" : "w-6 h-6 rounded-full object-cover"}
                                        />
                                    ) : (
                                        <div className={`${isHost ? 'w-8 h-8' : 'w-6 h-6'} rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold ${isHost ? 'text-xs' : 'text-[10px]'}`}>
                                            {displayStr.charAt(0).toUpperCase()}
                                        </div>
                                    );

                                    if (isHost) {
                                        return (
                                            <div key={i} className="flex items-center justify-between p-3 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 shadow-sm">
                                                <div 
                                                    className="flex items-center gap-3 cursor-pointer"
                                                    onClick={() => uid && navigate(`/profile/${uid}`)}
                                                >
                                                    {Avatar}
                                                    <span className="font-medium text-slate-900 dark:text-slate-100">
                                                        {displayStr} {isMe && "(Du)"}
                                                    </span>
                                                </div>

                                                {!isMe && uid && (
                                                    <button 
                                                        onClick={() => handleKickAttendee(uid, displayStr)}
                                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                        title="Ta bort från eventet"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <button 
                                                key={i} 
                                                onClick={() => uid && navigate(`/profile/${uid}`)}
                                                className={`flex items-center gap-2 bg-white dark:bg-slate-700 pl-1 pr-3 py-1 rounded-full border border-slate-200 dark:border-slate-600 shadow-sm transition-all
                                                    ${uid ? 'hover:ring-2 hover:ring-indigo-500 cursor-pointer' : 'cursor-default opacity-80'}
                                                `}
                                            >
                                                {Avatar}
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                                    {displayStr.split(' ')[0]}
                                                </span>
                                            </button>
                                        );
                                    }
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // --- CHATT FLIK (Oförändrad layout) ---
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {!isJoined ? (
                        <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="w-16 h-16 bg-indigo-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500">
                                <MessageCircle size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                                Chatten är låst
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-6">
                                Du måste anmäla dig till eventet för att kunna läsa och skriva i gruppchatten.
                            </p>
                            <button 
                                onClick={handleJoinToggle}
                                disabled={joining || isFull}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-full font-bold text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
                            >
                                {isFull ? 'Eventet är fullt' : 'Anmäl mig nu'}
                            </button>
                        </div>
                    ) : (
                        <EventChat eventId={event.id} />
                    )}
                </div>
            )}

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
                            ? 'bg-slate-400 hover:bg-slate-500' 
                            : isFull 
                                ? 'bg-rose-400 cursor-not-allowed' 
                                : 'bg-emerald-600 hover:bg-emerald-700' 
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