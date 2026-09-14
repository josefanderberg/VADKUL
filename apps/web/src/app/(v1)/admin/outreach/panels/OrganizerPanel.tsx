'use client';

// Arrangörer-fliken (14/9): säljmotorn "ditt event fick X klick hos oss —
// lägg upp nästa själv". Topplistan byggs HELT server-side ur eventStats
// (/api/admin/outreach/organizers) — konsolen är facit, ingen statistik
// matas in manuellt (kravlistan 20/8). Mejlutkasten går genom samma
// DraftStore-flöde som FB-utkasten (kind='arrangorsmejl', nyckel
// 'mejl-<contactId>') och överlever därmed flikbyten + omladdningar.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, MailCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { OrganizerListResponse, OrganizerStat } from '@/types/outreach';
import { DraftGenerator } from './DraftGenerator';

const fmtDate = (ms: number) =>
    new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });

export default function OrganizerPanel() {
    const { user } = useAuth();
    const [data, setData] = useState<OrganizerListResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    const reload = useCallback(async () => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/organizers', {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                setError(`Kunde inte hämta arrangörsstatistiken (${res.status}).`);
                return;
            }
            setData(await res.json() as OrganizerListResponse);
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    }, [user]);

    useEffect(() => { reload(); }, [reload]);

    if (error) return <p className="text-sm font-bold text-rose-600">{error}</p>;
    if (!data) return <p className="text-sm font-bold text-slate-400">{busy ? 'Räknar klick per arrangör…' : 'Hämtar…'}</p>;
    if (data.organizers.length === 0) {
        return <p className="text-sm font-semibold text-slate-500">Inga registrerade vidareklick ännu — listan vaknar när besökare börjar klicka BOKA/ANMÄL.</p>;
    }

    return (
        <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-slate-500">
                Arrangörer efter vidareklick vi skickat dem — säljunderlaget för
                &quot;lägg upp era event själva&quot;-mejlet. Siffrorna hämtas ur klick-
                statistiken när mejlet genereras, aldrig härifrån.
                {/* Dagsserien (clicksByDay) började mäta 14/9 — tills den byggts
                    upp visas bara de ärliga månadshinkarna. */}
                {data.dayDataSince && <> Dagsupplöst data sedan {data.dayDataSince}.</>}
            </p>
            {data.organizers.map(o => <OrganizerCard key={o.key} o={o} hasDayData={data.dayDataSince !== null} />)}
        </div>
    );
}

function OrganizerCard({ o, hasDayData }: { o: OrganizerStat; hasDayData: boolean }) {
    const name = o.contactName ?? o.hostName ?? o.key;
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-sm font-black text-slate-800">{name}</h3>
                <span className="text-[11px] font-bold text-slate-400">{o.key}</span>
                {o.replyStatus && (
                    <span className={`text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                        o.replyStatus === 'svar' ? 'bg-emerald-50 text-emerald-700'
                        : o.replyStatus === 'nej' ? 'bg-rose-50 text-rose-600'
                        : 'bg-slate-100 text-slate-500'
                    }`}>{o.replyStatus}</span>
                )}
                {o.followUpDueAt && (
                    <span className="text-[10px] font-bold text-amber-600">följ upp {fmtDate(o.followUpDueAt)}</span>
                )}
            </div>

            <p className="text-xs font-bold text-slate-600">
                {o.clicks} vidareklick totalt · {o.clicksThisMonth} denna månad · {o.clicksPrevMonth} förra
                {hasDayData && o.clicks30d > 0 && <> · {o.clicks30d} på 30 d ({o.clicks7d} på 7 d)</>}
                <span className="font-semibold text-slate-400"> · {o.views} kortvisningar</span>
            </p>

            {o.events.length > 0 && (
                <ul className="text-[11px] font-semibold text-slate-500 leading-relaxed">
                    {o.events.slice(0, 3).map(e => (
                        <li key={e.eventId || e.title} className="truncate">· {e.title} — {e.clicks} klick</li>
                    ))}
                </ul>
            )}

            {o.contactId ? (
                <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-2">
                    <div className="flex flex-wrap items-center gap-2">
                        {o.email && (
                            <a href={`mailto:${o.email}`}
                                className="inline-flex items-center gap-1.5 text-[11px] font-black text-[#006AA7] hover:underline">
                                <Mail size={12} /> {o.email}
                            </a>
                        )}
                        <MailSentButton contactId={o.contactId} />
                    </div>
                    <DraftGenerator
                        contactId={`mejl-${o.contactId}`}
                        contactName={name}
                        mode="unknown"
                        kind="arrangorsmejl"
                    />
                </div>
            ) : (
                <p className="text-[11px] font-semibold text-slate-400 border-t border-slate-100 pt-2">
                    Saknas i kontaktregistret — lägg till i docs/outreach/arrangorer.md och kör importen, så tänds mejlknappen.
                </p>
            )}
        </div>
    );
}

/**
 * "Mejlet skickat" → followUpDueAt = nu + 8 dygn via befintliga contact-
 * PATCH:en (fältet är vitlistat) — TodayPanels mejluppföljnings-påminnelse
 * plockar upp den utan mer bygge.
 */
function MailSentButton({ contactId }: { contactId: string }) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);

    const markSent = async () => {
        if (!user || busy || done) return;
        setBusy(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/contact', {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId, set: { followUpDueAt: Date.now() + 8 * 86_400_000 } }),
            });
            if (res.ok) setDone(true);
        } finally {
            setBusy(false);
        }
    };

    if (done) {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700">
                <MailCheck size={12} /> Uppföljning satt (+8 d)
            </span>
        );
    }
    return (
        <button type="button" onClick={markSent} disabled={busy}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-black hover:bg-slate-100 transition-colors disabled:opacity-50">
            {busy ? <Loader2 size={11} className="animate-spin" /> : <MailCheck size={11} />} Mejlet skickat
        </button>
    );
}
