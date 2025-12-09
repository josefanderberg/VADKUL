// src/pages/Profile.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // <--- useParams
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { userService } from '../services/userService';
import type { AppEvent, UserProfile } from '../types';
import Layout from '../components/layout/Layout';
import EventCard from '../components/ui/EventCard';
import RateUserModal from '../components/profile/RateUserModal'; // <--- Modal
import { Star, LogOut, Settings, CheckCircle2, MessageSquare } from 'lucide-react';

export default function Profile() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const { uid } = useParams(); // <--- Hämta ID från URL

    // Bestäm vems profil vi tittar på
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

    // Cache flags to avoid refetching
    const [hasLoadedHosted, setHasLoadedHosted] = useState(false);
    const [hasLoadedJoined, setHasLoadedJoined] = useState(false);

    const [activeTab, setActiveTab] = useState<'hosted' | 'joined'>('hosted');

    // 1. Ladda profil
    useEffect(() => {
        if (!targetUid) {
            // Om ingen är inloggad och inget ID finns
            if (!user) navigate('/login');
            return;
        }

        async function loadProfile() {
            setProfileLoading(true); // Reset loading vid byte av ID
            try {
                const data = await userService.getUserProfile(targetUid);
                setProfile(data);
                // Reset events vid byte av profil
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
    }, [targetUid, user, navigate]);

    // 2. Ladda events baserat på flik
    useEffect(() => {
        if (!targetUid || !profile) return;

        async function loadEvents() {
            if (activeTab === 'hosted' && !hasLoadedHosted && user) {
                setEventsLoading(true);
                try {
                    const hosted = await eventService.getHostedEvents(targetUid);
                    setHostedEvents(hosted);
                    setHasLoadedHosted(true);
                } catch (err) {
                    console.error("Fel vid hämtning av events:", err);
                } finally {
                    setEventsLoading(false);
                }
            } else if (activeTab === 'joined' && !hasLoadedJoined && profile) {
                setEventsLoading(true);
                try {
                    // Fallback: Hämta alla och filtrera
                    const all = await eventService.getAll();
                    // Vi behöver veta emailen för denna user, vilket vi har i profile
                    const pEmail = profile.email || '';
                    const pUid = profile.uid;

                    const joined = all.filter(e =>
                        e.attendees.some(a => a.email === pEmail || a.uid === pUid) &&
                        e.host.uid !== pUid
                    );

                    setJoinedEvents(joined);
                    setHasLoadedJoined(true);
                } catch (err) {
                    console.error("Fel vid hämtning av anmälda events:", err);
                } finally {
                    setEventsLoading(false);
                }
            }
        }

        loadEvents();
    }, [targetUid, profile, activeTab, hasLoadedHosted, hasLoadedJoined, user]);

    const handleRateUser = async (rating: number, comment: string) => {
        if (!user || !profile || !user.email) return;

        // Optimistisk uppdatering UI (kan göras bättre men detta räcker)
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
                createdAt: new Date()
            } // Mockar ihop en userprofile av auth-objektet ifall den saknas
        });

        // Uppdatera profilen efteråt för att visa nytt snitt
        const updated = await userService.getUserProfile(profile.uid);
        if (updated) setProfile(updated);
    };

    if (!user && !targetUid) return null;

    const displayName = profile?.displayName || (isMyProfile ? user?.displayName : 'Användare');
    const image = profile?.photoURL || profile?.verificationImage || undefined;
    const initials = (displayName || '??').substring(0, 2).toUpperCase();
    const currentList = activeTab === 'hosted' ? hostedEvents : joinedEvents;

    // Formatera betyg
    const ratingValue = profile?.rating ? profile.rating.toFixed(1) : 'Ny';
    const ratingCount = profile?.ratingCount || 0;

    return (
        <Layout>
            <div className="max-w-4xl mx-auto p-4 md:p-8 pb-20">

                {/* HEADER */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden mb-8 border border-slate-100 dark:border-slate-700">
                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-center md:items-start gap-6 relative">

                        {/* Avatar */}
                        <div className="relative">
                            {image ? (
                                <img
                                    src={image}
                                    alt="Profil"
                                    className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-slate-700 shadow-lg"
                                />
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-3xl font-extrabold text-indigo-600 dark:text-indigo-300 border-4 border-white dark:border-slate-700 shadow-lg">
                                    {initials}
                                </div>
                            )}
                            {profile?.isVerified && (
                                <div className="absolute bottom-0 right-0 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm">
                                    <CheckCircle2 size={20} className="text-blue-500 fill-blue-50" />
                                </div>
                            )}
                        </div>

                        <div className="text-center md:text-left flex-grow">
                            {profileLoading ? (
                                <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded animate-pulse mb-2"></div>
                            ) : (
                                <div>
                                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
                                        {displayName}
                                    </h1>
                                    {profile?.bio && (
                                        <p className="text-slate-600 dark:text-slate-300 text-sm mb-3 max-w-md mx-auto md:mx-0">
                                            {profile.bio}
                                        </p>
                                    )}
                                </div>
                            )}
                            <div className="flex items-center justify-center md:justify-start gap-3 text-sm text-slate-500 dark:text-slate-400 mb-4">
                                {profileLoading ? (
                                    <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"></div>
                                ) : (
                                    <>
                                        {profile?.age && <span>{profile.age} år •</span>}

                                        {/* BETYG */}
                                        <div className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-lg">
                                            <Star size={14} className="text-amber-400 fill-amber-400" />
                                            <span>{ratingValue}</span>
                                            <span className="text-slate-400 font-normal text-xs">({ratingCount})</span>
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* KNAPPAR: Visa bara "Betygsätt" om det INTE är min profil */}
                            {!isMyProfile && !profileLoading && (
                                <button
                                    onClick={() => setIsRateModalOpen(true)}
                                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-full shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 flex items-center gap-2 mx-auto md:mx-0"
                                >
                                    <Star size={16} /> Betygsätt
                                </button>
                            )}
                        </div>

                        {/* Actions (Bara om det är min profil, annars kanske vi vill ha chat?) */}
                        <div className="flex gap-2 absolute top-4 right-4 md:static">
                            {isMyProfile ? (
                                <>
                                    <button onClick={() => navigate('/settings')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                        <Settings size={20} />
                                    </button>
                                    <button onClick={() => logout()} className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                        <LogOut size={20} />
                                    </button>
                                </>
                            ) : (
                                // TODO: Chat-knapp här, om vi vill länka till direktmeddelande (framtida feature)
                                <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                    <MessageSquare size={20} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* TABS */}
                    <div className="flex border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={() => setActiveTab('hosted')}
                            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2
                        ${activeTab === 'hosted'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            {isMyProfile ? 'Mina Event' : 'Arrangerar'}
                            {hasLoadedHosted && (
                                <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs animate-in fade-in">
                                    {hostedEvents.length}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={() => setActiveTab('joined')}
                            className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2
                        ${activeTab === 'joined'
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10'
                                    : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            {isMyProfile ? 'Anmäld' : 'Deltar på'}
                            {hasLoadedJoined && (
                                <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs animate-in fade-in">
                                    {joinedEvents.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* LISTA */}
                {eventsLoading && currentList.length === 0 ? (
                    <div className="text-center py-20 text-slate-400 animate-pulse">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-indigo-600 animate-spin"></div>
                            <p>Hämtar events...</p>
                        </div>
                    </div>
                ) : currentList.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-300">
                        <p className="text-slate-500 font-medium mb-4">
                            {activeTab === 'hosted'
                                ? (isMyProfile ? "Du har inte skapat några events än." : "Inga events skapade än.")
                                : (isMyProfile ? "Du är inte anmäld till några events." : "Inte anmäld till något än.")}
                        </p>
                        {isMyProfile && activeTab === 'hosted' && (
                            <button onClick={() => navigate('/create')} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-transform active:scale-95">
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

                {/* MODAL */}
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