// lib/outreach/rules.ts
//
// Regelmotorn för kön. Varje grind bär ett evidence-fält: 'meta' är
// förstahandsbelagt hos Meta, 'husregel' är egen disciplin (obelagd men klok),
// 'gruppregel' kommer ur gruppens egna regler, 'eget-beslut' ur loggen.
// Husregler får VARNA men aldrig hårdblockera i onödan — UI:t visar skillnaden.

import type { OutreachContact, QueueGate } from '@/types/outreach';

export const KARENS_DAGAR = 21;         // 3-veckorsregeln (husregel)
export const MAX_POSTS_PER_DAY = 3;     // max 2–3 grupper/dag (husregel — Meta anger inga tal)
// Admin-DM-räknaren togs bort 26/7 på ägarbeslut: DM-spåret används inte
// ("de svarar ändå aldrig"). strikevarning-grinden nedan finns kvar.
export const NYMEDLEM_DAGAR = 5;        // Borås-noten: ny i gruppen ⇒ vänta + delta först
export const STADSKROCK_DAGAR = 7;      // två grupper i samma ort inom en vecka = onödig risk

export interface DayContext {
    now: number;                // epoch ms
    postedToday: number;        // bekräftade postningar idag (alla grupper)
    citiesPostedRecently: Map<string, number>;  // city → senaste postedAt (7-dagarsfönstret)
}

const DAY_MS = 86_400_000;

export function gatesFor(c: OutreachContact, ctx: DayContext): QueueGate[] {
    const gates: QueueGate[] = [];

    gates.push({
        id: 'karens',
        ok: !c.nextAllowedAt || c.nextAllowedAt <= ctx.now,
        label: c.nextAllowedAt && c.nextAllowedAt > ctx.now
            ? `Karens till ${new Date(c.nextAllowedAt).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })} (3-veckorsregeln)`
            : '3-veckorsregeln ok',
        evidence: 'husregel',
        hard: true,
    });

    gates.push({
        id: 'doNotPost',
        ok: !c.doNotPost,
        label: c.doNotPost ? 'Avskriven efter borttagning/nekad — posta inte' : 'Inte avskriven',
        evidence: 'eget-beslut',
        hard: true,
    });

    // Mjuk från 2, "röd" vid taket — UI:t rödmarkerar när ok är false.
    gates.push({
        id: 'dagstak',
        ok: ctx.postedToday < MAX_POSTS_PER_DAY,
        label: `${ctx.postedToday} av ${MAX_POSTS_PER_DAY} postade idag`,
        evidence: 'husregel',
        hard: false,
    });

    const lastInCity = c.city ? ctx.citiesPostedRecently.get(c.city.toLowerCase()) : undefined;
    gates.push({
        id: 'stadskrock',
        ok: !lastInCity,
        label: lastInCity
            ? `Annan grupp i ${c.city} fick inlägg för ${Math.round((ctx.now - lastInCity) / DAY_MS)} d sedan`
            : 'Ingen stadskrock',
        evidence: 'husregel',
        hard: false,
    });

    const today = new Date(ctx.now).getDay();
    const weekdayOk = !c.allowedWeekdays?.length || c.allowedWeekdays.includes(today);
    gates.push({
        id: 'veckodag',
        ok: weekdayOk,
        label: weekdayOk ? 'Rätt veckodag' : `Gruppens regler: ${c.groupRulesNote ?? 'fel veckodag'}`,
        evidence: 'gruppregel',
        hard: true,
    });

    const isNyMedlem = !!c.joinedGroupAt && ctx.now - c.joinedGroupAt < NYMEDLEM_DAGAR * DAY_MS;
    gates.push({
        id: 'nymedlem',
        ok: !isNyMedlem,
        label: isNyMedlem ? 'Ny i gruppen — delta/svara några dagar först' : 'Etablerad medlem',
        evidence: 'husregel',
        hard: false,
    });

    gates.push({
        id: 'strikevarning',
        ok: !(c.moderationRisk === 'hög' && c.adminDmStatus !== 'ja'),
        label: c.moderationRisk === 'hög' && c.adminDmStatus !== 'ja'
            ? 'Hög moderationsrisk — fråga admin (DM) innan du postar'
            : 'Risknivå ok',
        evidence: 'husregel',
        hard: false,
    });

    return gates;
}

/** Hård spärr fälld ⇒ kortet flyttas till "blockerade"-listan. */
export function isBlocked(gates: QueueGate[]): boolean {
    return gates.some(g => g.hard && !g.ok);
}
