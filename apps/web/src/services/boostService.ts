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
 * bara vilket event det gäller.
 */
import { functions } from '../lib/firebase';

/** Hur många dagar en boost gäller. Speglas i backend (default där är också 7). */
export const BOOST_DURATION_DAYS = 7;

/**
 * Startar checkout för att boosta `eventId`. Redirectar till Stripe vid succé.
 * Kastar med ett läsbart felmeddelande om något går fel (visa via toast).
 */
export async function startEventBoostCheckout(eventId: string): Promise<void> {
    const { httpsCallable } = await import('firebase/functions');
    const create = httpsCallable<{ eventId: string; returnUrl: string }, { url: string }>(
        functions,
        'createBoostCheckout',
    );

    // returnUrl valideras mot en tillåtlista på servern — den här sidan är bara
    // ett förslag, aldrig något Stripe redirectar till på klientens ord.
    const res = await create({ eventId, returnUrl: window.location.href });
    const url = res.data?.url;
    if (!url) throw new Error('Kunde inte starta betalningen. Försök igen om en stund.');
    window.location.assign(url);
}
