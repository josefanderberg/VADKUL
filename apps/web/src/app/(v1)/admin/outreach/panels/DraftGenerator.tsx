'use client';

// Utkastgeneratorn + kopiera-knappen — delas av panelerna Idag, Städer
// och Planering. Sedan 19/8 bor allt state i DraftStore (provider över
// flikarna): knappen här startar bara genereringen och visar lagrets
// tillstånd för sin kontakt. Byter man flik fortsätter genereringen och
// utkastet finns kvar — samma utkast syns i alla paneler och i docken.
// Routen postar ALDRIG något — texten kopieras manuellt (§0 i planen).

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { useDrafts, type DraftResponse } from './DraftStore';

const fmtTime = (ms: number) =>
    new Date(ms).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

export function DraftGenerator({ contactId, contactName, mode, autoStart = false }: {
    contactId: string;
    contactName: string;
    mode: 'approval' | 'direct' | 'unknown';
    /** Batch-flödet ("Generera dagens utkast"): true ⇒ starta genereringen
     *  själv vid montering/aktivering — en gång, aldrig i retry-loop, och
     *  aldrig om ett färskt utkast redan ligger i lagret. */
    autoStart?: boolean;
}) {
    const { drafts, generate } = useDrafts();
    const d = drafts[contactId];
    const busy = d?.status === 'loading';
    const result = d?.status === 'done' ? d.result : null;
    const error = d?.status === 'error' ? d.error : null;

    // Batch: dra igång en gång när autoStart tänds — men bara om lagret är
    // tomt för kontakten (sparade utkast ska inte genereras om i onödan).
    const startedRef = useRef(false);
    useEffect(() => {
        if (!autoStart || startedRef.current || d) return;
        startedRef.current = true;
        generate(contactId, contactName);
    }, [autoStart, d, generate, contactId, contactName]);

    return (
        <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center gap-2">
                <button type="button" onClick={() => generate(contactId, contactName)} disabled={busy}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#006AA7] text-white text-[11px] font-black hover:bg-[#005590] transition-colors disabled:opacity-50">
                    {busy ? <><Loader2 size={12} className="animate-spin" /> Skriver utkast… (~30 s)</>
                          : <><Sparkles size={12} /> {result ? 'Generera om' : 'Generera utkast'}</>}
                </button>
                {busy && (
                    <span className="text-[11px] font-bold text-slate-400">
                        fortsätter i bakgrunden — byt flik om du vill, docken visar när det är klart
                    </span>
                )}
                {error && <p className="text-[11px] font-bold text-rose-600">{error}</p>}
            </div>

            {result && d?.status === 'done' && (
                <DraftResultView result={result} mode={mode} generatedAt={d.generatedAt} />
            )}
        </div>
    );
}

/** Själva utkastvyn (metarad + V1/V2-block) — delas med docken. */
export function DraftResultView({ result, mode, generatedAt }: {
    result: DraftResponse;
    mode: 'approval' | 'direct' | 'unknown';
    generatedAt?: number;
}) {
    // Färskvaruvarning: eventen i ett halvdygnsgammalt utkast kan ha passerat.
    const stale = generatedAt !== undefined && Date.now() - generatedAt > 12 * 3_600_000;
    return (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-[11px] font-bold text-slate-500">
                {generatedAt !== undefined && <>skrivet {fmtTime(generatedAt)} · </>}
                {result.meta.weekCount} event inom {result.meta.radiusKm} km · {result.meta.nearCount} inom 8 km
                · data: {result.meta.source === 'live' ? 'live' : '⚠ snapshot'}
                {result.meta.usage && <> · {result.meta.usage.outputTokens.toLocaleString('sv-SE')} tokens ut · ~${result.meta.usage.costUsd.toFixed(2)}</>}
                {result.angle && <> · {result.angle}</>}
            </p>
            {stale && (
                <p className="text-[11px] font-bold text-amber-600">
                    ⚠ Utkastet är över 12 h gammalt — kolla att eventen fortfarande stämmer, eller generera om.
                </p>
            )}

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
