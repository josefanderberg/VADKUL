/**
 * Ankarstad för FB-kedjans venue-geokodning.
 *
 * Kontextstaden kommer från sök-kön/sidbevakningen — den säger var vi LETADE,
 * inte var eventet ÄR. FB korspostar friskt (delningar i stadsgrupper, fuzzy
 * sök), så turnéshower dyker upp i fel städers köer: Skönsmon-rapporten 25/9
 * ("event 50 mil härifrån") var "Christoffer Nyqvist – Umeå, Väven" ur
 * Sundsvalls-kön — kedjan ankrade "Väven" på Sundsvall och Nominatim hittade
 * lydigt en namne där. Samma natt låg ~25 FB-event i fel stad av samma skäl
 * (Betnér/Skellefteå i Karlstad, Månegarm/Umeå i Stockholm, Palladium/Malmö i
 * Västerås …).
 *
 * Samma princip som centroidGuard regel 3: sökordets ort är bara en gissning —
 * eventets EGEN text väger tyngre. Override:a kontextstaden bara när allt håller:
 *   1. kontextstaden nämns INTE någonstans i titel/adress/beskrivning
 *      (nämns den är kontexten bekräftad — hemmalagets stad, avresestaden …),
 *   2. adressen eller titeln nämner exakt EN annan känd stad
 *      (två olika, "Buss Göteborg–Malmö", är tvetydigt → rör inget).
 * Adressen väger tyngre än titeln: "Härnösands Riksteaterförening" slår
 * gästspelstiteln "… – Piteå Kammaropera" — gästspelet ÄR i Härnösand.
 *
 * Anroparen får ALDRIG låta override-staden nå centroid-fallbacken: den ska
 * bara vinna med en specifik träff (poi/gata), annars körs ordinarie kedja
 * med kontextstaden — då kan fixen aldrig göra något sämre än idag
 * ("SCA Arena" + bortalagstiteln "… – Skellefteå AIK" får inte flytta
 * hemmamatchen till Skellefteås mittpunkt).
 */

import { cityMentioned, findKnownCities } from '../../utils/cityInText';
import { postalTown } from '../../utils/swedishAddress';
import { isPlaceName } from '../../utils/sqliteHelper';

/**
 * Ankarstaden för adressens geokodning: postorten när adressen har ett
 * svenskt postnummer och orten finns i SCB-registret, annars kontextstaden.
 * Postorten är eventets egen uppgift; köns stad bara var vi letade. Mölnlycke
 * ur Uppsala-kön, Karlskoga ur Eskilstunas och Delsbo ur Hudiksvalls hamnade
 * alla i köns stad (#247, platsgranskningen 15/11). isPlace injiceras för test.
 */
export function addressAnchorCity(
    address: string, contextCity: string | null | undefined,
    isPlace: (name: string) => boolean = isPlaceName,
): string | undefined {
    const town = postalTown(address);
    if (town && isPlace(town)) return town;
    return contextCity || undefined;
}

export interface AnchorCityInput {
    /** Staden från sök-kön/sidbevakningen (source.city) — kan saknas. */
    contextCity: string | null | undefined;
    title: string;
    /** Extraherad adress/platssträng från eventsidan. */
    address: string;
    description: string;
}

/** Stad ur eventets egen text som ska ersätta kontextstaden, eller null. */
export function anchorCityOverride(input: AnchorCityInput): string | null {
    const context = (input.contextCity || '').trim();
    if (!context) return null;

    const ownText = [input.title, input.address, input.description].filter(Boolean).join('\n');
    if (cityMentioned(ownText, context)) return null;

    const notContext = (c: string) => c.toLowerCase() !== context.toLowerCase();
    const inAddress = findKnownCities(input.address || '').filter(notContext);
    const candidates = inAddress.length > 0 ? inAddress : findKnownCities(input.title || '').filter(notContext);
    return candidates.length === 1 ? candidates[0] : null;
}
