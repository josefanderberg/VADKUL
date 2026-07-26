// lib/outreach/scoring.ts
//
// Förväntat värde per kontakt. Urvalsregeln ur facit hittills är entydig:
// UTBUDET driver reaktionen (Helsingborg 305 event → 26 likes; Karlstad 98 → 5),
// därför dominerar eventSupply. Vikterna är startvärden — Claude-anteckningarna
// (etapp 6) får föreslå justeringar, ägaren antar.

import type { OutreachContact } from '@/types/outreach';

const norm = (v: number | undefined, max: number, fallback = 0.5) =>
    v === undefined ? fallback : Math.min(1, Math.max(0, v / max));

export function scoreContact(c: OutreachContact): { score: number; explanation: string } {
    const supply = norm(c.eventSupplyThisWeek, 400, 0.3);
    const members = norm(c.memberCount, 20_000, 0.5);   // okänt ⇒ neutralt
    const untouched = c.status === 'orörd' ? 1 : 0;
    const cityPage = c.hasCityPage ? 1 : 0;             // djuplänk = bättre landning
    const history =
        c.lastOutcome === 'publicerat-direkt' || c.lastOutcome === 'godkänt-uppe' ? 1
        : c.lastOutcome === undefined ? 0.5
        : 0;                                            // approval/borttagen = trögare
    const risk =
        (c.moderationRisk === 'hög' ? 1 : 0) +
        (c.isBigGroup && c.adminDmStatus !== 'ja' ? 0.5 : 0);

    const score =
        0.50 * supply +
        0.20 * members +
        0.12 * untouched +
        0.10 * cityPage +
        0.08 * history -
        0.15 * Math.min(1, risk);

    // Förklaringssträngen visas i kortet — ägaren ska aldrig gissa varför en
    // grupp ligger överst.
    const parts: string[] = [];
    if (c.eventSupplyThisWeek !== undefined) parts.push(`${c.eventSupplyThisWeek} event denna vecka`);
    else parts.push('utbud okänt (saknar koordinat)');
    if (c.memberCount) parts.push(`${c.memberCount.toLocaleString('sv-SE')} medlemmar`);
    if (untouched) parts.push('orörd');
    if (cityPage) parts.push('egen stadssida');
    if (c.lastOutcome === 'publicerat-direkt') parts.push('publicerar direkt');
    if (c.lastOutcome === 'krävde-godkännande') parts.push('kräver godkännande');
    if (c.moderationRisk === 'hög') parts.push('⚠ hög moderationsrisk');

    return { score: Math.round(score * 1000) / 1000, explanation: parts.join(' · ') };
}
