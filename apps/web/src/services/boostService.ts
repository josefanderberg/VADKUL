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
import { analytics, functions } from '../lib/firebase';
import { getAuthHeaders } from '../lib/authHeaders';

/** Boost-nivåerna: hur länge eventet lyfts fram. Backend mappar tier → pris. */
export type BoostTier = 'day' | 'week' | 'month';

/** Valet i BoostTierPicker: en betald nivå, eller kreditdagarna (gratis). */
export type BoostChoice = BoostTier | 'credit';

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
export interface BoostConfirmation {
    applied: boolean;
    alreadyApplied?: boolean;
    /** Belopp i minsta enhet (öre) resp. valutakod — från Stripe-sessionen via backend. */
    amountTotal?: number;
    currency?: string;
}

/**
 * KREDITDAGAR (ägarbeslut 4/11, Josef: "de dagar man inte förbrukar ... ska
 * man ha återstående tid som man kan lägga på en annan event när det eventet
 * försvinner. Men man kan minst förlora en dag ... Eventet måste vara slut
 * innan man får kreditdagar"). Hinner ett boostat event vara innan boosten
 * tar slut blir de hela dagar som återstår - minus en dag - kreditdagar på
 * kontot, som läggs på ett annat event utan betalning.
 *
 * Saldot bor server-side (boostCredits/{uid}, stängd för klienten) och
 * avräknas av backend i samma anrop som läser det: /api/boost/credit/settle
 * går igenom ens kvitton, krediterar de event som varit och svarar med
 * saldot. Klienten kan alltså aldrig ge sig själv dagar - se apps/web/src/
 * server/boostCredit.ts (Admin SDK i hosting-backenden; API-routes i stället
 * för callables eftersom nya Cloud Functions inte fick anropsrättighet från
 * deploy-kontot) och docs/stripe-event-boost.md.
 */
export interface BoostCreditBalance {
    /** Kreditdagar kvar på kontot. */
    days: number;
    /** Hur många kvitton som avräknades i det här anropet. */
    settled: number;
}

/** Routens felsvar { error } → Error med läsbar text (visa via toast). */
async function creditFetch<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error((data && typeof data.error === 'string') ? data.error : 'Något gick fel. Försök igen om en stund.');
    return data as T;
}

export async function fetchBoostCredit(): Promise<BoostCreditBalance> {
    return creditFetch<BoostCreditBalance>('/api/boost/credit/settle');
}

export interface BoostCreditResult {
    applied: boolean;
    /** Nya featuredUntil (ISO) när boosten lades på. */
    until?: string;
    /** Dagar som lades på eventet. */
    days: number;
    /** Kreditdagar kvar efteråt. */
    daysLeft: number;
}

/** Lägg ALLA kreditdagar på `eventId` - backend sätter featuredUntil direkt,
 *  ingen Stripe-redirect. Kastar med läsbart fel (visa via toast). */
export async function applyBoostCreditDays(eventId: string): Promise<BoostCreditResult> {
    return creditFetch<BoostCreditResult>('/api/boost/credit/apply', { eventId });
}

export async function confirmEventBoost(sessionId: string): Promise<BoostConfirmation> {
    const { httpsCallable } = await import('firebase/functions');
    const confirm = httpsCallable<{ sessionId: string }, BoostConfirmation>(
        functions,
        'confirmBoost',
    );
    const res = await confirm({ sessionId });
    return res.data ?? { applied: false };
}

/**
 * Loggar ett genomfört boostköp som GA4:s standardhändelse `purchase` — då
 * hamnar det under Intäktsgenerering i Google Analytics/Firebase-konsolen.
 * transaction_id = checkout-sessionen, så GA dedupar om samma köp skulle
 * loggas två gånger. Loggas ENDAST vid applied — aldrig på alreadyApplied
 * (omladdning av success-URL:en ska inte bli ett nytt köp i statistiken).
 * Belopp saknas tills functions-versionen som skickar med det är deployad;
 * köpet räknas ändå, bara utan intäktssiffra.
 */
export function logBoostPurchase(sessionId: string, confirmation: BoostConfirmation): void {
    analytics.then(async instance => {
        if (!instance) return;
        const { logEvent } = await import('firebase/analytics');
        logEvent(instance, 'purchase', {
            transaction_id: sessionId,
            currency: (confirmation.currency ?? 'sek').toUpperCase(),
            ...(typeof confirmation.amountTotal === 'number'
                ? { value: confirmation.amountTotal / 100 }
                : {}),
            items: [{ item_id: 'event_boost', item_name: 'Event-boost' }],
        });
    }).catch(() => { /* analytics avstängt */ });
}
