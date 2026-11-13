/**
 * Vad ett byte av kortets valda event ÄR (#226). Eventkortets ankar-effekt
 * körs varje gång sidan ger kortet ett nytt eventOBJEKT, och måste skilja på:
 *
 *  - 'internal': kortets egen Nästa/Bakåt drev fram eventet - ankare, besökt
 *    och bakåt-/framåtstackarna står kvar.
 *  - 'refresh': SAMMA event, bara ett färskare objekt (sidan pekar om det
 *    öppna kortet när cards-/descriptions-lagren landar). Inget val alls -
 *    allt står kvar. Före #226 lästes det som ett nytt val utifrån, så
 *    historiken nollades strax efter varje dagbyte (lagren för den nya dagen
 *    landar då) och Bakåt gick inte att trycka. Josef 13/11: "vi har ju en
 *    tillbaka knapp när man klickat på ett event och gått framåt med nästa.
 *    men alltså den ska ju kunna hoppa tillbaka i dagar också".
 *  - 'landing': landningen efter kortets dagbyte, eller ett val ur kortets
 *    lista - nytt ankare och tomt besökt-set, men stackarna står kvar.
 *  - 'fresh': ett nytt val utifrån (kartklick, första valet) - allt nollas.
 *
 * Ren modul, ingen React.
 */
export type CardSelectionKind = 'internal' | 'refresh' | 'landing' | 'fresh';

export interface CardSelectionInput {
    /** Id:t kortet visade före bytet, null om kortet var stängt. */
    prevId: string | null;
    /** Id:t kortet visar nu. */
    id: string;
    /** Kortets Nästa/Bakåt väntade på just det här id:t. */
    isPickNext: boolean;
    /** Kortet har just bett sidan byta dag och dagen har bytts. */
    isDayStepLanding: boolean;
    /** Valet kom ur kortets egna listor. */
    isListPick: boolean;
}

export function cardSelectionKind({ prevId, id, isPickNext, isDayStepLanding, isListPick }: CardSelectionInput): CardSelectionKind {
    if (isPickNext) return 'internal';
    if (isDayStepLanding || isListPick) return 'landing';
    if (prevId !== null && prevId === id) return 'refresh';
    return 'fresh';
}
