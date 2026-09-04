/**
 * Väljarlistans öppningshöjd (multievent i EventCard).
 *
 * Det vanliga kortet öppnar på "header + 60 px bildremsa" (mäts mot
 * data-peek-boundary). Väljarlistan har ingen sådan markör och ska ändå
 * öppna på SAMMA höjd (Josef 2/9) — men utan en halv rad i vikningen:
 * så många HELA rader som ryms inom budgeten, minst en. Ryms hela innehållet
 * visas allt (ingen tom remsa under sista raden).
 *
 * @param rowBottoms radernas underkant i px räknat från innehållets topp, i ordning
 * @param contentHeight hela listinnehållets höjd i px
 * @param budgetPx höjden det vanliga kortet öppnar på
 * @returns målhöjd i px räknat från innehållets topp
 */
export function chooserDefaultTargetPx(rowBottoms: number[], contentHeight: number, budgetPx: number): number {
    if (contentHeight <= budgetPx) return contentHeight;
    if (rowBottoms.length === 0) return budgetPx;
    let target = rowBottoms[0];
    for (const bottom of rowBottoms) {
        if (bottom > budgetPx) break;
        target = bottom;
    }
    return target;
}
