// Några scrapade källor (PRO/Svenska kyrkan) har väldigt många event och visas
// därför bara när användaren aktivt kryssar i dem (opt-in). När de väl är på
// integreras de visuellt som vilka event som helst — de ritas med sin vanliga
// LLM-kategorifärg på kartan (ingen egen käll-/mörk markörfärg längre).
//
// Klassningen (classifySource) används enbart av opt-in-filtret; källan
// identifieras på event-URL:ens värdnamn (LinkEvent.url, som för
// destinationsdatan är samma som id:t).
//
// HEMBYGDSFÖRENINGARNA är INTE med här längre (9/8, ägarbeslut: de ska ingå med
// resten). Utan rad här klassas de inte som källa → de faller in i sin vanliga
// LLM-kategori och syns alltid, precis som övriga event.
//
// KORPEN står kvar här UTAN motsvarande knapp i SPECIAL_CATEGORIES (8/8,
// ägarbeslut: utbudet är i praktiken Stockholmsbundet). Poängen med att behålla
// raden: matchesFilter göms allt som klassas som en källa tills källan kryssas
// i — finns ingen knapp kryssas den aldrig i, och de ~2 600 Korpen-eventen
// förblir dolda. Tas raden bort i stället slutar de klassas som källa och
// hamnar direkt i "visa alla".

export interface SourceDef {
    key: string;
    label: string;
    /** Matchar mot URL:ens värdnamn (gemener). */
    test: (host: string) => boolean;
}

export const SOURCE_DEFS: SourceDef[] = [
    { key: 'svenskakyrkan', label: 'Svenska kyrkan', test: h => h.includes('svenskakyrkan') },
    { key: 'pro', label: 'PRO', test: h => h === 'pro.se' || h.endsWith('.pro.se') },
    // Utan knapp — se blocket överst. Håller Korpen-eventen dolda.
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
