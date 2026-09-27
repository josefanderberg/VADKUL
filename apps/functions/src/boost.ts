/** Event-boost (Stripe): createBoostCheckout, confirmBoost, applyEventBoost. */
import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { db, region, isScrapedEventId } from './shared';
import { eventShareSlug } from '@vadkul/kontrakt';

// ==============================
// EVENT-BOOST (Stripe)
// ==============================

/**
 * Skapar Checkout-sessionen för en boost — vår EGEN, i stället för den som
 * `firestore-stripe-payments`-extensionen skapar från customers/{uid}/checkout_sessions.
 *
 * VARFÖR egen: Stripe slår på Managed Payments (Stripe/Link som merchant of
 * record) som default på kontot, och den kräver att produkten har en tax code
 * ur listan för DIGITALA VAROR. En boost är betald synlighet — annonsering —
 * som dessutom säljs via en plattform, alltså två saker Managed Payments
 * uttryckligen inte stödjer. Enda dokumenterade avstängningen är per session
 * (`managed_payments.enabled = false`), och extensionen bygger sessionen från
 * en FAST fältlista och kastar okända fält. Därför skapar vi sessionen själva.
 *
 * Resten av kedjan är orörd: vi återanvänder kundkopplingen extensionen redan
 * håller (`customers/{uid}.stripeId`), så dess webhook skriver fortfarande
 * customers/{uid}/payments när betalningen går igenom — och `applyEventBoost`
 * nedan gör jobbet precis som förut.
 */

/**
 * Boost i TRE nivåer. Priserna (Stripe Price-ID) sätts i apps/functions/.env —
 * aldrig av klienten: den skickar bara `tier`, och backend slår upp både pris
 * och antal dagar här. _WEEK faller tillbaka på gamla STRIPE_BOOST_PRICE_ID så
 * en deploy UTAN de nya env-nycklarna beter sig exakt som förut (en nivå,
 * 7 dagar — speglar BOOST_DURATION_DAYS i webbens boostService.ts). Dagarna
 * åker med som boostDays-metadata på sessionen + payment_intent, så
 * fulfillment (confirmBoost/applyEventBoost) är helt nivå-omedveten.
 */
type BoostTier = 'day' | 'week' | 'month';
const BOOST_TIERS: Record<BoostTier, { days: number; priceId: string }> = {
    day: { days: 1, priceId: process.env.STRIPE_BOOST_PRICE_ID_DAY || '' },
    week: { days: 7, priceId: process.env.STRIPE_BOOST_PRICE_ID_WEEK || process.env.STRIPE_BOOST_PRICE_ID || '' },
    month: { days: 30, priceId: process.env.STRIPE_BOOST_PRICE_ID_MONTH || '' },
};
/**
 * Vart Stripe får skicka tillbaka webbläsaren. Klienten skickar sin egen URL,
 * men den valideras mot den här listan — annars vore funktionen en öppen
 * redirect med Stripes namn framför.
 */
const RETURN_ORIGINS = ['https://vadkul.se', 'https://www.vadkul.se', 'http://localhost:3000'];

const safeReturnUrl = (raw: unknown): string => {
    if (typeof raw !== 'string' || !raw) return 'https://vadkul.se';
    try {
        const url = new URL(raw);
        return RETURN_ORIGINS.includes(url.origin) ? url.toString() : 'https://vadkul.se';
    } catch {
        return 'https://vadkul.se';
    }
};


/**
 * Var boosten bor. Användarskapade event: featuredUntil på själva
 * linkEvents-dokumentet. Skrapade event har inget dokument klienten får läsa
 * (aggregatedEvents är stängd sedan egress-fixen) — deras boost läggs i
 * overlay-kollektionen eventBoosts/{slug}, som webben läser och mappar
 * tillbaka på kart-eventen via fältet eventId. Slug i stället för URL som
 * dokument-id eftersom Firestore-id:n inte får innehålla snedstreck — samma
 * FNV-hash som /e/-länkarna, så id:t är stabilt för alltid.
 */
const boostTargetRef = (eventId: string) =>
    isScrapedEventId(eventId)
        ? db.collection('eventBoosts').doc(eventShareSlug(eventId))
        : db.collection('linkEvents').doc(eventId);

/**
 * Finns det skrapade eventet i aggregatens destinations-lager? Kollas innan
 * checkout skapas — ingen ska betala för ett id som inte pekar på något.
 * Destinations är antingen ett doc med events-array eller ett index-doc med
 * shardCount + destinations_N-shards; några få admin-reads, och boost-köp är
 * sällsynta, så kostnaden är försumbar.
 */
