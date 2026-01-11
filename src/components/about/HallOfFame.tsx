// src/components/about/HallOfFame.tsx
import { useState, useEffect } from 'react';
import { Trophy, Star, Flame, Calendar, Users } from 'lucide-react';
import { eventService } from '../../services/eventService';

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

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const events = await eventService.getAll();

                // --- 1. Top Creators (Most Events) ---
                const creatorMap = new Map<string, LeaderboardUser>();

                // --- 2. Top Hosts (Most Attendees) ---
                const hostMap = new Map<string, LeaderboardUser>();

                events.forEach(event => {
                    const host = event.host;

                    // Update Creator Stats
                    if (!creatorMap.has(host.uid)) {
                        creatorMap.set(host.uid, {
                            uid: host.uid,
                            name: host.displayName || host.name,
                            image: host.photoURL || null,
                            score: 0,
                            initials: host.initials
                        });
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

                setTopCreators(sortedCreators);
                setTopHosts(sortedHosts);

            } catch (error) {
                console.error("Failed to load hall of fame:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const renderPodium = (users: LeaderboardUser[], type: 'creator' | 'host') => {
        if (users.length === 0) return <div className="text-center text-muted-foreground p-8">Ingen data än...</div>;

        return (
            <div className="flex flex-col md:flex-row items-end justify-center gap-4 py-8">
                {/* Silver (2nd) */}
                {users[1] && <PodiumCard user={users[1]} place={2} type={type} />}

                {/* Gold (1st) */}
                {users[0] && <PodiumCard user={users[0]} place={1} type={type} />}

                {/* Bronze (3rd) */}
                {users[2] && <PodiumCard user={users[2]} place={3} type={type} />}
            </div>
        );
    };

    return (
        <div className="space-y-16 py-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold flex items-center justify-center gap-3">
                    <Trophy className="text-yellow-500" size={32} /> Hall of Fame
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                    Månadens mest engagerade medlemmar. De som skapar möten och bygger gemenskap.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : (
                <div className="grid lg:grid-cols-2 gap-12">

                    {/* TOP CREATORS */}
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 text-sm font-bold uppercase mb-2">
                                <Flame size={14} /> Eldsjälarna
                            </div>
                            <h3 className="text-xl font-bold">Flest Skapade Events</h3>
                        </div>
                        {renderPodium(topCreators, 'creator')}
                    </div>

                    {/* TOP HOSTS */}
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-sm font-bold uppercase mb-2">
                                <Users size={14} /> Publikmagneterna
                            </div>
                            <h3 className="text-xl font-bold">Flest Deltagare</h3>
                        </div>
                        {renderPodium(topHosts, 'host')}
                    </div>
                </div>
            )}
        </div>
    );
}

function PodiumCard({ user, place, type }: { user: LeaderboardUser, place: number, type: 'creator' | 'host' }) {
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

    return (
        <div className={`relative w-full max-w-[140px] md:max-w-[160px] ${heightClass} flex flex-col items-center justify-end p-4 rounded-t-2xl border-x border-t ${borderClass} ${bgClass} ${shadowClass} transition-transform hover:scale-105`}>

            {/* RANK BADGE */}
            <div className={`absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm z-10 
                ${isGold ? 'bg-yellow-500' : (isSilver ? 'bg-slate-400' : 'bg-amber-700')}`}>
                {place}
            </div>

            {/* AVATAR */}
            <div className="mb-3 relative">
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
            <h4 className="font-bold text-sm md:text-base text-center line-clamp-1 w-full">{user.name}</h4>

            {/* SCORE */}
            <div className="mt-2 flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-background/50 px-2 py-1 rounded-full">
                {type === 'creator' ? <Calendar size={12} /> : <Users size={12} />}
                <span>{user.score}</span>
            </div>
        </div>
    );
}
