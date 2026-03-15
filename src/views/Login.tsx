// src/pages/Login.tsx
import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { userService } from '../services/userService';
import { storageService } from '../services/storageService';
import { calculateAge } from '../utils/dateUtils';
import { Camera, RefreshCw, Check, ChevronLeft } from 'lucide-react';
import Layout from '../components/layout/Layout';

export default function Login() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Fånga läge eller referral code vid mount
    useEffect(() => {
        const mode = searchParams?.get('mode');
        if (mode === 'register') {
            setIsLoginMode(false);
        } else if (mode === 'login') {
            setIsLoginMode(true);
        }

        const ref = searchParams?.get('ref');
        if (ref) {
            console.log("Referral detected:", ref);
            sessionStorage.setItem('vadkul_ref_uid', ref);
            // Vi byter automatiskt till registreringsläget om man kommer via länk
            setIsLoginMode(false);
        }
    }, [searchParams]);

    // State för läge (Logga in vs Registrera)
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [regStep, setRegStep] = useState(1); // 1 = Creds, 2 = Profil & Kamera

    // Form Data
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState(''); // NY STATE
    const [fullName, setFullName] = useState('');
    const [birthDate, setBirthDate] = useState('');

    // UI State
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Camera State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // Date Refs & State for optimized UX
    const yearRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const dayRef = useRef<HTMLInputElement>(null);

    const [bYear, setBYear] = useState('');
    const [bMonth, setBMonth] = useState('');
    const [bDay, setBDay] = useState('');

    const updateBirthDate = (y: string, m: string, d: string) => {
        if (y.length === 4 && m.length > 0 && d.length > 0) {
            // Pad month/day with 0 if needed
            const padM = m.length === 1 ? `0${m}` : m;
            const padD = d.length === 1 ? `0${d}` : d;
            setBirthDate(`${y}-${padM}-${padD}`);
        } else {
            setBirthDate('');
        }
    };

    const handleYearChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length <= 4) {
            setBYear(val);
            updateBirthDate(val, bMonth, bDay);
            // Jump to Month if 4 digits
            if (val.length === 4) {
                monthRef.current?.focus();
            }
        }
    };

    const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value.replace(/[^0-9]/g, '');
        if (val.length <= 2) {
            setBMonth(val);
            updateBirthDate(bYear, val, bDay);
            // Jump to Day if 2 digits
            if (val.length === 2) {
                dayRef.current?.focus();
            }
        }
    };

    // --- LOGGA IN LOGIK ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            // Kolla om vi ska omdirigeras någonstans
            const redirect = searchParams?.get('redirect') || '/';
            router.push(redirect);
        } catch (err: any) {
            handleAuthError(err);
        } finally {
            setLoading(false);
        }
    };

    // --- KAMERA FUNKTIONER ---
    const startCamera = async () => {
        try {
            setCameraActive(true);
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error(err);
            setError("Kunde inte starta kameran. Kontrollera behörigheter.");
            setCameraActive(false);
        }
    };

    const takePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            // Sätt canvas storlek till videons storlek
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            if (context) {
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // Komprimera lite
                setCapturedImage(dataUrl);
                stopCamera();
            }
        }
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            const tracks = stream.getTracks();
            tracks.forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setCameraActive(false);
    };

    const retakePhoto = () => {
        setCapturedImage(null);
        startCamera();
    };

    // --- REGISTRERING LOGIK ---
    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        // Enkel validering steg 1
        if (password.length < 6) {
            setError("Lösenordet måste vara minst 6 tecken.");
            return;
        }
        if (password !== confirmPassword) {
            setError("Lösenorden matchar inte.");
            return;
        }
        setError('');
        setRegStep(2);
    };

    const handleRegister = async () => {
        if (!fullName || !birthDate) {
            setError("Fyll i namn och födelsedatum.");
            return;
        }

        // Validera datum strikt
        const [yStr, mStr, dStr] = birthDate.split('-');
        const y = parseInt(yStr);
        const m = parseInt(mStr);
        const d = parseInt(dStr);
        const now = new Date();
        const currentYear = now.getFullYear();

        // 1. Grundläggande gränser
        if (m < 1 || m > 12) {
            setError("Ogiltig månad.");
            return;
        }

        if (y < 1900 || y > currentYear) {
            setError("Ogiltigt årtal.");
            return;
        }

        // 2. Dagar i månaden (hanterar skottår automatiskt via Date(y, m, 0).getDate())
        const daysInMonth = new Date(y, m, 0).getDate();
        if (d < 1 || d > daysInMonth) {
            setError("Ogiltigt datum för vald månad.");
            return;
        }

        // 3. Framtida datum (kontrollera fullständigt datum)
        const dateObj = new Date(y, m - 1, d);
        if (dateObj > now) {
            setError("Födelsedatumet kan inte vara i framtiden.");
            return;
        }


        setError('');
        setLoading(true);

        try {
            // 1. Skapa Auth-användare
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2. Ladda upp verifieringsbild (från Base64 -> Blob -> Storage)
            let verificationUrl = '';
            if (capturedImage) {
                try {
                    const res = await fetch(capturedImage);
                    const blob = await res.blob();
                    verificationUrl = await storageService.uploadFile(`users/${user.uid}/verification_image`, blob);
                } catch (uploadError) {
                    console.error("Kunde inte ladda upp bild", uploadError);
                }
            }

            // 3. Uppdatera Auth-profilen (Display Name)
            await updateProfile(user, {
                displayName: fullName,
                photoURL: null // Vi sätter INTE verifieringsbilden som profilbild, null för att nollställa
            });

            // 4. Spara utökad profil i Firestore
            await userService.createUserProfile(user.uid, {
                email: user.email || '',
                displayName: fullName,
                age: calculateAge(birthDate),
                birthDate: birthDate,
                // Fix: Sätt till 'pending' ENDAST om bild laddades upp
                isVerified: false,
                verificationStatus: verificationUrl ? 'pending' : 'none',
                verificationImage: verificationUrl || capturedImage || undefined, // undefined will be filtered out by userService
                photoURL: null, // Null is valid in Firestore to signify "no value" if we want that
                referrerUid: sessionStorage.getItem('vadkul_ref_uid') || undefined // <--- Skicka med referrerUid
            });

            // Rensa ref efter användning
            sessionStorage.removeItem('vadkul_ref_uid');

            // Kolla om vi ska omdirigeras någonstans
            const redirect = searchParams?.get('redirect') || '/';
            router.push(redirect);
        } catch (err: any) {
            handleAuthError(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAuthError = (err: any) => {
        console.error(err);
        let msg = "Ett fel uppstod.";
        if (err.code === 'auth/invalid-credential') msg = "Fel e-post eller lösenord.";
        if (err.code === 'auth/email-already-in-use') msg = "E-postadressen används redan.";
        if (err.code === 'auth/weak-password') msg = "Lösenordet är för svagt.";
        setError(msg);
    };

    return (
        <Layout>
            <div className={`flex flex-col items-center justify-center min-h-screen px-4 pt-8 pb-40 ${!isLoginMode ? 'bg-gradient-to-b from-transparent to-emerald-50/30' : ''}`}>

                <div className={`w-full max-w-md bg-card rounded-2xl shadow-xl overflow-hidden border ${!isLoginMode ? 'border-emerald-200 ring-4 ring-emerald-50/50' : 'border-border'}`}>

                    {/* Header */}
                    <div className="p-6 border-b border-border flex items-center justify-between">
                        <h2 className="text-xl font-extrabold text-foreground">
                            {isLoginMode ? 'Välkommen tillbaka' : (regStep === 1 ? '🎉 Skapa nytt konto' : 'Slutför profil')}
                        </h2>
                        {regStep === 2 && (
                            <button onClick={() => setRegStep(1)} className="text-muted-foreground hover:text-primary">
                                <ChevronLeft size={24} />
                            </button>
                        )}
                    </div>

                    <div className="p-6">
                        {error && (
                            <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm font-medium border border-rose-100 mb-4">
                                {error}
                            </div>
                        )}

                        {/* --- LOGIN FORM --- */}
                        {isLoginMode && (
                            <form onSubmit={handleLogin} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">E-post</label>
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary" placeholder="namn@exempel.se" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Lösenord</label>
                                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary" placeholder="••••••" />
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-md disabled:opacity-70">
                                    {loading ? 'Loggar in...' : 'Logga In'}
                                </button>
                                <div className="relative py-4">
                                    <div className="absolute inset-0 flex items-center">
                                        <div className="w-full border-t border-border"></div>
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-card px-2 text-muted-foreground font-bold">eller</span>
                                    </div>
                                </div>

                                <button 
                                    type="button" 
                                    onClick={() => setIsLoginMode(false)}
                                    className="w-full py-3.5 bg-emerald-50 text-emerald-700 border-2 border-emerald-200 font-black rounded-xl hover:bg-emerald-100 transition-all active:scale-[0.98] uppercase tracking-wider text-sm shadow-sm"
                                >
                                    Skapa nytt konto ✨
                                </button>
                            </form>
                        )}

                        {/* --- REGISTRERING STEG 1 --- */}
                        {!isLoginMode && regStep === 1 && (
                            <form onSubmit={handleNextStep} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">E-post</label>
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary" placeholder="namn@exempel.se" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Lösenord</label>
                                    <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Minst 6 tecken" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Upprepa Lösenord</label>
                                    <input type="password" required minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-emerald-500" placeholder="Samma lösenord igen" />
                                </div>
                                <button type="submit" className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-black rounded-2xl shadow-[0_8px_0_0_rgba(6,78,59,1)] hover:shadow-[0_6px_0_0_rgba(6,78,59,1)] active:shadow-none active:translate-y-2 transition-all duration-150 uppercase tracking-wider">
                                    Nästa Steg →
                                </button>
                                <p className="text-center text-sm text-muted-foreground mt-4">
                                    Redan konto? <button type="button" onClick={() => setIsLoginMode(true)} className="text-primary font-bold hover:underline">Logga in</button>
                                </p>
                            </form>
                        )}

                        {/* --- REGISTRERING STEG 2 (Profil & Kamera) --- */}
                        {!isLoginMode && regStep === 2 && (
                            <>
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Namn</label>
                                        <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                                            className="w-full p-3.5 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary" placeholder="Ditt fullständiga namn" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Födelsedatum</label>
                                        <div className="grid grid-cols-10 gap-2">
                                            {/* ÅR */}
                                            <div className="col-span-4">
                                                <input
                                                    ref={yearRef}
                                                    type="text"
                                                    placeholder="ÅÅÅÅ"
                                                    maxLength={4}
                                                    value={bYear}
                                                    onChange={handleYearChange}
                                                    className="w-full p-3.5 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary text-center placeholder-muted-foreground/50"
                                                    required
                                                />
                                            </div>
                                            {/* MÅNAD */}
                                            <div className="col-span-3">
                                                <input
                                                    ref={monthRef}
                                                    type="text"
                                                    placeholder="MM"
                                                    maxLength={2}
                                                    value={bMonth}
                                                    onChange={handleMonthChange}
                                                    className="w-full p-3.5 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary text-center placeholder-muted-foreground/50"
                                                    required
                                                />
                                            </div>
                                            {/* DAG */}
                                            <div className="col-span-3">
                                                <input
                                                    ref={dayRef}
                                                    type="text"
                                                    placeholder="DD"
                                                    maxLength={2}
                                                    value={bDay}
                                                    onChange={(e) => {
                                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                                        setBDay(val);
                                                        updateBirthDate(bYear, bMonth, val);
                                                    }}
                                                    className="w-full p-3.5 rounded-xl border border-border bg-muted/50 text-foreground outline-none focus:ring-2 focus:ring-primary text-center placeholder-muted-foreground/50"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* KAMERA SEKTION */}
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase mb-2">Verifiera dig (Valfritt)</label>

                                    <div className="relative w-full bg-muted rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border-2 border-dashed border-border">

                                        {/* 1. Ingen bild tagen än */}
                                        {!cameraActive && !capturedImage && (
                                            <button onClick={startCamera} className="flex flex-col items-center text-muted-foreground hover:text-primary transition-colors">
                                                <Camera size={48} className="mb-2" />
                                                <span className="text-sm font-bold">Öppna kameran</span>
                                            </button>
                                        )}

                                        {/* 2. Kameran är igång */}
                                        {cameraActive && (
                                            <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
                                        )}

                                        {/* 3. Bilden är tagen */}
                                        {capturedImage && (
                                            <img src={capturedImage} alt="Verifiering" className="absolute inset-0 w-full h-full object-cover" />
                                        )}

                                        {/* Dold canvas för att fånga bilden */}
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>

                                    {/* Kamera Kontroller */}
                                    <div className="mt-3 flex justify-center">
                                        {cameraActive && (
                                            <button onClick={takePhoto} className="px-6 py-2 bg-primary text-primary-foreground rounded-full font-bold shadow-lg hover:bg-primary/90">
                                                Ta Bild
                                            </button>
                                        )}
                                        {capturedImage && (
                                            <div className="flex gap-3">
                                                <button onClick={retakePhoto} className="flex items-center gap-2 px-4 py-2 bg-muted text-foreground rounded-lg font-bold hover:bg-muted/80">
                                                    <RefreshCw size={16} /> Ta om
                                                </button>
                                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg font-bold border border-emerald-500/20">
                                                    <Check size={16} /> Redo
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleRegister}
                                    disabled={loading || !fullName || !birthDate}
                                    className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white text-lg font-black rounded-2xl shadow-[0_8px_0_0_rgba(6,78,59,1)] hover:shadow-[0_6px_0_0_rgba(6,78,59,1)] active:shadow-none active:translate-y-2 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none transition-all duration-150 mt-6 uppercase tracking-wider"
                                >
                                    {loading ? 'Skapar konto...' : 'Slutför Registrering'}
                                </button>
                            </>
                        )}

                    </div>
                </div>
            </div>
        </Layout >
    );
}