async function scrapedEventExists(eventId: string): Promise<boolean> {
    const index = await db.collection('aggregatedEvents').doc('destinations').get();
    if (!index.exists) return false;
    const data = index.data() || {};
    const inArr = (events: unknown) =>
        Array.isArray(events) && events.some((e: any) => e?.id === eventId);
    if (inArr(data.events)) return true;
    const shardCount = typeof data.shardCount === 'number' ? data.shardCount : 0;
    for (let i = 0; i < shardCount; i++) {
        const shard = await db.collection('aggregatedEvents').doc(`destinations_${i}`).get();
        if (inArr(shard.data()?.events)) return true;
    }
    return false;
}

export const createBoostCheckout = functions
    // invoker: 'public' — nya Gen1-funktioner får INTE allUsers-invoker
    // automatiskt längre, och utan den svarar Google 403 innan koden startar
    // (de äldre callables i filen har bindningen sedan tidigare). Anropet är
    // fortfarande skyddat: auth-kontrollen sker i koden via context.auth.
    .runWith({ secrets: ['STRIPE_API_KEY'], invoker: 'public' })
    .region('europe-west1')
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad för att boosta ett event.');
        }
        // Anonym tips-session räknas inte som inloggad: betalningen ska knytas
        // till ett konto personen kan komma tillbaka till (och kvittot mailas dit).
        if (context.auth.token?.firebase?.sign_in_provider === 'anonymous') {
            throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad för att boosta ett event.');
        }
        // Nivån är valfri — utelämnad (eller null) betyder 'week', så gamla
        // bundlar som inte skickar tier köper 7-dagarsboosten precis som innan.
        // Allt annat än de tre kända nivåerna avvisas hårt: tier väljer pris,
        // och ett påhittat värde ska aldrig tyst bli ett köp på fel nivå.
        const rawTier = data?.tier;
        if (rawTier != null && rawTier !== 'day' && rawTier !== 'week' && rawTier !== 'month') {
            throw new functions.https.HttpsError('invalid-argument', 'Ogiltig boostnivå.');
        }
        const tier: BoostTier = rawTier ?? 'week';
        const { days: boostDays, priceId } = BOOST_TIERS[tier];
        if (!priceId) {
            console.error(`[boost] Pris-ID för nivån '${tier}' saknas i functions-miljön `
                + `(STRIPE_BOOST_PRICE_ID_${tier.toUpperCase()}${tier === 'week' ? ' eller STRIPE_BOOST_PRICE_ID' : ''}).`);
            throw new functions.https.HttpsError('failed-precondition', 'Boost är inte tillgängligt ännu.');
        }

        const uid = context.auth.uid;
        const rawEventId = typeof data?.eventId === 'string' ? data.eventId.trim() : '';
        if (!rawEventId) {
            throw new functions.https.HttpsError('invalid-argument', 'Inget event angivet.');
        }
        // Ett tillfälle i en veckoserie har id "<docId>__2026-08-13" och motsvarar
        // inget eget dokument — dokumentet är seriens bas (samma avskalning som
        // vid radering). Boosten hamnar alltså på serien, vilket är rätt: alla
        // tillfällen lyfts. Utan den här raden skulle varje serie-tillfälle
        // avvisas som "finns inte". Skrapade id:n är URL:er och lämnas orörda —
        // en URL kan mycket väl innehålla "__" utan att vara en serie.
        const eventId = isScrapedEventId(rawEventId) ? rawEventId : rawEventId.split('__')[0];

        // Finns eventet inte ska ingen betala heller. Användarskapade valideras
        // mot linkEvents (dit boosten skrivs); skrapade mot aggregatens
        // destinations-lager (boosten hamnar i eventBoosts-overlayn).
        if (isScrapedEventId(eventId)) {
            if (!(await scrapedEventExists(eventId))) {
                throw new functions.https.HttpsError('not-found', 'Eventet går inte att boosta.');
            }
        } else {
            const eventSnap = await db.collection('linkEvents').doc(eventId).get();
            if (!eventSnap.exists) {
                throw new functions.https.HttpsError('not-found', 'Eventet går inte att boosta.');
            }
        }

        const returnUrl = safeReturnUrl(data?.returnUrl);
        // Stripe ersätter {CHECKOUT_SESSION_ID} i success_url. Klammrarna får INTE
        // url-kodas, så parametern läggs på råtext efter serialiseringen — det är
        // den `confirmBoost` läser när användaren kommer tillbaka.
        const successUrl = (() => {
            const u = new URL(returnUrl);
            u.searchParams.delete('boost_session');
            const qs = u.searchParams.toString();
            return `${u.origin}${u.pathname}${qs ? `?${qs}&` : '?'}boost_session={CHECKOUT_SESSION_ID}`;
        })();

        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_API_KEY as string, { apiVersion: '2026-07-29.dahlia' });

        // Kundkopplingen: extensionen skriver `stripeId` på customers/{uid} vid
        // första köpet. Saknas den skapar vi kunden på samma form (metadata
        // firebaseUID + fältet stripeId), annars hittar inte extensionens
        // webhook tillbaka till uid:t och betalningen landar aldrig i Firestore.
        const customerRef = db.collection('customers').doc(uid);
        const customerSnap = await customerRef.get();
        let stripeId = customerSnap.get('stripeId') as string | undefined;
        // Sparade kund-id:n kan höra till FEL Stripe-läge: alla köp före
        // live-växlingen 19/8 skapade TEST-kunder, och med live-nyckeln
        // svarar Stripe "No such customer" på dem — hela checkouten föll.
        // Verifiera id:t i nuvarande läge; finns kunden inte (eller är
        // raderad) släpps id:t så en ny kund skapas nedan. Andra fel
        // (nät m.m.) kastas vidare — att skapa om kunden i blindo hade
        // gett dubbletter.
        if (stripeId) {
            try {
                const existing = await stripe.customers.retrieve(stripeId);
                if ((existing as { deleted?: boolean }).deleted) stripeId = undefined;
            } catch (err) {
                if ((err as { code?: string })?.code === 'resource_missing') {
                    console.warn(`[boost] Sparad Stripe-kund ${stripeId} finns inte i nuvarande läge (test/live-växling) — skapar ny.`);
                    stripeId = undefined;
                } else {
                    throw err;
                }
            }
        }
        if (!stripeId) {
            const authUser = await admin.auth().getUser(uid);
            const customer = await stripe.customers.create({
                email: authUser.email || undefined,
                metadata: { firebaseUID: uid },
            });
            stripeId = customer.id;
            await customerRef.set({ stripeId, stripeLink: `https://dashboard.stripe.com/customers/${stripeId}` }, { merge: true });
        }

        // Samma metadata på både sessionen och payment_intent: extensionens
        // payments-dokument speglar payment_intent, och det är den `applyEventBoost` läser.
        const metadata = { eventId, boostDays: String(boostDays), firebaseUID: uid };

        try {
            const session = await stripe.checkout.sessions.create({
                mode: 'payment',
                customer: stripeId,
                line_items: [{ price: priceId, quantity: 1 }],
                success_url: successUrl,
                cancel_url: returnUrl,
                allow_promotion_codes: true,
                // Kärnan i hela den här funktionen — se blocket överst.
                managed_payments: { enabled: false },
                metadata,
                payment_intent_data: { metadata },
            });
            if (!session.url) {
                throw new functions.https.HttpsError('internal', 'Fick ingen betalningslänk från Stripe.');
            }
            console.log(`[boost] Checkout ${session.id} skapad för event ${eventId} (nivå ${tier}, ${boostDays} d, user ${uid}).`);
            return { url: session.url };
        } catch (err) {
            if (err instanceof functions.https.HttpsError) throw err;
            console.error('[boost] Kunde inte skapa checkout-session:', err);
            throw new functions.https.HttpsError('internal', 'Kunde inte starta betalningen. Försök igen om en stund.');
        }
    });

