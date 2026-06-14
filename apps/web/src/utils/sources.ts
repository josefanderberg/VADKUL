// Vissa scrapade källor har SÅ många event att de dränker kartan. De döljs som
// standard men kan slås på igen via källtogglarna i kategorifiltret.
//
// En källa identifieras på event-URL:ens värdnamn (LinkEvent.url, som för
// destinationsdatan är samma som id:t).

export interface SourceDef {
    key: string;
    label: string;
    /** Matchar mot URL:ens värdnamn (gemener). */
    test: (host: string) => boolean;
}

export const SOURCE_DEFS: SourceDef[] = [
    { key: 'svenskakyrkan', label: 'Svenska kyrkan', test: h => h.includes('svenskakyrkan') },
    { key: 'pro', label: 'PRO', test: h => h === 'pro.se' || h.endsWith('.pro.se') },
    { key: 'korpen', label: 'Korpen', test: h => h.includes('korpen') },
];

// Dessa döljs från start (för många event). Användaren kan slå på dem igen.
export const DEFAULT_MUTED_SOURCES = ['svenskakyrkan', 'pro', 'korpen'];

/** Källnyckel för ett event, eller null om det inte tillhör en känd "stor" källa. */
export function classifySource(urlOrId?: string): string | null {
    if (!urlOrId) return null;
    let host: string;
    try {
        host = new URL(urlOrId).hostname.toLowerCase();
    } catch {
        return null;
    }
    for (const def of SOURCE_DEFS) {
        if (def.test(host)) return def.key;
    }
    return null;
}
