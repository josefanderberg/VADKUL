/**
 * SHIM (fas 0): eventShareSlug bor numera i @vadkul/kontrakt — sluggen MÅSTE
 * räknas identiskt på webben, i functions och i appen, annars dör delade
 * /e/-länkar. GULDTESTET flyttade med till paketet
 * (packages/kontrakt/src/eventShareSlug.test.ts) och gäller precis som förut.
 */
export { eventShareSlug } from '@vadkul/kontrakt';
