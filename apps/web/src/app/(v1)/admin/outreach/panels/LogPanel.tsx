'use client';

// Logg — allt vi redan har om tidigare publiceringar: när, var, vilken
// variant, hur länken låg, utfallet och engagemanget (importerat från
// masterlistan + allt som loggats via konsolen). Raderna fälls ut till hela
// inläggstexten med kopiera-knapp — bra som "skriv inte likadant"-referens
// när nästa utkast ska skrivas.

import { useMemo, useState } from 'react';
import type { LogChannel, OutreachLogEntry } from '@/types/outreach';
import { ChevronDown } from 'lucide-react';
import { CopyButton } from './DraftGenerator';
import { useLog } from './useLog';

const OUTCOME_BADGE: Record<string, { label: string; cls: string }> = {
    'publicerat-direkt': { label: '✅ publicerat direkt', cls: 'bg-emerald-50 text-emerald-700' },
    'godkänt-uppe': { label: '✅ godkänt/uppe', cls: 'bg-emerald-50 text-emerald-700' },
    'krävde-godkännande': { label: '🔒 i godkännandekö', cls: 'bg-amber-50 text-amber-700' },
    'borttagen': { label: '❌ borttagen', cls: 'bg-rose-50 text-rose-700' },
    'nekad': { label: '❌ nekad', cls: 'bg-rose-50 text-rose-700' },
    'okänt': { label: '❓ okänt utfall', cls: 'bg-slate-100 text-slate-500' },
};

const CHANNEL_LABEL: Record<LogChannel, string> = {
    'fb-grupp': 'FB-grupper',
    'fb-sida': 'FB-sidan',
    'email': 'Mejl',
    'messenger-dm': 'Messenger-DM',
    'admin-dm': 'Admin-DM',
    'campaign': 'Kampanj',
};

const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function LogPanel() {
    const { entries, error, busy } = useLog();
    const [channel, setChannel] = useState<LogChannel | 'alla'>('fb-grupp');

    const channels = useMemo(() => {
        if (!entries) return [];
        const seen = new Set(entries.map(e => e.channel));
        return (Object.keys(CHANNEL_LABEL) as LogChannel[]).filter(c => seen.has(c));
    }, [entries]);

    const shown = useMemo(() => {
        if (!entries) return [];
        return channel === 'alla' ? entries : entries.filter(e => e.channel === channel);
    }, [entries, channel]);

    if (error) return <p className="text-sm font-bold text-rose-600">{error}</p>;
    if (!entries) return <p className="text-sm font-bold text-slate-400">{busy ? 'Hämtar loggen…' : 'Ingen logg.'}</p>;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
                {[...channels.map(c => ({ id: c as LogChannel | 'alla', label: CHANNEL_LABEL[c] })),
                  { id: 'alla' as const, label: 'Alla' }].map(t => (
                    <button key={t.id} onClick={() => setChannel(t.id)}
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-black transition-colors ${
                            channel === t.id ? 'bg-[#006AA7] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}>
                        {t.label} ({t.id === 'alla' ? entries.length : entries.filter(e => e.channel === t.id).length})
                    </button>
                ))}
            </div>

            <ul className="flex flex-col gap-2">
                {shown.map(e => <LogRow key={e.id} e={e} />)}
                {shown.length === 0 && (
                    <p className="text-sm font-semibold text-slate-400">Inga rader i den här kanalen.</p>
                )}
            </ul>
        </div>
    );
}

function LogRow({ e }: { e: OutreachLogEntry }) {
    const [open, setOpen] = useState(false);
    const badge = OUTCOME_BADGE[e.outcome] ?? OUTCOME_BADGE['okänt'];
    const hasEngagement = e.likes !== undefined || e.comments !== undefined || e.shares !== undefined;
    const hasBody = !!(e.bodyText || e.firstCommentText || e.notes);

    return (
        <li className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button type="button" onClick={() => hasBody && setOpen(v => !v)}
                className={`w-full text-left p-3.5 flex items-start gap-3 transition-colors ${hasBody ? 'hover:bg-slate-50' : 'cursor-default'}`}>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="text-sm font-black text-slate-800">{e.contactName}</span>
                        <span className="text-[11px] font-bold text-slate-400">{fmtDate(e.postedAt ?? e.draftCreatedAt)}</span>
                        {!e.confirmedByOwner && (
                            <span className="text-[10px] font-black text-violet-600 bg-violet-50 rounded-full px-2 py-0.5">utkast, ej bekräftat postat</span>
                        )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${badge.cls}`}>{badge.label}</span>
                        {e.variant && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">variant {e.variant}</span>}
                        {e.linkPlacement && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">länk {e.linkPlacement}</span>}
                        {e.method && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">{e.method}</span>}
                        {e.starLinkIncluded && <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-yellow-50 text-yellow-700">⭐ stjärnlänk</span>}
                    </div>
                    {hasEngagement && (
                        <p className="text-[11px] font-bold text-slate-500 mt-1.5">
                            {e.likes !== undefined && <>👍 {e.likes} </>}
                            {e.comments !== undefined && <>· 💬 {e.comments} </>}
                            {e.shares !== undefined && <>· ↗ {e.shares}</>}
                            {e.ownRepliesCount !== undefined && <> · ↩ {e.ownRepliesCount} egna svar</>}
                        </p>
                    )}
                    {!e.outcomeCheckedAt && e.confirmedByOwner && (
                        <p className="text-[11px] font-bold text-amber-600 mt-1">⚠ utfallet är inte uppföljt — se Idag-fliken</p>
                    )}
                </div>
                {hasBody && <ChevronDown size={15} className={`mt-1 shrink-0 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />}
            </button>

            {open && hasBody && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-3.5 flex flex-col gap-3">
                    {e.bodyText && <TextBlock label="Inläggstexten" text={e.bodyText} />}
                    {e.firstCommentText && <TextBlock label="Första kommentaren" text={e.firstCommentText} />}
                    {e.notes && <p className="text-xs font-semibold text-slate-500">📝 {e.notes}</p>}
                    {e.importedFrom && <p className="text-[10px] font-bold text-slate-300">importerad från {e.importedFrom}</p>}
                </div>
            )}
        </li>
    );
}

function TextBlock({ label, text }: { label: string; text: string }) {
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
