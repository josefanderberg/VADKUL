'use client';

// Publiceringskonsolen — skalet med flikar, alla levande: Idag, Städer
// (stadskort → gruppens FB-länk + utkastgenerator; ersatte Kön 18/8; kartan
// bor här som lista/karta-toggle sedan 19/8), Planering (facebookschemat,
// 14 dagar), Logg (alla publiceringar med text + utfall) och Statistik
// (totaler/utfall/toppinlägg/A-B ur loggen).
// Utkasten bor i DraftStore (provider över flikarna) — genereringar fortsätter
// i bakgrunden vid flikbyte och docken (DraftDock) visar dem överallt.
// All data via /api/admin/outreach/* med Bearer-token — klienten läser ALDRIG
// outreach-collections direkt (de är stängda i firestore.rules).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import type { OutreachApiUsage, QueueResponse } from '@/types/outreach';
import { Megaphone, RefreshCw, Building2, CalendarDays, KeyRound, ListTodo, BarChart3, ScrollText } from 'lucide-react';
import TodayPanel from './panels/TodayPanel';
import CityPanel from './panels/CityPanel';
import SchedulePanel from './panels/SchedulePanel';
import LogPanel from './panels/LogPanel';
import StatsPanel from './panels/StatsPanel';
import { DraftProvider } from './panels/DraftStore';
import DraftDock from './panels/DraftDock';

// Kön-fliken togs bort 18/8 (ägarbeslut: den visade samma data som Städer i en
// annan layout) — stadskorten i Städer är sorterade på score, så kortordningen
// ÄR kön. Karta-fliken togs bort 19/8 (ägarbeslut: "inte ett helt avsnitt")
// och blev en lista/karta-toggle inne i Städer.
type Tab = 'idag' | 'stader' | 'planering' | 'logg' | 'statistik';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'idag', label: 'Idag', icon: <ListTodo size={14} /> },
    { id: 'stader', label: 'Städer', icon: <Building2 size={14} /> },
    { id: 'planering', label: 'Planering', icon: <CalendarDays size={14} /> },
    { id: 'logg', label: 'Logg', icon: <ScrollText size={14} /> },
    { id: 'statistik', label: 'Statistik', icon: <BarChart3 size={14} /> },
];

export default function OutreachConsole() {
    const { user, loading } = useAuth();
    const [tab, setTab] = useState<Tab>('idag');
    // Städer-flikens lista/karta-toggle bor här: Shell behöver veta om kartan
    // visas (Sverige i en 4xl-spalt blir en tunn remsa → bredare container).
    const [cityView, setCityView] = useState<'lista' | 'karta'>('lista');
    const [data, setData] = useState<QueueResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/queue', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                setError(res.status === 403
                    ? 'Kontot saknar adminbehörighet.'
                    : `Kunde inte hämta kön (${res.status}).`);
                return;
            }
            setData(await res.json());
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    if (loading) return <Shell><p className="text-sm font-bold text-slate-400">Laddar…</p></Shell>;
    if (!user) {
        return (
            <Shell>
                <p className="text-sm font-semibold text-slate-500">
                    Logga in med admin-kontot på <Link href="/admin" className="text-[#006AA7] font-bold hover:underline">/admin</Link> först.
                </p>
            </Shell>
        );
    }

    return (
        <DraftProvider>
        {/* Kartvyn behöver bredden — Sverige i en 4xl-spalt blir en tunn remsa. */}
        <Shell wide={tab === 'stader' && cityView === 'karta'}>
            <div className="flex items-center justify-between gap-4 mb-1">
                <div className="flex items-center gap-2">
                    <Megaphone size={22} className="text-[#006AA7]" />
                    <h1 className="text-2xl font-black text-slate-800">Publiceringskonsol</h1>
                </div>
                <button onClick={load} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors disabled:opacity-50">
                    <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Uppdatera
                </button>
            </div>
            {data && (
                <p className="text-xs font-bold text-slate-400 mb-3">
                    {data.counts.groups} FB-grupper · {data.counts.organizers} arrangörer · {data.counts.logged} loggade publiceringar
                </p>
            )}

            {/* API-kortet: nyckelrotation + förbrukning — kontrollen direkt här,
                utan att behöva logga in på Anthropic-konsolen. */}
            {data && <ApiCard usage={data.apiUsage} onRotated={load} />}

            {/* Flikarna */}
            <div className="flex items-center gap-1.5 mb-6 overflow-x-auto">
                {TABS.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs whitespace-nowrap transition-colors ${
                            tab === t.id ? 'bg-[#006AA7] text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {error && (
                <p className="text-sm font-bold text-rose-600 mb-4">{error}</p>
            )}

            {!data && !error && <p className="text-sm font-bold text-slate-400">Hämtar kön…</p>}

            {data && tab === 'idag' && <TodayPanel data={data} onChanged={load} />}
            {data && tab === 'stader' && (
                <CityPanel data={data} onChanged={load} view={cityView} onViewChange={setCityView} />
            )}
            {data && tab === 'planering' && <SchedulePanel data={data} />}
            {tab === 'logg' && <LogPanel />}
            {tab === 'statistik' && <StatsPanel />}
        </Shell>
        <DraftDock />
        </DraftProvider>
    );
}

