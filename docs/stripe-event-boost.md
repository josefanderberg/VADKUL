# Event-boost med Stripe

Engångsbetald "boost" som lyfter fram ett event på kartan en period. Tre
nivåer via callable-fältet `tier`: `day` (1 dag), `week` (7 dagar, default när
fältet utelämnas) och `month` (30 dagar) — ett Stripe-pris per nivå, se
env-nycklarna nedan. Bygger på Firebase-extensionen
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
Stripe skickar tillbaka till success_url  ?boost_session=cs_…
        │
        ▼
confirmBoost  (Cloud Function)          ← PRIMÄR FULFILLMENT
   hämtar sessionen från Stripe, kräver payment_status === 'paid',
   skriver kvitto boostPayments/{sessionId} + featuredUntil i SAMMA
   transaction
        │
        ├──▼ (skyddsnät, om extensionens webhook någon gång börjar ringa)
        │  Extensionens webhook → customers/{uid}/payments/{id} (succeeded)
        │  → applyEventBoost, som hoppar över när featuredPaymentId redan
        │    är samma payment_intent (annars dubbelboost)
        ▼
Kartan visar pinnen guld/amber + ⭐ och prioriterar den i listan
   tills featuredUntil passerats (ingen städning behövs).
```

**Varför inte webhook som primär väg:** extensionens webhook har aldrig
avfyrats i det här projektet, och dess Stripe-nyckel är utgången ("Expired API
Key provided", 5/8). `confirmBoost` behöver ingen webhook alls — den frågar
Stripe direkt. Priset är att någon som stänger fliken mitt i betalningen får
sin boost först när de återvänder med länken; skyddsnätet ovan täcker det den
dagen webhooken börjar fungera.

**Säkerhet:** `featuredUntil` skrivs bara av `confirmBoost`/`applyEventBoost`
(admin-SDK, kringgår reglerna). Firestore-reglerna förbjuder uttryckligen
klienten att sätta `featuredUntil`/`featuredPaymentId` (se
`infra/firebase/firestore.rules`, linkEvents-`update`), och `boostPayments` är
helt stängd för klienten. En ägare kan alltså **inte** själv-boosta gratis.

Två spärrar mot dubbelapplicering: kvittot `boostPayments/{sessionId}` (skrivs
i samma transaction som boosten, så en omladdning av success-URL:en inte
förlänger gratis) och `featuredPaymentId`-kollen i `applyEventBoost`. Sessionen
kan dessutom bara lösas in av det konto som betalade — `metadata.firebaseUID`
måste matcha anroparen.

## Engångs-setup (det du behöver göra)

1. **Stripe-konto** – skapa ett på [stripe.com](https://stripe.com). Börja i
   **testläge** (inga riktiga pengar). Du behöver `Secret key` (sk_test_…).

2. **Skapa produkterna + priserna** i Stripe Dashboard → *Products* — ETT
   One-time-pris (inte recurring, valuta SEK, valfritt belopp) per nivå:
   - "Event-boost (1 dag)" → Price-ID till `STRIPE_BOOST_PRICE_ID_DAY`
   - "Event-boost (7 dagar)" → `STRIPE_BOOST_PRICE_ID_WEEK` (eller lämna
     nyckeln tom och låt gamla `STRIPE_BOOST_PRICE_ID` gälla)
   - "Event-boost (30 dagar)" → `STRIPE_BOOST_PRICE_ID_MONTH`
   - Kopiera respektive **Price-ID** (`price_…`).

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

4. **Webhook** – behövs INTE för boosten (se `confirmBoost` ovan), bara om du
   vill ha skyddsnätet. Extensionens setup skriver ut en webhook-URL; lägg till
   den i Stripe → *Developers → Webhooks* (nya vyn: **Workbench → Webhooks**,
   och testläget har egna endpoints — `dashboard.stripe.com/test/webhooks`).
   Event-listan dyker bara upp när man skapar/redigerar en endpoint. Events:
   `checkout.session.completed`, `payment_intent.succeeded`. Signing secret
   klistras in med `firebase ext:configure`.

5. **Price-ID:n till backend** – priserna ägs av Cloud-funktionen, aldrig av
   klienten. Ligger i `apps/functions/.env.vadkul-f2cb2` (committad, eftersom
   `.env` är gitignorerad och deployen körs från `main` på Mac minin):
   ```
   STRIPE_BOOST_PRICE_ID=price_XXXXXXXXXXXX        # vecko-fallback (befintlig)
   STRIPE_BOOST_PRICE_ID_DAY=price_XXXXXXXXXXXX    # 1 dag
   STRIPE_BOOST_PRICE_ID_MONTH=price_XXXXXXXXXXXX  # 30 dagar
   # STRIPE_BOOST_PRICE_ID_WEEK=price_XXXXXXXXXXXX # valfri — annars gäller raden överst
   ```
   Saknas priset för den valda nivån svarar `createBoostCheckout` "Boost är
   inte tillgängligt ännu" för just den nivån; övriga nivåer fungerar ändå.

6. **Stripe-nyckeln till Secret Manager** – `createBoostCheckout` skapar
   sessionen själv och behöver därför sin egen kopia av secret key:
   ```bash
   firebase functions:secrets:set STRIPE_API_KEY --project=vadkul-f2cb2
   ```
   (Extensionens egen nyckel ligger kvar orörd – den används av dess webhook.)

7. **Deploya** funktioner + regler + webben (klienten läser `?boost_session`):
   ```bash
   firebase deploy --only functions:createBoostCheckout,functions:confirmBoost,functions:applyEventBoost,firestore:rules,hosting
   ```
   OBS: nya Gen1-funktioner får inte `allUsers`-invoker automatiskt längre —
   därför `invoker: 'public'` i koden. Fastnar den ändå (403 innan koden
   startar) sätts den för hand i Cloud Console → funktionen → *Permissions* →
   `allUsers` + **Cloud Functions Invoker**.

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
3. Efter redirect tillbaka landar du på `?boost_session=cs_…`, en toast säger
   "Aktiverar boosten…" och pinnen blir amber/guld med ⭐ överst i listan.
4. Logg: `firebase functions:log --only createBoostCheckout,confirmBoost,applyEventBoost`.

Ser du `[boost] Checkout … skapad` men ingen boost: kolla `confirmBoost` i
loggen. `payment_status` som inte är `paid` betyder att betalningen aldrig gick
igenom; `permission-denied` att sessionen tillhör ett annat konto.

## Att tänka på / framtida

- **Pris och längd** bor i Stripe (ett Price-ID per nivå, se punkt 5 ovan)
  resp. `BOOST_TIERS` i `createBoostCheckout` (day=1, week=7, month=30 dagar;
  week speglar `BOOST_DURATION_DAYS` i `boostService.ts`; backend klampar
  1–90). Nivån väljs av klienten via `tier`, men pris och dagar slås alltid
  upp server-side — okänd nivå avvisas med `invalid-argument`.
- **Skrapade event GÅR att boosta sedan 18/8.** `createBoostCheckout` validerar
  skrapade id:n (URL:er, känns igen på snedstrecket) mot aggregatens
  destinations-lager, och boosten skrivs till overlay-kollektionen
  `eventBoosts/{slug}` som webben mappar tillbaka på kart-eventen — se
  `boostTargetRef` i `index.ts`. Användarskapade event får som förut
  `featuredUntil` direkt på `linkEvents`-dokumentet.
- **Klienten kan fortfarande skriva `customers/{uid}/checkout_sessions`**
  (reglerna tillåter det, extensionen lyssnar). Vi använder inte den vägen
  längre; vill man stänga den helt är det en regel-ändring.
- **Go live:** byt till Stripes live-nycklar och live Price-ID. Inget i koden
  behöver ändras.
- **Återbetalning** tar inte bort boosten automatiskt – lägg vid behov till en
  trigger på `payment_intent` refund som nollar `featuredUntil`.