/**
 * Applicerar boosten när användaren kommer tillbaka från Stripe.
 *
 * Detta är den PRIMÄRA fulfillment-vägen. `applyEventBoost` nedan (via
 * extensionens webhook) ligger kvar som skyddsnät, men förutsätter att Stripe
 * faktiskt ringer extensionen — och den webhooken har aldrig avfyrats.
 *
 * Betalningen verifieras hos Stripe, aldrig på klientens ord: vi hämtar
 * sessionen och kräver payment_status === 'paid'. Dubbelapplicering hindras av
 * kvittot `boostPayments/{sessionId}` som skrivs i SAMMA transaction som
 * featuredUntil — utan det skulle en omladdning av success-URL:en förlänga
 * boosten gratis, om och om igen.
 */
export const confirmBoost = functions
    .runWith({ secrets: ['STRIPE_API_KEY'], invoker: 'public' })
    .region('europe-west1')
    .https.onCall(async (data: any, context: functions.https.CallableContext) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'Du måste vara inloggad.');
        }
        const uid = context.auth.uid;
        const sessionId = typeof data?.sessionId === 'string' ? data.sessionId.trim() : '';
        if (!sessionId.startsWith('cs_') || sessionId.length > 200) {
            throw new functions.https.HttpsError('invalid-argument', 'Ogiltig betalning.');
        }

        const { default: Stripe } = await import('stripe');
        const stripe = new Stripe(process.env.STRIPE_API_KEY as string, { apiVersion: '2026-07-29.dahlia' });

        let session: any;
        try {
            session = await stripe.checkout.sessions.retrieve(sessionId);
        } catch (err) {
            console.error('[boost] Kunde inte hämta session:', err);
            throw new functions.https.HttpsError('not-found', 'Betalningen kunde inte hittas.');
        }

        // Obetald (t.ex. avbruten, eller en fördröjd betalmetod som ännu inte
        // klarnat) → inget fel, bara "inte klar än".
        if (session.payment_status !== 'paid') {
            console.log(`[boost] Session ${sessionId} har status ${session.payment_status} — ingen boost.`);
            return { applied: false, status: session.payment_status };
        }

        const metadata = (session.metadata || {}) as Record<string, string>;
        // Sessionen måste tillhöra den som anropar: annars kunde någon som fått
        // tag på ett session-id lösa in en annans betalning.
        if (metadata.firebaseUID !== uid) {
            throw new functions.https.HttpsError('permission-denied', 'Betalningen tillhör ett annat konto.');
        }
        const eventId = metadata.eventId;
        if (!eventId) {
            throw new functions.https.HttpsError('failed-precondition', 'Betalningen saknar event.');
        }
        const boostDays = Math.max(1, Math.min(90, parseInt(metadata.boostDays || '7', 10) || 7));
        const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : sessionId;

        const receiptRef = db.collection('boostPayments').doc(sessionId);
        const scraped = isScrapedEventId(eventId);
        const eventRef = boostTargetRef(eventId);

        const result = await db.runTransaction(async (tx) => {
            const [receipt, evt] = await Promise.all([tx.get(receiptRef), tx.get(eventRef)]);
            if (receipt.exists) return { applied: false, alreadyApplied: true };
            // Skrapade event: overlay-dokumentet skapas vid FÖRSTA boosten, så
            // att det saknas är normalt. Användarskapade: dokumentet ÄR eventet
            // och måste finnas.
            if (!scraped && !evt.exists) {
                throw new functions.https.HttpsError('not-found', 'Eventet finns inte längre.');
            }
            const evtData = evt.exists ? (evt.data() || {}) : {};
            const now = Date.now();
            const currentUntilMs =
                evtData.featuredUntil instanceof admin.firestore.Timestamp ? evtData.featuredUntil.toMillis() : 0;
            const until = new Date(Math.max(now, currentUntilMs) + boostDays * 24 * 60 * 60 * 1000);
            tx.set(receiptRef, {
                uid, eventId, boostDays, paymentId, sessionId,
                appliedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            if (scraped) {
                // eventId med i dokumentet: slug-hashen är enkelriktad och
                // klienten behöver ursprungs-id:t (URL:en) för att para ihop
                // overlayn med rätt kart-event.
                tx.set(eventRef, {
                    eventId,
                    featuredUntil: admin.firestore.Timestamp.fromDate(until),
                    featuredPaymentId: paymentId,
                }, { merge: true });
            } else {
                tx.update(eventRef, {
                    featuredUntil: admin.firestore.Timestamp.fromDate(until),
                    featuredPaymentId: paymentId,
                });
            }
            return { applied: true, until: until.toISOString() };
        });

        if (result.applied) {
            console.log(`[boost] Event ${eventId} boostat ${boostDays} dagar via confirmBoost (session ${sessionId}, user ${uid}).`);
            // Belopp/valuta från Stripe-sessionen följer med i svaret så
            // klienten kan logga köpet i Analytics — beloppet kommer alltid
            // härifrån, aldrig från klientens prisetiketter.
            return { ...result, amountTotal: session.amount_total, currency: session.currency };
        }
        return result;
    });

