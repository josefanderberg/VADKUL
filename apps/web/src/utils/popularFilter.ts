/**
 * popularFilter.ts — kartans 🔥 Populära-regel.
 *
 * `pop` klassas av pipelinen (apps/scraper utils/popularEvent) och bakas i
 * aggregaten — webben läser bara flaggan. Gamla cachade lager saknar fältet:
 * undefined = inte populär, aldrig ett fel.
 *
 * Bypass-mängden är MEDVETET en liten explicit funktion: ägarbeslut 10/9 att
 * boostade event alltid räknas som populära under boostperioden (en del av
 * boost-löftet), och användarskapade event följer sin vanliga särställning
 * (matchesFilter släpper ändå igenom dem först). TM-event har INGEN bypass —
 * biljettsignalen i pipelinepoängen bär dem.
 */

interface PopularCandidate {
    pop?: boolean;
    userCreated?: boolean;
    featuredUntil?: Date;
}

/** Samma regel som linkEventService.isEventFeatured — dubblerad raden här för
 *  att utils ska förbli Firebase-fria i test (servicen drar in lib/firebase). */
const featuredNow = (e: PopularCandidate): boolean =>
    !!e.featuredUntil && e.featuredUntil.getTime() > Date.now();

export function popularBypass(e: PopularCandidate): boolean {
    return !!e.userCreated || featuredNow(e);
}

/** Filterregeln: av → allt passerar; på → bara pop-flaggade + bypass. */
export function passesPopularFilter(e: PopularCandidate, popularOnly: boolean): boolean {
    return !popularOnly || e.pop === true || popularBypass(e);
}
