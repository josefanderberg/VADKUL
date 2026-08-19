/**
 * boostService.ts — startar en Stripe Checkout för att "boosta" (featura) ett event.
 *
 *  1. Vi anropar vår egen Cloud Function `createBoostCheckout`, som skapar
 *     Checkout-sessionen och returnerar `url`.
 *  2. Vi redirectar webbläsaren dit.
 *  3. Efter betalning skriver `firestore-stripe-payments`-extensionens webhook
 *     ett payments-dok som Cloud-funktionen `applyEventBoost` plockar upp och
 *     sätter featuredUntil på eventet.
 *
 * Sessionen skapas INTE av extensionen (via customers/{uid}/checkout_sessions)
 * som förut: den bygger sessionen från en fast fältlista och kan därför inte
 * skicka `managed_payments.enabled = false`. Utan den flaggan kräver Stripe en
 * tax code för digitala varor — och en boost är annonsering, inte en digital
 * vara. Se apps/functions/src/index.ts (createBoostCheckout) och
 * docs/stripe-event-boost.md.
 *
 * Pris och eventId/boostDays-metadata ägs numera av backend — klienten skickar
 * bara vilket event det gäller och vilken nivå (tier) man valt.
 */
import { functions } from '../lib/firebase';

/** Boost-nivåerna: hur länge eventet lyfts fram. Backend mappar tier → pris. */
export type BoostTier = 'day' | 'week' | 'month';

/** Hur många dagar en boost gäller per nivå. Speglas i backend. */
export const BOOST_DURATION_DAYS: Record<BoostTier, number> = {
    day: 1,
    week: 7,
    month: 30,
};

/**
 * Nivåerna som köp-UI:t (BoostTierPicker) visar — EN källa för etikett, pris
 * och säljtext. OBS: priserna här är bara VISNING — det riktiga beloppet
 * sätts i Stripe och ägs av backend (createBoostCheckout). Ändras priset i
 * Stripe MÅSTE siffran här uppdateras, annars ljuger knappen.
 *
 * LANSERINGEN (19/8) KÖR ENBART 'week' (99 kr — gamla STRIPE_BOOST_PRICE_ID,
 * testad hela vägen). 'day'/'month' är byggda i backend men har inga Stripe-
 * priser: utan pris svarar createBoostCheckout "Boost är inte tillgängligt
 * ännu", så de ska INTE visas i väljaren. Tänd en till nivå så här:
 *   1. Skapa priset i Stripe.
 *   2. Sätt STRIPE_BOOST_PRICE_ID_DAY/_MONTH i apps/functions/.env och
 *      deploya functions (actionen tar bara hosting).
 *   3. Lägg till nivån här med det RIKTIGA beloppet som priceLabel.
 */
export const BOOST_TIERS: {
    tier: BoostTier;
    label: string;
    priceLabel: string;
    pitch: string;
}[] = [
    {
        tier: 'week',
        label: '1 vecka',
        priceLabel: '99 kr',
        pitch: 'Syns på kartan hela veckan med guldstjärna — upp till 1000x exponering.',
    },
];

/**
 * Startar checkout för att boosta `eventId` på vald nivå. Redirectar till
 * Stripe vid succé. Kastar med ett läsbart felmeddelande om något går fel
 * (visa via toast).
 */
export async function startEventBoostCheckout(eventId: string, tier: BoostTier): Promise<void> {
    const { httpsCallable } = await import('firebase/functions');
    const create = httpsCallable<{ eventId: string; returnUrl: string; tier: BoostTier }, { url: string }>(
        functions,
        'createBoostCheckout',
    );

    // returnUrl valideras mot en tillåtlista på servern — den här sidan är bara
    // ett förslag, aldrig något Stripe redirectar till på klientens ord.
    const res = await create({ eventId, returnUrl: window.location.href, tier });
    const url = res.data?.url;
    if (!url) throw new Error('Kunde inte starta betalningen. Försök igen om en stund.');
    window.location.assign(url);
}

/**
 * Applicerar boosten efter återkomsten från Stripe (?boost_session=cs_…).
 *
 * Detta är den primära fulfillment-vägen: backend hämtar sessionen från Stripe
 * och kräver payment_status === 'paid' innan featuredUntil sätts — betalningen
 * verifieras alltså aldrig på klientens ord. Ett kvitto per session gör att en
 * omladdning av success-URL:en inte förlänger boosten en gång till.
 *
 * `applied: false` utan fel betyder att betalningen inte var klar (avbruten
 * eller fördröjd betalmetod) eller att boosten redan var applicerad.
 */
export async function confirmEventBoost(sessionId: string): Promise<{ applied: boolean; alreadyApplied?: boolean }> {
    const { httpsCallable } = await import('firebase/functions');
    const confirm = httpsCallable<{ sessionId: string }, { applied: boolean; alreadyApplied?: boolean }>(
        functions,
        'confirmBoost',
    );
    const res = await confirm({ sessionId });
    return res.data ?? { applied: false };
}
