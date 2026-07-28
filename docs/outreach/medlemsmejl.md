# Medlemsutskicket — stjärnan till de första 167

Skickas via **Zoho Campaigns** (INTE vanliga Zoho Mail — bulk bryter mot deras
policy och riskerar domänryktet som arrangörsmejlen behöver). Kampanjkod:
**MEDLEM1** (egen kod ⇒ attributionen kan skilja medlemsmejl från FB-inläggens
STJARNA1 och arrangörernas ARRANGOR1).

## Steg 0 — status 2026-07-28

**✅ Medlemslistan HÄMTAD 2026-07-28:** `medlemmar-2026-07-28.csv` i repo-roten,
**167 unika adresser** (+30 sedan 17/7-exporten, ingen borttappad) med kolumnerna
`email,firstname` — **159 har förnamn**, 8 saknar (hälsningen faller tillbaka på
"Hej där!"). Rådumpen (med lösenordshashar) är raderad. Ny export:

```bash
firebase auth:export /tmp/vadkul-auth-raw.json --format=json --project vadkul-f2cb2
node docs/outreach/build-medlemslista.mjs /tmp/vadkul-auth-raw.json
rm /tmp/vadkul-auth-raw.json
```

[build-medlemslista.mjs](build-medlemslista.mjs) härleder förnamnet ur Auth-
profilens `displayName`: första ordet, avslutande siffror bort ("Malin81" →
"Malin"), versal begynnelsebokstav. Mejladresser som namn och initialer på 1–2
tecken lämnas blanka — hellre ingen hälsning än "Hej MP!".

**⬜ Deployen — kör före utskicket (Josef, manuellt):** MEDLEM1-koden
committades 17/7 (e5dae06) men senast VERIFIERADE functions-deployen är från
12/7 — utan deploy säger stjärnlänken "Ogiltig gåvolänk". Kommandot är
idempotent (gör inget om koden redan råkar vara live):

```bash
firebase deploy --only functions:redeemStarGift
```

`medlemmar-*.csv` är gitignorad (PII committas aldrig). Importera CSV:n i
Campaigns och **radera filen efteråt**.

## Zoho Campaigns — snabbsetup

1. [campaigns.zoho.eu](https://campaigns.zoho.eu) → logga in med Zoho-kontot
   (gratisnivån räcker gott för 167 kontakter).
2. Koppla domänen om den frågar (SPF/DKIM finns redan via Mail-setupen).
3. Contacts → Hantera listor → **Skapa lista** "Medlemmar" → Importera CSV:n.
   Prenumerationstyp **Marknadsföring**; fältmappning `email` → Contact Email,
   `firstname` → First Name.
4. Ny kampanj → avsändare **info@vadkul.se** / Josef på VADKUL → klistra in
   mejlet nedan → **behåll Campaigns avregistreringsfot** (lagkrav och
   spamskydd — ta aldrig bort den).
5. Skicka **vardagkväll ca 19–20 eller söndag kväll**.

## Personaliseringen

Zohos merge-tag tar ett reservvärde efter lodstrecket: **`$[FNAME|där]$`** ger
"Hej Anna!" för de 159 med namn och "Hej där!" för de 8 utan. Skriv taggen
ordagrant i editorn (eller använd Infoga merge-tag och fyll i reservvärdet
`där`). Använd den bara i hälsningen — namn mitt i brödtexten låter påklistrat.

## Ämne (välj/A-B-testa — Campaigns kan skicka två varianter)

- `En guldstjärna till dig som var tidig ⭐`
- `$[FNAME|Hej]$, du är en av de första 167 på VADKUL`
  (blir "Anna, du är en av…" resp. "Hej, du är en av…" — funkar i båda fallen)

## Mejlet

> Hej $[FNAME|där]$!
>
> Du får det här mejlet för att du har ett konto på **vadkul.se** — och det
> gör dig till en av de första. Just nu är ni 167 stycken. Det vill jag fira.
>
> Därför får du en **guldstjärna** ⭐ Så här använder du den:
>
> 1. Öppna [vadkul.se/?stjarna=MEDLEM1](https://vadkul.se/?stjarna=MEDLEM1)
>    och logga in
> 2. Öppna valfritt event på kartan — kanske något du själv ska på?
> 3. Tryck på ⭐
>
> Eventet får en guldmarkör och syns **alltid på kartan tills det ägt rum** —
> din markering hjälper andra att hitta det. Du har en stjärna, så välj med
> omsorg 😊
>
> Sedan sist har kartan också blivit snabbare och visar nu **över 22 000
> evenemang** i hela Sverige. Nytt är också att du kan **skapa egna event**
> (plusknappen — loppis, grillkväll, vad du vill, syns direkt på kartan) och
> **önska event** ✨ Varje stad har dessutom fått en egen sida:
> [vadkul.se/evenemang](https://vadkul.se/evenemang)
>
> Tack för att du var med tidigt!
>
> /Josef, som bygger VADKUL på kvällar och helger

*(Campaigns lägger själv på avregistreringslänken i sidfoten — låt den vara.)*

## Efteråt

- Öppnings-/klicksiffror: Campaigns-rapporten.
- Hur många löste in stjärnan: Firestore → `users` → filtrera
  `starGiftCode == 'MEDLEM1'` (eller be Claude räkna).
- Studsar/avregistreringar: Campaigns sköter listhygienen automatiskt.
