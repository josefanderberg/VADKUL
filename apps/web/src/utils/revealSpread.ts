/**
 * SHIM: utspridningen i reveal-urvalet (#200) och kantramen där inga brickor
 * tänds (#262) bor i @vadkul/kontrakt (packages/kontrakt/src/revealSpread.ts),
 * så att appen tänder samma brickor som webben (#261). Testerna flyttade med.
 */
export {
    insideRevealView, pickSpreadRevealKeys, REVEAL_EDGE_INSET, REVEAL_SPREAD_CELL_PX, revealViewOffset,
    type RevealInset, type SpreadCandidate,
} from '@vadkul/kontrakt';
