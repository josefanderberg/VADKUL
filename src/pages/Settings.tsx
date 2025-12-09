// src/pages/Settings.tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userService } from '../services/userService';
import { storageService } from '../services/storageService';
import { updatePassword } from 'firebase/auth';
import Layout from '../components/layout/Layout';
import { ArrowLeft, Save, LogOut, Camera, Lock, RefreshCw, CheckCircle2, User, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '../types';

export default function Settings() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeProfile, setActiveProfile] = useState<UserProfile | null>(null);

    // Form states
    const [displayName, setDisplayName] = useState('');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [age, setAge] = useState<string>('');
    const [bio, setBio] = useState('');
    const [profileImage, setProfileImage] = useState<string | null>(null);

    // Password State
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Verification State
    const [isVerified, setIsVerified] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [verificationImage, setVerificationImage] = useState<string | null>(null);

    useEffect(() => {
        if (!user) {
            navigate('/login');
            return;
        }

        async function load() {
            try {
                const profile = await userService.getUserProfile(user!.uid);
                setActiveProfile(profile);

                if (profile) {
                    setDisplayName(profile.displayName || '');
                    setAge(profile.age ? profile.age.toString() : '');
                    setBio(profile.bio || '');
                    setProfileImage(profile.photoURL || null);
                    setIsVerified(profile.isVerified);
                } else {
                    setDisplayName(user!.displayName || '');
                }
            } catch (error) {
                console.error(error);
                toast.error("Kunde inte hämta inställningar");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [user, navigate]);

    // Handle Input Changes och flagga unsaved
    const handleInputChange = (setter: (val: any) => void, val: any) => {
        setter(val);
        setHasUnsavedChanges(true);
    };

    // --- BILD-UPPLADDNING (Profile Pic - Storage) ---
    const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && user) {
            try {
                toast.loading("Laddar upp bild...");
                const url = await storageService.uploadFile(`users/${user.uid}/profile_pic`, file); // Skriver över gamla
                setProfileImage(url);
                setHasUnsavedChanges(true); // Vi sparar URLen i formen, men den sparas i DB när man klickar "Spara"? 
                // Alternativt: Spara URL direkt? Nej, användaren förväntar sig nog "Spara"-knappen.
                toast.dismiss();
                toast.success("Bild uppladdad! Glöm inte att spara.");
            } catch (error) {
                console.error(error);
                toast.dismiss();
                toast.error("Kunde inte ladda upp bild");
            }
        }
    };

    // --- VERIFIERING KAMERA ---
    const startCamera = async () => {
        try {
            setCameraActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            toast.error("Kunde inte starta kameran");
            setCameraActive(false);
        }
    };

    const takePhoto = async () => { // Async nu
        if (videoRef.current && canvasRef.current && user) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Konvertera Canvas till Blob för uppladdning
                canvas.toBlob(async (blob) => {
                    if (blob) {
                        try {
                            toast.loading("Laddar upp verifiering...");
                            // Unikt namn för att inte cacha/krocka om man tar om? 
                            // Eller skriv över `verification_pending.jpg`?
                            const url = await storageService.uploadFile(`users/${user.uid}/verification_image`, blob);
                            setVerificationImage(url);
                            stopCamera();
                            setHasUnsavedChanges(true);
                            toast.dismiss();
                            toast.success("Bild tagen!");
                        } catch (err) {
                            console.error(err);
                            toast.dismiss();
                            toast.error("Uppladdning misslyckades");
                        }
                    }
                }, 'image/jpeg', 0.8);
            }
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        setCameraActive(false);
    };

    // --- SAVE ---
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        try {
            const ageNum = parseInt(age) || 0;

            await userService.createUserProfile(user.uid, {
                displayName,
                age: ageNum,
                email: user.email || '',
                bio,
                photoURL: profileImage || undefined,
                // Om vi har tagit en ny verifieringsbild -> Sätt isVerified=false tills admin godkänt? 
                // Eller true om vi bara uppdaterar den? 
                // Logiken var: "Om man redan är verifierad, ska man inte kunna ladda upp".
                // Så om vi är här har vi laddat upp en ny -> Antagligen Pending eller True. 
                // Vi sätter den till true (verifierad via kamera) för enkelhetens skull i MVP.
                isVerified: isVerified || !!verificationImage,
                verificationImage: verificationImage || activeProfile?.verificationImage || undefined
            });

            // Om lösenord fyllts i
            if (newPassword) {
                if (newPassword.length < 6) {
                    toast.error("Lösenordet måste vara 6 tecken");
                } else if (newPassword !== confirmPassword) {
                    toast.error("Lösenorden matchar inte");
                } else {
                    await updatePassword(user, newPassword);
                    toast.success("Lösenord uppdaterat!");
                    setNewPassword('');
                    setConfirmPassword('');
                }
            }

            toast.success("Inställningar sparade!");
            setHasUnsavedChanges(false);
            // Uppdatera lokal state
            setIsVerified(isVerified || !!verificationImage);

        } catch (error) {
            console.error(error);
            toast.error("Kunde inte spara");
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = async () => {
        if (confirm("Är du säker på att du vill logga ut?")) {
            await logout();
            navigate('/login');
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="flex justify-center p-20 text-slate-400">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="max-w-xl mx-auto p-4 pb-20">

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-500">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Inställningar</h1>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">

                    <form onSubmit={handleSave} className="p-6 space-y-8">

                        {/* 1. PROFILBILD & NAMN */}
                        <section>
                            <h2 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                                <User size={14} /> Profil & Info
                            </h2>
                            <div className="flex items-start gap-4 mb-4">
                                <div className="relative group cursor-pointer">
                                    <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600">
                                        {profileImage ? (
                                            <img src={profileImage} alt="Profil" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-1">Ingen bild</div>
                                        )}
                                    </div>
                                    {/* Overlay med kamera-ikon för upload */}
                                    <label className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white rounded-full cursor-pointer">
                                        <Camera size={20} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageUpload} />
                                    </label>
                                </div>
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Visningsnamn</label>
                                        <input
                                            type="text"
                                            value={displayName}
                                            onChange={e => handleInputChange(setDisplayName, e.target.value)}
                                            className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none  dark:text-white text-sm"
                                            placeholder="Ditt namn"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Ålder</label>
                                        <input
                                            type="number"
                                            value={age}
                                            onChange={e => handleInputChange(setAge, e.target.value)}
                                            className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none  dark:text-white text-sm"
                                            placeholder="Din ålder"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* BIO */}
                            <div>
                                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                                    <FileText size={14} className="text-slate-400" /> Biografi
                                </label>
                                <textarea
                                    value={bio}
                                    onChange={e => handleInputChange(setBio, e.target.value)}
                                    rows={3}
                                    className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white text-sm resize-none"
                                    placeholder="Berätta kort om dig själv..."
                                />
                            </div>
                        </section>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* 2. VERIFIERING */}
                        <section>
                            <h2 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                                <CheckCircle2 size={14} /> Verifiering
                            </h2>

                            {isVerified ? (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 p-4 rounded-xl flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/50">
                                    <CheckCircle2 size={24} className="flex-shrink-0" />
                                    <div>
                                        <p className="font-bold">Du är verifierad!</p>
                                        <p className="text-xs opacity-80">Din identitet har bekräftats. Du kan inte ändra din verifieringsbild.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-400 p-4 rounded-xl border border-amber-100 dark:border-amber-900/50">
                                        <p className="font-bold text-sm mb-1">Du är inte verifierad</p>
                                        <p className="text-xs">För att öka tilliten i communityt behöver du verifiera din profil med en bild.</p>
                                    </div>

                                    {/* KAMERA LOGIK */}
                                    <div className="relative w-full max-w-sm mx-auto bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700">
                                        {!cameraActive && !verificationImage && (
                                            <button type="button" onClick={startCamera} className="flex flex-col items-center text-slate-500 hover:text-indigo-600 transition-colors">
                                                <Camera size={32} className="mb-2" />
                                                <span className="text-sm font-bold">Ta verifieringsbild</span>
                                            </button>
                                        )}
                                        {cameraActive && (
                                            <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                                        )}
                                        {verificationImage && (
                                            <img src={verificationImage} alt="Verifiering" className="absolute inset-0 w-full h-full object-cover" />
                                        )}
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>

                                    <div className="flex justify-center gap-3">
                                        {cameraActive && (
                                            <button type="button" onClick={takePhoto} className="px-4 py-2 bg-indigo-600 text-white rounded-full font-bold text-sm">Ta Bild</button>
                                        )}
                                        {cameraActive && (
                                            <button type="button" onClick={stopCamera} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-full font-bold text-sm">Avbryt</button>
                                        )}
                                        {verificationImage && (
                                            <button type="button" onClick={() => { setVerificationImage(null); startCamera(); setHasUnsavedChanges(true); }} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full font-bold text-sm hover:bg-slate-300">
                                                <RefreshCw size={14} /> Ta om
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </section>

                        <hr className="border-slate-100 dark:border-slate-700" />

                        {/* 3. SÄKERHET - LÖSENORD */}
                        <section>
                            <h2 className="text-xs font-bold uppercase text-slate-400 mb-4 flex items-center gap-2">
                                <Lock size={14} /> Lösenord
                            </h2>
                            <div className="space-y-3">
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => handleInputChange(setNewPassword, e.target.value)}
                                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none  dark:text-white text-sm"
                                    placeholder="Nytt lösenord (minst 6 tecken)"
                                />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none  dark:text-white text-sm"
                                    placeholder="Bekräfta lösenord"
                                />
                            </div>
                        </section>

                        <div className="pt-4 flex items-center justify-end sticky bottom-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md py-4 border-t border-slate-100 dark:border-slate-700 -mx-6 px-6">
                            <button
                                type="submit"
                                disabled={saving}
                                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <Save size={18} />
                                )}
                                Spara {hasUnsavedChanges && '*'}
                            </button>
                        </div>
                    </form>

                    {/* Danger Zone */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700">
                        <button
                            onClick={handleLogout}
                            className="text-red-600 font-bold text-sm flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors w-full justify-center"
                        >
                            <LogOut size={16} />
                            Logga ut
                        </button>
                    </div>

                </div>
            </div>
        </Layout>
    );
}
