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

/** Den kortare normtiteln ingår ORDAGRANT (hela ord) i den längre — och är
 *  själv nog lång för att bära mening. "när bok blir bio" ingår i
 *  "föreläsning när bok blir bio några nedslag i filmhistorien"; bara "bio"
 *  gör det inte (minst 8 tecken). */
const CONTAINED_TITLE_MIN = 8;
const titleContains = (a: string, b: string): boolean => {
    const [long, short] = a.length >= b.length ? [a, b] : [b, a];
    return short.length >= CONTAINED_TITLE_MIN && ` ${long} `.includes(` ${short} `);
};

/**
 * Grupperar en dags (tidssorterade) event på titel och omslagsbild.
 * Ordningen mellan grupper är första förekomstens; ordningen inom gruppen
 * bevaras (= tidsordning). Representanten är gruppens första event MED
 * omslagsbild — bilden ska bära raden — annars det första. Singlar blir
 * grupper med tom dups-lista. Bildlösa event grupperas aldrig på bild.
 *
 * TREDJE regeln (Josef 28/9, "När bok blir bio"-paret: samma föreläsning
 * från två källor med olika titellängd OCH olika bild-URL:er): event på
 * SAMMA PLATS med SAMMA STARTTID grupperas när den ena normtiteln ingår i
 * den andra. Plats + exakt tid krävs — titelinneslutning ensam hade slagit
 * ihop "Julmarknad" med "Julmarknad i Tenhult" på annan ort, och olika
 * program i samma hus (olika tider) ska inte gruppera. Kräver att anroparen
 * skickar med `time` och `locationName`; utan dem gäller bara titel/bild.
 */
export function groupDayDuplicates<T extends {
    title: string;
    coverImage?: string;
    time?: string | Date;
    locationName?: string;
}>(
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

    // Plats + starttid-hinkarna för tredje regeln. Hinkarna är pyttesmå
    // (samma lokal, samma klockslag), så parvisa jämförelser är gratis.
    const byPlaceTime = new Map<string, number[]>();
    list.forEach((e, i) => {
        if (!e.locationName || !e.time) return;
        const ms = new Date(e.time).getTime();
        if (!Number.isFinite(ms)) return;
        const k = `${dupKey(e.locationName)}|${ms}`;
        const b = byPlaceTime.get(k);
        if (b) b.push(i); else byPlaceTime.set(k, [i]);
    });
    for (const bucket of byPlaceTime.values()) {
        for (let x = 0; x < bucket.length; x++) {
            for (let y = x + 1; y < bucket.length; y++) {
                const a = list[bucket[x]], b = list[bucket[y]];
                if (titleContains(dupKey(a.title), dupKey(b.title))) union(bucket[x], bucket[y]);
            }
        }
    }

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
