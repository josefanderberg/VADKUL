// Dubblettgruppering för daglistan: event under SAMMA DAG som delar TITEL
// eller OMSLAGSBILD blir EN rad ("på hög") i stället för tio. Mönstren kommer
// från biblioteks-, förenings- och kommunkällorna:
//   • samma titel på varje filial/ort ("Barnens gosedjursval" ×9 i Jönköping,
//     "Sagostund" på var bibliotek);
//   • samma bild men olika titel ("Förtidsröstning i stan" / "Förtidsröstning
//     Tenhult" — kommunens kampanjbild på varje lokal). Bild-URL:erna är
//     innehålls-hashade (scraped-events/shared/<hash>.jpg), så identisk URL
//     betyder identisk bild.
// Raden visar representanten; övriga tillfällen (det som faktiskt skiljer:
// tid, plats — och titeln när den avviker) radas upp bakom en utfällning på
// raden (DayFilteredList).
//
// Titelnyckeln är normaliserad som cityDatas normTitle (gemener, allt
// icke-alfanumeriskt → mellanslag) — "Sagostund!" och "sagostund" är samma
// event, men "Sagostund på Sigtuna bibliotek" är det inte. Nycklarna kan
// KEDJA grupper (A delar titel med B, B delar bild med C ⇒ en grupp), därav
// union-find i stället för en enkel Map.

/** Normaliserad titelnyckel — spegel av cityData.normTitle. */
export const dupKey = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9åäö]+/g, ' ').trim();

export type DupGroup<T> = { rep: T; dups: T[] };

/**
 * Grupperar en dags (tidssorterade) event på titel och omslagsbild.
 * Ordningen mellan grupper är första förekomstens; ordningen inom gruppen
 * bevaras (= tidsordning). Representanten är gruppens första event MED
 * omslagsbild — bilden ska bära raden — annars det första. Singlar blir
 * grupper med tom dups-lista. Bildlösa event grupperas aldrig på bild.
 */
export function groupDayDuplicates<T extends { title: string; coverImage?: string }>(
    list: T[],
): DupGroup<T>[] {
    // Union-find över listindex. Roten är alltid komponentens LÄGSTA index
    // (union pekar högre rot på lägre) — det ger första förekomstens ordning
    // gratis när grupperna samlas ihop nedan.
    const parent = list.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    const union = (a: number, b: number) => {
        const ra = find(a), rb = find(b);
        if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
    };

    const firstByKey = new Map<string, number>();
    list.forEach((e, i) => {
        const keys = [`t:${dupKey(e.title)}`];
        if (e.coverImage) keys.push(`i:${e.coverImage}`);
        for (const k of keys) {
            const first = firstByKey.get(k);
            if (first === undefined) firstByKey.set(k, i);
            else union(first, i);
        }
    });

    const byRoot = new Map<number, T[]>();
    list.forEach((e, i) => {
        const r = find(i);
        const g = byRoot.get(r);
        if (g) g.push(e); else byRoot.set(r, [e]);
    });
    return [...byRoot.values()].map(g => {
        const rep = g.find(e => !!e.coverImage) ?? g[0];
        return { rep, dups: g.filter(e => e !== rep) };
    });
}

/**
 * Närhetslistans variant (eventkortets "Fler event i närheten"): listan är
 * AVSTÅNDSSORTERAD och blandar dagar, så medlemmarna i en dubblettgrupp kan
 * ligga utspridda. Samma regel som ovan fast per DAG (lokal tid ur `time`),
 * och gruppen tar sin FÖRSTA medlems plats i ordningen (= närmast).
 * Representanten väljs som i groupDayDuplicates (första med bild).
 */
export function groupListDuplicates<T extends { title: string; coverImage?: string; time: string | Date }>(
    list: T[],
): DupGroup<T>[] {
    // ISO-sträng (stadssidorna) eller Date (kartans LinkEvent) — new Date tar båda.
    const dayOf = (t: string | Date) => {
        const d = new Date(t);
        return d.getFullYear() * 10_000 + d.getMonth() * 100 + d.getDate();
    };
    const byDay = new Map<number, T[]>();
    for (const e of list) {
        const k = dayOf(e.time);
        const b = byDay.get(k);
        if (b) b.push(e); else byDay.set(k, [e]);
    }
    const groupOf = new Map<T, DupGroup<T>>();
    for (const bucket of byDay.values()) {
        for (const g of groupDayDuplicates(bucket)) {
            groupOf.set(g.rep, g);
            for (const d of g.dups) groupOf.set(d, g);
        }
    }
    const out: DupGroup<T>[] = [];
    const emitted = new Set<DupGroup<T>>();
    for (const e of list) {
        const g = groupOf.get(e)!;
        if (emitted.has(g)) continue;
        emitted.add(g);
        out.push(g);
    }
    return out;
}
