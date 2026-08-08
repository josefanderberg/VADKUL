# Event-boost med Stripe

Engångsbetald "boost" som lyfter fram ett användarskapat event på kartan en
period (default **7 dagar**). Bygger på Firebase-extensionen
[`firestore-stripe-payments`](https://extensions.dev/extensions/invertase/firestore-stripe-payments).

## Hur det hänger ihop

```
Vem som helst (inloggad) klickar "Boosta eventet"  (LinkEventCard)
        │
        ▼
startEventBoostCheckout()         boostService.ts
   anropar callable createBoostCheckout({ eventId, returnUrl })
        │
        ▼
createBoostCheckout  (Cloud Function, apps/functions/src/index.ts)
   verifierar konto + att linkEvents/{eventId} finns,
   hämtar/skapar customers/{uid}.stripeId,
   skapar Checkout Session med managed_payments.enabled = false
   → returnerar `url`
        │
        ▼
Webbläsaren redirectas till Stripe → användaren betalar
        │
        ▼
Extensionens webhook skriver customers/{uid}/payments/{id} (status: succeeded)
   (den hittar användaren via `where('stripeId','==',payment.customer)` —
    därför MÅSTE sessionen skapas med `customer: stripeId`)
        │
        ▼
applyEventBoost  (Cloud Function, apps/functions/src/index.ts)
   läser metadata.eventId/boostDays,
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

5. **Price-ID till backend** – priset ägs av Cloud-funktionen, aldrig av
   klienten. Ligger i `apps/functions/.env.vadkul-f2cb2` (committad, eftersom
   `.env` är gitignorerad och deployen körs från `main` på Mac minin):
   ```
   STRIPE_BOOST_PRICE_ID=price_XXXXXXXXXXXX
   ```
   Saknas den svarar `createBoostCheckout` "Boost är inte tillgängligt ännu".

6. **Stripe-nyckeln till Secret Manager** – `createBoostCheckout` skapar
   sessionen själv och behöver därför sin egen kopia av secret key:
   ```bash
   firebase functions:secrets:set STRIPE_API_KEY --project=vadkul-f2cb2
   ```
   (Extensionens egen nyckel ligger kvar orörd – den används av dess webhook.)

7. **Deploya** funktioner + regler:
   ```bash
   firebase deploy --only functions:createBoostCheckout,functions:applyEventBoost,firestore:rules
   ```

## Varför vi skapar sessionen själva (Managed Payments)

Extensionen kan skapa Checkout-sessioner åt oss via
`customers/{uid}/checkout_sessions` – och det var så det fungerade från början.
Det gick sönder när Stripe slog på **Managed Payments** (Stripe/Link som
merchant of record) som default på kontot:

```
Invalid line_items[0]: the product tax code is missing.
```

Managed Payments kräver en `tax_code` ur listan för **digitala varor**. En boost
är betald synlighet – annonsering – och säljs dessutom via en plattform; båda
står uttryckligen som *icke* stödda i Stripes eligibility-krav. Att sätta en
digital-vara-kod bara för att tysta felet vore att felklassa produkten
skattemässigt.

Enda dokumenterade avstängningen är **per session**:
`managed_payments[enabled]=false`. Extensionen bygger sin session från en fast
fältlista (`mode`, `line_items`, `payment_intent_data`, `automatic_tax`, …) och
kastar okända fält – den kan alltså inte skicka flaggan. Därför skapar
`createBoostCheckout` sessionen själv.

Konsekvensen: **VADKUL är säljare**, inte Link. Momsen är vår att redovisa
(eller Stripe Tax:s att räkna), kontoutdraget säger `VADKUL` och inte
`LINK.COM*`, och ingen kan återbetala över huvudet på oss.

Fulfillment är oförändrad. Extensionens webhook hittar användaren med
`where('stripeId','==',payment.customer)`, så sessionen **måste** skapas med
`customer: <customers/{uid}.stripeId>` – gör den inte det landar betalningen
aldrig i Firestore och boosten appliceras aldrig.

## Testa (testläge)

1. Logga in, skapa ett eget event, öppna det → klicka **Boosta eventet**.
2. Betala med Stripes testkort `4242 4242 4242 4242`, valfritt framtida datum/CVC.
3. Efter redirect tillbaka: inom någon sekund skriver `applyEventBoost`
   `featuredUntil` och pinnen blir amber/guld med ⭐ och hamnar överst i listan.
4. Logg: `firebase functions:log --only createBoostCheckout,applyEventBoost`.

Ser du checkout-sessionen men aldrig någon boost: kontrollera att webhooken i
Stripe har **`payment_intent.succeeded`** påslagen (steg 4). Det är den som gör
att extensionen skriver payments-dokumentet `applyEventBoost` lyssnar på.

## Att tänka på / framtida

- **Pris och längd** bor i Stripe (pris, via `STRIPE_BOOST_PRICE_ID`) resp.
  `BOOST_DAYS` i `createBoostCheckout` (speglas av `BOOST_DURATION_DAYS` i
  `boostService.ts`; backend klampar 1–90). Vill du ha flera nivåer: skapa flera
  Priser och skicka olika `boostDays`.
- **Skrapade event går inte att boosta.** Knappen visas bara för `userCreated`
  (se `EventCard.tsx`) och `createBoostCheckout` avvisar allt som saknar
  dokument i `linkEvents`. Skulle man släppa på det betalar kunden för en boost
  som aldrig kan appliceras. Att öppna vägen kräver en egen collection som
  kartan/aggregatet slår ihop – inte gjort.
- **Klienten kan fortfarande skriva `customers/{uid}/checkout_sessions`**
  (reglerna tillåter det, extensionen lyssnar). Vi använder inte den vägen
  längre; vill man stänga den helt är det en regel-ändring.
- **Go live:** byt till Stripes live-nycklar och live Price-ID. Inget i koden
  behöver ändras.
- **Återbetalning** tar inte bort boosten automatiskt – lägg vid behov till en
  trigger på `payment_intent` refund som nollar `featuredUntil`.
