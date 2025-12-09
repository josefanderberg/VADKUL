// src/pages/Login.tsx
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { userService } from '../services/userService';
import { storageService } from '../services/storageService';
import { ChevronLeft, Camera, RefreshCw, Check } from 'lucide-react';
import Layout from '../components/layout/Layout';

export default function Login() {
    const navigate = useNavigate();

    // State för läge (Logga in vs Registrera)
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [regStep, setRegStep] = useState(1); // 1 = Creds, 2 = Profil & Kamera

    // Form Data
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [age, setAge] = useState('');

    // UI State
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Camera State
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [cameraActive, setCameraActive] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);

    // --- LOGGA IN LOGIK ---
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/');
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
        setError('');
        setRegStep(2);
    };

    const handleRegister = async () => {
        if (!fullName || !age) {
            setError("Fyll i namn och ålder.");
            return;
        }
        if (!capturedImage) {
            setError("Du måste verifiera dig med en bild.");
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
            try {
                const res = await fetch(capturedImage);
                const blob = await res.blob();
                verificationUrl = await storageService.uploadFile(`users/${user.uid}/verification_image`, blob);
            } catch (uploadError) {
                console.error("Kunde inte ladda upp bild", uploadError);
                // Fortsätt ändå? Eller faila? Vi fortsätter men kanske loggar.
                // För MVP är det ok, men vi vill helst ha bilden.
            }

            // 3. Uppdatera Auth-profilen (Display Name)
            await updateProfile(user, {
                displayName: fullName,
                photoURL: verificationUrl || undefined // Sätt auth profilbild till verifieringsbilden initialt?
            });

            // 4. Spara utökad profil i Firestore
            await userService.createUserProfile(user.uid, {
                email: user.email || '',
                displayName: fullName,
                age: parseInt(age),
                isVerified: true,
                verificationImage: verificationUrl || capturedImage, // Fallback till base64 om upload failade (inte optimalt men säkert)
                photoURL: verificationUrl || undefined
            });

            navigate('/');
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
            <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 py-8">

                <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-700">

                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                        <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                            {isLoginMode ? 'Välkommen tillbaka' : (regStep === 1 ? 'Skapa konto' : 'Slutför profil')}
                        </h2>
                        {regStep === 2 && (
                            <button onClick={() => setRegStep(1)} className="text-slate-400 hover:text-indigo-600">
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
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-post</label>
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="namn@exempel.se" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lösenord</label>
                                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••" />
                                </div>
                                <button type="submit" disabled={loading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md disabled:opacity-70">
                                    {loading ? 'Loggar in...' : 'Logga In'}
                                </button>
                                <p className="text-center text-sm text-slate-500 mt-4">
                                    Inget konto? <button type="button" onClick={() => setIsLoginMode(false)} className="text-indigo-600 font-bold hover:underline">Registrera dig</button>
                                </p>
                            </form>
                        )}

                        {/* --- REGISTRERING STEG 1 --- */}
                        {!isLoginMode && regStep === 1 && (
                            <form onSubmit={handleNextStep} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">E-post</label>
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="namn@exempel.se" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Lösenord</label>
                                    <input type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)}
                                        className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Minst 6 tecken" />
                                </div>
                                <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md">
                                    Nästa
                                </button>
                                <p className="text-center text-sm text-slate-500 mt-4">
                                    Redan konto? <button type="button" onClick={() => setIsLoginMode(true)} className="text-indigo-600 font-bold hover:underline">Logga in</button>
                                </p>
                            </form>
                        )}

                        {/* --- REGISTRERING STEG 2 (Profil & Kamera) --- */}
                        {!isLoginMode && regStep === 2 && (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Namn</label>
                                        <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ditt namn" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ålder</label>
                                        <input type="number" required value={age} onChange={e => setAge(e.target.value)}
                                            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" placeholder="År" />
                                    </div>
                                </div>

                                {/* KAMERA SEKTION */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Verifiera dig (Ta en selfie)</label>

                                    <div className="relative w-full bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden aspect-[4/3] flex items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700">

                                        {/* 1. Ingen bild tagen än */}
                                        {!cameraActive && !capturedImage && (
                                            <button onClick={startCamera} className="flex flex-col items-center text-slate-400 hover:text-indigo-600 transition-colors">
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
                                            <button onClick={takePhoto} className="px-6 py-2 bg-indigo-600 text-white rounded-full font-bold shadow-lg hover:bg-indigo-700">
                                                Ta Bild
                                            </button>
                                        )}
                                        {capturedImage && (
                                            <div className="flex gap-3">
                                                <button onClick={retakePhoto} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg font-bold hover:bg-slate-300">
                                                    <RefreshCw size={16} /> Ta om
                                                </button>
                                                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg font-bold border border-green-200">
                                                    <Check size={16} /> Redo
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={handleRegister}
                                    disabled={loading || !capturedImage || !fullName || !age}
                                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                                >
                                    {loading ? 'Skapar konto...' : 'Slutför Registrering'}
                                </button>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </Layout>
    );
}