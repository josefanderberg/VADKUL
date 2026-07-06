// Några scrapade källor (PRO/Korpen/Svenska kyrkan) har väldigt många event och
// visas därför bara när användaren aktivt kryssar i dem (opt-in). När de väl är
// på integreras de visuellt som vilka event som helst — de ritas med sin vanliga
// LLM-kategorifärg på kartan (ingen egen käll-/mörk markörfärg längre).
//
// Klassningen (classifySource) används enbart av opt-in-filtret; källan
// identifieras på event-URL:ens värdnamn (LinkEvent.url, som för
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
