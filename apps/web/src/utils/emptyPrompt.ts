/**
 * Tom-prompten ovanför dagväljaren ("Inget här idag") tiger på kvartersnivå
 * (#252, ägarbeslut 15/11, Josef: "den täcker för mycket av skärmen. och är
 * ivägen när man kanske letar efter restaurangen"). Så nära inzoomat är en
 * tom ruta det normala - man letar efter platser, inte event - och där tänds
 * kvarterets platsskyltar (lekplats, idrott, park; restaurang och kafé
 * strax efter). Gränsen är det nära skyltlagrets startzoom PÅ WEBBEN - ur
 * de djupare kaklen, ett steg före kontraktets (#288) - så de två följer
 * varandra om den flyttas.
 *
 * Appen har samma regel i lib/kartPrompt, mot appens eget skyltlager (som
 * också tänds ett steg tidigare, #251).
 */
import { POI_SIGN_DEEP_NEAR_MIN_ZOOM } from './mapPoiSigns';

export const EMPTY_PROMPT_MAX_ZOOM = POI_SIGN_DEEP_NEAR_MIN_ZOOM;

/** Får tom-prompten visas vid den här zoomen? null = kartan har inte rapporterat sin zoom än. */
export function emptyPromptAllowedAt(zoom: number | null): boolean {
    return zoom === null || zoom < EMPTY_PROMPT_MAX_ZOOM;
}
