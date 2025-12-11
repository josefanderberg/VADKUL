// src/pages/PublicProfile.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, MapPin, Calendar, CheckCircle2, ArrowLeft, UserPlus, Flag, Star, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { friendService } from '../services/friendService';
import type { UserProfile, AppEvent } from '../types';
import Loading from '../components/ui/Loading';
import EventCard from '../components/ui/EventCard'; // Återanvänd EventCard!
import RateUserModal from '../components/profile/RateUserModal'; // Importera modalen

export default function PublicProfile() {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // --- NYA STATES FÖR EVENTS ---
    const [hostedEvents, setHostedEvents] = useState<AppEvent[]>([]);
    const [joinedEvents, setJoinedEvents] = useState<AppEvent[]>([]);
    const [activeTab, setActiveTab] = useState<'hosted' | 'joined'>('hosted');
    const [eventsLoading, setEventsLoading] = useState(false);

    // Friend / Rating State
    const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'incoming' | 'accepted'>('none');
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);
    const [hasRated, setHasRated] = useState(false);

    useEffect(() => {
        async function load() {
            if (!uid) return;

            // Legacy check (behålls från tidigare kod)
            if (uid === 'legacy_user') {
                setProfile({
                    uid: 'legacy_user',
                    displayName: 'Tidigare Användare',
                    email: '',
                    isVerified: false,
                    age: 0,
                    verificationImage: undefined, // Ingen bild
                    createdAt: new Date()
                } as UserProfile);
                setLoading(false);
                return;
            }

            try {
                const data = await userService.getUserProfile(uid);
                if (data) {
                    setProfile(data);

                    // --- CHECK FRIEND STATUS & RATING (om inloggad) ---
                    if (currentUser && currentUser.uid !== uid) {
                        try {
                            const status = await friendService.checkFriendStatus(currentUser.uid, uid);
                            setFriendStatus(status as any); // Type-cast om det behövs beroende på types

                            // Check if rated
                            const rated = await userService.hasUserReviewed(uid, currentUser.uid);
                            setHasRated(rated);

                        } catch (e) {
                            console.error("Failed to check status", e);
                        }
                    }

                    // --- LOAD HOSTED EVENTS (Alltid publika) ---
                    const hosted = await eventService.getHostedEvents(uid);
                    setHostedEvents(hosted);

                } else {
                    console.error("Ingen profil hittades för ID:", uid);
                }
            } catch (error) {
                console.error("Fel vid hämtning av profil:", error);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [uid, currentUser]);

    // --- LOAD JOINED EVENTS (Om vänner) ---
    useEffect(() => {
        async function loadJoined() {
            if (activeTab === 'joined' && joinedEvents.length === 0 && profile && uid) {
                // Endast om vän eller om det är jag själv (fast detta är public profile, så antagligen inte jag)
                // Eller om logiken säger att joined events är publika? USER sa "om man är vänner ska man kunna se vilka den ska gå på"

                // Så vi laddar bara om vänstatus är accepted.
                if (friendStatus === 'accepted') {
                    setEventsLoading(true);
                    try {
                        const all = await eventService.getAll();
                        const pEmail = profile.email || '';
                        const pUid = profile.uid;

                        const joined = all.filter(e =>
                            e.attendees.some(a => a.email === pEmail || a.uid === pUid) &&
                            e.host.uid !== pUid
                        );
                        setJoinedEvents(joined);
                    } catch (err) {
                        console.error(err);
                    } finally {
                        setEventsLoading(false);
                    }
                }
            }
        }
        loadJoined();
    }, [activeTab, friendStatus, profile, uid, joinedEvents.length]);


    const startChat = () => {
        if (!currentUser) {
            toast.error("Du måste logga in för att chatta.");
            return;
        }
        if (!profile) return;

        navigate('/chat', {
            state: {
                targetUser: {
                    uid: profile.uid,
                    name: profile.displayName,
                    image: profile.verificationImage || profile.photoURL
                }
            }
        });
    };

    const handleFriendRequest = async () => {
        if (!currentUser || !profile) return;

        try {
            if (friendStatus === 'none') {
                await friendService.sendFriendRequest(currentUser.uid, profile.uid);
                setFriendStatus('pending');
                toast.success("Vänförfrågan skickad!");
            }
        } catch (e) {
            toast.error("Kunde inte hantera vänförfrågan");
        }
    };

    const handleAcceptFriend = async () => {
        if (!currentUser || !profile) return;
        try {
            await friendService.acceptFriendRequest(currentUser.uid, profile.uid);
            setFriendStatus('accepted');
            toast.success("Ni är nu vänner!");
        } catch {
            toast.error("Misslyckades.");
        }
    };

    const handleRateUser = async (rating: number, comment: string) => {
        if (!currentUser || !profile || !currentUser.email) return;

        await userService.addReview(profile.uid, {
            rating,
            comment,
            reviewer: {
                ...currentUser,
                uid: currentUser.uid,
                email: currentUser.email,
                displayName: currentUser.displayName || 'Anonym',
                age: 0,
                isVerified: false,
                createdAt: new Date(),
                photoURL: currentUser.photoURL || undefined
            }
        });

        // Uppdatera profilen för att visa nytt snittbetyg
        const updated = await userService.getUserProfile(profile.uid);
        if (updated) setProfile(updated);
        setHasRated(true);
        toast.success("Tack för ditt betyg!");
    };


    if (loading) return <Layout><Loading text="Laddar profil..." /></Layout>;

    if (!profile) return (
        <Layout>
            <div className="p-10 text-center flex flex-col items-center">
                <p className="text-muted-foreground mb-4">Kunde inte hitta användaren.</p>
                <button onClick={() => navigate(-1)} className="text-primary font-bold hover:underline">
                    Gå tillbaka
                </button>
            </div>
        </Layout>
    );

    const isMe = currentUser?.uid === profile.uid; // Borde inte hända ofta på public profile men bra att ha
    const isLegacy = profile.uid === 'legacy_user';
    const initials = (profile.displayName || '??').substring(0, 2).toUpperCase();

    // Rating Display
    const ratingValue = profile.rating ? profile.rating.toFixed(1) : 'Ny';

    return (
        <Layout>
            <div className="max-w-4xl mx-auto p-4 md:p-8 pb-24">

                <button onClick={() => navigate(-1)} className="flex items-center text-muted-foreground hover:text-primary mb-4 md:hidden">
                    <ArrowLeft size={20} /> <span className="font-bold ml-1">Tillbaka</span>
                </button>

                {/* --- PROFIL HEADER (Liknande Profile.tsx) --- */}
                <div className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border mb-8">

                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative">

                        {/* Avatar */}
                        <div className="relative">
                            {profile.verificationImage || profile.photoURL ? (
                                <img
                                    src={profile.verificationImage || profile.photoURL}
                                    alt={profile.displayName}
                                    className="w-32 h-32 rounded-full border-4 border-background object-cover shadow-lg"
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-full border-4 border-background bg-primary/20 flex items-center justify-center shadow-lg text-4xl font-extrabold text-primary">
                                    {initials}
                                </div>
                            )}
                            {profile.isVerified && (
                                <div className="absolute bottom-2 right-2 bg-background rounded-full p-1.5 shadow-sm">
                                    <CheckCircle2 size={24} className="text-blue-500 fill-blue-50" />
                                </div>
                            )}
                        </div>

                        {/* Namn & Info */}
                        <div className="flex-1 text-center md:text-left w-full">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                                <div>
                                    <h1 className="text-3xl font-black text-foreground mb-1">
                                        {profile.displayName}
                                    </h1>

                                    {profile.bio && (
                                        <p className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto md:mx-0 leading-relaxed mb-3">
                                            {profile.bio}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm font-medium text-muted-foreground">
                                        {profile.age > 0 && <span>{profile.age} år</span>}

                                        <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 rounded-full border border-amber-500/20">
                                            <Star size={14} fill="currentColor" />
                                            <span className="font-bold">{ratingValue}</span>
                                            <span className="opacity-70 text-xs font-normal">({profile.ratingCount || 0})</span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            <MapPin size={14} />
                                            <span>Växjö</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar size={14} />
                                            <span>Medlem sedan {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Nyligen'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Desktop Top Right Report Button */}
                                {!isMe && !isLegacy && (
                                    <button onClick={handleReport} className="hidden md:block p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-full transition-colors self-start" title="Rapportera">
                                        <Flag size={20} />
                                    </button>
                                )}
                            </div>


                            {/* --- ACTIONS BAR --- */}
                            {!isMe && !isLegacy && (
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto mt-2">

                                    {/* 1. VÄN-KNAPP LOGIK */}
                                    {friendStatus === 'none' && (
                                        <button
                                            onClick={handleFriendRequest}
                                            className="flex-1 md:flex-none bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-primary/90 transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <UserPlus size={18} /> Lägg till vän
                                        </button>
                                    )}
                                    {friendStatus === 'pending' && (
                                        <button disabled className="flex-1 md:flex-none bg-muted text-muted-foreground px-5 py-2.5 rounded-xl font-bold border border-border cursor-not-allowed flex items-center justify-center gap-2">
                                            Vänförfrågan skickad
                                        </button>
                                    )}
                                    {friendStatus === 'incoming' && (
                                        <button onClick={handleAcceptFriend} className="flex-1 md:flex-none bg-green-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-green-700 transition-all flex items-center justify-center gap-2">
                                            <UserPlus size={18} /> Acceptera vän
                                        </button>
                                    )}
                                    {friendStatus === 'accepted' && (
                                        <div className="flex-1 md:flex-none px-5 py-2.5 rounded-xl font-bold border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 flex items-center justify-center gap-2">
                                            <CheckCircle2 size={18} /> Vänner
                                        </div>
                                    )}

                                    {/* 2. BETYGSÄTT KNAPP */}
                                    {hasRated ? (
                                        <button disabled className="flex-1 md:flex-none bg-muted/50 text-amber-600/70 border border-amber-500/10 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-default" title="Du har redan betygsatt">
                                            <Star size={18} fill="currentColor" /> Betygsatt
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => setIsRateModalOpen(true)}
                                            className="flex-1 md:flex-none bg-card text-foreground border border-border hover:bg-muted px-5 py-2.5 rounded-xl font-bold shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                                        >
                                            <Star size={18} /> Betygsätt
                                        </button>
                                    )}

                                    {/* 3. CHAT KNAPP */}
                                    <button
                                        onClick={startChat}
                                        className="flex-1 md:flex-none bg-secondary text-secondary-foreground hover:bg-secondary/80 px-5 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        <MessageCircle size={18} /> Chatta
                                    </button>

                                    {/* Mobile Report Button (In Action Row) */}
                                    <button
                                        onClick={handleReport}
                                        className="md:hidden p-3 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                        title="Rapportera"
                                    >
                                        <Flag size={20} className="text-destructive/80" />
                                    </button>

                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* --- TABS --- */}
                <div className="mb-6 flex border-b border-border">
                    <button
                        onClick={() => setActiveTab('hosted')}
                        className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2
                            ${activeTab === 'hosted' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}
                        `}
                    >
                        Arrangerar
                        <span className="bg-muted px-2 py-0.5 rounded-full text-xs text-muted-foreground">{hostedEvents.length}</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('joined')}
                        className={`pb-3 px-4 font-bold text-sm transition-colors border-b-2 flex items-center gap-2
                            ${activeTab === 'joined' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}
                        `}
                    >
                        Ska gå på
                        {friendStatus === 'accepted' && joinedEvents.length > 0 && (
                            <span className="bg-muted px-2 py-0.5 rounded-full text-xs text-muted-foreground">{joinedEvents.length}</span>
                        )}
                    </button>
                </div>


                {/* --- CONTENT AREA --- */}
                <div className="min-h-[200px]">

                    {/* CASE HOSTED EVENTS */}
                    {activeTab === 'hosted' && (
                        hostedEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                                {hostedEvents.map(evt => (
                                    <div key={evt.id} className="h-full">
                                        <EventCard event={evt} compact={false} />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                                Ingen events skapade just nu.
                            </div>
                        )
                    )}

                    {/* CASE JOINED EVENTS */}
                    {activeTab === 'joined' && (
                        friendStatus === 'accepted' ? (
                            eventsLoading ? (
                                <Loading text="Hämtar..." />
                            ) : (
                                joinedEvents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
                                        {joinedEvents.map(evt => (
                                            <div key={evt.id} className="h-full">
                                                <EventCard event={evt} compact={false} />
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
                                        {profile.displayName} ska inte gå på något just nu.
                                    </div>
                                )
                            )
                        ) : (
                            // PRIVATE CONTENT
                            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border flex flex-col items-center">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                                    <LogOut size={24} />
                                </div>
                                <h3 className="text-lg font-bold mb-2">Detta är privat</h3>
                                <p className="text-muted-foreground max-w-xs mx-auto mb-6">
                                    Du måste vara vän med {profile.displayName} för att se vilka events de ska gå på.
                                </p>
                                {friendStatus === 'none' && (
                                    <button
                                        onClick={handleFriendRequest}
                                        className="text-primary font-bold hover:underline"
                                    >
                                        Skicka vänförfrågan
                                    </button>
                                )}
                            </div>
                        )
                    )}

                </div>

            </div>

            {/* RATING MODAL */}
            <RateUserModal
                isOpen={isRateModalOpen}
                onClose={() => setIsRateModalOpen(false)}
                onSubmit={handleRateUser}
                targetName={profile.displayName}
            />

        </Layout>
    );

    // Helper för rapport (om det inte fanns definierat)
    function handleReport() {
        toast('Rapportera funktion ej implementerad ännu', { icon: '⚠️' });
    }
}