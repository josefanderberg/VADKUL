'use client';

// Delningskön — dagens färdiga inlägg, ett kort per grupp.
//
// Flödet är tre klick: Kopiera → Öppna gruppen → Postat ✓. Först det tredje
// klicket startar karensen och räknar mot dagskvoten; konsolen kan inte se
// Facebook, så ingenting är postat förrän ägaren säger det.
//
// Korten fylls på av morgonkörningen (POST /api/admin/outreach/plan, körs av
// GitHub Actions) och av ✨-knappen i Idag-fliken. Utkast vars eventrader
// hunnit passera hamnar under "Inaktuella" — de ska genereras om, inte postas
// (LÄRDOM 30/7 i docs/outreach/facebook-grupper.md).

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { ReadyPost, ReadyResponse } from '@/types/outreach';
import {
    AlertTriangle, CalendarClock, CheckCircle2, ChevronDown, ExternalLink, Loader2, Send, Sparkles,
} from 'lucide-react';
import CopyButton from './CopyButton';

export default function SharePanel({ onChanged }: { onChanged: () => void }) {
    const { user } = useAuth();
    const [data, setData] = useState<ReadyResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [planning, setPlanning] = useState(false);
    const [planNote, setPlanNote] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/ready', {
                headers: { Authorization: `Bearer ${token}` },
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error ?? `Kunde inte hämta delningskön (${res.status}).`);
                return;
            }
            setData(json as ReadyResponse);
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    const planNow = async () => {
        if (!user || planning) return;
        setPlanning(true);
        setPlanNote(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/plan', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setPlanNote(json?.error ?? `Planeringen misslyckades (${res.status}).`);
                return;
            }
            const created = json?.created?.length ?? 0;
            const skipped = json?.skipped?.length ?? 0;
            const failed = json?.failed?.length ?? 0;
            setPlanNote(created === 0
                ? `Inga nya utkast (${skipped} grupper överhoppade${failed ? `, ${failed} misslyckades` : ''}) — kön är redan full eller dagskvoten slut.`
                : `${created} nya utkast${skipped ? `, ${skipped} överhoppade` : ''}${failed ? `, ${failed} misslyckades` : ''}.`);
            await load();
            onChanged();
        } catch {
            setPlanNote('Nätverksfel — försök igen.');
        } finally {
            setPlanning(false);
        }
    };

    const markPosted = async (logId: string) => {
        if (!user) return;
        const token = await user.getIdToken();
        const res = await fetch('/api/admin/outreach/log', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ logId }),
        });
        if (!res.ok) {
            const json = await res.json().catch(() => null);
            throw new Error(json?.error ?? `Kunde inte bekräfta (${res.status}).`);
        }
        await load();
        onChanged();
    };

    if (!data && !error) return <p className="text-sm font-bold text-slate-400">Hämtar delningskön…</p>;

    const quotaLeft = data ? Math.max(0, data.quota.maxPerDay - data.quota.postedToday) : 0;

    return (
        <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-black text-slate-800">
                        {data?.ready.length ?? 0} inlägg redo att delas
                    </p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                        {data?.quota.postedToday ?? 0} av {data?.quota.maxPerDay ?? 3} postade idag
                        {quotaLeft === 0 && ' · dagskvoten är slut, spara resten till imorgon'}
                    </p>
                </div>
                <button type="button" onClick={planNow} disabled={planning}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#006AA7] text-white text-xs font-black hover:bg-[#005590] transition-colors disabled:opacity-50">
                    {planning
                        ? <><Loader2 size={13} className="animate-spin" /> Skriver utkast… (~1 min)</>
                        : <><Sparkles size={13} /> Skriv dagens utkast</>}
                </button>
            </div>

            {planNote && <p className="text-xs font-bold text-slate-600">{planNote}</p>}
            {error && <p className="text-sm font-bold text-rose-600">{error}</p>}

            {data && data.ready.length === 0 && data.stale.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
                    <p className="text-sm font-semibold text-slate-500">
                        Kön är tom. Morgonkörningen fyller på den varje dag kl 06:30 — eller tryck
                        på <span className="font-black">Skriv dagens utkast</span> för att fylla den nu.
                    </p>
                </div>
            )}

            {data && data.ready.length > 0 && (
                <ul className="flex flex-col gap-4">
                    {data.ready.map(p => (
                        <PostCard key={p.logId} post={p} onPosted={markPosted} disabled={busy} />
                    ))}
                </ul>
            )}

            {data && data.stale.length > 0 && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-black text-slate-500 flex items-center gap-1.5">
                        <CalendarClock size={13} /> Inaktuella — posta inte, generera om
                    </p>
                    <ul className="flex flex-col gap-2">
                        {data.stale.map(p => (
                            <li key={p.logId} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                                <p className="text-sm font-black text-slate-800">{p.contactName}</p>
                                <p className="text-[11px] font-bold text-amber-700 mt-0.5">{p.staleReason}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

/* ── Ett inlägg, en grupp ────────────────────────────────────────────────── */

function PostCard({ post, onPosted, disabled }: {
    post: ReadyPost;
    onPosted: (logId: string) => Promise<void>;
    disabled: boolean;
}) {
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [showAlt, setShowAlt] = useState(false);

    const isV2 = post.variant === 'V2';

    const confirm = async () => {
        if (saving) return;
        setSaving(true);
        setErr(null);
        try {
            await onPosted(post.logId);
        } catch (e) {
            setErr(e instanceof Error ? e.message : 'Kunde inte bekräfta.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <li className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-slate-800">{post.contactName}</p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                            isV2 ? 'bg-violet-100 text-violet-700' : 'bg-sky-100 text-sky-700'
                        }`}>
                            {isV2 ? 'V2 — länk i första kommentaren' : 'V1 — länk i inlägget'}
                        </span>
                        {typeof post.memberCount === 'number' && (
                            <span className="text-[11px] font-bold text-slate-400">
                                {post.memberCount.toLocaleString('sv-SE')} medl.
                            </span>
                        )}
                        {post.plannedBy === 'auto' && (
                            <span className="text-[11px] font-bold text-slate-400">automatiskt planerat</span>
                        )}
                    </div>
                </div>
                {post.groupUrl && (
                    <a href={post.groupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006AA7] hover:underline shrink-0 pt-0.5">
                        <ExternalLink size={11} /> Öppna gruppen
                    </a>
                )}
            </div>

            {post.warnings.length > 0 && (
                <ul className="flex flex-col gap-1">
                    {post.warnings.map((w, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] font-bold text-amber-700">
                            <AlertTriangle size={12} className="mt-0.5 shrink-0" /> {w}
                        </li>
                    ))}
                </ul>
            )}

            <Block label={isV2 ? 'Inlägget (utan länk)' : 'Inlägget'} text={post.bodyText} />
            {isV2 && post.firstCommentText && (
                <Block label="Första kommentaren — lägg den direkt efter" text={post.firstCommentText} />
            )}

            {post.alternate && (
                <div>
                    <button type="button" onClick={() => setShowAlt(v => !v)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700">
                        <ChevronDown size={12} className={showAlt ? 'rotate-180 transition-transform' : 'transition-transform'} />
                        {showAlt ? 'Dölj' : 'Visa'} den andra varianten
                        {isV2 ? ' (V1, länk i inlägget)' : ' (V2, länk i första kommentaren)'}
                    </button>
                    {showAlt && (
                        <div className="flex flex-col gap-2 pt-2">
                            <Block label="Alternativ — inlägget" text={post.alternate.bodyText} />
                            {post.alternate.firstCommentText && (
                                <Block label="Alternativ — första kommentaren" text={post.alternate.firstCommentText} />
                            )}
                        </div>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <button type="button" onClick={confirm} disabled={saving || disabled}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-black hover:bg-emerald-700 transition-colors disabled:opacity-50">
                    {saving
                        ? <><Loader2 size={12} className="animate-spin" /> Sparar…</>
                        : <><CheckCircle2 size={12} /> Postat ✓</>}
                </button>
                <span className="text-[11px] font-semibold text-slate-400">
                    startar 3-veckorskarensen och räknar mot dagskvoten
                </span>
                {err && <span className="text-[11px] font-bold text-rose-600">{err}</span>}
            </div>

            {post.angle && (
                <p className="text-[11px] font-semibold text-slate-400 flex items-start gap-1.5">
                    <Send size={11} className="mt-0.5 shrink-0" /> {post.angle}
                </p>
            )}
        </li>
    );
}

function Block({ label, text }: { label: string; text: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-600">{label}</span>
                <CopyButton text={text} title={`Kopiera: ${label}`} />
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 text-xs font-medium leading-relaxed text-slate-800 max-h-80 overflow-y-auto font-[inherit]">
                {text}
            </pre>
        </div>
    );
}
