/**
 * KYRKAN, PRO OCH KORPEN PÅ KARTAN VID INZOOMNING (#240, ägarbeslut 15/11,
 * Josef: visa dem inzoomat, inte i listan, eftersom de inte är intressanta för
 * andra än de närboende).
 *
 * Opt-in-källorna (utils/sources) göms som förut i översikten, i listan man
 * scrollar, i siffrorna och på populärt. Men den som zoomat in till sitt
 * kvarter (OPT_IN_MAP_MIN_ZOOM) ser deras markörer på kartan utan något kryss,
 * som om källorna vore ikryssade: kategori- och 🔥-filtret gäller dem precis
 * som när de är ikryssade, och de går att öppna. Ingen ny hämtning görs -
 * eventen ligger redan i destinationslagret.
 *
 * Den som själv kryssar i en källa (profilpanelens "Visa även på kartan",
 * Fler i kategoriraden) får den som förut, på alla zoomnivåer och i listan.
 */

/** Zoomen där källorna tänds på kartan: samma kvartersnivå som det nära
 *  skyltlagret (POI_SIGN_NEAR_MIN_ZOOM i @vadkul/kontrakt). Ticketen lät 15
 *  eller 16 stå öppet; 16 är ett steg till om 15 visar sig för tätt. */
export const OPT_IN_MAP_MIN_ZOOM = 15;

/** Källorna som tänds inzoomat. Samma nycklar som SOURCE_DEFS. */
export const INZOOM_SOURCE_KEYS: readonly string[] = ['svenskakyrkan', 'pro', 'korpen'];

/** Tänds källorna på kartan vid den här zoomen? null = okänd zoom (kartan har
 *  inte rapporterat än) - då inte. */
export function optInSourcesOnMapAt(zoom: number | null): boolean {
    return zoom !== null && zoom >= OPT_IN_MAP_MIN_ZOOM;
}

/** Källorna som räknas som ikryssade för kartans inzoomade lager: användarens
 *  egna val plus inzoom-källorna. Resten av mängden (t.ex. 'family') följer
 *  med orörd, så familjegrinden beter sig som förut. */
export function withInzoomSources(selected: ReadonlySet<string>): Set<string> {
    const out = new Set(selected);
    for (const key of INZOOM_SOURCE_KEYS) out.add(key);
    return out;
}

/**
 * Kartans eventlista. `inzoom` = optInSourcesOnMapAt(zoom). Under gränsen är
 * det exakt listans (samma referens, så kartan inte bygger om sina lager i
 * onödan). Över gränsen: samma underlag genom inzoom-filtret, i samma ordning.
 */
export function mapEventsFor<T>(
    inzoom: boolean,
    listEvents: T[],
    base: T[],
    passesInzoom: (evt: T) => boolean,
): T[] {
    return inzoom ? base.filter(passesInzoom) : listEvents;
}
