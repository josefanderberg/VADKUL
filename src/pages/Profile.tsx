// src/pages/Profile.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { eventService } from '../services/eventService';
import { userService } from '../services/userService';
import type { AppEvent, UserProfile } from '../types';
import Layout from '../components/layout/Layout';
import EventCard from '../components/ui/EventCard';
import { Star, LogOut, Settings, CheckCircle2 } from 'lucide-react';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hostedEvents, setHostedEvents] = useState<AppEvent[]>([]);
  const [joinedEvents, setJoinedEvents] = useState<AppEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'hosted' | 'joined'>('hosted');

  useEffect(() => {
    if (!user) {
        navigate('/login');
        return;
    }

    async function load() {
        try {
            // 1. Hämta min utökade profil
            const myProfile = await userService.getUserProfile(user!.uid);
            setProfile(myProfile);

            // 2. Hämta alla events
            const all = await eventService.getAll();
            const myEmail = user!.email || '';
            const myUid = user!.uid;

            // Filtrera Hosted (Där jag är värd)
            const hosted = all.filter(e => e.host.email === myEmail);
            
            // Filtrera Joined (Där jag är deltagare, men INTE värd)
            // OBS: Här ändrar vi logiken från .includes() till .some()
            const joined = all.filter(e => 
                e.attendees.some(a => a.email === myEmail || a.uid === myUid) && 
                e.host.email !== myEmail
            );

            setHostedEvents(hosted);
            setJoinedEvents(joined);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }
    load();
  }, [user, navigate]);

  if (!user) return null;

  const displayName = profile?.displayName || user.displayName || user.email;
  const image = profile?.verificationImage;
  const initials = (displayName || 'ME').substring(0, 2).toUpperCase();
  const currentList = activeTab === 'hosted' ? hostedEvents : joinedEvents;

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
                    <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-1">
                        {displayName}
                    </h1>
                    <div className="flex items-center justify-center md:justify-start gap-2 text-sm text-slate-500 dark:text-slate-400 mb-4">
                        {profile?.age && <span>{profile.age} år •</span>}
                        <span className="flex items-center gap-1 font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                            5.0 <Star size={12} fill="currentColor" />
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 absolute top-4 right-4 md:static">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <Settings size={20} />
                    </button>
                    <button onClick={() => logout()} className="p-2 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <LogOut size={20} />
                    </button>
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
                    Mina Event
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs">
                        {hostedEvents.length}
                    </span>
                </button>
                <button 
                    onClick={() => setActiveTab('joined')}
                    className={`flex-1 py-4 text-sm font-bold border-b-2 transition-colors flex items-center justify-center gap-2
                        ${activeTab === 'joined' 
                            ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400 bg-indigo-50/50 dark:bg-indigo-900/10' 
                            : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        }`}
                >
                    Anmäld
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-xs">
                        {joinedEvents.length}
                    </span>
                </button>
            </div>
        </div>

        {/* LISTA */}
        {loading ? (
            <div className="text-center py-10 text-slate-400">Laddar din profil...</div>
        ) : currentList.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                <p className="text-slate-500 font-medium mb-4">
                    {activeTab === 'hosted' 
                        ? "Du har inte skapat några events än." 
                        : "Du är inte anmäld till några events."}
                </p>
                {activeTab === 'hosted' && (
                    <button onClick={() => navigate('/create')} className="px-5 py-2 bg-indigo-600 text-white rounded-lg font-bold shadow-md hover:bg-indigo-700">
                        Skapa ett nu
                    </button>
                )}
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {currentList.map(evt => (
                    <div key={evt.id} className="h-full">
                         <EventCard event={evt} />
                    </div>
                ))}
            </div>
        )}

      </div>
    </Layout>
  );
}