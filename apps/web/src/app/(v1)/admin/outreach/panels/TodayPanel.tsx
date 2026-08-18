'use client';

// "Att göra idag" — handlingslistan, inte en tabell: dagskvoten, okända utfall
// som ska följas upp, kölagda inlägg att släpp-kolla och förfallna
// mejluppföljningar. Datat kommer färdigberäknat från kö-routen.
//
// Varje rad fälls ut till sin åtgärd: utfall + engagemang sparas via
// PATCH /api/admin/outreach/log, mejlknapparna via PATCH .../contact.
// Sparningen sätter outcomeCheckedAt/replyStatus — det är det som stänger
// raden, så listan laddas om (onChanged) och raden försvinner av sig själv.

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { LogOutcome, PostMethod, QueueResponse, TodayAction } from '@/types/outreach';
import {
    AlertCircle, CheckCircle2, ChevronDown, Clock3, ExternalLink, Eye, Mail,
    MessageCircle, Sparkles,
} from 'lucide-react';
import { CopyButton, DraftGenerator } from './DraftGenerator';

const DAY_MS = 86_400_000;

const ICONS: Record<TodayAction['type'], React.ReactNode> = {
    'följ-upp-utfall': <AlertCircle size={14} className="text-amber-500" />,
    'släpp-kollen': <Clock3 size={14} className="text-sky-500" />,
    'mejluppföljning': <Mail size={14} className="text-violet-500" />,
    'svara-kommentarer': <MessageCircle size={14} className="text-emerald-500" />,
};

const OUTCOMES: { id: LogOutcome; label: string }[] = [
    { id: 'publicerat-direkt', label: 'Publicerat direkt' },
    { id: 'krävde-godkännande', label: 'Krävde godkännande' },
    { id: 'godkänt-uppe', label: 'Godkänt/uppe' },
    { id: 'borttagen', label: 'Borttagen' },
    { id: 'nekad', label: 'Nekad' },
];
// Släpp-kollen har bara tre rimliga svar — resten är redan avgjort.
const RELEASE_OUTCOMES = new Set<LogOutcome>(['godkänt-uppe', 'nekad', 'borttagen']);

const METHODS: { id: PostMethod; label: string }[] = [
    { id: 'eget-inlägg', label: 'Eget inlägg' },
    { id: 'delat-sidinlägg', label: 'Delat sidinlägg' },
];

