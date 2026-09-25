/**
 * @vadkul/kontrakt — det delade kontraktet mellan VADKUL:s klienter
 * (web, functions och appen). Här bor:
 *
 *  - typerna för Firestore-dokument och API-ytor (types.ts)
 *  - kategori-nycklarna, som aggregat och filter refererar med sträng (categories.ts)
 *  - ren, miljöfri logik som MÅSTE räkna lika överallt (eventShareSlug.ts)
 *
 * REGLER: paketet får aldrig bero på firebase, react eller node-API:er —
 * det ska gå att importera oförändrat i Next, Cloud Functions och React
 * Native. Firestores Timestamp speglas strukturellt (se types.ts).
 */
export * from './types';
export * from './categories';
export * from './eventShareSlug';
