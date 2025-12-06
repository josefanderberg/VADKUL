// src/pages/PublicProfile.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, MapPin, Calendar, CheckCircle2, User as UserIcon, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../types';

export default function PublicProfile() {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!uid) return;
      try {
        const data = await userService.getUserProfile(uid);
        if (data) {
          setProfile(data);
        } else {
          // Om ingen profil hittas (kanske gammalt event utan UID)
          console.error("Ingen profil hittades för ID:", uid);
        }
      } catch (error) {
        console.error("Fel vid hämtning av profil:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [uid]);

  const startChat = () => {
    if (!currentUser) {
        toast.error("Du måste logga in för att chatta.");
        return;
    }
    if (!profile) return;
    
    // Skicka med vem vi vill prata med till Chat-sidan
    navigate('/chat', { 
        state: { 
            targetUser: {
                uid: profile.uid,
                name: profile.displayName,
                image: profile.verificationImage
            } 
        } 
    });
  };

  if (loading) return <Layout><div className="p-10 text-center">Laddar profil...</div></Layout>;
  
  if (!profile) return (
    <Layout>
        <div className="p-10 text-center flex flex-col items-center">
            <p className="text-slate-500 mb-4">Kunde inte hitta användaren.</p>
            <button onClick={() => navigate(-1)} className="text-indigo-600 font-bold hover:underline">
                Gå tillbaka
            </button>
        </div>
    </Layout>
  );

  const isMe = currentUser?.uid === profile.uid;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-4 pt-4 md:pt-10">
        
        <button onClick={() => navigate(-1)} className="flex items-center text-slate-500 hover:text-indigo-600 mb-4 md:hidden">
            <ArrowLeft size={20} /> <span className="font-bold ml-1">Tillbaka</span>
        </button>

        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">
            
            {/* Omslagsbild (Dekorativ gradient) */}
            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>

            <div className="px-6 pb-8">
                {/* Avatar */}
                <div className="relative -mt-16 mb-4 inline-block">
                    {profile.verificationImage ? (
                        <img 
                            src={profile.verificationImage} 
                            alt={profile.displayName} 
                            className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 object-cover shadow-md bg-white"
                        />
                    ) : (
                        <div className="w-32 h-32 rounded-full border-4 border-white dark:border-slate-800 bg-slate-200 dark:bg-slate-700 flex items-center justify-center shadow-md">
                            <UserIcon size={48} className="text-slate-400" />
                        </div>
                    )}
                    {profile.isVerified && (
                        <div className="absolute bottom-2 right-2 bg-white dark:bg-slate-800 rounded-full p-1 shadow-sm" title="Verifierad">
                            <CheckCircle2 size={20} className="text-blue-500 fill-blue-50" />
                        </div>
                    )}
                </div>

                {/* Header Info & Knapp */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-1">
                            {profile.displayName}
                        </h1>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                            {profile.age > 0 ? `${profile.age} år gammal` : 'Ålder ej angiven'}
                        </p>
                    </div>

                    {/* CHATTA KNAPP - Visas bara om det INTE är jag */}
                    {!isMe && (
                        <button 
                            onClick={startChat}
                            className="w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 transition-transform active:scale-95"
                        >
                            <MessageCircle size={20} />
                            Chatta nu
                        </button>
                    )}
                </div>

                {/* Detaljer */}
                <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <MapPin size={16} />
                            <span className="text-xs font-bold uppercase">Plats</span>
                        </div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">Växjö</p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-slate-400 mb-1">
                            <Calendar size={16} />
                            <span className="text-xs font-bold uppercase">Medlem sedan</span>
                        </div>
                        <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Nyligen'}
                        </p>
                    </div>
                </div>

            </div>
        </div>
      </div>
    </Layout>
  );
}