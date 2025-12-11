// src/pages/PublicProfile.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
// Importera nya ikoner: UserPlus för vän, Flag för rapport
import { MessageCircle, MapPin, Calendar, CheckCircle2, User as UserIcon, ArrowLeft, UserPlus, Flag } from 'lucide-react';
import toast from 'react-hot-toast';

import Layout from '../components/layout/Layout';
import { userService } from '../services/userService';
import { useAuth } from '../context/AuthContext';
import type { UserProfile } from '../types';
import Loading from '../components/ui/Loading';

export default function PublicProfile() {
    const { uid } = useParams<{ uid: string }>();
    const navigate = useNavigate();
    const { user: currentUser } = useAuth();

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // --- NYTT STATE FÖR VÄNNER OCH RAPPORT ---
    const [isFriend, setIsFriend] = useState(false);
    const [friendRequestSent, setFriendRequestSent] = useState(false);
    // ------------------------------------------

    useEffect(() => {
        async function load() {
            if (!uid) return;

            // --- FIX: Hantera gamla legacy-användare manuellt ---
            if (uid === 'legacy_user') {
                setProfile({
                    uid: 'legacy_user',
                    displayName: 'Tidigare Användare',
                    email: '',
                    isVerified: false,
                    age: 0,
                    verificationImage: undefined, // Ingen bild
                    createdAt: new Date() // Sätt dagens datum eller null
                } as UserProfile);
                setLoading(false);
                return;
            }
            // ----------------------------------------------------

            try {
                const data = await userService.getUserProfile(uid);
                if (data) {
                    setProfile(data);
                    // HÄR SKA LOGIK FÖR ATT KONTROLLERA VÄNSTATUS LIGGA
                    // Exempel: const isFr = await friendService.checkStatus(currentUser.uid, uid);
                    // setIsFriend(isFr);
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
    }, [uid]);

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
                    image: profile.verificationImage
                }
            }
        });
    };

    // --- MOCKAD LOGIK FÖR VÄN-FUNKTION ---
    const handleFriendRequest = () => {
        if (!currentUser) {
            toast.error("Du måste logga in för att skicka en vänförfrågan.");
            return;
        }
        if (!profile) return;

        if (isFriend) {
            // Logik för att ta bort vän
            toast.success(`Tog bort ${profile.displayName} som vän.`);
            setIsFriend(false);
        } else if (friendRequestSent) {
            // Logik för att avbryta förfrågan
            toast('Vänförfrågan avbruten.', { icon: '✋' });
            setFriendRequestSent(false);
        } else {
            // Logik för att skicka förfrågan
            toast.success(`Vänförfrågan skickad till ${profile.displayName}!`);
            setFriendRequestSent(true);
            // await friendService.sendRequest(currentUser.uid, profile.uid);
        }
    };

    // --- MOCKAD LOGIK FÖR RAPPORT-FUNKTION ---
    const handleReport = () => {
        if (!currentUser) {
            toast.error("Du måste logga in för att rapportera.");
            return;
        }
        if (!profile) return;

        // Här kan man öppna en modal eller navigera till en rapportsida
        // För detta exempel använder vi en toast.
        toast.error(`Rapportfunktion för ${profile.displayName} triggad.`, {
            duration: 3000,
            icon: '⚠️'
        });
        // navigate('/report-user', { state: { userId: profile.uid }});
    }
    // ------------------------------------------

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

    const isMe = currentUser?.uid === profile.uid;

    // --- FIX: Inaktivera chat om det är en legacy_user ---
    const isLegacy = profile.uid === 'legacy_user';

    // Vänknappens text
    const friendButtonText = isFriend ? 'Vänner' : (friendRequestSent ? 'Väntar...' : 'Lägg till som vän');
    // Vänknappens stil
    const friendButtonClass = isFriend
        ? 'bg-green-500 hover:bg-green-600'
        : (friendRequestSent
            ? 'bg-muted text-muted-foreground'
            : 'bg-primary hover:bg-primary/90');

    return (
        <Layout>
            <div className="max-w-2xl mx-auto p-4 pt-4 md:pt-10">

                <button onClick={() => navigate(-1)} className="flex items-center text-muted-foreground hover:text-primary mb-4 md:hidden">
                    <ArrowLeft size={20} /> <span className="font-bold ml-1">Tillbaka</span>
                </button>

                <div className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border">

                    {/* Omslagsbild */}
                    <div className={`h-32 bg-gradient-to-r ${isLegacy ? 'from-muted-foreground/50 to-muted-foreground' : 'from-primary/80 to-primary'}`}></div>

                    <div className="px-6 pb-8">
                        {/* Avatar */}
                        <div className="relative -mt-16 mb-4 inline-block">
                            {profile.verificationImage ? (
                                <img
                                    src={profile.verificationImage}
                                    alt={profile.displayName}
                                    className="w-32 h-32 rounded-full border-4 border-card object-cover shadow-md bg-card"
                                />
                            ) : (
                                <div className="w-32 h-32 rounded-full border-4 border-card bg-muted flex items-center justify-center shadow-md">
                                    <UserIcon size={48} className="text-muted-foreground" />
                                </div>
                            )}
                            {profile.isVerified && (
                                <div className="absolute bottom-2 right-2 bg-card rounded-full p-1 shadow-sm" title="Verifierad">
                                    <CheckCircle2 size={20} className="text-blue-500 fill-blue-50" />
                                </div>
                            )}
                        </div>

                        {/* Header Info & Knappar */}
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                            <div>
                                <h1 className="text-3xl font-extrabold text-foreground mb-1">
                                    {profile.displayName}
                                </h1>
                                <p className="text-muted-foreground font-medium flex items-center gap-2">
                                    {profile.age > 0 ? `${profile.age} år gammal` : ' '}
                                </p>
                            </div>

                            {/* ACTIONS - Visas bara om det INTE är jag OCH inte legacy */}
                            {!isMe && !isLegacy && (
                                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">

                                    {/* VÄN-KNAPP */}
                                    <button
                                        onClick={handleFriendRequest}
                                        className={`w-full md:w-auto text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20 dark:shadow-none flex items-center justify-center gap-2 transition-transform active:scale-95 ${friendButtonClass}`}
                                        disabled={friendRequestSent && !isFriend}
                                    >
                                        <UserPlus size={20} />
                                        {friendButtonText}
                                    </button>

                                    {/* CHATTA KNAPP */}
                                    <button
                                        onClick={startChat}
                                        className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95"
                                    >
                                        <MessageCircle size={20} />
                                        Chatta nu
                                    </button>

                                    {/* RAPPORTERA KNAPP (Diskret Utropstecken/Flagga) */}
                                    <button
                                        onClick={handleReport}
                                        title="Rapportera användare"
                                        className="md:w-auto p-3 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                    >
                                        <Flag size={20} className="text-destructive/80" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Detaljer */}
                        <div className="mt-8 grid grid-cols-2 gap-4">
                            <div className="p-4 bg-muted/30 rounded-xl border border-border">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <MapPin size={16} />
                                    <span className="text-xs font-bold uppercase">Plats</span>
                                </div>
                                <p className="font-semibold text-foreground">Växjö</p>
                            </div>
                            <div className="p-4 bg-muted/30 rounded-xl border border-border">
                                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                                    <Calendar size={16} />
                                    <span className="text-xs font-bold uppercase">Medlem sedan</span>
                                </div>
                                <p className="font-semibold text-foreground">
                                    {/* Om legacy, skriv inget datum eller skriv "Tidigare" */}
                                    {isLegacy ? '-' : (profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Nyligen')}
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Layout>
    );
}