/**
 * Applicerar en betald "boost" på ett event.
 *
 * Förutsätter Firebase-extensionen `firestore-stripe-payments` (Invertase/Stripe),
 * som vid en lyckad ENGÅNGSbetalning skriver ett dokument under
 *   customers/{uid}/payments/{paymentId}
 * (Stripe PaymentIntent: { status, amount, currency, metadata, ... }).
 *
 * Klienten startar köpet genom att skapa en checkout-session med
 * payment_intent_data.metadata.eventId (+ boostDays) — se webb-klienten. Vi läser
 * tillbaka den metadatan här och sätter featuredUntil på eventet. Detta är ENDA
 * stället featuredUntil skrivs: klienten kan aldrig boosta sig själv gratis
 * (Firestore-reglerna tillåter inte fältet), bara en verifierad betalning.
 */
export const applyEventBoost = region.firestore
    .document('customers/{uid}/payments/{paymentId}')
    .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
        const after = change.after.exists ? change.after.data() : null;
        if (!after) return null;
        const before = change.before.exists ? change.before.data() : null;

        // Agera bara på lyckade betalningar, och bara EN gång (status-övergången).
        if (after.status !== 'succeeded') return null;
        if (before && before.status === 'succeeded') return null;

        const uid = context.params.uid as string;
        const paymentId = context.params.paymentId as string;
        const metadata = (after.metadata || {}) as Record<string, string>;
        const eventId = metadata.eventId;
        if (!eventId) {
            // Inte ett boost-köp (t.ex. framtida prenumeration) → ignorera.
            // OBS: ser du detta för ETT boost-köp bär inte payment_intent metadatan
            // eventId — då måste klientens checkout-session sätta
            // payment_intent_data.metadata (se docs/stripe-event-boost.md).
            console.log(`[boost] Betalning ${paymentId} (user ${uid}) saknar eventId-metadata — hoppar över.`);
            return null;
        }

        // Säkra gränser: 1–90 dagar, default 7.
        const boostDays = Math.max(1, Math.min(90, parseInt(metadata.boostDays || '7', 10) || 7));

        const scraped = isScrapedEventId(eventId);
        const eventRef = boostTargetRef(eventId);
        try {
            await db.runTransaction(async (tx) => {
                const snap = await tx.get(eventRef);
                // Skrapade event: overlay-dokumentet skapas vid första boosten —
                // att det saknas är normalt. Användarskapade: dokumentet ÄR
                // eventet och måste finnas.
                if (!scraped && !snap.exists) {
                    console.error(`[boost] Event ${eventId} saknas — betalning ${paymentId} (user ${uid}) kunde inte appliceras.`);
                    return;
                }
                const data = snap.exists ? (snap.data() || {}) : {};
                // Redan applicerad av confirmBoost när användaren kom tillbaka från
                // Stripe (samma payment_intent-id på båda vägarna). Utan den här
                // kollen skulle en fungerande webhook lägga på boosten en gång till.
                if (data.featuredPaymentId === paymentId) {
                    console.log(`[boost] Betalning ${paymentId} redan applicerad på ${eventId} — hoppar över.`);
                    return;
                }
                // 5/8: boosten är öppen — VEM SOM HELST (inloggad) får betala för att
                // lyfta ett event, inte bara ägaren (fans/föreningar/arrangörer utan
                // eget konto för eventet). Betalningen är redan Stripe-verifierad och
                // boost ger bara synlighet, så ägarkravet togs bort. Betalare + ägare
                // loggas för spårbarhet. (Skrapade event har ingen ägare att logga.)
                if (!scraped && data.hostUid !== uid) {
                    console.log(`[boost] ${uid} boostar annans event ${eventId} (hostUid=${data.hostUid ?? 'okänd'}).`);
                }
                // Förläng från det senare av "nu" och en ev. pågående boost.
                const now = Date.now();
                const currentUntilMs =
                    data.featuredUntil instanceof admin.firestore.Timestamp ? data.featuredUntil.toMillis() : 0;
                const base = Math.max(now, currentUntilMs);
                const until = new Date(base + boostDays * 24 * 60 * 60 * 1000);
                if (scraped) {
                    // eventId med i dokumentet — se confirmBoost: hashen är
                    // enkelriktad, klienten parar via URL:en.
                    tx.set(eventRef, {
                        eventId,
                        featuredUntil: admin.firestore.Timestamp.fromDate(until),
                        featuredPaymentId: paymentId,
                    }, { merge: true });
                } else {
                    tx.update(eventRef, {
                        featuredUntil: admin.firestore.Timestamp.fromDate(until),
                        featuredPaymentId: paymentId,
                    });
                }
            });
            console.log(`[boost] Event ${eventId} boostat ${boostDays} dagar (betalning ${paymentId}, user ${uid}).`);
        } catch (err) {
            console.error('[boost] Kunde inte applicera boost:', err);
        }
        return null;
    });
