'use client';

// Utkastgeneratorn + kopiera-knappen — delas av panelerna Idag, Städer
// och Planering. Flyttad ur TodayPanel 18/8 med oförändrad logik:
// POST /api/admin/outreach/draft → V1/V2 med kopiera-knappar. Routen postar
// ALDRIG något — texten kopieras manuellt (§0 i admin-konsol-planen).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';

type DraftResponse = {
    drafts: { v1: string; v2Post: string; v2FirstComment: string };
    mentionedEvents: { title: string; day: string; place: string; emoji: string }[];
    angle: string;
    meta: {
        linkTarget: string; weekCount: number; nearCount: number; radiusKm: number;
        dataUpdatedAt: string; source: 'live' | 'snapshot';
        // Vad genereringen drog — visas i utkast-rutan och summeras i API-kortet.
        usage?: { inputTokens: number; outputTokens: number; costUsd: number };
    };
};

export function DraftGenerator({ contactId, mode, autoStart = false }: {
    contactId: string;
    mode: 'approval' | 'direct' | 'unknown';
    /** Batch-flödet ("Generera dagens utkast"): true ⇒ starta genereringen
     *  själv vid montering/aktivering — en gång, aldrig i retry-loop. */
    autoStart?: boolean;
}) {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<DraftResponse | null>(null);

    const generate = useCallback(async () => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch('/api/admin/outreach/draft', {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok) {
                setError(json?.error ?? `Generering misslyckades (${res.status}).`);
                return;
            }
            setResult(json as DraftResponse);
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    }, [user, contactId]);

    // Batch: dra igång en gång när autoStart tänds. Fel stoppar — ingen
    // automatisk omkörning (API-nyckelfel skulle annars loopa).
    const startedRef = useRef(false);
    useEffect(() => {
        if (!autoStart || startedRef.current || busy || result) return;
        startedRef.current = true;
        generate();
    }, [autoStart, busy, result, generate]);

    return (
        <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
                <button type="button" onClick={generate} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006AA7] text-white text-[11px] font-black hover:bg-[#005590] transition-colors disabled:opacity-50">
                    {busy ? <><Loader2 size={12} className="animate-spin" /> Skriver utkast… (~30 s)</>
                          : <><Sparkles size={12} /> {result ? 'Generera om' : 'Generera utkast'}</>}
                </button>
                {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
            </div>

            {result && (
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[11px] font-bold text-slate-500">
                        {result.meta.weekCount} event inom {result.meta.radiusKm} km · {result.meta.nearCount} inom 8 km
                        · data: {result.meta.source === 'live' ? 'live' : '⚠ snapshot'}
                        {result.meta.usage && <> · {result.meta.usage.outputTokens.toLocaleString('sv-SE')} tokens ut · ~${result.meta.usage.costUsd.toFixed(2)}</>}
                        {result.angle && <> · {result.angle}</>}
                    </p>

                    {(mode === 'approval' || mode === 'unknown') && (
                        <DraftBlock label="V1 — länk i inlägget (godkännandekö)" text={result.drafts.v1} />
                    )}
                    {(mode === 'direct' || mode === 'unknown') && (
                        <>
                            <DraftBlock label="V2 — inlägget (utan länk)" text={result.drafts.v2Post} />
                            <DraftBlock label="V2 — första kommentaren (länken)" text={result.drafts.v2FirstComment} />
                        </>
                    )}
                    {mode === 'approval' && (
                        <p className="text-[11px] font-semibold text-slate-400">
                            Publicerade den direkt ändå? Generera om — eller ta V1:an som den är, länken gör jobbet.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

function DraftBlock({ label, text }: { label: string; text: string }) {
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-600">{label}</span>
                <CopyButton text={text} title={`Kopiera: ${label}`} />
            </div>
            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-medium leading-relaxed text-slate-800 max-h-72 overflow-y-auto font-[inherit]">
                {text}
            </pre>
        </div>
    );
}

/** Kopiera-knapp med "✓ Kopierad"-kvitto. */
export function CopyButton({ text, title }: { text: string; title: string }) {
    const [done, setDone] = useState(false);
    return (
        <button type="button" title={title}
            onClick={async () => {
                try {
                    await navigator.clipboard.writeText(text);
                    setDone(true);
                    setTimeout(() => setDone(false), 1500);
                } catch { /* clipboard nekad — inget att göra */ }
            }}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black border transition-colors shrink-0 ${
                done ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                     : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}>
            {done ? <><Check size={11} /> Kopierad</> : <><Copy size={11} /> Kopiera</>}
        </button>
    );
}
