/**
 * Troféerna (ägarbeslut 23/10 2026). Josef: "bygg det som objekt" och "det
 * räcker med en symbol, men att det kanske syns om man klickar på den".
 *
 *  - Varje trofé är ett EGET OBJEKT, `trophies/{id}` (TrophyDoc), med nummer,
 *    ägare och historik. Då kan den en dag byta ägare genom att bara ägaren
 *    och historiken ändras. Överlåtelse och försäljning är INTE byggda - det
 *    är ett eget beslut (i appen bara via Apples köp i appen, och appen säljer
 *    ingenting).
 *  - För visning speglas ägarens troféer i `users/{uid}.trophies`
 *    (TrophyMirror[]), så profilen inte behöver någon extra läsning.
 *  - BÅDA skrivs bara av admin-SDK:t (utdelningsskriptet). Reglerna har ingen
 *    match för trophies (stängd för klienter) och spärrar users.trophies för
 *    klientens create och update - annars kunde vem som helst ge sig en.
 *  - UI:t visar bara symbolen bredvid namnet; ett tryck visar describeTrophy.
 */

export const TROPHY_TYPES = ['fortur-2026'] as const;

export type TrophyType = (typeof TROPHY_TYPES)[number];

/** trophies/{id} - själva objektet. Tider som ISO-strängar (kontraktet
 *  känner inte till Firestores Timestamp). */
export interface TrophyDoc {
    type: TrophyType;
    /** Löpnummer inom typen, 1 = först. */
    number: number;
    /** Hur många av typen som finns. */
    of: number;
    /** Nuvarande ägarens uid. */
    owner: string;
    awardedAt: string;
    /** Varje ägare i ordning, den nuvarande sist. */
    history: { owner: string; since: string }[];
}

/** users/{uid}.trophies[] - spegeln profilerna läser. */
export interface TrophyMirror {
    id: string;
    type: TrophyType;
    number: number;
    of: number;
}

const DEFS: Record<TrophyType, { symbol: string; title: string; text: (t: TrophyMirror) => string }> = {
    'fortur-2026': {
        symbol: '🏆',
        title: 'Förtur till appen',
        text: t => `En av de ${t.of} som bjöd in en vän innan appen släpptes. Nr ${t.number} av ${t.of}.`,
    },
};

const isTrophyType = (v: unknown): v is TrophyType =>
    typeof v === 'string' && (TROPHY_TYPES as readonly string[]).includes(v);

const isPositiveInt = (v: unknown): v is number =>
    typeof v === 'number' && Number.isInteger(v) && v > 0;

/** Läs users-dokumentets fält defensivt: okända typer och trasiga poster
 *  hoppas över, samma id räknas en gång. Ordning: som de delades ut. */
export function readTrophies(raw: unknown): TrophyMirror[] {
    if (!Array.isArray(raw)) return [];
    const out: TrophyMirror[] = [];
    const seen = new Set<string>();
    for (const r of raw) {
        if (typeof r !== 'object' || r === null) continue;
        const { id, type, number, of } = r as Record<string, unknown>;
        if (typeof id !== 'string' || !id || seen.has(id)) continue;
        if (!isTrophyType(type) || !isPositiveInt(number) || !isPositiveInt(of) || number > of) continue;
        seen.add(id);
        out.push({ id, type, number, of });
    }
    return out;
}

/** Symbolen och texten som visas när man trycker på den. */
export function describeTrophy(t: TrophyMirror): { symbol: string; title: string; text: string } {
    const d = DEFS[t.type];
    return { symbol: d.symbol, title: d.title, text: d.text(t) };
}

export interface TrophyAward {
    id: string;
    doc: TrophyDoc;
    mirror: TrophyMirror;
}

/**
 * Utdelningen av en BEGRÄNSAD typ: kandidaterna numreras efter när de
 * kvalade (först = nr 1, lika = uid-ordning), en per uid (tidigaste vinner),
 * och alla får samma `of`. Id:t är `<typ>-<nummer>` - stabilt, så en ny
 * körning aldrig skapar dubbletter.
 */
export function planTrophyAwards(
    type: TrophyType,
    candidates: readonly { uid: string; qualifiedAt: number }[],
    awardedAt: string,
): TrophyAward[] {
    const first = new Map<string, number>();
    for (const c of candidates) {
        if (!c.uid) continue;
        const prev = first.get(c.uid);
        if (prev === undefined || c.qualifiedAt < prev) first.set(c.uid, c.qualifiedAt);
    }
    const ordered = [...first.entries()].sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
    const of = ordered.length;
    return ordered.map(([owner], i) => {
        const number = i + 1;
        const id = `${type}-${number}`;
        return {
            id,
            doc: { type, number, of, owner, awardedAt, history: [{ owner, since: awardedAt }] },
            mirror: { id, type, number, of },
        };
    });
}
