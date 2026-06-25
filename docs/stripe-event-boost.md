# Event-boost med Stripe

Engångsbetald "boost" som lyfter fram ett användarskapat event på kartan en
period (default **7 dagar**). Bygger på Firebase-extensionen
[`firestore-stripe-payments`](https://extensions.dev/extensions/invertase/firestore-stripe-payments).

## Hur det hänger ihop

```
Ägaren klickar "Boosta eventet"  (LinkEventCard)
        │
        ▼
startEventBoostCheckout()         boostService.ts
   skriver customers/{uid}/checkout_sessions/{id}
   (mode:'payment', price, metadata.eventId + boostDays)
        │
        ▼
firestore-stripe-payments-extensionen
   skapar Stripe Checkout Session → skriver tillbaka `url`
        │
        ▼
Webbläsaren redirectas till Stripe → användaren betalar
        │
        ▼
Extensionen skriver customers/{uid}/payments/{id} (status: succeeded)
        │
        ▼
applyEventBoost  (Cloud Function, apps/functions/src/index.ts)
   läser metadata.eventId/boostDays, verifierar hostUid == uid,
   sätter featuredUntil på linkEvents/{eventId}
        │
        ▼
Kartan visar pinnen guld/amber + ⭐ och prioriterar den i listan
   tills featuredUntil passerats (ingen städning behövs).
```

**Säkerhet:** `featuredUntil` kan bara skrivas av `applyEventBoost` (admin-SDK,
kringgår reglerna). Firestore-reglerna förbjuder uttryckligen klienten att sätta
`featuredUntil`/`featuredPaymentId` (se `infra/firebase/firestore.rules`,
linkEvents-`update`). En ägare kan alltså **inte** själv-boosta gratis.

## Engångs-setup (det du behöver göra)

1. **Stripe-konto** – skapa ett på [stripe.com](https://stripe.com). Börja i
   **testläge** (inga riktiga pengar). Du behöver `Secret key` (sk_test_…).

2. **Skapa produkten + priset** i Stripe Dashboard → *Products*:
   - Namn t.ex. "Event-boost (7 dagar)".
   - **One-time**-pris (inte recurring), valuta SEK, valfritt belopp.
   - Kopiera **Price-ID** (`price_…`).

3. **Installera extensionen**:
   ```bash
   firebase ext:install invertase/firestore-stripe-payments --project=vadkul-f2cb2
   ```
   Under konfigurationen:
   - Ange Stripe **Secret key** (lägg den som en Secret, inte i klartext).
   - "Sync new users to Stripe customers": valfritt (Off går bra – kunden skapas
     vid första köpet).
   - "Products and pricing plans collection": default `products`.
   - Customer details collection: default `customers`.
   - Sätt extensionens region till **europe-west1** (matchar övriga functions).

4. **Webhook** – extensionens setup skriver ut en webhook-URL. Lägg till den i
   Stripe Dashboard → *Developers → Webhooks*, kopiera signing secret och kör
   `firebase ext:configure` för att klistra in den (eller följ install-guidens
   sista steg). Events som behövs minst: `checkout.session.completed`,
   `payment_intent.succeeded`.

5. **Env-variabel** – lägg Price-ID:t i webbappens miljö:
   ```
   NEXT_PUBLIC_STRIPE_BOOST_PRICE_ID=price_XXXXXXXXXXXX
   ```
   (Saknas den döljs/avaktiveras boost-knappen – se `isBoostConfigured()`.)

6. **Deploya** funktioner + regler:
   ```bash
   firebase deploy --only functions:applyEventBoost,firestore:rules
   ```

## Testa (testläge)

1. Logga in, skapa ett eget event, öppna det → klicka **Boosta eventet**.
2. Betala med Stripes testkort `4242 4242 4242 4242`, valfritt framtida datum/CVC.
3. Efter redirect tillbaka: inom någon sekund skriver `applyEventBoost`
   `featuredUntil` och pinnen blir amber/guld med ⭐ och hamnar överst i listan.
4. Logg: `firebase functions:log --only applyEventBoost`.

## Att tänka på / framtida

- **Pris och längd** bor i Stripe (pris) resp. `BOOST_DURATION_DAYS` i
  `boostService.ts` + `boostDays`-metadata (default 7, backend klampar 1–90).
  Vill du ha flera nivåer: skapa flera Priser och skicka olika `boostDays`.
- **Go live:** byt till Stripes live-nycklar och live Price-ID. Inget i koden
  behöver ändras.
- **Återbetalning** tar inte bort boosten automatiskt – lägg vid behov till en
  trigger på `payment_intent` refund som nollar `featuredUntil`.
