'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { feedbackService } from '@/services/feedbackService';
import type { FeedbackItem } from '@/types';
import { ShieldCheck, LogOut, RefreshCw, ExternalLink, Flag, MessageSquare, Star } from 'lucide-react';
import toast from 'react-hot-toast';

// Enda kontot som släpps in. Klient-gaten är bara för UX — den RIKTIGA
// spärren ligger i Firestore-reglerna (isAdmin → request.auth.token.email),
// så även om någon öppnar /admin kan de inte läsa datan utan rätt konto.
const ADMIN_EMAIL = 'admin@admin.com';

/** Bryt ut en URL ur en rapportsträng så vi kan länka till källan. */
function extractUrl(message: string): string | null {
    const m = message.match(/https?:\/\/[^\s)]+/);
    return m ? m[0] : null;
}

function formatDate(ts: any): string {
    const d = ts && typeof ts.toDate === 'function' ? ts.toDate() : (ts instanceof Date ? ts : null);
    if (!d) return '';
    return d.toLocaleString('sv-SE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AdminClient() {
    const { user, loading, signIn, logout } = useAuth();
    const isAdmin = !!user && user.email === ADMIN_EMAIL;

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);

    const [items, setItems] = useState<FeedbackItem[] | null>(null);
    const [loadingItems, setLoadingItems] = useState(false);

    const loadItems = async () => {
        setLoadingItems(true);
        const data = await feedbackService.getRecentFeedback(300);
        setItems(data);
        setLoadingItems(false);
    };

    useEffect(() => {
        if (isAdmin) loadItems();
    }, [isAdmin]);

    const { reports, feedback } = useMemo(() => {
        const all = items ?? [];
        return {
            reports: all.filter(i => (i.message ?? '').startsWith('[EVENTRAPPORT]')),
            feedback: all.filter(i => !(i.message ?? '').startsWith('[EVENTRAPPORT]')),
        };
    }, [items]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setBusy(true);
        try {
            await signIn(email, password);
        } catch {
            toast.error('Fel e-post eller lösenord.');
        } finally {
            setBusy(false);
        }
    };

    // ── Laddar auth ──────────────────────────────────────────────────────────
    if (loading) {
        return <Shell><p className="text-sm font-bold text-slate-400">Laddar…</p></Shell>;
    }

    // ── Inte inloggad → login ────────────────────────────────────────────────
    if (!user) {
        return (
            <Shell>
                <h1 className="text-2xl font-black text-slate-800 mb-1">Admin</h1>
                <p className="text-sm text-slate-500 mb-6">Logga in med admin-kontot.</p>
                <form onSubmit={handleLogin} className="flex flex-col gap-3 max-w-sm">
                    <input
                        type="email" value={email} onChange={e => setEmail(e.target.value)}
                        placeholder="E-post" required autoFocus
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-[#006AA7] focus:outline-none"
                    />
                    <input
                        type="password" value={password} onChange={e => setPassword(e.target.value)}
                        placeholder="Lösenord" required
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:border-[#006AA7] focus:outline-none"
                    />
                    <button type="submit" disabled={busy}
                        className="px-5 py-3 rounded-xl bg-[#006AA7] text-white font-bold disabled:opacity-50 hover:bg-[#005590] transition-colors">
                        {busy ? 'Loggar in…' : 'Logga in'}
                    </button>
                </form>
            </Shell>
        );
    }

    // ── Inloggad men fel konto → ingen åtkomst ───────────────────────────────
    if (!isAdmin) {
        return (
            <Shell>
                <h1 className="text-2xl font-black text-slate-800 mb-1">Ingen åtkomst</h1>
                <p className="text-sm text-slate-500 mb-6">
                    Kontot <span className="font-bold">{user.email}</span> har inte adminbehörighet.
                </p>
                <button onClick={() => logout()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-sm hover:bg-slate-100 transition-colors">
                    <LogOut size={15} /> Logga ut
                </button>
            </Shell>
        );
    }

    // ── Admin ────────────────────────────────────────────────────────────────
    return (
        <Shell wide>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={22} className="text-[#006AA7]" />
                    <h1 className="text-2xl font-black text-slate-800">Admin</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadItems} disabled={loadingItems}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50">
                        <RefreshCw size={13} className={loadingItems ? 'animate-spin' : ''} /> Uppdatera
                    </button>
                    <button onClick={() => logout()}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors">
                        <LogOut size={13} /> Logga ut
                    </button>
                </div>
            </div>

            {/* Eventrapporter */}
            <Section icon={<Flag size={15} className="text-rose-500" />} title="Eventrapporter" count={reports.length}>
                {reports.length === 0 ? (
                    <Empty>Inga rapporter. 🎉</Empty>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {reports.map(r => {
                            const url = extractUrl(r.message);
                            return (
                                <li key={r.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                                    <p className="text-sm font-semibold text-slate-800 break-words">
                                        {r.message.replace('[EVENTRAPPORT] ', '')}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-slate-400">
                                        <span>{formatDate(r.createdAt)}</span>
                                        {url && (
                                            <a href={url} target="_blank" rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[#006AA7] hover:underline">
                                                <ExternalLink size={11} /> Öppna källa
                                            </a>
                                        )}
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </Section>

            {/* Övrig feedback */}
            <Section icon={<MessageSquare size={15} className="text-[#006AA7]" />} title="Feedback" count={feedback.length}>
                {feedback.length === 0 ? (
                    <Empty>Ingen feedback än.</Empty>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {feedback.map(f => (
                            <li key={f.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <div className="flex items-center gap-1 mb-1">
                                    {Array.from({ length: 5 }, (_, i) => (
                                        <Star key={i} size={13}
                                            className={i < (f.rating ?? 0) ? 'text-amber-400' : 'text-slate-200'}
                                            fill={i < (f.rating ?? 0) ? 'currentColor' : 'none'} />
                                    ))}
                                </div>
                                <p className="text-sm font-semibold text-slate-800 break-words">{f.message}</p>
                                <p className="mt-1.5 text-[11px] font-bold text-slate-400">{formatDate(f.createdAt)}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </Section>
        </Shell>
    );
}

/* ── Layout-hjälpare ──────────────────────────────────────────────────────── */

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <div className={`mx-auto px-5 py-10 ${wide ? 'max-w-3xl' : 'max-w-2xl'}`}>
                <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors mb-6">
                    ← Tillbaka till kartan
                </Link>
                {children}
            </div>
        </main>
    );
}

function Section({ icon, title, count, children }: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
    return (
        <section className="mb-8">
            <h2 className="flex items-center gap-2 text-base font-black text-slate-900 mb-3">
                {icon} {title}
                <span className="text-xs font-black text-slate-400 tabular-nums">· {count}</span>
            </h2>
            {children}
        </section>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-sm font-semibold text-slate-400 py-2">{children}</p>;
}
