// Några scrapade källor (PRO/Korpen/Svenska kyrkan) har väldigt många event.
// De visas numera ALLTID på kartan, men ritas med en egen markörfärg så att de
// går att skilja från övriga event (och från varandra).
//
// En källa identifieras på event-URL:ens värdnamn (LinkEvent.url, som för
// destinationsdatan är samma som id:t).

export interface SourceDef {
    key: string;
    label: string;
    /** Matchar mot URL:ens värdnamn (gemener). */
    test: (host: string) => boolean;
    /** Markörfärg (hex) för den här källan. */
    color: string;
}

export const SOURCE_DEFS: SourceDef[] = [
    { key: 'svenskakyrkan', label: 'Svenska kyrkan', test: h => h.includes('svenskakyrkan'), color: '#7c3aed' }, // lila
    { key: 'pro', label: 'PRO', test: h => h === 'pro.se' || h.endsWith('.pro.se'), color: '#db2777' },          // rosa
    { key: 'korpen', label: 'Korpen', test: h => h.includes('korpen'), color: '#16a34a' },                       // grön
];

/** Källdefinitionen för ett event, eller null om det inte tillhör en känd källa. */
function classify(urlOrId?: string): SourceDef | null {
    if (!urlOrId) return null;
    let host: string;
    try {
        host = new URL(urlOrId).hostname.toLowerCase();
    } catch {
        return null;
    }
    for (const def of SOURCE_DEFS) {
        if (def.test(host)) return def;
    }
    return null;
}

/** Källnyckel för ett event, eller null om det inte tillhör en känd "stor" källa. */
export function classifySource(urlOrId?: string): string | null {
    return classify(urlOrId)?.key ?? null;
}

/** Markörfärg (hex) för ett events källa, eller null om det inte är en känd källa. */
export function sourceColor(urlOrId?: string): string | null {
    return classify(urlOrId)?.color ?? null;
}
