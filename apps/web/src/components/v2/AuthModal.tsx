'use client';

import { useEffect, useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { CITIES, getCity } from '@/lib/cityUtils';
import { DERIVED_CITY_KEY } from '@/hooks/useSaveUserCity';
import toast from 'react-hot-toast';

interface AuthModalProps {
    open: boolean;
    onClose: () => void;
    /** Visas överst — t.ex. "Logga in för att chatta". */
    reason?: string;
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
export default function AuthModal({ open, onClose, reason }: AuthModalProps) {
    const { signIn, register, resetPassword } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
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
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="auth-modal-title"
                className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 id="auth-modal-title" className="text-xl font-black text-slate-800 dark:text-slate-100">
                            {mode === 'login' ? 'Logga in' : 'Skapa konto'}
                        </h2>
                        {reason && <p className="text-xs font-semibold text-slate-500 mt-0.5">{reason}</p>}
                    </div>
                    <button type="button" onClick={onClose} aria-label="Stäng" className="text-slate-400 hover:text-slate-600 p-1">
                        <X size={20} />
                    </button>
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
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
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
                                    className="w-28 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
                                />
                                <select
                                    value={gender}
                                    onChange={(e) => setGender(e.target.value)}
                                    aria-label="Kön"
                                    required
                                    className={`flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-[#006AA7] focus:outline-none ${gender ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}
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
                                className={`w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-[#006AA7] focus:outline-none ${citySlug ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400'}`}
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
                                    className="w-4 h-4 accent-[#006AA7] shrink-0"
                                />
                                <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
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
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
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
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
                    />
                    {error && (
                        <p role="alert" className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700">
                            {error}
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#006AA7] text-white font-bold disabled:opacity-50 hover:bg-[#005590] transition-colors"
                    >
                        {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                        {busy ? 'Vänta…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
                    </button>
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={forgot}
                            disabled={busy}
                            className="text-xs font-semibold text-slate-500 hover:text-[#006AA7] transition-colors self-center disabled:opacity-50"
                        >
                            Glömt lösenord?
                        </button>
                    )}
                </form>

                <button
                    type="button"
                    onClick={() => setMode(m => (m === 'login' ? 'register' : 'login'))}
                    className="text-sm font-bold text-[#006AA7] hover:text-[#005590] transition-colors"
                >
                    {mode === 'login' ? 'Ny här? Skapa konto' : 'Har du redan konto? Logga in'}
                </button>

                {mode === 'register' && (
                    <p className="text-[11px] font-semibold text-slate-400 text-center -mt-1">
                        Genom att skapa konto godkänner du vår{' '}
                        <a href="/integritet" target="_blank" rel="noopener" className="underline hover:text-slate-600 transition-colors">
                            integritetspolicy
                        </a>.
                    </p>
                )}
            </div>
        </div>
    );
}
