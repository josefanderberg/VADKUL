'use client';

// "Att göra idag" — handlingslistan, inte en tabell: dagskvoten, okända utfall
// som ska följas upp, kölagda inlägg att släpp-kolla och förfallna
// mejluppföljningar. Datat kommer färdigberäknat från kö-routen.

import type { QueueResponse, TodayAction } from '@/types/outreach';
import { AlertCircle, CheckCircle2, Clock3, Eye, Mail, MessageCircle } from 'lucide-react';

const ICONS: Record<TodayAction['type'], React.ReactNode> = {
    'följ-upp-utfall': <AlertCircle size={14} className="text-amber-500" />,
    'släpp-kollen': <Clock3 size={14} className="text-sky-500" />,
    'mejluppföljning': <Mail size={14} className="text-violet-500" />,
    'svara-kommentarer': <MessageCircle size={14} className="text-emerald-500" />,
};

export default function TodayPanel({ data }: { data: QueueResponse }) {
    const { quota, visits, actions, queue } = data;
    const quotaLeft = Math.max(0, quota.maxPerDay - quota.postedToday);

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
                            <li key={`${a.type}-${a.logId ?? a.contactId}-${i}`}
                                className="rounded-xl border border-slate-200 bg-white p-3.5 flex items-start gap-2.5">
                                <span className="mt-0.5">{ICONS[a.type]}</span>
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">{a.label}</p>
                                    {a.dueSince && (
                                        <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                                            väntat sedan {new Date(a.dueSince).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}
                                        </p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            {/* Dagens bästa kandidater — smakprov ur kön */}
            <section>
                <h2 className="text-base font-black text-slate-900 mb-3">
                    Bästa kandidaterna just nu
                    {quotaLeft === 0 && <span className="ml-2 text-xs font-black text-rose-500">dagskvoten full</span>}
                </h2>
                {queue.length === 0 ? (
                    <p className="text-sm font-semibold text-slate-400">Inga mogna grupper — kolla fliken Kön för nedräkningar.</p>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {queue.slice(0, Math.max(quotaLeft, 3)).map(item => (
                            <li key={item.contact.id} className="rounded-xl border border-slate-200 bg-white p-3.5">
                                <p className="text-sm font-black text-slate-800">{item.contact.name}</p>
                                <p className="text-[11px] font-bold text-slate-400 mt-0.5">{item.scoreExplanation}</p>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
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
