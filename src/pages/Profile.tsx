// src/pages/Profile.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { userService } from '../services/userService';
import { friendService, type FriendStatus } from '../services/friendService';
import type { AppEvent, UserProfile } from '../types';
import Layout from '../components/layout/Layout';
import EventCard from '../components/ui/EventCard';
import RateUserModal from '../components/profile/RateUserModal';
import { Star, LogOut, Settings, CheckCircle2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import Loading from '../components/ui/Loading';

export default function Profile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { uid } = useParams();

    // Determine whose profile we are viewing
    const targetUid = uid || user?.uid;
    const isMyProfile = user?.uid === targetUid;

    const [profile, setProfile] = useState<UserProfile | null>(null);

    // Data states
    const [hostedEvents, setHostedEvents] = useState<AppEvent[]>([]);
    const [joinedEvents, setJoinedEvents] = useState<AppEvent[]>([]);

    // Loading states
    const [profileLoading, setProfileLoading] = useState(true);
    const [eventsLoading, setEventsLoading] = useState(false);

    // Modal state
    const [isRateModalOpen, setIsRateModalOpen] = useState(false);

    // Cache flags
    const [hasLoadedHosted, setHasLoadedHosted] = useState(false);
    const [hasLoadedJoined, setHasLoadedJoined] = useState(false);

    const [activeTab, setActiveTab] = useState<'hosted' | 'joined'>('hosted');

    // Sort logic
    const [sortOption, setSortOption] = useState<'created' | 'time'>('created');

    // Friend State
    const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');

    // Rating check
    const [hasRated, setHasRated] = useState(false);

    // 1. Load Profile & Friend Status
    useEffect(() => {
        if (!targetUid) {
            if (!user) navigate('/login');
            return;
        }

        async function loadProfile() {
            setProfileLoading(true);
            try {
                const data = await userService.getUserProfile(targetUid!);
                setProfile(data);
                // Reset events on profile switch
                setHostedEvents([]);
                setJoinedEvents([]);
                setHasLoadedHosted(false);
                setHasLoadedJoined(false);
            } catch (err) {
                console.error(err);
            } finally {
                setProfileLoading(false);
            }
        }
        loadProfile();

        // Check friend status
        async function checkFriendship() {
            if (user && targetUid && user.uid !== targetUid) {
                try {
                    const status = await friendService.checkFriendStatus(user.uid, targetUid);
                    setFriendStatus(status);

                    // Also check if rated
                    const rated = await userService.hasUserReviewed(targetUid!, user.uid);
                    setHasRated(rated);
                } catch (e) {
                    console.error("Failed to check friend/rate status", e);
                }
            }
        }
        checkFriendship();

    }, [targetUid, user, navigate]);

    // 2. Load events based on tab
    useEffect(() => {
        if (!targetUid || !profile) return;

        async function loadEvents() {
            if (activeTab === 'hosted' && !hasLoadedHosted && user) {
                setEventsLoading(true);
                try {
                    const hosted = await eventService.getHostedEvents(targetUid!);
                    setHostedEvents(hosted);
                    setHasLoadedHosted(true);
                } catch (err) {
                    console.error("Error loading hosted events:", err);
                } finally {
                    setEventsLoading(false);
                }
            } else if (activeTab === 'joined' && !hasLoadedJoined && profile) {
                // Determine if we should load joined events
                // Allowed if: It is my profile OR we are friends
                const canView = isMyProfile || friendStatus === 'accepted';

                if (canView) {
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
                        setHasLoadedJoined(true);
                    } catch (err) {
                        console.error("Error loading joined events:", err);
                    } finally {
                        setEventsLoading(false);
                    }
                }
            }
        }

        loadEvents();
    }, [targetUid, profile, activeTab, hasLoadedHosted, hasLoadedJoined, user, isMyProfile, friendStatus]);

    const handleRateUser = async (rating: number, comment: string) => {
        if (!user || !profile || !user.email) return;

        await userService.addReview(profile.uid, {
            rating,
            comment,
            reviewer: {
                ...user,
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Anonym',
                age: 0,
                isVerified: false,
                createdAt: new Date(),
                photoURL: user.photoURL || undefined
            }
        });

        const updated = await userService.getUserProfile(profile.uid);
        if (updated) setProfile(updated);
        setHasRated(true);
    };

    // Friend Actions
    const handleSendFriendRequest = async () => {
        if (!user || !profile) return;
        try {
            await friendService.sendFriendRequest(user.uid, profile.uid);
            setFriendStatus('pending');
            toast.success("Vänförfrågan skickad!");
        } catch (e) {
            toast.error("Kunde inte skicka förfrågan.");
        }
    };

    const handleAcceptFriendRequest = async () => {
        if (!user || !profile) return;
        try {
            await friendService.acceptFriendRequest(user.uid, profile.uid);
            setFriendStatus('accepted');
            toast.success("Vänförfrågan accepterad! Ni är nu vänner.");
        } catch (e) {
            toast.error("Något gick fel.");
        }
    };

    const handleRemoveFriend = async () => {
        if (!user || !profile) return;
        if (!confirm("Är du säker på att du vill ta bort vännen?")) return;
        try {
            await friendService.removeFriend(user.uid, profile.uid);
            setFriendStatus('none');
            toast.success("Vän borttagen.");
        } catch (e) {
            toast.error("Kunde inte ta bort vän.");
        }
    };

    const startChat = () => {
        if (!user) {
            toast.error("Du måste logga in för att chatta.");
            return;
        }
        if (!profile) return;

        navigate('/chat', {
            state: {
                targetUser: {
                    uid: profile.uid,
                    name: profile.displayName,
                    image: profile.photoURL || null
                }
            }
        });
    };

    if (!user && !targetUid) return null;

    const displayName = profile?.displayName || (isMyProfile ? user?.displayName : 'Användare');
    const image = profile?.photoURL || undefined;
    const initials = (displayName || '??').substring(0, 2).toUpperCase();

    // Sort Logic
    // 1. Created (Desc) - Senast tillagd först
    // 2. Time (Asc) - Snarast först (Tid kvar)
    const rawList = activeTab === 'hosted' ? hostedEvents : joinedEvents;
    const currentList = [...rawList].sort((a, b) => {
        if (sortOption === 'created') {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA; // Nyast först
        } else {
            return new Date(a.time).getTime() - new Date(b.time).getTime(); // Snarast först
        }
    });

    const ratingValue = profile?.rating ? profile.rating.toFixed(1) : 'Ny';
    const ratingCount = profile?.ratingCount || 0;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto p-4 md:p-8 pb-20">

                {/* HEADER */}
                <div className="bg-card dark:bg-neutral-900 rounded-2xl shadow-xl overflow-hidden mb-8 border border-border">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start text-center md:text-left gap-6 relative">

                        {/* Avatar */}
                        <div className="relative flex-shrink-0">
                            {image ? (
                                <img
                                    src={image}
                                    alt="Profil"
                                    className="w-24 h-24 rounded-full object-cover border-4 border-background shadow-lg"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center text-3xl font-extrabold text-primary border-4 border-background shadow-lg">
                                    {initials}
                                </div>
                            )}
                            {profile?.isVerified && (
                                <div className="absolute bottom-0 right-0 bg-background rounded-full p-1 shadow-sm">
                                    <CheckCircle2 size={20} className="text-blue-500 fill-blue-50" />
                                </div>
                            )}
                        </div>

                        <div className="flex-grow">
                            {profileLoading ? (
                                <div className="h-8 w-48 bg-muted rounded animate-pulse mb-2"></div>
                            ) : (
                                <div>
                                    <h1 className="text-2xl font-extrabold text-foreground mb-1">
                                        {displayName}
                                    </h1>
                                    {profile?.bio && (
                                        <p className="text-muted-foreground text-sm mb-3 max-w-md mx-auto md:mx-0">
                                            {profile.bio}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center justify-center md:justify-start gap-3 text-sm text-muted-foreground mb-4">
                                {profileLoading ? (
                                    <div className="h-4 w-32 bg-muted rounded animate-pulse"></div>
                                ) : (
                                    <>
                                        {profile?.age && <span>{profile.age} år •</span>}
                                        <div className="flex items-center gap-1 font-bold text-foreground bg-muted/50 px-2 py-1 rounded-lg">
                                            <Star size={14} className="text-amber-400 fill-amber-400" />
                                            <span>{ratingValue}</span>
                                            <span className="text-muted-foreground font-normal text-xs">({ratingCount})</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {!isMyProfile && !profileLoading && (
                                <div className="flex flex-wrap gap-2 mt-2 md:mt-0">
                                    {/* --- FRIEND ACTIONS (Flyttade hit) --- */}
                                    {friendStatus === 'none' && (
                                        <button
                                            onClick={handleSendFriendRequest}
                                            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-full shadow-lg hover:bg-primary/90 transition-transform active:scale-95 flex items-center gap-2"
                                        >
                                            Lägg till vän
                                        </button>
                                    )}
                                    {friendStatus === 'pending' && (
                                        <button
                                            disabled
                                            className="px-4 py-2 bg-muted text-muted-foreground text-sm font-bold rounded-full cursor-not-allowed flex items-center gap-2"
                                        >
                                            Förfrågan skickad
                                        </button>
                                    )}
                                    {friendStatus === 'incoming' && (
                                        <button
                                            onClick={handleAcceptFriendRequest}
                                            className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-full shadow-lg hover:bg-green-700 transition-transform active:scale-95 flex items-center gap-2"
                                        >
                                            Acceptera
                                        </button>
                                    )}
                                    {friendStatus === 'accepted' && (
                                        <button
                                            onClick={handleRemoveFriend}
                                            className="px-4 py-2 bg-muted text-muted-foreground text-sm font-bold rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors flex items-center gap-2"
                                        >
                                            Vänner
                                        </button>
                                    )}

                                    {/* --- RATE BUTTON --- */}
                                    {hasRated ? (
                                        <div className="px-4 py-2 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 text-sm font-bold rounded-full border border-amber-200 dark:border-amber-700/50 flex items-center gap-2 cursor-pointer" title="Du har redan betygsatt">
                                            <Star size={16} fill="currentColor" /> Betygsatt
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setIsRateModalOpen(true)}
                                            className="px-4 py-2 bg-background text-foreground border border-border text-sm font-bold rounded-full shadow-sm hover:bg-muted transition-transform active:scale-95 flex items-center gap-2"
                                        >
                                            <Star size={16} /> Betygsätt
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Top Right Actions (Now only Settings/Logout/Chat) */}
                        <div className="flex gap-2 absolute top-4 right-4 md:static self-start">
                            {isMyProfile ? (
                                <>
                                    <button onClick={() => navigate('/settings')} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors">
                                        <Settings size={20} />
                                    </button>
                                    <button onClick={() => logout()} className="p-2 text-muted-foreground hover:text-destructive hover:bg-muted rounded-full transition-colors">
                                        <LogOut size={20} />
                                    </button>
                                </>
                            ) : (
                                <button onClick={startChat} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-full transition-colors" title="Skicka meddelande">
                                    <MessageSquare size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* TABS & SORT HEADER */}
                    <div className="border-t border-border">
                        {/* TAB BAR */}
                        <div className="flex">
                            <button
                                onClick={() => setActiveTab('hosted')}
                                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2
                        ${activeTab === 'hosted'
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-muted-foreground hover:bg-muted/50'
                                    }`}
                            >
                                {isMyProfile ? 'Mina Event' : 'Arrangerar'}
                                {hasLoadedHosted && (
                                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs animate-in fade-in">
                                        {hostedEvents.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setActiveTab('joined')}
                                className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2
                        ${activeTab === 'joined'
                                        ? 'border-primary text-primary bg-primary/5'
                                        : 'border-transparent text-muted-foreground hover:bg-muted/50'
                                    }`}
                            >
                                {isMyProfile ? 'Anmäld' : 'Deltar på'}
                                {hasLoadedJoined && (
                                    <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded-full text-xs animate-in fade-in">
                                        {joinedEvents.length}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* SORT CONTROLS - Visas bara om det finns events */}
                        {currentList.length > 0 && (activeTab === 'hosted' || friendStatus === 'accepted' || isMyProfile) && (
                            <div className="p-2 bg-muted/20 flex justify-end gap-2 px-4 border-b border-border/50">
                                <label className="text-xs font-semibold text-muted-foreground self-center mr-1">Sortera:</label>
                                <div className="flex bg-background rounded-lg p-1 border border-border shadow-sm">
                                    <button
                                        onClick={() => setSortOption('created')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                                            ${sortOption === 'created' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}
                                        `}
                                    >
                                        Senast tillagd
                                    </button>
                                    <button
                                        onClick={() => setSortOption('time')}
                                        className={`px-3 py-1 rounded-md text-xs font-medium transition-all
                                            ${sortOption === 'time' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted'}
                                        `}
                                    >
                                        Tid kvar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {eventsLoading && currentList.length === 0 ? (
                    <Loading text="Hämtar events..." />
                ) : (
                    <>
                        {/* CONDITIONAL CONTENT */}
                        {activeTab === 'joined' && !isMyProfile && friendStatus !== 'accepted' ? (
                            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border animate-in fade-in zoom-in-95 duration-300">
                                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4 text-muted-foreground">
                                    <LogOut size={32} />
                                </div>
                                <p className="text-muted-foreground font-medium mb-2">Detta innehåll är privat.</p>
                                <p className="text-sm text-muted-foreground/80">Du måste vara vän med {displayName} för att se vad de ska gå på.</p>
                            </div>
                        ) : currentList.length === 0 ? (
                            <div className="text-center py-16 bg-card rounded-2xl border border-dashed border-border animate-in fade-in zoom-in-95 duration-300">
                                <p className="text-muted-foreground font-medium mb-4">
                                    {activeTab === 'hosted'
                                        ? (isMyProfile ? "Du har inte skapat några events än." : "Inga events skapade än.")
                                        : (isMyProfile ? "Du är inte anmäld till några events." : "Inte anmäld till något än.")}
                                </p>
                                {isMyProfile && activeTab === 'hosted' && (
                                    <button onClick={() => navigate('/create')} className="px-5 py-2 bg-primary text-primary-foreground rounded-lg font-bold shadow-md hover:bg-primary/90 transition-transform active:scale-95">
                                        Skapa ett event
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                {currentList.map(evt => (
                                    <div key={evt.id} className="h-full">
                                        <EventCard event={evt} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <RateUserModal
                    isOpen={isRateModalOpen}
                    onClose={() => setIsRateModalOpen(false)}
                    onSubmit={handleRateUser}
                    targetName={profile?.displayName || 'Användaren'}
                />

            </div>
        </Layout>
    );
}