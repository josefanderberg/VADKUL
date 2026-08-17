'use client';

// Publiceringskonsolen — skalet med flikar. Etapp 1: Idag + Kön är levande;
// Planering/Logg/Statistik är platshållare tills etapp 2–4.
// All data via /api/admin/outreach/* med Bearer-token — klienten läser ALDRIG
// outreach-collections direkt (de är stängda i firestore.rules).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import type { QueueResponse } from '@/types/outreach';
import { Megaphone, RefreshCw, CalendarDays, ListTodo, ListOrdered, BarChart3, ScrollText, Map as MapIcon } from 'lucide-react';
import TodayPanel from './panels/TodayPanel';
import QueuePanel from './panels/QueuePanel';
import MapPanel from './panels/MapPanel';

type Tab = 'idag' | 'kon' | 'karta' | 'planering' | 'logg' | 'statistik';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'idag', label: 'Idag', icon: <ListTodo size={14} /> },
    { id: 'kon', label: 'Kön', icon: <ListOrdered size={14} /> },
    { id: 'karta', label: 'Karta', icon: <MapIcon size={14} /> },
    { id: 'planering', label: 'Planering', icon: <CalendarDays size={14} /> },
    { id: 'logg', label: 'Logg', icon: <ScrollText size={14} /> },
    { id: 'statistik', label: 'Statistik', icon: <BarChart3 size={14} /> },
];

export default function OutreachConsole() {
    const { user, loading } = useAuth();
    const [tab, setTab] = useState<Tab>('idag');
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
        // Kartan behöver bredden — Sverige i en 4xl-spalt blir en tunn remsa.
        <Shell wide={tab === 'karta'}>
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
                <p className="text-xs font-bold text-slate-400 mb-5">
                    {data.counts.groups} FB-grupper · {data.counts.organizers} arrangörer · {data.counts.logged} loggade publiceringar
                </p>
            )}

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
            {data && tab === 'kon' && <QueuePanel data={data} />}
            {tab === 'karta' && <MapPanel />}
            {tab === 'planering' && (
                <ComingSoon>
                    Månadsschemat: utkast för både grupperna och FB-sidan planeras upp till
                    30 dagar framåt, med automatisk omkoll 7 dagar före publicering
                    (eventen räknas om + betygsätts på nytt). Byggs i etapp 2.
                </ComingSoon>
            )}
            {tab === 'logg' && (
                <ComingSoon>
                    Alla publiceringar med hela inläggstexten, utfall och engagemang. Byggs i etapp 3.
                </ComingSoon>
            )}
            {tab === 'statistik' && (
                <ComingSoon>
                    Godkänd-/borttagen-andel per variant och ort, klick per inlägg (ref-länkar),
                    stjärn-napp per kod och besök per sida. Byggs i etapp 3–4.
                </ComingSoon>
            )}
        </Shell>
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

function ComingSoon({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
            <p className="text-sm font-semibold text-slate-500">{children}</p>
        </div>
    );
}
