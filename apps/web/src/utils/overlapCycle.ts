// ── Z-växling för överlappande kartbrickor ────────────────────────────────────
// Grannbrickor som täcker varandra på skärmen (egna grupper, men närmare än
// ~en brickbredd i pixlar) ska turas om att ligga överst så eventet under
// högen upptäcks. Den här modulen är den rena geometrin + turordningen:
// V2Map projicerar tända brickor till skärmpunkter, frågar overlapClusters
// vilka som bildar högar och nextFront vems tur det är, och ritar svaret via
// spegellagret 'plain-events-front'. Inga kart-/React-beroenden här.

// En tänd brickas ankarpunkt i skärmpixlar. sortKey = huvudlagrets stapel-
// ordning (högst ritas överst) så klustret vet vem som syns naturligt.
export type OverlapPoint = { key: string; x: number; y: number; sortKey: number };

// En hög: members i stapelordning (naturliga toppen först), id byggt av de
// alfabetiskt sorterade nycklarna - samma hög får samma id mellan tick även
// när punktlistans ordning eller sortKeys skiftar.
export type OverlapCluster = { id: string; members: string[]; topKey: string };

// Kluster = sammanhängande komponenter där ankarpunkter ligger inom radiusPx
// (kedjor räknas ihop: A nära B och B nära C ger en trio, även om A och C är
// längre isär). Bara högar med minst 2 medlemmar returneras, i stabil ordning
// (stigande id) så round-robin-pekaren i V2Map kan gå listan runt.
export function overlapClusters(points: OverlapPoint[], radiusPx: number): OverlapCluster[] {
    const n = points.length;
    if (n < 2) return [];
    const r2 = radiusPx * radiusPx;
    // Union-find över alla par. n är antalet TÄNDA brickor i bild (reveal-
    // systemet håller det till tiotal), så n² är billigt.
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => {
        let root = i;
        while (parent[root] !== root) root = parent[root];
        while (parent[i] !== root) { const next = parent[i]; parent[i] = root; i = next; }
        return root;
    };
    for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
            const dx = points[i].x - points[j].x;
            const dy = points[i].y - points[j].y;
            if (dx * dx + dy * dy <= r2) parent[find(j)] = find(i);
        }
    }
    const byRoot = new Map<number, OverlapPoint[]>();
    for (let i = 0; i < n; i++) {
        const root = find(i);
        const bucket = byRoot.get(root);
        if (bucket) bucket.push(points[i]); else byRoot.set(root, [points[i]]);
    }
    const clusters: OverlapCluster[] = [];
    for (const group of byRoot.values()) {
        if (group.length < 2) continue;
        // Stapelordning: fallande sortKey (som huvudlagret ritar), nyckel som
        // deterministisk tiebreak - vid lika sortKey vet vi inte säkert vem GL
        // råkar rita överst, men en "onödig" spegelkopia av den som redan låg
        // överst är bara ett stillastående steg i rotationen.
        group.sort((a, b) => b.sortKey - a.sortKey || (a.key < b.key ? -1 : 1));
        const members = group.map(p => p.key);
        clusters.push({ id: [...members].sort().join('|'), members, topKey: members[0] });
    }
    clusters.sort((a, b) => (a.id < b.id ? -1 : 1));
    return clusters;
}

// Vems tur är det att ligga överst i högen? Rotationen går i stapelordning
// och varvar runt genom ALLA medlemmar, inklusive den naturliga toppen (det
// steget är spegelns viloläge). Ingen känd front (ny hög, eller fronten
// försvann med en databygge) = den naturliga toppen syns, så turen går till
// medlem två.
export function nextFront(cluster: OverlapCluster, current: string | null | undefined): string {
    const { members } = cluster;
    const idx = current != null ? members.indexOf(current) : -1;
    if (idx < 0) return members[1 % members.length];
    return members[(idx + 1) % members.length];
}
