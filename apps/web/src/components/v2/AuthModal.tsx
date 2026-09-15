'use client';

import { useEffect, useState } from 'react';
import { X, LogIn, UserPlus, Check } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CITIES, getCity } from '@/lib/cityUtils';
import { DERIVED_CITY_KEY } from '@/hooks/useSaveUserCity';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import toast from 'react-hot-toast';

interface AuthModalProps {
    open: boolean;
    onClose: () => void;
    /** Visas överst — t.ex. "Logga in för att chatta". */
    reason?: string;
    /** Öppna välkomstrutan (Om VADKUL). Utloggades enda väg dit sedan den
     *  flytande info-knappen revs 15/9. Utelämnad → länken döljs. */
    onOpenAbout?: () => void;
}

/** Översätt Firebase-felkoder till begriplig svenska. */
function authErrorText(code: string): string {
    // Okänd e-post — fås bara när Firebase email-enumeration protection är AV.
    // Är skyddet PÅ (default på nya projekt) returneras 'invalid-credential' istället,
    // och då går det inte att skilja okänt konto från fel lösenord på klienten.
    if (code.includes('user-not-found'))
        return 'Det finns inget konto med den e-postadressen — skapa ett konto först.';
    if (code.includes('wrong-password')) return 'Fel lösenord.';
    if (code.includes('invalid-credential'))
        return 'Fel e-post eller lösenord. Saknar du konto? Skapa ett nedan.';
    if (code.includes('email-already-in-use')) return 'E-postadressen används redan — logga in istället.';
    if (code.includes('weak-password')) return 'Lösenordet behöver minst 6 tecken.';
    if (code.includes('invalid-email')) return 'Ogiltig e-postadress.';
    if (code.includes('too-many-requests')) return 'För många försök — vänta en stund.';
    return 'Något gick fel. Försök igen.';
}

/**
 * Inloggning/registrering i en modal — man lämnar aldrig kartan.
 * Samma e-post+lösenord-flöde som gamla /login-sidan.
 */
