'use client';

// Planering — LÖPANDE BANDET (19/8): överst "På tur nu" — dagens och
// morgondagens grupper som körkort med alla stationer i ordning:
//   ① utkast (generatorn) → ② Insta-bilden (/api/marketing/ad/<citySlug>,
//   live-siffror; FB tar bara texten) → ③ öppna gruppen och posta/dela →
//   ④ "✓ Postad" (POST /api/admin/outreach/log: loggrad + karens på
//   kontakten → kön räknas om och nästa stad rycker fram).
// Under bandet: "På tur härnäst" — resten av 14-dagarsschemat kompakt, så
// stadsordningen syns innan den blir aktuell. Schemat är ett FÖRSLAG som
// räknas om live vid varje laddning (inget sparas): greedy-placering av
// högst score först, där varje dag respekterar
//   · karensen (3-veckorsregeln via nextAllowedAt),
//   · gruppens veckodagsregler (allowedWeekdays),
//   · stadskrocken (≥7 d mellan grupper i samma ort — även INOM schemat),
//   · dagstaket (2 föreslås per dag; husregeln tillåter max 3).
// Utkast genereras bara för idag/imorgon — "utkast är färskvara" (23/7-regeln):
// ett utkast skrivet en vecka i förväg nämner event som redan passerat.

import { useMemo } from 'react';
import type { OutreachContact, QueueItem, QueueResponse } from '@/types/outreach';
import { CalendarDays, ExternalLink, Flame, ImageIcon } from 'lucide-react';
import { DraftGenerator, PostConfirm } from './DraftGenerator';
import { useDrafts } from './DraftStore';

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

export default function SchedulePanel({ data, onChanged }: { data: QueueResponse; onChanged: () => void }) {
    const all = useMemo(() => [...data.queue, ...data.blocked], [data]);
    const days = useMemo(
        () => buildSchedule(all, data.generatedAt, data.quota.postedToday),
        [all, data.generatedAt, data.quota.postedToday],
    );

    // "Inte postat på ett tag" — säg det rakt ut, med datum.
    const lastPosted = Math.max(0, ...all.map(i => i.contact.lastPostedAt ?? 0));
    const daysSince = lastPosted ? Math.floor((data.generatedAt - lastPosted) / DAY_MS) : null;

    // Bandet = idag + imorgon (utkastens färskvarufönster). Resten är kön.
    const laneDays = days.slice(0, 2);
    const upcomingDays = days.slice(2);

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
                    Löpande bandet: utkast → bild → posta i gruppen → ✓ Postad. Bocken loggar
                    publiceringen och sätter karensen ({PER_DAY}/dag föreslås, husregelns tak är 3;
                    ≥{STADSKROCK_DAGAR} d mellan grupper i samma ort). Utkast skrivs tidigast dagen
                    före: utkast är färskvara.
                </p>
            </div>

            {/* ── PÅ TUR NU — bandet ─────────────────────────────────────── */}
            {laneDays.map((day, d) => (
                <section key={day.dayStart}>
                    <h2 className="text-sm font-black text-slate-900 mb-2 capitalize inline-flex items-center gap-2">
                        {fmtDay(day.dayStart)}
                        {d === 0 && <span className="text-[10px] font-black text-white bg-[#006AA7] rounded-full px-2 py-0.5">på tur nu</span>}
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
                        <ul className="flex flex-col gap-3">
                            {day.items.map(item => (
                                <ExecutionCard key={item.contact.id} item={item} onChanged={onChanged} />
                            ))}
                        </ul>
                    )}
                </section>
            ))}

            {/* ── PÅ TUR HÄRNÄST — kompakt kö så stadsordningen syns i förväg ── */}
            <section>
                <h2 className="text-sm font-black text-slate-900 mb-2">På tur härnäst</h2>
                <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                    {upcomingDays.every(day => day.items.length === 0) ? (
                        <p className="p-3.5 text-[11px] font-bold text-slate-300">Inga lediga grupper de kommande dagarna.</p>
                    ) : upcomingDays.flatMap(day =>
                        day.items.map(item => (
                            <UpcomingRow key={item.contact.id} item={item} dayStart={day.dayStart} />
                        ))
                    )}
                </div>
            </section>
        </div>
    );
}

