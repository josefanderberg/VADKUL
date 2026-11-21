/**
 * Svarsraden (Intresserad · Kommer · Bjud med · ANMÄL) är sticky i kortets
 * botten och glider då över omslagsbilden. Ägarbeslut 13/11 (#224, Josef:
 * "om man är över bilden med dem så ska de inte ha en sådan vit bakgrund ...
 * tills de hamnar under bilden då kan de få en bakgrund"): finns det en bild
 * är raden genomskinlig ända tills den sticker ner UNDER bildens nederkant,
 * mot beskrivningen. Raden BÖRJAR alltså utan platta - även medan arket
 * växer upp och raden ännu står över rubrikraden ovanför bilden (Josef samma
 * kväll: "den får en vit bakgrund första sekunden ... den ska ju börja med
 * transparent bakgrund när det finns en bild"). Kräv aldrig att raden ligger
 * helt inom bilden igen - det gav just den vita blinken.
 */
export interface VerticalSpan {
    top: number;
    bottom: number;
}

/** Slack i px: avrundning i getBoundingClientRect och bildens border-t. */
export const COVER_EDGE_SLACK_PX = 2;

export function plateOverCover(plate: VerticalSpan | null, cover: VerticalSpan | null): boolean {
    if (!plate || !cover) return false;
    if (plate.bottom <= plate.top || cover.bottom <= cover.top) return false;
    return plate.bottom <= cover.bottom + COVER_EDGE_SLACK_PX;
}
