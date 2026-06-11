'use client';

import { useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';

interface AuthModalProps {
    open: boolean;
    onClose: () => void;
    /** Visas överst — t.ex. "Logga in för att chatta". */
    reason?: string;
}

/** Översätt Firebase-felkoder till begriplig svenska. */
function authErrorText(code: string): string {
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found'))
        return 'Fel e-post eller lösenord.';
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
    const { signIn, register } = useAuth();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    if (!open) return null;

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            if (mode === 'login') await signIn(email, password);
            else await register(name, email, password);
            toast.success(mode === 'login' ? 'Inloggad!' : 'Välkommen till VADKUL!');
            onClose();
        } catch (err: any) {
            toast.error(authErrorText(String(err?.code ?? err)));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
            <div
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">
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
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Visningsnamn"
                            required
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
                        />
                    )}
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="E-post"
                        required
                        autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
                    />
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Lösenord"
                        required
                        minLength={6}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#006AA7] focus:outline-none"
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#006AA7] text-white font-bold disabled:opacity-50 hover:bg-[#005590] transition-colors"
                    >
                        {mode === 'login' ? <LogIn size={16} /> : <UserPlus size={16} />}
                        {busy ? 'Vänta…' : mode === 'login' ? 'Logga in' : 'Skapa konto'}
                    </button>
                </form>

                <button
                    type="button"
                    onClick={() => setMode(m => (m === 'login' ? 'register' : 'login'))}
                    className="text-sm font-bold text-[#006AA7] hover:text-[#005590] transition-colors"
                >
                    {mode === 'login' ? 'Ny här? Skapa konto' : 'Har du redan konto? Logga in'}
                </button>
            </div>
        </div>
    );
}
