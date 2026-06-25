/**
 * boostService.ts — startar en Stripe Checkout för att "boosta" (featura) ett event.
 *
 * Bygger på Firebase-extensionen `firestore-stripe-payments`:
 *  1. Vi skapar ett dokument under customers/{uid}/checkout_sessions med
 *     mode:'payment' + Stripe Price-ID:t för boosten.
 *  2. Extensionen skapar en Checkout Session hos Stripe och skriver tillbaka
 *     `url` (eller `error`) på SAMMA dokument.
 *  3. Vi lyssnar på dokumentet och redirectar webbläsaren till `url`.
 *  4. Efter betalning skriver extensionen ett payments-dok som Cloud-funktionen
 *     `applyEventBoost` plockar upp och sätter featuredUntil på eventet.
 *
 * eventId/boostDays skickas med i metadata (både på sessionen och på
 * payment_intent) så att backend vet vilket event som ska boostas.
 */
import { auth, db } from '../lib/firebase';
import { addDoc, collection, onSnapshot } from 'firebase/firestore';

/** Stripe Price-ID för boost-produkten — sätts som env-var (skapas i Stripe Dashboard). */
const BOOST_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_BOOST_PRICE_ID;

/** Hur många dagar en boost gäller. Speglas i backend (default där är också 7). */
export const BOOST_DURATION_DAYS = 7;

/** True om Stripe är konfigurerat — använd för att visa/dölja boost-knappen. */
export function isBoostConfigured(): boolean {
    return !!BOOST_PRICE_ID;
}

/**
 * Startar checkout för att boosta `eventId`. Redirectar till Stripe vid succé.
 * Kastar med ett läsbart felmeddelande om något går fel (visa via toast).
 */
export async function startEventBoostCheckout(eventId: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Du måste vara inloggad för att boosta ett event.');
    if (!db) throw new Error('Firestore är inte initierad.');
    if (!BOOST_PRICE_ID) {
        throw new Error('Boost är inte tillgängligt ännu — Stripe är inte konfigurerat.');
    }

    const metadata = { eventId, boostDays: String(BOOST_DURATION_DAYS) };
    const sessionsCol = collection(db, 'customers', user.uid, 'checkout_sessions');

    const ref = await addDoc(sessionsCol, {
        mode: 'payment',
        price: BOOST_PRICE_ID,
        quantity: 1,
        success_url: window.location.href,
        cancel_url: window.location.href,
        allow_promotion_codes: true,
        // Sessions-metadata + payment_intent-metadata: applyEventBoost läser den
        // senare (payments-dokumentet speglar payment_intent).
        metadata,
        payment_intent_data: { metadata },
    });

    return new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = (fn: () => void) => {
            if (settled) return;
            settled = true;
            unsub();
            clearTimeout(timer);
            fn();
        };

        const unsub = onSnapshot(
            ref,
            (snap) => {
                const data = snap.data() as { url?: string; error?: { message?: string } } | undefined;
                if (!data) return;
                if (data.error) {
                    finish(() => reject(new Error(data.error?.message || 'Kunde inte starta betalningen.')));
                    return;
                }
                if (data.url) {
                    finish(() => {
                        window.location.assign(data.url as string);
                        resolve();
                    });
                }
            },
            (err) => finish(() => reject(err)),
        );

        // Säkerhetsnät: om extensionen inte svarar (t.ex. ej installerad).
        const timer = setTimeout(
            () => finish(() => reject(new Error('Fick inget svar från betaltjänsten. Försök igen om en stund.'))),
            20000,
        );
    });
}
