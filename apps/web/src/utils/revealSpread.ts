/**
 * SHIM: utspridningen i reveal-urvalet (#200) bor numera i @vadkul/kontrakt
 * (packages/kontrakt/src/revealSpread.ts), så att appen tänder samma brickor
 * som webben när kartan är utzoomad (#261). Testerna flyttade med.
 */
export { pickSpreadRevealKeys, REVEAL_SPREAD_CELL_PX, type SpreadCandidate } from '@vadkul/kontrakt';