/**
 * API-kortet — nyckelstatus + förbrukning, alltid synligt oavsett flik.
 *
 * Nedräkningen är en ROTATIONSPÅMINNELSE (30 dagar från första utkastet, eller
 * från senaste "Ny nyckel inlagd"): API-nycklar går inte ut av sig själva, men
 * regelbunden rotation är god hygien. Kostnaden är en uppskattning på
 * Opus 5-listpriser räknad ur varje anrops usage — facit bor i Anthropic-
 * konsolens Usage-flik.
 */
const ROTATION_DAYS = 30;
const DAY_MS = 86_400_000;

function ApiCard({ usage, onRotated }: { usage: OutreachApiUsage | null; onRotated: () => void }) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);

    const rotate = async () => {
        if (!user || busy) return;
        if (!window.confirm('Nollställ 30-dagarsräknaren? Gör detta först när nya nyckeln ligger i .env.local, .env och WEB_ENV-secreten.')) return;
        setBusy(true);
        try {
            const token = await user.getIdToken();
            await fetch('/api/admin/outreach/api-usage', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'key-rotated' }),
            });
            onRotated();
        } finally {
            setBusy(false);
        }
    };

    if (!usage) {
        return (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 mb-5 flex items-center gap-2">
                <KeyRound size={14} className="text-slate-400" />
                <p className="text-xs font-bold text-slate-400">
                    API: ingen förbrukning loggad ännu — kortet vaknar vid första genererade utkastet.
                </p>
            </div>
        );
    }

    const daysLeft = ROTATION_DAYS - Math.floor((Date.now() - usage.keyCreatedAt) / DAY_MS);
    const keyTone = daysLeft <= 0 ? 'text-rose-600' : daysLeft <= 7 ? 'text-amber-600' : 'text-slate-700';
    const fmtDate = (ms?: number) =>
        ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : '—';

    return (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className={`inline-flex items-center gap-1.5 text-xs font-black ${keyTone}`}>
                <KeyRound size={14} />
                {daysLeft <= 0
                    ? 'Nyckelrotation: dags att byta nyckel'
                    : `Nyckelrotation om ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagar'}`}
            </span>
            <span className="text-xs font-bold text-slate-500">
                {usage.calls.toLocaleString('sv-SE')} utkast · {(usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens).toLocaleString('sv-SE')} tokens in
                · {usage.outputTokens.toLocaleString('sv-SE')} ut
            </span>
            <span className="text-xs font-black text-slate-700">
                ≈ ${usage.estimatedCostUsd.toFixed(2)} förbrukat
            </span>
            <span className="text-[11px] font-bold text-slate-400">
                senast {fmtDate(usage.lastCallAt)} · {usage.lastModel ?? '—'}
            </span>
            <button onClick={rotate} disabled={busy}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 font-bold text-[11px] hover:bg-slate-100 transition-colors disabled:opacity-50">
                Ny nyckel inlagd
            </button>
        </div>
    );
}

function Shell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <div className={`mx-auto px-5 py-10 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}>
                <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors mb-6">
                    ← Admin
                </Link>
                {children}
            </div>
        </main>
    );
}