/* ── Körkortet: en grupp på tur, alla stationer i ordning ──────────────── */
function ExecutionCard({ item, onChanged }: { item: QueueItem; onChanged: () => void }) {
    const c = item.contact;
    const { drafts } = useDrafts();
    const d = drafts[c.id];
    const draft = d?.status === 'done' ? d.result : null;
    // Texten som loggas: det man faktiskt klistrar in (V2-posten för
    // direktgrupper, annars V1:an med länken).
    const bodyText = draft
        ? (c.postingMode === 'direct' ? draft.drafts.v2Post : draft.drafts.v1)
        : undefined;

    return (
        <li className="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
                <p className="text-sm font-black text-slate-800 min-w-0 flex-1 break-words">
                    {c.name}
                    {c.city && <span className="ml-2 text-[11px] font-bold text-[#006AA7]">{c.city}</span>}
                </p>
                <span className="text-[10px] font-black text-slate-400 shrink-0">
                    {c.postingMode === 'approval' ? 'godkännandekö → V1'
                        : c.postingMode === 'direct' ? 'direkt → V2' : 'okänt läge'}
                </span>
            </div>
            <p className="text-[11px] font-bold text-slate-400 -mt-2">
                Varför: {item.scoreExplanation} · Förslag: {suggestVariant(c)}
            </p>
            {c.groupRulesNote && (
                <p className="text-[11px] font-bold text-amber-600 -mt-1">⚠ {c.groupRulesNote}</p>
            )}

            {/* ① Utkastet */}
            <Station n={1} label="Skriv utkastet">
                <DraftGenerator contactId={c.id} contactName={c.name} mode={c.postingMode} />
            </Station>

            {/* ② Bilden — bara städer med egen stadssida har annonsbilden.
                FB tar bara texten; bilden är för Instagram (1080×1080, live-siffror). */}
            <Station n={2} label="Bilden (Instagram)">
                {c.citySlug ? (
                    <a href={`/api/marketing/ad/${c.citySlug}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 text-[11px] font-black hover:bg-slate-100 transition-colors self-start">
                        <ImageIcon size={12} /> Öppna annonsbilden — {c.city} (live-siffror)
                    </a>
                ) : (
                    <p className="text-[11px] font-semibold text-slate-400">
                        {c.city ?? 'Orten'} saknar egen stadssida — ingen genererad bild; kör bara text på FB.
                    </p>
                )}
            </Station>

            {/* ③ Gruppen */}
            <Station n={3} label="Posta i gruppen">
                {c.groupUrl ? (
                    <a href={c.groupUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-[#006AA7] text-[11px] font-black hover:bg-slate-100 transition-colors self-start">
                        <ExternalLink size={12} /> Öppna gruppen — klistra in texten, eller dela sidans senaste inlägg
                    </a>
                ) : (
                    <p className="text-[11px] font-semibold text-rose-500">Grupplänk saknas — lägg in den i Städer-fliken.</p>
                )}
            </Station>

            {/* ④ Klart — loggar + sätter karens, kön räknas om */}
            <Station n={4} label="Bocka av">
                <PostConfirm contactId={c.id} bodyText={bodyText} onPosted={onChanged} />
            </Station>
        </li>
    );
}

function Station({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
    return (
        <div className="flex gap-2.5 border-t border-slate-100 pt-2.5">
            <span className="h-5 w-5 shrink-0 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black inline-flex items-center justify-center mt-0.5">
                {n}
            </span>
            <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                <span className="text-[11px] font-black text-slate-600">{label}</span>
                {children}
            </div>
        </div>
    );
}

/* ── Kompakt rad i "På tur härnäst" — datum, grupp, stad, varför ────────── */
function UpcomingRow({ item, dayStart }: { item: QueueItem; dayStart: number }) {
    const c = item.contact;
    return (
        <div className="p-3 flex items-center gap-3">
            <span className="text-[11px] font-black text-slate-400 w-16 shrink-0 capitalize">
                {new Date(dayStart).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' })}
            </span>
            <p className="text-xs font-bold text-slate-800 min-w-0 flex-1 break-words">
                {c.name}
                {c.city && <span className="ml-2 text-[11px] font-bold text-[#006AA7]">{c.city}</span>}
            </p>
            {c.groupUrl && (
                <a href={c.groupUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-[#006AA7] shrink-0">
                    <ExternalLink size={11} />
                </a>
            )}
        </div>
    );
}
