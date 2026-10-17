/**
 * SHIM: ordfiltret i chatten bor i @vadkul/kontrakt (chattfilter.ts) - webben
 * och appen MÅSTE stoppa exakt samma ord, så listan finns bara där. Testerna
 * bor i paketet (packages/kontrakt/src/chattfilter.test.ts).
 */
export { hittaStötandeOrd, ORDFILTER_STOPP } from '@vadkul/kontrakt';