export default function AuthModal({ open, onClose, reason, onOpenAbout }: AuthModalProps) {
    const { signIn, signInWithGoogle, register, resetPassword } = useAuth();
    // 'complete' = kompletteringssteget efter första Google-inloggningen:
    // registreringsblankettens statistik-/segmenteringsfält (ålder, kön,
    // stad, barn) som Google-flödet annars hoppar över. Man ÄR redan
    // inloggad där — kryss/Hoppa över stänger utan krav.
    const [mode, setMode] = useState<'login' | 'register' | 'complete'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Ålder + kön (statistikunderlag) — samlas in vid registrering och speglas
    // till users/{uid}. Kön har alltid "Vill inte ange" som utväg.
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    // Stad (valfri) — förifylls från kartans GPS-härledning (localStorage).
    // cityTouched skiljer "godkände förslaget" (gps → fortsätter auto-
    // uppdateras) från "valde själv" (manual → GPS rör den aldrig).
    const [citySlug, setCitySlug] = useState('');
    const [cityTouched, setCityTouched] = useState(false);
    // "Jag har barn" — bara kryssrutan här (registreringen hålls lätt);
    // barnens åldrar kompletteras i profilpanelen. Styr kartans standardfilter
    // (Familj & barn auto-på för den som har barn).
    const [hasChildren, setHasChildren] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open || cityTouched || citySlug) return;
        try {
            const raw = localStorage.getItem(DERIVED_CITY_KEY);
            if (!raw) return;
            const derived = JSON.parse(raw);
            // Validera mot CITIES — stashen kan vara gammal/korrupt.
            if (derived?.slug && getCity(derived.slug)) setCitySlug(derived.slug);
        } catch { /* ingen prefill */ }
    }, [open, cityTouched, citySlug]);

    // Rensa felet när användaren ändrar input, byter läge eller öppnar modalen på nytt
    // — så att ett gammalt fel aldrig hänger kvar.
    useEffect(() => { setError(null); }, [email, password, name, age, gender, mode, open]);

    // Stängd modal → tillbaka till login-läget, så en senare öppning aldrig
    // landar i ett kvarglömt kompletteringssteg.
    useEffect(() => { if (!open) setMode('login'); }, [open]);

    // Escape stänger modalen — standardbeteende för dialoger (tangentbord/SR).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const forgot = async () => {
        if (!email.trim()) {
            setError('Skriv din e-postadress i fältet ovan först.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await resetPassword(email);
            toast.success('Vi har skickat en återställningslänk till din e-post.');
        } catch (err: any) {
            setError(authErrorText(String(err?.code ?? err)));
        } finally {
            setBusy(false);
        }
    };

    // Google — ETT klick, inget formulär (kontot skapas automatiskt första
    // gången; stad förifylls från GPS-härledningen i AuthContext). Anonyma
    // tips-sessioner länkas så tipsen följer med. Nya konton skickas vidare
    // till kompletteringssteget — där fångas ålder/kön/stad/barn som
    // registreringsblanketten annars samlar in.
    const google = async () => {
        setBusy(true);
        setError(null);
        try {
            const { needsProfile } = await signInWithGoogle();
            if (needsProfile) {
                toast.success('Välkommen till VADKUL!');
                setMode('complete');
                return;
            }
            toast.success('Inloggad!');
            onClose();
        } catch (err: any) {
            const code = String(err?.code ?? err);
            // En stängd popup är ett val, inte ett fel — visa ingenting.
            if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) return;
            if (code.includes('popup-blocked')) {
                setError('Webbläsaren blockerade Google-rutan — tillåt popup-fönster för vadkul.se och försök igen.');
                return;
            }
            if (code.includes('account-exists-with-different-credential')) {
                setError('E-postadressen har redan ett konto med lösenord — logga in med det nedan.');
                return;
            }
            if (code.includes('operation-not-allowed')) {
                setError('Google-inloggning är inte påslagen ännu — logga in med e-post så länge.');
                return;
            }
            // Domänen saknas i Firebase Auths tillåtlista (Authentication →
            // Settings → Authorized domains) — drabbade vadkul.se vid
            // lanseringen 13/9. Nämn koden så felet går att känna igen.
            if (code.includes('unauthorized-domain')) {
                setError('Inloggning är inte tillåten från den här adressen ännu (unauthorized-domain) — logga in med e-post så länge.');
                return;
            }
            // Okänd kod → logga den; utan detta är felet ogissbart i efterhand.
            console.warn('[auth] Google-inloggningen föll:', code);
            setError('Google-inloggningen gick inte att slutföra. Försök igen.');
        } finally {
            setBusy(false);
        }
    };

    // Kompletteringsstegets spara: skriv statistik-/segmenteringsfälten till
    // users/{uid} (merge — grundprofil + ev. GPS-stad är redan speglade av
    // signInWithGoogle). Samma fältsemantik som register: okryssad barnruta
    // är "inget svar", manuellt vald stad vinner över GPS.
    const saveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const uid = auth.currentUser?.uid;
        if (!uid) { onClose(); return; } // borde inte hända — men lås aldrig fast någon
        setBusy(true);
        setError(null);
        try {
            const city = citySlug ? getCity(citySlug) : null;
            await setDoc(doc(db, 'users', uid), {
                ...(age.trim() && Number.isFinite(Number(age)) ? { age: Number(age) } : {}),
                ...(gender ? { gender } : {}),
                ...(hasChildren ? { hasChildren: true } : {}),
                ...(city ? {
                    city: city.name,
                    citySlug: city.slug,
                    citySource: (cityTouched ? 'manual' : 'gps') as 'gps' | 'manual',
                    cityUpdatedAt: serverTimestamp(),
                } : {}),
            }, { merge: true });
            toast.success('Klart — profilen är sparad!');
            onClose();
        } catch (err) {
            console.error(err);
            setError('Kunde inte spara. Försök igen — eller hoppa över så länge.');
        } finally {
            setBusy(false);
        }
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
            if (mode === 'login') await signIn(email, password);
            else {
                const city = citySlug ? getCity(citySlug) : null;
                await register(name, email, password, {
                    age: age.trim() ? Number(age) : undefined,
                    gender: gender || undefined,
                    hasChildren: hasChildren || undefined,
                    ...(city ? {
                        city: city.name,
                        citySlug: city.slug,
                        citySource: (cityTouched ? 'manual' : 'gps') as 'gps' | 'manual',
                    } : {}),
                });
            }
            toast.success(mode === 'login' ? 'Inloggad!' : 'Välkommen till VADKUL!');
            onClose();
        } catch (err: any) {
            setError(authErrorText(String(err?.code ?? err)));
        } finally {
            setBusy(false);
        }
    };

    return (
        // Rutan bär SAMMA mörka platta-språk som stadsnamnet/dagväljaren på
        // kartan (Josef 31/8 — den mörkblå looken utbytt): slate-900/80 +
        // blur + white/10-kant, guld (#FECC02) som accent i stället för blått.
        // Samma look i ljust och mörkt läge, precis som plattorna.
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                className="bg-slate-900/85 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 id="auth-modal-title" className="text-xl font-black text-white">
                            {mode === 'login' ? 'Logga in' : mode === 'register' ? 'Skapa konto' : 'Nästan klart!'}
                        </h2>
                        {mode === 'complete'
                            ? <p className="text-xs font-semibold text-white/60 mt-0.5">Berätta lite om dig så visar vi rätt event — det tar fem sekunder.</p>
                            : reason && <p className="text-xs font-semibold text-white/60 mt-0.5">{reason}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Stäng" className="text-white/50 hover:text-white p-1 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Kompletteringssteget efter första Google-inloggningen:
                    samma fält som registreringsblanketten samlar in (ålder/
                    kön/stad/barn — utskicks- och filterunderlaget). Man ÄR
                    redan inloggad: Hoppa över/krysset stänger utan krav. */}
                {mode === 'complete' ? (
                    <form onSubmit={saveProfile} className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <input
                                type="number"
                                inputMode="numeric"
                                value={age}
                                onChange={(e) => setAge(e.target.value)}
                                placeholder="Ålder"
                                aria-label="Ålder"
                                required
                                min={13}
                                max={120}
                                autoFocus
                                className="w-28 px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:border-[#FECC02]/70 focus:outline-none"
                            />
                            <select
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                                aria-label="Kön"
                                required
                                className={`flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/10 focus:border-[#FECC02]/70 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-white ${gender ? 'text-white' : 'text-white/40'}`}
                            >
                                <option value="" disabled>Kön</option>
                                <option value="kvinna">Kvinna</option>
                                <option value="man">Man</option>
                                <option value="annat">Annat</option>
                                <option value="vill_ej_ange">Vill inte ange</option>
                            </select>
                        </div>
                        <select
                            value={citySlug}
                            onChange={(e) => { setCitySlug(e.target.value); setCityTouched(true); }}
                            aria-label="Stad"
                            className={`w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 focus:border-[#FECC02]/70 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-white ${citySlug ? 'text-white' : 'text-white/40'}`}
                        >
                            <option value="">Stad (valfritt)</option>
                            {[...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(c => (
                                <option key={c.slug} value={c.slug}>{c.name}</option>
                            ))}
                        </select>
                        <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hasChildren}
                                onChange={(e) => setHasChildren(e.target.checked)}
                                className="w-4 h-4 accent-[#FECC02] shrink-0"
                            />
                            <span className="text-sm font-semibold text-white/80">
                                Jag har barn (0–13 år)
                            </span>
                        </label>
                        {error && (
                            <p role="alert" className="rounded-xl bg-red-500/15 border border-red-400/30 px-4 py-2.5 text-sm font-semibold text-red-200">
                                {error}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FECC02] text-slate-900 font-black disabled:opacity-50 hover:bg-[#ffd633] transition-colors"
                        >
                            <Check size={16} />
                            {busy ? 'Vänta…' : 'Spara'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={busy}
                            className="text-xs font-semibold text-white/50 hover:text-white transition-colors self-center disabled:opacity-50"
                        >
                            Hoppa över
                        </button>
                    </form>
                ) : (
                <>
                {/* Google överst — lägsta tröskeln in, särskilt i det ögonblick
                    någon just försökt gilla/chatta/önska. E-postformuläret
                    ligger kvar under en "eller"-linje. */}
                <button
                    type="button"
                    onClick={google}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-white text-slate-800 font-black disabled:opacity-50 hover:bg-slate-100 transition-colors"
                >
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                    </svg>
                    {busy ? 'Vänta…' : 'Fortsätt med Google'}
                </button>
                <div className="flex items-center gap-3" aria-hidden>
                    <span className="flex-1 h-px bg-white/10" />
                    <span className="text-[11px] font-bold uppercase tracking-widest text-white/40">eller</span>
                    <span className="flex-1 h-px bg-white/10" />
                </div>

                <form onSubmit={submit} className="flex flex-col gap-3">
                    {mode === 'register' && (
                        <>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Visningsnamn"
                                aria-label="Visningsnamn"
                                autoComplete="nickname"
                                required
                                className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:border-[#FECC02]/70 focus:outline-none"
                            />
                            {/* Ålder + kön sida vid sida — statistikunderlag ("vilka
                                använder VADKUL"). Kön kan alltid lämnas som
                                "Vill inte ange"; ålder krävs (13+). */}
                            <div className="flex gap-3">
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                    placeholder="Ålder"
                                    aria-label="Ålder"
                                    required
                                    min={13}
                                    max={120}
                                    className="w-28 px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:border-[#FECC02]/70 focus:outline-none"
                                />
                                <select
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                    aria-label="Kön"
                                    required
                                    className={`flex-1 px-4 py-3 rounded-xl border border-white/10 bg-white/10 focus:border-[#FECC02]/70 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-white ${gender ? 'text-white' : 'text-white/40'}`}
                                >
                                    <option value="" disabled>Kön</option>
                                    <option value="kvinna">Kvinna</option>
                                    <option value="man">Man</option>
                                    <option value="annat">Annat</option>
                                    <option value="vill_ej_ange">Vill inte ange</option>
                                </select>
                            </div>
                            {/* Stad (valfri) — gör att utskicken kan visa event nära
                                användaren. Förifylls från GPS-härledningen. */}
                            <select
                                value={citySlug}
                                onChange={(e) => { setCitySlug(e.target.value); setCityTouched(true); }}
                                aria-label="Stad"
                                className={`w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 focus:border-[#FECC02]/70 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-white ${citySlug ? 'text-white' : 'text-white/40'}`}
                            >
                                <option value="">Stad (valfritt)</option>
                                {[...CITIES].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map(c => (
                                    <option key={c.slug} value={c.slug}>{c.name}</option>
                                ))}
                            </select>
                            {/* "Jag har barn (0–13 år)" — lätt steg: bara kryss-
                                rutan, åldrarna fylls i senare i profilen.
                                Kryssrutan avgör om kartan visar familjeeventen
                                direkt eller lägger dem bakom 🧸-opt-in-cirkeln
                                (utils/familyFilter). */}
                            <label className="flex items-center gap-2.5 px-1 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={hasChildren}
                                    onChange={(e) => setHasChildren(e.target.checked)}
                                    className="w-4 h-4 accent-[#FECC02] shrink-0"
                                />
                                <span className="text-sm font-semibold text-white/80">
                                    Jag har barn (0–13 år)
                                </span>
                            </label>
                        </>
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-post"
                        aria-label="E-post"
                        autoComplete="email"
                        required
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:border-[#FECC02]/70 focus:outline-none"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Lösenord"
                        aria-label="Lösenord"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        required
                        minLength={6}
                        className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/10 text-white placeholder:text-white/40 focus:border-[#FECC02]/70 focus:outline-none"
                    />
                    {error && (
                        <p role="alert" className="rounded-xl bg-red-500/15 border border-red-400/30 px-4 py-2.5 text-sm font-semibold text-red-200">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#FECC02] text-slate-900 font-black disabled:opacity-50 hover:bg-[#ffd633] transition-colors"
                    >
                        {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                        {busy ? 'Vänta…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
                    </button>
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={forgot}
                            disabled={busy}
                            className="text-xs font-semibold text-white/50 hover:text-white transition-colors self-center disabled:opacity-50"
                        >
                            Glömt lösenord?
                        </button>
                    )}
                </form>

                <button
                    type="button"
                    onClick={() => setMode(m => (m === 'login' ? 'register' : 'login'))}
                    className="text-sm font-bold text-[#FECC02] hover:text-[#ffd633] transition-colors"
                >
                    {mode === 'login' ? 'Ny här? Skapa konto' : 'Har du redan konto? Logga in'}
                </button>

                {mode === 'register' && (
                    <p className="text-[11px] font-semibold text-white/40 text-center -mt-1">
                        Genom att skapa konto godkänner du vår{' '}
                        <a href="/integritet" target="_blank" rel="noopener" className="underline hover:text-white/70 transition-colors">
                            integritetspolicy
                        </a>.
                    </p>
                )}

                {/* Om VADKUL (15/9) — utloggades väg tillbaka till välkomstrutan
                    sedan den flytande info-knappen revs. */}
                {onOpenAbout && (
                    <button
                        type="button"
                        onClick={onOpenAbout}
                        className="text-xs font-semibold text-white/50 hover:text-white transition-colors self-center"
                    >
                        Vad är VADKUL?
                    </button>
                )}
                </>
                )}
            </div>
        </div>
    );
}
