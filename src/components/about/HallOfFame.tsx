// src/components/about/HallOfFame.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Star, Flame, Calendar, Users } from 'lucide-react';
import { eventService } from '../../services/eventService';

import type { AppEvent } from '../../types';
import { EVENT_CATEGORIES, type EventCategoryType } from '../../utils/categories';

interface LeaderboardUser {
    uid: string;
    name: string;
    image: string | null;
    score: number;
    initials: string;
}

export default function HallOfFame() {
    const [loading, setLoading] = useState(true);
    const [topCreators, setTopCreators] = useState<LeaderboardUser[]>([]);
    const [topHosts, setTopHosts] = useState<LeaderboardUser[]>([]);
    const [topInviters, setTopInviters] = useState<LeaderboardUser[]>([]);
    const [topEventsByCategory, setTopEventsByCategory] = useState<{ category: EventCategoryType, event: AppEvent }[]>([]);

    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            const CACHE_KEY = 'vadkul_hof_data_v3'; // Bump version
            const TIME_KEY = 'vadkul_hof_timestamp_v3';
            const CACHE_DURATION = 60 * 60 * 1000; // 1 timme

            const cached = sessionStorage.getItem(CACHE_KEY);
            const cacheTime = sessionStorage.getItem(TIME_KEY);
            const now = Date.now();

            if (cached && cacheTime && (now - parseInt(cacheTime) < CACHE_DURATION)) {
                console.log("Using cached Hall of Fame data");
                const { creators, hosts, inviters, eventsByCategory } = JSON.parse(cached);
                setTopCreators(creators);
                setTopHosts(hosts);
                setTopInviters(inviters || []);
                setTopEventsByCategory(eventsByCategory || []);
                setLoading(false);
                return;
            }

            console.log("Fetching fresh Hall of Fame data...");
            setLoading(true);
            try {
                const events = await eventService.getAll();

                // --- 0. Top Events per Category (Current Month) ---
                const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

                const eventsThisMonth = events.filter(e => {
                    return e.createdAt && new Date(e.createdAt) >= startOfMonth;
                });

                const bestPerCategory = new Map<EventCategoryType, AppEvent>();

                eventsThisMonth.forEach(event => {
                    const currentBest = bestPerCategory.get(event.type);
                    if (!currentBest) {
                        bestPerCategory.set(event.type, event);
                    } else {
                        const currentCount = currentBest.attendees?.length || 0;
                        const newCount = event.attendees?.length || 0;
                        if (newCount > currentCount) {
                            bestPerCategory.set(event.type, event);
                        }
                    }
                });

                // Convert to array and filter out those with 0 attendees if desired (or keep them)
                const topEvents = Array.from(bestPerCategory.entries())
                    .map(([category, event]) => ({ category, event }))
                    .sort((a, b) => (b.event.attendees?.length || 0) - (a.event.attendees?.length || 0));


                // --- 1. Top Creators (Most Events) ---
                const creatorMap = new Map<string, LeaderboardUser>();

                // --- 2. Top Hosts (Most Attendees) ---
                const hostMap = new Map<string, LeaderboardUser>();

                // --- 3. Top Inviters (MOCK DATA FOR NOW - Randomly pick from hosts) ---
                const potentialInviters: LeaderboardUser[] = [];

                events.forEach(event => {
                    const host = event.host;

                    // Update Creator Stats
                    if (!creatorMap.has(host.uid)) {
                        const userObj = {
                            uid: host.uid,
                            name: host.displayName || host.name,
                            image: host.photoURL || null,
                            score: 0,
                            initials: host.initials
                        };
                        creatorMap.set(host.uid, userObj);
                        potentialInviters.push({ ...userObj, score: 0 }); // Collect unique users for mock
                    }
                    const creator = creatorMap.get(host.uid)!;
                    creator.score += 1;

                    // Update Host Stats (Attendees)
                    if (!hostMap.has(host.uid)) {
                        hostMap.set(host.uid, {
                            uid: host.uid,
                            name: host.displayName || host.name,
                            image: host.photoURL || null,
                            score: 0,
                            initials: host.initials
                        });
                    }
                    const hostEntry = hostMap.get(host.uid)!;
                    hostEntry.score += (event.attendees?.length || 0); // Count all attendees
                });

                // Sort and take top 3
                const sortedCreators = Array.from(creatorMap.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);

                const sortedHosts = Array.from(hostMap.values())
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);

                // Mock logic for invitations
                const uniquePotential = Array.from(new Map(potentialInviters.map(item => [item.uid, item])).values());
                const sortedInviters = uniquePotential
                    .map(u => ({ ...u, score: Math.floor(Math.random() * 45) + 5 }))
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 3);


                setTopCreators(sortedCreators);
                setTopHosts(sortedHosts);
                setTopInviters(sortedInviters);
                setTopEventsByCategory(topEvents);

                // Spara till cache
                sessionStorage.setItem(CACHE_KEY, JSON.stringify({ creators: sortedCreators, hosts: sortedHosts, inviters: sortedInviters, eventsByCategory: topEvents }));
                sessionStorage.setItem(TIME_KEY, now.toString());

            } catch (error) {
                console.error("Failed to load hall of fame:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const renderPodium = (users: LeaderboardUser[], type: 'creator' | 'host' | 'inviter') => {
        if (users.length === 0) return <div className="text-center text-muted-foreground p-8">Ingen data än...</div>;

        return (
            <div className="flex flex-row items-end justify-center gap-2 md:gap-4 py-8 w-full max-w-md mx-auto">
                <div className="flex-1 flex justify-end">
                    {users[1] && <PodiumCard user={users[1]} place={2} type={type} />}
                </div>
                <div className="flex-1 flex justify-center z-10">
                    {users[0] && <PodiumCard user={users[0]} place={1} type={type} />}
                </div>
                <div className="flex-1 flex justify-start">
                    {users[2] && <PodiumCard user={users[2]} place={3} type={type} />}
                </div>
            </div>
        );
    };

    const currentMonthName = new Date().toLocaleString('sv-SE', { month: 'long' });
    const capitalizedMonth = currentMonthName.charAt(0).toUpperCase() + currentMonthName.slice(1);

    return (
        <div className="space-y-16 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4 px-4">
                <h2 className="text-3xl font-bold flex flex-col md:flex-row items-center justify-center gap-3">
                    <Trophy className="text-yellow-500" size={32} /> Hall of Fame
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                    Vi hyllar de som gör VADKUL möjligt! Här hittar du månadens hjältar.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : (
                <div className="space-y-20">

                    {/* --- NEW SECTION: EVENTS PER CATEGORY --- */}
                    <div className="space-y-8 px-4">
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-sm font-bold uppercase mb-2">
                                <Trophy size={14} /> Månadens Utvalda
                            </div>
                            <h3 className="text-2xl font-bold">{capitalizedMonth}s Största Events per Kategori</h3>
                            <p className="text-muted-foreground text-sm mt-2">Dessa events drog mest folk inom sin genre denna månad!</p>
                        </div>

                        {topEventsByCategory.length === 0 ? (
                            <div className="text-center p-8 bg-muted/30 rounded-xl border border-dashed border-border text-muted-foreground">Inga events skapade denna månad än!</div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {topEventsByCategory.map(({ category, event }) => {
                                    const catInfo = EVENT_CATEGORIES[category];
                                    return (
                                        <div
                                            key={event.id}
                                            onClick={() => navigate(`/public-profile/${event.host.uid}`)} // Link to host profile as requested or event? Ideally EventDetails? 
                                            // The user said "jämte info" and "can stand which month". Usually Hall of Fame links to profiles, but for an EVENT, maybe link to event? 
                                            // But previous feedback was about clicking to profile. I'll link to Profile for now as it's a Hall of Fame for USERS mostly.
                                            // Actally, let's link to the Event if it's about the event. But past events aren't clickable/viewable usually?
                                            // Let's stick to Profile for consistency with the rest of HoF.
                                            className={`relative flex items-center gap-4 p-4 rounded-xl border-2 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer bg-card ${catInfo.hoverBorder} border-transparent shadow-sm hover:shadow-md`}
                                        >
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0 ${catInfo.color}`}>
                                                {catInfo.emoji}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-bold text-muted-foreground uppercase mb-0.5">{catInfo.label}</div>
                                                <h4 className="font-bold text-foreground truncate">{event.title}</h4>
                                                <div className="text-xs text-muted-foreground">
                                                    Host: <span className="text-primary font-medium">{event.host.name}</span>
                                                </div>
                                            </div>
                                            <div className="text-center px-2 py-1 bg-muted rounded-lg">
                                                <div className="text-lg font-bold">{event.attendees?.length || 0}</div>
                                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Delt</div>
                                            </div>
                                            {/* Badge for #1 */}
                                            <div className="absolute -top-2 -right-2 bg-yellow-400 text-yellow-900 rounded-full p-1 shadow-sm">
                                                <Trophy size={12} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 px-4">

                        {/* TOP CREATORS */}
                        <div className="space-y-6 flex flex-col items-center w-full">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-bold uppercase mb-2">
                                    <Flame size={14} /> Eldsjälarna
                                </div>
                                <h3 className="text-xl font-bold">Flest Skapade Events</h3>
                            </div>
                            {renderPodium(topCreators, 'creator')}
                        </div>

                        {/* TOP HOSTS */}
                        <div className="space-y-6 flex flex-col items-center w-full">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-sm font-bold uppercase mb-2">
                                    <Users size={14} /> Publikmagneterna
                                </div>
                                <h3 className="text-xl font-bold">Flest Deltagare</h3>
                            </div>
                            {renderPodium(topHosts, 'host')}
                        </div>

                        {/* TOP INVITERS (NEW) */}
                        <div className="space-y-6 flex flex-col items-center w-full">
                            <div className="text-center">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-sm font-bold uppercase mb-2">
                                    <Star size={14} /> Ambassadörerna
                                </div>
                                <h3 className="text-xl font-bold">Flest Inbjudna</h3>
                            </div>
                            {renderPodium(topInviters, 'inviter')}
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
}

// MoviNg `useNavigate` to the parent component isn't strictly necessary if PodiumCard is in the same file, 
// but usually it's better to pass `onUserClick` prop if we want to keep it pure.
// However, simplest here is to just use hook inside PodiumCard or pass navigator.
// Since PodiumCard is a separate function component defined in the same file, it can use hooks.

function PodiumCard({ user, place, type }: { user: LeaderboardUser, place: number, type: 'creator' | 'host' | 'inviter' }) {
    const navigate = useNavigate(); // Hook must be used inside the component

    const isGold = place === 1;
    const isSilver = place === 2;
    const isBronze = place === 3;

    const heightClass = isGold ? 'h-64 md:h-72 order-2' : (isSilver ? 'h-56 md:h-60 order-1' : 'h-48 md:h-52 order-3');

    // Colors
    let borderClass = 'border-border';
    let bgClass = 'bg-card';
    let shadowClass = '';

    if (isGold) {
        borderClass = 'border-yellow-500/50';
        bgClass = 'bg-gradient-to-b from-yellow-500/10 to-card';
        shadowClass = 'shadow-lg shadow-yellow-500/20';
    } else if (isSilver) {
        borderClass = 'border-slate-400/50';
        bgClass = 'bg-gradient-to-b from-slate-400/10 to-card';
    } else if (isBronze) {
        borderClass = 'border-amber-700/50';
        bgClass = 'bg-gradient-to-b from-amber-700/10 to-card';
    }

    const getIcon = () => {
        switch (type) {
            case 'creator': return <Calendar size={12} />;
            case 'host': return <Users size={12} />;
            case 'inviter': return <Star size={12} />;
        }
    };

    return (
        <div
            onClick={() => navigate(`/public-profile/${user.uid}`)}
            className={`relative w-full max-w-[140px] md:max-w-[160px] cursor-pointer group ${heightClass} flex flex-col items-center justify-end p-4 rounded-t-2xl border-x border-t ${borderClass} ${bgClass} ${shadowClass} transition-all duration-500 hover:scale-105 hover:brightness-110`}
            title={`Gå till ${user.name}s profil`}
        >

            {/* RANK BADGE */}
            <div className={`absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm z-10 
                ${isGold ? 'bg-yellow-500' : (isSilver ? 'bg-slate-400' : 'bg-amber-700')}`}>
                {place}
            </div>

            {/* AVATAR */}
            <div className="mb-3 relative group-hover:-translate-y-2 transition-transform duration-300">
                {user.image ? (
                    <img src={user.image} alt={user.name} className={`w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 ${isGold ? 'border-yellow-500' : (isSilver ? 'border-slate-400' : 'border-amber-700')}`} />
                ) : (
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center text-xl font-bold border-4 ${isGold ? 'border-yellow-500' : (isSilver ? 'border-slate-400' : 'border-amber-700')} bg-muted text-muted-foreground`}>
                        {user.initials}
                    </div>
                )}
                {isGold && <Star className="absolute -top-2 -right-2 text-yellow-500 fill-yellow-500 animate-pulse" size={24} />}
            </div>

            {/* NAME */}
            <h4 className="font-bold text-sm md:text-base text-center line-clamp-1 w-full group-hover:text-primary transition-colors">{user.name}</h4>

            {/* SCORE */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-background/50 px-2 py-1 rounded-full">
                {getIcon()}
                <span>{user.score}</span>
            </div>
        </div>
    );
}
