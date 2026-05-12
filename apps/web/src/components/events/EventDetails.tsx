'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import {
    Clock, MapPin, ChevronLeft,
    CheckCircle2, Share2, AlertCircle,
    MessageCircle, Info, X, Users, MoreVertical, Flag,
    Eye, EyeOff, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../layout/Layout';
import EventChat from './EventChat';
import { useAuth } from '../../context/AuthContext';
import { eventService } from '../../services/eventService';
import type { AppEvent } from '../../types';
import { formatEventDate } from '../../utils/dateUtils';
import { notificationService } from '../../services/notificationService';
import { userService } from '../../services/userService';
import { calculateDistance } from '../../utils/mapUtils';

// VIKTIGT: Importera kategorier för att få rätt markör-färg
import { EVENT_CATEGORIES, AGE_CATEGORIES, type EventCategoryType } from '../../utils/categories';
import { useAdmin } from '../../context/AdminContext';

interface EventDetailsProps {
    initialEvent?: AppEvent | null;
}

export default function EventDetails({ initialEvent }: EventDetailsProps) {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();
    const { user } = useAuth();
    const { isAdmin } = useAdmin();

    const [event, setEvent] = useState<AppEvent | null>(initialEvent || null);
    const [loading, setLoading] = useState(!initialEvent);
    const [error, setError] = useState(initialEvent === null ? 'Eventet kunde inte hittas.' : '');
    const [joining, setJoining] = useState(false);

    const [activeTab, setActiveTab] = useState<'info' | 'chat'>('info');
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        async function load() {
            if (!id) return;

            // 1. Öka visningar och VÄNTA tills det är klart för att undvika race condition
            try {
                // Vi använder optimistic update lokalt för känslan, men vi vill också se rätt data.
                // Vi väntar på Firestore.
                await eventService.incrementViews(id);
            } catch (err) {
                console.error("Failed to increment views:", err);
            }

            if (initialEvent) {
                setLoading(false);
            } else {
                // 2. Hämta data EFTER att vi ökat
                const data = await eventService.getById(id);
                if (data) {
                    setEvent(data);

                    // Self-healing: Check if host data is up to date
                    // ONLY RUN THIS IF I AM THE HOST (Security Rule Requirement)
                    if (user?.uid && data.host?.uid === user.uid) {
                        try {
                            const hostProfile = await userService.getUserProfile(data.host.uid);
                            if (hostProfile) {
                                const correctPhoto = hostProfile.photoURL || null;
                                const currentPhoto = data.host.photoURL || null;

                                // If photo changed/missing, update the event
                                if (correctPhoto !== currentPhoto) {
                                    console.log("Updating stale host data...");
                                    const updatedEvent = {
                                        ...data,
                                        host: {
                                            ...data.host,
                                            photoURL: correctPhoto,
                                            // Update other fields if needed, e.g. name if changed
                                            name: hostProfile.displayName || data.host.name,
                                            verified: hostProfile.isVerified
                                        }
                                    };
                                    setEvent(updatedEvent);
                                    await eventService.update(updatedEvent);
                                }
                            }
                        } catch (e) {
                            console.error("Failed to refresh host data", e);
                        }
                    }
                } else {
                    setError('Eventet kunde inte hittas.');
                }
                setLoading(false);
            }
        }

        // Check host data updates separately if needed
        if (event && user?.uid && event.host?.uid === user.uid) {
            // ... (existing host check logic can be added here if needed to run on client)
        }
        load();
    }, [id, user?.uid, initialEvent]);

    // --- SEQUENTIAL NAVIGATION LOGIC ---
    const [nextEventId, setNextEventId] = useState<string | null>(null);
    const [prevEventId, setPrevEventId] = useState<string | null>(null);

    useEffect(() => {
        if (event) {
            // Hämta användarens position (från localStorage som vi sparar i HomeContent)
            const userLat = localStorage.getItem('user_lat');
            const userLng = localStorage.getItem('user_lng');
            
            // Om vi inte har position, använd det första eventets position som "ankare" 
            // så att listan blir konsekvent under hela sessionen.
            const anchorLat = userLat ? parseFloat(userLat) : event.lat;
            const anchorLng = userLng ? parseFloat(userLng) : event.lng;

            eventService.getAll().then(allEvents => {
                // Sortera ALLA event efter avstånd från ANKARET (inte från nuvarande event)
                const sorted = [...allEvents].sort((a, b) => {
                    const distA = calculateDistance(anchorLat, anchorLng, a.lat, a.lng);
                    const distB = calculateDistance(anchorLat, anchorLng, b.lat, b.lng);
                    return distA - distB;
                });

                const currentIndex = sorted.findIndex(e => e.id === event.id);
                
                if (currentIndex !== -1) {
                    if (currentIndex > 0) setPrevEventId(sorted[currentIndex - 1].id);
                    else setPrevEventId(null);

                    if (currentIndex < sorted.length - 1) setNextEventId(sorted[currentIndex + 1].id);
                    else setNextEventId(null);
                }
            });
        }
    }, [event?.id]);

    const isJoined = user?.email && event ? event.attendees.some(a => a.email === user.email) : false;
    const confirmedCount = event ? event.attendees.filter(a => a.status !== 'pending').length : 0;
    const isFull = event ? confirmedCount >= event.maxParticipants : false;
    const percentFull = event ? Math.min(100, (confirmedCount / event.maxParticipants) * 100) : 0;
    const spotsLeft = event ? Math.max(0, event.minParticipants - confirmedCount) : 0;

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
                const currentConfirmedCount = newAttendees.filter(a => a.status !== 'pending').length;
                if (currentConfirmedCount >= event.maxParticipants) {
                    toast.error("Tyvärr, eventet är fullbokat.");
                    setJoining(false);
                    return;
                }

                const userProfile = await userService.getUserProfile(user.uid);
                const correctPhotoURL = userProfile?.photoURL || user.photoURL || null;

                const initialStatus = event.requiresApproval ? 'pending' : 'confirmed';

                newAttendees.push({
                    uid: user.uid,
                    email: user.email || '',
                    displayName: user.displayName || 'Deltagare',
                    photoURL: correctPhotoURL,
                    status: initialStatus
                });

                if (initialStatus === 'pending') {
                    toast.success("Förfrågan skickad! Väntar på värdens godkännande.");
                } else {
                    toast.success("Hurra! Du är anmäld! 🚀");
                    // Skicka notis till värden
                    if (event.host.uid && event.host.uid !== user.uid) {
                        await notificationService.send({
                            recipientId: event.host.uid,
                            senderId: user.uid,
                            senderName: user.displayName || user.email || 'Någon',
                            senderImage: user.photoURL || null,
                            type: 'join',
                            message: event.requiresApproval ? `vill gå med i "${event.title}"` : `har anmält sig till "${event.title}"!`,
                            link: `/event/${event.id}`
                        });
                    }
                }
            }

            const updatedEvent = { ...event, attendees: newAttendees };
            setEvent(updatedEvent);
            // ANVÄND NYA METODEN: Skicka bara arrayen
            await eventService.updateAttendees(event.id, newAttendees);

        } catch (err) {
            console.error("Kunde inte uppdatera anmälan:", err);
            toast.error("Något gick fel vid sparandet.");
        } finally {
            setJoining(false);
        }
    };

    const handleKickAttendee = async (attendeeUid: string, attendeeName: string) => {
        if (!event) return;
        if (!window.confirm(`Vill du ta bort ${attendeeName} från eventet?`)) return;
        await removeAttendee(attendeeUid);
        toast.success(`${attendeeName} har tagits bort.`);
    };

    const handleDenyRequest = async (attendeeUid: string) => {
        if (!event) return;
        if (!window.confirm(`Vill du neka denna förfrågan?`)) return;
        await removeAttendee(attendeeUid);
        toast.success("Förfrågan nekad.");
    };

    const removeAttendee = async (uidToRemove: string) => {
        if (!event) return;
        try {
            const newAttendees = event.attendees.filter(a => a.uid !== uidToRemove);
            const updatedEvent = { ...event, attendees: newAttendees };
            setEvent(updatedEvent);
            await eventService.updateAttendees(event.id, newAttendees);
        } catch (error) {
            console.error("Kunde inte ta bort deltagare:", error);
            toast.error("Misslyckades att ta bort deltagare.");
        }
    };

    const handleApproveRequest = async (attendeeUid: string) => {
        if (!event) return;
        try {
            const newAttendees = event.attendees.map(a => {
                if (a.uid === attendeeUid) return { ...a, status: 'confirmed' as const };
                return a;
            });
            const updatedEvent = { ...event, attendees: newAttendees };
            setEvent(updatedEvent);
            await eventService.update(updatedEvent);
            toast.success("Deltagare godkänd! 🎉");

            // Skicka notis till användaren
            await notificationService.send({
                recipientId: attendeeUid,
                senderId: user?.uid, // Värden
                type: 'system',
                message: `Du har blivit godkänd att delta på "${event.title}"!`,
                link: `/event/${event.id}`
            });

        } catch (error) {
            console.error(error);
            toast.error("Kunde inte godkänna.");
        }
    };

    const handleShare = async () => {
        if (!event) return;
        const shareData = {
            title: `VADKUL: ${event.title}`,
            text: `Häng med på ${event.title}!`,
            url: window.location.href
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Länk kopierad till urklipp!");
        }
    };

    const handleReport = async () => {
        setShowMenu(false);

        if (!user) {
            toast.error("Du måste logga in för att rapportera ett event.");
            return;
        }

        // Safety check (should block undefined values)
        if (!event) {
            toast.error("Kunde inte hitta eventdata.");
            return;
        }

        const reason = window.prompt("Ange anledning till rapportering:", "Olämpligt innehåll");
        if (!reason) return; // User cancelled

        try {
            await addDoc(collection(db, 'reports'), {
                eventId: event.id, // Verified exists
                eventTitle: event.title || 'Okänt event',
                reporterId: user.uid,
                reporterEmail: user.email || 'Anonym',
                reason: reason,
                status: 'pending',
                createdAt: Timestamp.now()
            });
            toast.success("Tack! Vi har mottagit din anmälan och kommer granska eventet.");
        } catch (error: any) {
            console.error("Report error:", error);
            // Show the actual error message to help debugging
            toast.error(`Fel vid rapportering: ${error.message}`);
        }
    };

    // --- NY LOGIK: GÖM / VISA / TA BORT ---
    const handleToggleVisibility = async () => {
        if (!event) return;
        const newVisibility = event.visibility === 'hidden' ? 'public' : 'hidden';
        const updatedEvent: AppEvent = { ...event, visibility: newVisibility };

        try {
            await eventService.update(updatedEvent);
            setEvent(updatedEvent);
            toast.success(newVisibility === 'hidden' ? "Eventet är nu gömt." : "Eventet är nu publikt.");
            setShowMenu(false);
        } catch (e) {
            toast.error("Kunde inte ändra synlighet.");
        }
    };

    const handleDeleteEvent = async () => {
        if (!event) return;
        if (window.confirm("Är du säker på att du vill ta bort detta event permanent? Detta går inte att ångra.")) {
            try {
                await eventService.delete(event.id);
                // Rensa hem-cachen så att eventet försvinner direkt
                sessionStorage.removeItem('vadkul_events_cache');
                sessionStorage.removeItem('vadkul_events_cache_time');

                toast.success("Eventet har tagits bort.");
                router.push('/'); // Skicka till startsidan
            } catch (e) {
                toast.error("Kunde inte ta bort eventet.");
            }
        }
    };

    if (loading) return <Layout><div className="p-10 text-center text-muted-foreground">Laddar...</div></Layout>;
    if (error || !event) return <Layout><div className="p-10 text-center text-destructive">{error}</div></Layout>;

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

    const rawCoverImage = event.coverImage || categoryData.defaultImage; // <--- NY: Omslagsbild
    const coverImage = typeof rawCoverImage === 'string' ? rawCoverImage : rawCoverImage?.src;

    return (
        <Layout>
            <div className="max-w-3xl mx-auto pb-24">

                {/* TOP NAV */}
                <div className="p-4 flex items-center justify-between sticky top-16 bg-background/90 backdrop-blur z-40 shadow-sm md:shadow-none">
                    <button onClick={() => router.back()} className="flex items-center text-muted-foreground hover:text-primary transition-colors bg-background/50 p-2 rounded-full md:bg-transparent md:p-0">
                        <ChevronLeft size={20} />
                        <span className="font-bold text-sm ml-1 hidden md:inline">Tillbaka</span>
                    </button>

                    {/* NAVIGATION STEPS */}
                    <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-full border border-border/50">
                        <button
                            disabled={!prevEventId}
                            onClick={() => prevEventId && router.push(`/event/${prevEventId}`, { scroll: false })}
                            className={`p-1.5 rounded-full transition-all ${!prevEventId ? 'opacity-20 cursor-not-allowed' : 'hover:bg-background hover:text-primary text-muted-foreground'}`}
                            title="Föregående event"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <span className="text-[10px] font-bold uppercase text-muted-foreground px-1 tracking-tighter">Stega event</span>
                        <button
                            disabled={!nextEventId}
                            onClick={() => nextEventId && router.push(`/event/${nextEventId}`, { scroll: false })}
                            className={`p-1.5 rounded-full transition-all ${!nextEventId ? 'opacity-20 cursor-not-allowed' : 'hover:bg-background hover:text-primary text-muted-foreground'}`}
                            title="Nästa event"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                    </div>

                    <div className="flex gap-2 relative">
                        {isHost && (
                            <button
                                onClick={() => router.push(`/edit-event/${event.id}`)}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                title="Redigera event"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                            </button>
                        )}
                        <button
                            onClick={handleShare}
                            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            title="Dela event"
                        >
                            <Share2 size={20} />
                        </button>

                        {/* MORE MENU */}
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                            >
                                <MoreVertical size={20} />
                            </button>

                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)}></div>
                                    <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl shadow-xl border border-border z-50 overflow-hidden py-1">
                                        {(isHost || isAdmin) ? (
                                            <>
                                                <button
                                                    onClick={handleToggleVisibility}
                                                    className="w-full text-left px-4 py-3 text-sm font-medium text-foreground hover:bg-muted flex items-center gap-3 border-b border-border/50"
                                                >
                                                    {event.visibility === 'hidden' ? <Eye size={18} /> : <EyeOff size={18} />}
                                                    {event.visibility === 'hidden' ? "Gör publikt" : "Göm event"}
                                                </button>
                                                <button
                                                    onClick={handleDeleteEvent}
                                                    className="w-full text-left px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10 flex items-center gap-3"
                                                >
                                                    <Trash2 size={18} /> Ta bort event
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={handleReport}
                                                className="w-full text-left px-4 py-3 text-sm font-medium text-destructive hover:bg-muted flex items-center gap-3"
                                            >
                                                <Flag size={18} /> Rapportera event
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* --- HERO IMAGE --- */}
                <div className="relative h-56 md:h-72 w-full md:rounded-b-3xl overflow-hidden -mt-16 md:mt-0 mb-6 group">
                    <Image unoptimized
                        src={coverImage}
                        alt={event.title}
                        fill
                        priority
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/30 z-10"></div>

                    {/* HIDDEN OVERLAY BANNER */}
                    {event.visibility === 'hidden' && (
                        <div className="absolute inset-x-0 top-16 md:top-0 bg-black/60 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center z-20 border-b border-white/10 animate-in slide-in-from-top-4 duration-500">
                            <div className="flex items-center gap-2 text-white font-bold mb-1">
                                <EyeOff size={20} className="text-white" />
                                <span>Eventet är gömt</span>
                            </div>
                            <p className="text-xs text-white/80 max-w-md">Endast du och anmälda deltagare kan se detta event.</p>
                        </div>
                    )}

                    {/* Kategori Badge på bilden */}
                    <div className="absolute bottom-4 left-4 md:left-8">
                        <div className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 shadow-lg backdrop-blur-md bg-white/95 text-black`}>
                            <span className="text-lg">{markerEmoji}</span>
                            {categoryData.label}
                        </div>
                    </div>

                    {/* TOP RIGHT BADGES */}
                    <div className="absolute top-20 md:top-6 right-4 md:right-8 flex flex-col items-end gap-2">
                        {/* Söker deltagare Badge */}
                        {!isFull && spotsLeft > 0 && (
                            <div className={`flex items-center gap-1.5 text-xs font-bold text-white px-3 py-1.5 rounded-full shadow-lg border border-white/20 backdrop-blur-md
                                ${spotsLeft === 1 ? 'bg-amber-500/90' : 'bg-orange-500/90'}
                            `}>
                                <Users size={12} strokeWidth={3} />
                                <span>Söker {spotsLeft} deltagare till</span>
                            </div>
                        )}

                        {/* Garanterat Badge */}
                        {confirmedCount >= event.minParticipants && (
                            <div className="flex items-center gap-1.5 text-xs font-bold text-white bg-emerald-500/90 backdrop-blur-md px-3 py-1.5 rounded-full shadow-lg border border-white/20">
                                <CheckCircle2 size={12} strokeWidth={3} />
                                <span>Garanterat event!</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="px-4 md:px-8">

                    {/* TITEL & HOST */}
                    <div className="flex flex-col gap-2 mb-8">
                        <h1 className="text-3xl md:text-4xl font-black text-foreground leading-tight">
                            {event.title}
                        </h1>

                        <div className="flex items-center justify-between">
                            {/* VÄRD */}
                            <button
                                onClick={() => {
                                    if (event.host.uid) router.push(`/public-profile/${event.host.uid}`);
                                    else toast.error("Kan inte visa profil (gammalt event)");
                                }}
                                className="flex items-center gap-2 text-sm text-muted-foreground hover:bg-muted p-2 -ml-2 rounded-lg transition-colors group text-left"
                            >
                                {event.host.photoURL ? (
                                    <div className="relative w-8 h-8 shrink-0 rounded-full overflow-hidden ring-2 ring-background shadow-sm">
                                        <Image unoptimized
                                            src={event.host.photoURL}
                                            fill
                                            sizes="32px"
                                            className="object-cover"
                                            alt={event.host.name}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className="w-8 h-8 shrink-0 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs group-hover:scale-110 transition-transform ring-2 ring-background shadow-sm"
                                        style={{ width: '32px', height: '32px' }}
                                    >
                                        {event.host.initials}
                                    </div>
                                )}
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Arrangeras av</span>
                                    <span className="font-bold text-foreground group-hover:text-primary">
                                        {event.host.name}
                                        {event.host.verified && <CheckCircle2 size={12} className="inline ml-1 text-blue-500" />}
                                    </span>
                                </div>
                            </button>

                            {/* PRIS (Flyttad hit för bättre balans) */}
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">Pris</span>
                                <span className="font-bold text-xl text-foreground">
                                    {event.price > 0 ? `${event.price} kr` : 'Gratis'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* --- FLIKAR --- */}
                    <div className="flex border-b border-border mb-6">
                        <button
                            onClick={() => setActiveTab('info')}
                            className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 
                    ${activeTab === 'info'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <Info size={18} /> Info
                        </button>
                        <button
                            onClick={() => setActiveTab('chat')}
                            className={`flex-1 pb-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors border-b-2 
                    ${activeTab === 'chat'
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                            <MessageCircle size={18} /> Gruppchatt
                        </button>
                    </div>

                    {/* --- FLIKINNEHÅLL --- */}
                    {activeTab === 'info' ? (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">

                            {/* 1. TID, PLATS, ÅLDER, VISNINGAR GRID */}
                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="col-span-2 md:col-span-1 bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                        <Clock size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground/70 uppercase">Tid</p>
                                        <p className="font-semibold text-foreground">{formatEventDate(event.time)}</p>
                                    </div>
                                </div>

                                <div className="col-span-2 md:col-span-1 bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                        <MapPin size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground/70 uppercase">Plats</p>
                                        <p className="font-semibold text-foreground">{event.location.name}</p>
                                    </div>
                                </div>

                                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                        <Users size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground/70 uppercase">Ålder</p>
                                        <p className="font-semibold text-foreground">
                                            {(() => {
                                                const cat = AGE_CATEGORIES.find(c => c.id === event.ageCategory);
                                                if (!cat) return 'Alla åldrar';
                                                if (event.minAge !== cat.min || event.maxAge !== cat.max) {
                                                    return `${cat.label} (${event.minAge}-${event.maxAge} år)`;
                                                }
                                                return cat.label;
                                            })()}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex items-center gap-3">
                                    <div className="p-2 bg-muted rounded-lg text-muted-foreground">
                                        <Eye size={20} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-muted-foreground/70 uppercase">Visningar</p>
                                        <p className="font-semibold text-foreground">{event.views || 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* 2. KARTA */}
                            <div className="h-64 rounded-xl overflow-hidden shadow-md border border-border relative z-0 mb-8">
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

                            {/* 3. BESKRIVNING */}
                            <div className="mb-8">
                                <h3 className="font-bold text-lg text-foreground mb-2">Om eventet</h3>
                                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                    {event.description || "Ingen beskrivning angiven."}
                                </p>
                            </div>

                            {/* 4. DELTAGARE */}
                            <div className="mb-8 p-5 bg-card rounded-2xl border border-border shadow-sm">

                                {/* HOST: VÄNTANDE FÖRFRÅGNINGAR */}
                                {isHost && event.attendees.some(a => a.status === 'pending') && (
                                    <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800/30">
                                        <h4 className="font-bold text-amber-800 dark:text-amber-200 mb-3 text-sm uppercase tracking-wide">
                                            Väntar på Godkännande ({event.attendees.filter(a => a.status === 'pending').length})
                                        </h4>
                                        <div className="space-y-3">
                                            {event.attendees.filter(a => a.status === 'pending').map(request => (
                                                <div key={request.uid} className="flex items-center justify-between bg-card p-3 rounded-lg border border-amber-200 dark:border-transparent shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        {request.photoURL ? (
                                                            <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden border border-border">
                                                                <Image unoptimized
                                                                    src={request.photoURL}
                                                                    alt={request.displayName}
                                                                    fill
                                                                    sizes="40px"
                                                                    className="object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="w-10 h-10 shrink-0 rounded-full bg-muted flex items-center justify-center font-bold text-muted-foreground"
                                                                style={{ width: '40px', height: '40px' }}
                                                            >
                                                                {request.displayName.charAt(0)}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-foreground">{request.displayName}</span>
                                                            <button
                                                                onClick={() => router.push(`/public-profile/${request.uid}`)}
                                                                className="text-xs text-primary hover:underline text-left"
                                                            >
                                                                Visa profil
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleDenyRequest(request.uid)}
                                                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold"
                                                        >
                                                            Neka
                                                        </button>
                                                        <button
                                                            onClick={() => handleApproveRequest(request.uid)}
                                                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm"
                                                        >
                                                            Godkänn
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-between items-end mb-2">
                                    <h3 className="font-bold text-foreground">Vilka kommer?</h3>
                                    <span className="text-sm font-bold text-muted-foreground">
                                        {event.attendees.filter(a => a.status !== 'pending').length} / {event.maxParticipants}
                                    </span>
                                </div>

                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-4">
                                    <div
                                        className={`h-full ${isFull ? 'bg-rose-500' : 'bg-emerald-500'} transition-all duration-500`}
                                        style={{ width: `${percentFull}%` }}
                                    />
                                </div>

                                {event.attendees.filter(a => a.status !== 'pending').length === 0 ? (
                                    <span className="text-sm text-muted-foreground/80 italic">Inga bekräftade deltagare ännu.</span>
                                ) : (
                                    <div className={isHost ? "flex flex-col gap-2" : "flex flex-wrap gap-2"}>
                                        {event.attendees
                                            .filter(a => a.status !== 'pending') // Visa bara bekräftade
                                            .map((attendee, i) => {

                                                const isObject = typeof attendee === 'object' && attendee !== null;
                                                const displayStr = isObject ? (attendee.displayName || attendee.email || 'Anonym') : 'Okänd';
                                                const uid = isObject ? attendee.uid : null;
                                                const photo = isObject ? attendee.photoURL : null;
                                                const isMe = uid === user?.uid;

                                                const Avatar = photo ? (
                                                    <div className={`relative ${isHost ? 'w-8 h-8' : 'w-6 h-6'} shrink-0 rounded-full overflow-hidden`}>
                                                        <Image unoptimized
                                                            src={photo}
                                                            alt={displayStr}
                                                            fill
                                                            sizes={isHost ? "32px" : "24px"}
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`shrink-0 ${isHost ? 'w-8 h-8' : 'w-6 h-6'} rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold ${isHost ? 'text-xs' : 'text-[10px]'}`}
                                                        style={{ width: isHost ? '32px' : '24px', height: isHost ? '32px' : '24px' }}
                                                    >
                                                        {displayStr.charAt(0).toUpperCase()}
                                                    </div>
                                                );

                                                if (isHost) {
                                                    return (
                                                        <div key={i} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border shadow-sm">
                                                            <div
                                                                className="flex items-center gap-3 cursor-pointer"
                                                                onClick={() => uid && router.push(`/public-profile/${uid}`)}
                                                            >
                                                                {Avatar}
                                                                <span className="font-medium text-foreground">
                                                                    {displayStr} {isMe && "(Du)"}
                                                                </span>
                                                            </div>

                                                            {!isMe && uid && (
                                                                <button
                                                                    onClick={() => handleKickAttendee(uid, displayStr)}
                                                                    className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
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
                                                            onClick={() => uid && router.push(`/public-profile/${uid}`)}
                                                            className={`flex items-center gap-2 bg-muted/50 pl-1 pr-3 py-1 rounded-full border border-border/50 shadow-sm transition-all
                                                                            ${uid ? 'hover:ring-2 hover:ring-primary cursor-pointer' : 'cursor-default opacity-80'}
                                                                        `}
                                                        >
                                                            {Avatar}
                                                            <span className="text-xs font-medium text-muted-foreground">
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
                        // --- CHATT FLIK ---
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {(!isJoined || event.attendees.find(a => a.email === user?.email)?.status === 'pending') ? (
                                <div className="text-center py-12 bg-card rounded-xl border border-border">
                                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                                        <MessageCircle size={32} />
                                    </div>
                                    <h3 className="text-lg font-bold text-foreground mb-2">
                                        Chatten är låst
                                    </h3>
                                    <p className="text-muted-foreground max-w-xs mx-auto mb-6">
                                        Du måste anmäla dig till eventet för att kunna läsa och skriva i gruppchatten.
                                    </p>
                                    <button
                                        onClick={handleJoinToggle}
                                        disabled={joining || isFull}
                                        className="bg-primary text-primary-foreground px-6 py-2 rounded-full font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
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
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-card border-t border-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
                    <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
                        <button
                            onClick={handleJoinToggle}
                            disabled={joining || (isFull && !isJoined)}
                            className={`flex-grow py-3.5 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2
          ${isJoined ? 'bg-secondary text-secondary-foreground hover:bg-secondary/80' : isFull ? 'bg-destructive/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'}
        `}
                        >
                            {joining ? (
                                <span>Sparar...</span>
                            ) : isJoined ? (
                                event.attendees.find(a => a.email === user?.email)?.status === 'pending' ? (
                                    <>Väntar på godkännande <Clock size={18} /></>
                                ) : (
                                    <>Avboka min plats <AlertCircle size={18} /></>
                                )
                            ) : isFull ? (
                                <>Fullbokat</>
                            ) : (
                                <>Anmäl mig nu <CheckCircle2 size={18} /></>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </Layout>
    );
}