export default function TodayPanel({ data, onChanged }: { data: QueueResponse; onChanged: () => void }) {
    const { quota, visits, actions, queue } = data;
    const quotaLeft = Math.max(0, quota.maxPerDay - quota.postedToday);
    // Batch-flödet: EN knapp genererar utkast för alla dagens grupper
    // parallellt — sen är det bara att scrolla och kopiera rätt variant per
    // grupp (V1/V2 väljs redan av gruppens läge i generatorn).
    const [batchStarted, setBatchStarted] = useState(false);

    return (
        <div className="flex flex-col gap-6">
            {/* Dagskvoten + besöken */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <Quota label="Gruppinlägg idag" used={quota.postedToday} max={quota.maxPerDay} />
                <div className="flex items-center gap-2">
                    <Eye size={14} className="text-sky-500" />
                    <span className="text-xs font-bold text-slate-500">Besök idag</span>
                    <span className="text-sm font-black tabular-nums text-slate-800">{visits.today}</span>
                    <span className="text-[11px] font-bold text-slate-400">igår {visits.yesterday}</span>
                </div>
                <span className="text-[11px] font-bold text-slate-400">
                    Max 3/dag är husregel — Meta anger inga tal, men spamdisciplinen gör det
                </span>
            </div>

            {/* Att göra */}
            <section>
                <h2 className="text-base font-black text-slate-900 mb-3">
                    Att göra idag <span className="text-xs font-black text-slate-400 tabular-nums">· {actions.length}</span>
                </h2>
                {actions.length === 0 ? (
                    <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-600 py-1">
                        <CheckCircle2 size={15} /> Allt är ikapp — inga öppna uppföljningar.
                    </p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {actions.map((a, i) => (
                            <ActionRow key={`${a.type}-${a.logId ?? a.contactId}-${i}`} a={a} onChanged={onChanged} />
                        ))}
                    </ul>
                )}
            </section>

            {/* Dagens grupper — DET man kom hit för: vilka, kräver de godkännande,
                hur gick det sist, kopiera namnen/prompten och kör. */}
            <section>
                <div className="flex flex-wrap items-center gap-3 mb-3">
                    <h2 className="text-base font-black text-slate-900">
                        Dagens grupper att posta i
                        {quotaLeft === 0 && <span className="ml-2 text-xs font-black text-rose-500">dagskvoten full</span>}
                    </h2>
                    {queue.length > 0 && !batchStarted && (
                        <button type="button" onClick={() => setBatchStarted(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#006AA7] text-white font-bold text-xs hover:bg-[#005590] transition-colors">
                            <Sparkles size={13} /> Generera dagens utkast ({Math.min(queue.length, 4)})
                        </button>
                    )}
                    {batchStarted && (
                        <span className="text-[11px] font-bold text-slate-400">
                            Skriver alla parallellt (~30 s) — scrolla ner och kopiera rätt variant per grupp.
                        </span>
                    )}
                    {queue.length > 0 && <CopyPromptButton items={queue.slice(0, 4)} />}
                </div>
                {queue.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-400">Inga mogna grupper — kolla Städer-fliken för karens-nedräkningarna.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {queue.slice(0, 4).map(item => (
                            <CandidateCard key={item.contact.id} item={item} autoGenerate={batchStarted} />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

/* ── Dagens kandidatkort — allt man behöver veta FÖRE postningen ─────────── */

const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : null;

const OUTCOME_LABEL: Record<string, string> = {
    'publicerat-direkt': '✅ publicerades direkt',
    'krävde-godkännande': '🔒 hamnade i godkännandekö',
    'godkänt-uppe': '✅ godkändes och kom upp',
    'borttagen': '❌ togs bort',
    'nekad': '❌ nekades',
    'okänt': '❓ okänt utfall',
};

/** Badge + instruktion utifrån postingMode — svarar direkt på "V1 eller V2?". */
function ModeBadge({ mode }: { mode: 'approval' | 'direct' | 'unknown' }) {
    if (mode === 'approval') return (
        <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[11px] font-black">
            🔒 Kräver godkännande → V1, länk i inlägget
        </span>
    );
    if (mode === 'direct') return (
        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[11px] font-black">
            ⚡ Publicerar direkt → V2, länk i första kommentaren
        </span>
    );
    return (
        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[11px] font-black">
            ❓ Okänt läge — avgör i composern (kö = V1, direkt = V2)
        </span>
    );
}

function CandidateCard({ item, autoGenerate = false }: {
    item: import('@/types/outreach').QueueItem;
    autoGenerate?: boolean;
}) {
    const c = item.contact;
    const last = c.lastPostedAt
        ? `Senast: ${fmtDate(c.lastPostedAt)} — ${OUTCOME_LABEL[c.lastOutcome ?? 'okänt'] ?? c.lastOutcome}`
        : 'Aldrig postad — jungfrugrupp';
    return (
        <li className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
                <p className="text-sm font-black text-slate-800 min-w-0 flex-1">{c.name}</p>
                <CopyButton text={c.name} title="Kopiera gruppnamnet" />
                {c.groupUrl && (
                    <a href={c.groupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006AA7] hover:underline shrink-0">
                        <ExternalLink size={11} /> Öppna
                    </a>
                )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <ModeBadge mode={c.postingMode} />
                {typeof c.memberCount === 'number' && (
                    <span className="text-[11px] font-bold text-slate-400">{c.memberCount.toLocaleString('sv-SE')} medl.</span>
                )}
            </div>
            <p className="text-[11px] font-bold text-slate-500">{last}</p>
            <p className="text-[11px] font-bold text-slate-400">{item.scoreExplanation}</p>
            <DraftGenerator contactId={c.id} mode={c.postingMode} autoStart={autoGenerate} />
        </li>
    );
}

/* ── Utkastgeneratorn + CopyButton bor i ./DraftGenerator sedan 18/8 ─────── */

/** Bygger HELA dags-prompten (klistras rakt in i Claude-chatten):
 *  gruppnamnen + läge + senaste utfall — så utkasten kan skrivas utan
 *  följdfrågor. */
function CopyPromptButton({ items }: { items: import('@/types/outreach').QueueItem[] }) {
    const prompt = [
        'Skriv dagens FB-inlägg för de här grupperna (följ alla regler i docs/outreach/facebook-grupper.md — synka main först, 8 km-regeln, kolla karens):',
        ...items.map((it, i) => {
            const c = it.contact;
            const mode = c.postingMode === 'approval' ? 'kräver godkännande (V1)'
                : c.postingMode === 'direct' ? 'publicerar direkt (V2)' : 'okänt läge';
            const last = c.lastPostedAt
                ? `senast ${fmtDate(c.lastPostedAt)}: ${c.lastOutcome ?? 'okänt'}`
                : 'aldrig postad';
            return `${i + 1}. ${c.name} — ${mode}; ${last}`;
        }),
    ].join('\n');
    return <CopyButton text={prompt} title="Kopiera färdig prompt för dagens utkast" />;
}

/* ── Klickbara att-göra-rader ───────────────────────────────────────────── */

function ActionRow({ a, onChanged }: { a: TodayAction; onChanged: () => void }) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const patch = async (path: 'log' | 'contact', body: object) => {
        if (!user) return;
        setBusy(true);
        setError(null);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/admin/outreach/${path}`, {
                method: 'PATCH',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const msg = (await res.json().catch(() => null))?.error;
                setError(msg ?? `Kunde inte spara (${res.status}).`);
                return;
            }
            onChanged();
        } catch {
            setError('Nätverksfel — försök igen.');
        } finally {
            setBusy(false);
        }
    };

    const isLogAction = !!a.logId && (a.type === 'följ-upp-utfall' || a.type === 'släpp-kollen');

    return (
        <li className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <button type="button" onClick={() => setOpen(v => !v)}
                className="w-full text-left p-3.5 flex items-start gap-2.5 hover:bg-slate-50 transition-colors">
                <span className="mt-0.5">{ICONS[a.type]}</span>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                    {a.dueSince && (
                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                            väntat sedan {new Date(a.dueSince).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                        </p>
                    )}
                </div>
                <ChevronDown size={15} className={`mt-0.5 shrink-0 text-slate-300 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-3.5 flex flex-col gap-3">
                    {(a.groupUrl || a.email) && (
                        <div className="flex flex-wrap items-center gap-3">
                            {a.groupUrl && (
                                <a href={a.groupUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006AA7] hover:underline">
                                    <ExternalLink size={11} /> Öppna gruppen
                                </a>
                            )}
                            {a.email && (
                                <a href={`mailto:${a.email}`}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006AA7] hover:underline">
                                    <Mail size={11} /> {a.email}
                                </a>
                            )}
                        </div>
                    )}

                    {isLogAction && (
                        <OutcomeEditor busy={busy} compact={a.type === 'släpp-kollen'}
                            onSave={p => patch('log', { logId: a.logId, ...p })} />
                    )}
                    {a.type === 'mejluppföljning' && (
                        <MailButtons busy={busy}
                            onAct={set => patch('contact', { contactId: a.contactId, set })} />
                    )}
                    {!isLogAction && a.type !== 'mejluppföljning' && !a.groupUrl && !a.email && (
                        <p className="text-xs font-semibold text-slate-400">Ingen kopplad åtgärd för den här raden ännu.</p>
                    )}

                    {error && <p className="text-xs font-bold text-rose-600">{error}</p>}
                </div>
            )}
        </li>
    );
}

/** Utfallsraden ur planens §7: utfallsknappar + likes/komm/deln/egna svar. */
function OutcomeEditor({ busy, compact, onSave }: {
    busy: boolean;
    compact: boolean;
    onSave: (p: {
        outcome: LogOutcome;
        method?: PostMethod;
        likes?: number; comments?: number; shares?: number; ownRepliesCount?: number;
        avskriv?: boolean;
    }) => void;
}) {
    const [outcome, setOutcome] = useState<LogOutcome | null>(null);
    const [method, setMethod] = useState<PostMethod | null>(null);
    const [nums, setNums] = useState({ likes: '', comments: '', shares: '', ownRepliesCount: '' });
    const [avskriv, setAvskriv] = useState(false);

    const choices = compact ? OUTCOMES.filter(o => RELEASE_OUTCOMES.has(o.id)) : OUTCOMES;
    const showAvskriv = outcome === 'borttagen' || outcome === 'nekad';
    const parse = (s: string) => {
        const v = parseInt(s, 10);
        return Number.isFinite(v) && v >= 0 ? v : undefined;
    };

    return (
        <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-1.5">
                {choices.map(o => (
                    <button key={o.id} type="button" onClick={() => setOutcome(o.id)}
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-black transition-colors ${
                            outcome === o.id ? 'bg-[#006AA7] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}>
                        {o.label}
                    </button>
                ))}
            </div>

            {/* A/B:t: skrevs inlägget i gruppen, eller delades sidinlägget dit?
                Utan den här raden går de två metoderna inte att jämföra sen. */}
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-black text-slate-400 mr-0.5">Metod:</span>
                {METHODS.map(m => (
                    <button key={m.id} type="button" onClick={() => setMethod(method === m.id ? null : m.id)}
                        className={`px-2.5 py-1.5 rounded-full text-[11px] font-black transition-colors ${
                            method === m.id ? 'bg-slate-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                        }`}>
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
                <NumField label="👍 likes" value={nums.likes} onChange={v => setNums(n => ({ ...n, likes: v }))} />
                <NumField label="💬 komm." value={nums.comments} onChange={v => setNums(n => ({ ...n, comments: v }))} />
                <NumField label="↗ deln." value={nums.shares} onChange={v => setNums(n => ({ ...n, shares: v }))} />
                <NumField label="↩ egna svar" value={nums.ownRepliesCount} onChange={v => setNums(n => ({ ...n, ownRepliesCount: v }))} />
            </div>

            {showAvskriv && (
                <label className="inline-flex items-center gap-2 text-xs font-bold text-rose-600 cursor-pointer">
                    <input type="checkbox" checked={avskriv} onChange={e => setAvskriv(e.target.checked)}
                        className="accent-rose-600" />
                    Avskriv gruppen — posta aldrig igen
                </label>
            )}

            <button type="button" disabled={!outcome || busy}
                onClick={() => outcome && onSave({
                    outcome,
                    method: method ?? undefined,
                    likes: parse(nums.likes),
                    comments: parse(nums.comments),
                    shares: parse(nums.shares),
                    ownRepliesCount: parse(nums.ownRepliesCount),
                    avskriv: showAvskriv && avskriv ? true : undefined,
                })}
                className="self-start px-3.5 py-2 rounded-xl bg-[#006AA7] text-white font-bold text-xs hover:bg-[#005590] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {busy ? 'Sparar…' : 'Spara utfall'}
            </button>
        </div>
    );
}

function MailButtons({ busy, onAct }: { busy: boolean; onAct: (set: object) => void }) {
    const btn = 'px-2.5 py-1.5 rounded-full text-[11px] font-black border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40';
    return (
        <div className="flex flex-wrap gap-1.5">
            <button type="button" disabled={busy} className={btn}
                onClick={() => onAct({ followUpDueAt: Date.now() + 8 * DAY_MS })}>
                Uppföljning skickad — påminn om 8 d
            </button>
            <button type="button" disabled={busy} className={btn}
                onClick={() => onAct({ replyStatus: 'svar' })}>
                Fick svar 🎉
            </button>
            <button type="button" disabled={busy} className={btn}
                onClick={() => onAct({ replyStatus: 'nej' })}>
                Tackade nej
            </button>
        </div>
    );
}

function NumField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            {label}
            <input type="number" min={0} inputMode="numeric" value={value} placeholder="–"
                onChange={e => onChange(e.target.value)}
                className="w-14 px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 text-center" />
        </label>
    );
}

function Quota({ label, used, max }: { label: string; used: number; max: number }) {
    const full = used >= max;
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">{label}</span>
            <span className={`text-sm font-black tabular-nums ${full ? 'text-rose-500' : 'text-slate-800'}`}>
                {used} / {max}
            </span>
        </div>
    );
}
