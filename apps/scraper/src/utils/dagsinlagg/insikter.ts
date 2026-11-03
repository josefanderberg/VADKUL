/**
 * insikter.ts - vad inläggen gav. REN logik: tolkar Metas insights-svar
 * till platta siffror, räknar veckorapporten och viktar temahjulet efter
 * hur temana gått. Anropen mot Graph ligger i socialPublish.ts.
 *
 * Siffrorna är interna (ägarbeslut 29/8: trafik visas aldrig publikt);
 * de går bara till Telegram-rapporten och loggen.
 */

import type { Inlagg, Tema } from './typer';
import { TEMAN } from './typer';

export type Insikter = Record<string, number>;

function tal(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : 0;
}

/** Metas insights-lista [{name, values:[{value}]}] -> {name: value}. */
export function tolkaInsightsLista(raw: unknown): Insikter {
    const ut: Insikter = {};
    const data = (raw as { data?: unknown[] } | null)?.data;
    if (!Array.isArray(data)) return ut;
    for (const rad of data as { name?: string; values?: { value?: unknown }[] }[]) {
        if (!rad?.name) continue;
        const v = rad.values?.[0]?.value;
        ut[rad.name] = typeof v === 'object' && v !== null
            ? Object.values(v as Record<string, unknown>).reduce<number>((s, x) => s + tal(x), 0)
            : tal(v);
    }
    return ut;
}

/** Facebook: räckvidd ur insights, reaktioner/kommentarer/delningar ur fälten. */
export function tolkaFbInsikter(raw: { insights: unknown; fields: unknown }): Insikter {
    const i = tolkaInsightsLista(raw.insights);
    const f = (raw.fields ?? {}) as {
        reactions?: { summary?: { total_count?: unknown } };
        comments?: { summary?: { total_count?: unknown } };
        shares?: { count?: unknown };
    };
    return {
        rackvidd: i.post_impressions_unique ?? 0,
        visningar: i.post_impressions ?? 0,
        klick: i.post_clicks ?? 0,
        reaktioner: tal(f.reactions?.summary?.total_count),
        kommentarer: tal(f.comments?.summary?.total_count),
        delningar: tal(f.shares?.count),
    };
}

/** Instagram: reach/likes/comments/saved/shares(/plays) -> svenska nycklar. */
export function tolkaIgInsikter(raw: unknown): Insikter {
    const i = tolkaInsightsLista(raw);
    const ut: Insikter = {
        rackvidd: i.reach ?? 0, gillningar: i.likes ?? 0, kommentarer: i.comments ?? 0,
        sparningar: i.saved ?? 0, delningar: i.shares ?? 0,
    };
    if (i.plays !== undefined) ut.spelningar = i.plays;
    return ut;
}

/** Ett tal per inlägg att jämföra teman på: engagemang väger tyngre än räckvidd. */
export function engagemang(ins: Inlagg['insikter']): number {
    if (!ins) return 0;
    const fb = ins.fb ?? {}, ig = ins.ig ?? {};
    return (fb.rackvidd ?? 0) / 100 + (ig.rackvidd ?? 0) / 100
        + (fb.reaktioner ?? 0) + (ig.gillningar ?? 0)
        + 3 * ((fb.kommentarer ?? 0) + (ig.kommentarer ?? 0))
        + 2 * ((fb.delningar ?? 0) + (ig.delningar ?? 0) + (ig.sparningar ?? 0));
}

export interface TemaRad { tema: Tema; antal: number; snitt: number; rackvidd: number }

/** Snitt per tema över inlägg som har insikter. */
export function perTema(inlagg: Inlagg[]): TemaRad[] {
    const ut: TemaRad[] = [];
    for (const tema of TEMAN) {
        const egna = inlagg.filter(i => i.tema === tema && i.insikter);
        if (!egna.length) continue;
        const summa = egna.reduce((s, i) => s + engagemang(i.insikter), 0);
        const rackvidd = egna.reduce((s, i) => s + (i.insikter?.fb?.rackvidd ?? 0) + (i.insikter?.ig?.rackvidd ?? 0), 0);
        ut.push({ tema, antal: egna.length, snitt: Math.round((summa / egna.length) * 10) / 10, rackvidd });
    }
    return ut.sort((a, b) => b.snitt - a.snitt);
}

/**
 * Vikter till temahjulet: teman som går klart sämre än snittet får lägre
 * vikt (ner till 0,5), de som går bättre får upp till 2. Ingen vikt under
 * 1 förrän temat har minst tre mätta inlägg, och inget tema stängs av
 * automatiskt (0 sätts bara för hand).
 */
export function viktaTeman(rader: TemaRad[]): Partial<Record<Tema, number>> {
    const matta = rader.filter(r => r.antal >= 3);
    if (!matta.length) return {};
    const snitt = matta.reduce((s, r) => s + r.snitt, 0) / matta.length;
    if (snitt <= 0) return {};
    const ut: Partial<Record<Tema, number>> = {};
    for (const r of matta) {
        const kvot = r.snitt / snitt;
        ut[r.tema] = Math.round(Math.max(0.5, Math.min(2, kvot)) * 100) / 100;
    }
    return ut;
}

/** Veckorapporten till Telegram (HTML). */
export function veckorapport(inlagg: Inlagg[], fran: string, till: string): string {
    const veckans = inlagg.filter(i => i.id >= fran && i.id <= till && i.status === 'publicerad')
        .sort((a, b) => (a.id < b.id ? -1 : 1));
    const rader = veckans.map(i => {
        const fb = i.insikter?.fb, ig = i.insikter?.ig;
        const m = i.insikter
            ? `FB ${fb?.rackvidd ?? 0} nådda, ${fb?.reaktioner ?? 0} reaktioner, ${fb?.kommentarer ?? 0} kommentarer · IG ${ig?.rackvidd ?? 0} nådda, ${ig?.gillningar ?? 0} gilla, ${ig?.kommentarer ?? 0} kommentarer`
            : 'insikter hämtas efter 48 h';
        return `${i.id.slice(5)} ${i.tema}${i.variant ? `/${i.variant}` : ''}${i.stad ? ` (${i.stad})` : ''}: ${m}`;
    });
    const teman = perTema(inlagg).map(r => `${r.tema}: ${r.snitt} (${r.antal} st)`).join(', ');
    return [
        `📊 <b>Veckans inlägg ${fran.slice(5)} till ${till.slice(5)}</b>`,
        rader.length ? rader.join('\n') : 'Inga publicerade inlägg den här veckan.',
        teman ? `\nSnitt per tema (alla mätta): ${teman}` : '',
    ].filter(Boolean).join('\n');
}
