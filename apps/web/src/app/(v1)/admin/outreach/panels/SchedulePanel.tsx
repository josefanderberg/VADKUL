'use client';

// Planering — facebookschemat: 14 dagar framåt med konkreta grupper per dag,
// så postandet kommer igång igen efter ett uppehåll. Schemat är ett FÖRSLAG
// som räknas om live vid varje laddning (inget sparas): greedy-placering av
// högst score först, där varje dag respekterar
//   · karensen (3-veckorsregeln via nextAllowedAt),
//   · gruppens veckodagsregler (allowedWeekdays),
//   · stadskrocken (≥7 d mellan grupper i samma ort — även INOM schemat),
//   · dagstaket (2 föreslås per dag; husregeln tillåter max 3).
// Utkast genereras bara för idag/imorgon — "utkast är färskvara" (23/7-regeln):
// ett utkast skrivet en vecka i förväg nämner event som redan passerat.

import { useMemo } from 'react';
import type { OutreachContact, QueueItem, QueueResponse } from '@/types/outreach';
import { CalendarDays, ExternalLink, Flame } from 'lucide-react';
import { DraftGenerator } from './DraftGenerator';

const DAY_MS = 86_400_000;
const PLAN_DAYS = 14;
const PER_DAY = 2;              // förslaget håller sig under husregelns tak (3)
const STADSKROCK_DAGAR = 7;     // speglar lib/outreach/rules.ts

interface DayPlan {
    dayStart: number;
    weekday: number;            // 0=sön … 6=lör
    items: QueueItem[];
}

/**
 * Variantförslaget per grupp: B (maker-storyn) används EXAKT en gång och
 * passar bäst som första inlägget i en jungfrugrupp; annars A (helgtipset,
 * alltid med färska event). C/D väljs manuellt där tonen passar.
 */
function suggestVariant(c: OutreachContact): string {
    if ((c.postCount ?? 0) === 0 && !c.usedVariants?.includes('B'))
        return 'B — maker-storyn (jungfrugrupp; används en enda gång)';
    return 'A — helgtipset (nya event varje gång)';
}

function buildSchedule(all: QueueItem[], now: number, postedToday: number): DayPlan[] {
    // Avskrivna grupper deltar aldrig; resten sorteras på förväntat värde.
    const pool = all
        .filter(i => !i.contact.doNotPost)
        .sort((a, b) => b.score - a.score);

    const scheduled = new Set<string>();
    const cityLastDay = new Map<string, number>();   // ort (gemener) → dagindex
    const sod = new Date(now); sod.setHours(0, 0, 0, 0);
    const start = sod.getTime();

    const days: DayPlan[] = [];
    for (let d = 0; d < PLAN_DAYS; d++) {
        const dayStart = start + d * DAY_MS;
        const weekday = new Date(dayStart).getDay();
        // Redan postade inlägg äter av dag 0:s utrymme.
        const capacity = d === 0 ? Math.max(0, PER_DAY - postedToday) : PER_DAY;
        const items: QueueItem[] = [];
        for (const item of pool) {
            if (items.length >= capacity) break;
            const c = item.contact;
            if (scheduled.has(c.id)) continue;
            // Karensen ska ha löpt ut senast den dagen.
            if (c.nextAllowedAt && c.nextAllowedAt > dayStart + DAY_MS - 1) continue;
            if (c.allowedWeekdays?.length && !c.allowedWeekdays.includes(weekday)) continue;
            const cityKey = c.city?.trim().toLowerCase();
            if (cityKey) {
                const prev = cityLastDay.get(cityKey);
                if (prev !== undefined && d - prev < STADSKROCK_DAGAR) continue;
            }
            // Dag 0 ska inte föreslå grupper som är spärrade JUST idag av andra
            // hårda grindar (fel veckodag täcks ovan, karens likaså — kvar är
            // t.ex. stadskrock mot en NYSS bekräftad postning, som är mjuk).
            if (d === 0 && item.blocked) continue;
            items.push(item);
            scheduled.add(c.id);
            if (cityKey) cityLastDay.set(cityKey, d);
        }
        days.push({ dayStart, weekday, items });
    }
    return days;
}

