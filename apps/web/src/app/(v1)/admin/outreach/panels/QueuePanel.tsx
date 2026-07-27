'use client';

// Kön — mogna grupper sorterade på förväntat värde, med förklaringssträng och
// grindarnas varningar. Blockerade grupper bakom en toggle med nedräkning.
// "Skapa utkast" aktiveras i etapp 2 — knappen finns men pekar dit.

import { useState } from 'react';
import type { QueueItem, QueueResponse } from '@/types/outreach';
import { AlertTriangle, ExternalLink, Lock, PenLine } from 'lucide-react';

export default function QueuePanel({ data }: { data: QueueResponse }) {
    const [showBlocked, setShowBlocked] = useState(false);

    return (
        <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
                {data.queue.map(item => <QueueCard key={item.contact.id} item={item} />)}
                {data.queue.length === 0 && (
                    <p className="text-sm font-semibold text-slate-400 py-2">
                        Inga mogna grupper just nu.
                    </p>
                )}
            </ul>

            <button onClick={() => setShowBlocked(v => !v)}
                className="self-start inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-100 transition-colors">
                <Lock size={12} /> {showBlocked ? 'Dölj' : 'Visa'} blockerade ({data.blocked.length})
            </button>

            {showBlocked && (
                <ul className="flex flex-col gap-2">
                    {data.blocked.map(item => <QueueCard key={item.contact.id} item={item} blocked />)}
                </ul>
            )}
        </div>
    );
}

function QueueCard({ item, blocked = false }: { item: QueueItem; blocked?: boolean }) {
    const c = item.contact;
    const softWarnings = item.gates.filter(g => !g.hard && !g.ok);
    const hardBlocks = item.gates.filter(g => g.hard && !g.ok);

    return (
        <li className={`rounded-xl border bg-white p-3.5 ${blocked ? 'border-slate-200 opacity-70' : 'border-slate-200'}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-800 break-words">{c.name}</p>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">{item.scoreExplanation}</p>

                    {/* Länkmål + postningsläge */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge tone="slate">{c.hasCityPage ? `/evenemang/${c.citySlug}` : 'vadkul.se'}</Badge>
                        <Badge tone={c.postingMode === 'direct' ? 'green' : c.postingMode === 'approval' ? 'amber' : 'slate'}>
                            {c.postingMode === 'direct' ? 'publicerar direkt → länk i kommentar'
                                : c.postingMode === 'approval' ? 'kräver godkännande → länk i inlägget'
                                : 'okänt läge → länk i inlägget'}
                        </Badge>
                        {c.eventSupplyThisWeek === undefined && (
                            <Badge tone="amber">⚠ saknar koordinat — kan inte räkna utbud</Badge>
                        )}
                    </div>

                    {/* Varningar/spärrar */}
                    {(softWarnings.length > 0 || hardBlocks.length > 0) && (
                        <div className="mt-2 flex flex-col gap-1">
                            {hardBlocks.map(g => (
                                <p key={g.id} className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500">
                                    <Lock size={11} /> {g.label}
                                </p>
                            ))}
                            {softWarnings.map(g => (
                                <p key={g.id} className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                                    <AlertTriangle size={11} /> {g.label} <span className="text-slate-300">({g.evidence})</span>
                                </p>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button disabled title="Utkastgeneratorn byggs i etapp 2"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#006AA7] text-white font-bold text-xs opacity-40 cursor-not-allowed">
                        <PenLine size={12} /> Skapa utkast
                    </button>
                    {c.groupUrl ? (
                        <a href={c.groupUrl} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006AA7] hover:underline">
                            <ExternalLink size={11} /> Öppna gruppen
                        </a>
                    ) : (
                        <span className="text-[11px] font-bold text-slate-300">grupp-URL saknas</span>
                    )}
                </div>
            </div>
        </li>
    );
}

function Badge({ tone, children }: { tone: 'slate' | 'green' | 'amber'; children: React.ReactNode }) {
    const cls = {
        slate: 'bg-slate-100 text-slate-600',
        green: 'bg-emerald-50 text-emerald-700',
        amber: 'bg-amber-50 text-amber-700',
    }[tone];
    return <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${cls}`}>{children}</span>;
}