const fmtDay = (ms: number) =>
    new Date(ms).toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtDate = (ms?: number) =>
    ms ? new Date(ms).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' }) : null;

export default function SchedulePanel({ data }: { data: QueueResponse }) {
    const all = useMemo(() => [...data.queue, ...data.blocked], [data]);
    const days = useMemo(
        () => buildSchedule(all, data.generatedAt, data.quota.postedToday),
        [all, data.generatedAt, data.quota.postedToday],
    );

    // "Inte postat på ett tag" — säg det rakt ut, med datum.
    const lastPosted = Math.max(0, ...all.map(i => i.contact.lastPostedAt ?? 0));
    const daysSince = lastPosted ? Math.floor((data.generatedAt - lastPosted) / DAY_MS) : null;

    return (
        <div className="flex flex-col gap-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-1">
                <p className="text-sm font-black text-slate-800 inline-flex items-center gap-1.5">
                    <CalendarDays size={15} className="text-[#006AA7]" />
                    {daysSince === null
                        ? 'Ingen bekräftad postning i loggen ännu.'
                        : `Senaste bekräftade postningen: ${fmtDate(lastPosted)} — ${daysSince} ${daysSince === 1 ? 'dag' : 'dagar'} sedan.`}
                </p>
                <p className="text-[11px] font-bold text-slate-400">
                    Schemat föreslår {PER_DAY}/dag (husregelns tak är 3) och räknas om varje gång du laddar —
                    inget sparas. Karens, veckodagsregler och ≥{STADSKROCK_DAGAR} d mellan grupper i samma ort
                    respekteras även inom schemat. Utkast skrivs tidigast dagen före: utkast är färskvara.
                </p>
            </div>

            {days.map((day, d) => (
                <section key={day.dayStart}>
                    <h2 className="text-sm font-black text-slate-900 mb-2 capitalize inline-flex items-center gap-2">
                        {fmtDay(day.dayStart)}
                        {d === 0 && <span className="text-[10px] font-black text-white bg-[#006AA7] rounded-full px-2 py-0.5">idag</span>}
                        {(day.weekday === 4 || day.weekday === 5) && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
                                <Flame size={10} /> bästa dagen för helgtips
                            </span>
                        )}
                    </h2>
                    {day.items.length === 0 ? (
                        <p className="text-[11px] font-bold text-slate-300">
                            {d === 0 && data.quota.postedToday >= PER_DAY
                                ? `Redan ${data.quota.postedToday} postade idag — vila.`
                                : 'Inga lediga grupper den här dagen.'}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {day.items.map(item => (
                                <ScheduleRow key={item.contact.id} item={item} draftable={d <= 1} />
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}

function ScheduleRow({ item, draftable }: { item: QueueItem; draftable: boolean }) {
    const c = item.contact;
    return (
        <li className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <p className="text-sm font-black text-slate-800 min-w-0 flex-1 break-words">
                    {c.name}
                    {c.city && <span className="ml-2 text-[11px] font-bold text-slate-400">{c.city}</span>}
                </p>
                {c.groupUrl && (
                    <a href={c.groupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006AA7] hover:underline shrink-0">
                        <ExternalLink size={11} /> Öppna
                    </a>
                )}
            </div>
            <p className="text-[11px] font-bold text-slate-400">Varför: {item.scoreExplanation}</p>
            <p className="text-[11px] font-bold text-slate-500">
                Förslag: {suggestVariant(c)}
                {' · '}{c.postingMode === 'approval' ? 'kräver godkännande → V1'
                    : c.postingMode === 'direct' ? 'publicerar direkt → V2' : 'okänt läge'}
            </p>
            {c.groupRulesNote && (
                <p className="text-[11px] font-bold text-amber-600">⚠ {c.groupRulesNote}</p>
            )}
            {draftable ? (
                <DraftGenerator contactId={c.id} contactName={c.name} mode={c.postingMode} />
            ) : (
                <p className="text-[11px] font-semibold text-slate-300">
                    Utkast skrivs tidigast dagen före (färskvaruregeln).
                </p>
            )}
        </li>
    );
}
