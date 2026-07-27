# Medlemsutskicket — stjärnan till de första 137

Skickas via **Zoho Campaigns** (INTE vanliga Zoho Mail — bulk bryter mot deras
policy och riskerar domänryktet som arrangörsmejlen behöver). Kampanjkod:
**MEDLEM1** (egen kod ⇒ attributionen kan skilja medlemsmejl från FB-inläggens
STJARNA1 och arrangörernas ARRANGOR1).

## Steg 0 — två kommandon Josef kör själv (PII + prod-deploy = manuellt)

```bash
# 1. Deploya MEDLEM1-koden (byggd + tsc-grön, bara deployen kvar):
firebase deploy --only functions:redeemStarGift

# 2. Medlemslistan — exportera, behåll BARA mejladresserna, radera rådumpen
#    (rådumpen innehåller lösenordshashar och ska inte ligga kvar på disk):
firebase auth:export /tmp/vadkul-auth-raw.json --format=json --project vadkul-f2cb2
node -e "const u=require('/tmp/vadkul-auth-raw.json').users||[];const m=u.map(x=>x.email).filter(Boolean);require('fs').writeFileSync('medlemmar-$(date +%Y-%m-%d).csv','email\n'+m.join('\n'));console.log(m.length+' adresser')"
rm /tmp/vadkul-auth-raw.json
```

`medlemmar-*.csv` är gitignorad (PII committas aldrig). Importera CSV:n i
Campaigns och **radera filen efteråt**.

## Zoho Campaigns — snabbsetup

1. [campaigns.zoho.eu](https://campaigns.zoho.eu) → logga in med Zoho-kontot
   (gratisnivån räcker gott för 137 kontakter).
2. Koppla domänen om den frågar (SPF/DKIM finns redan via Mail-setupen).
3. Contacts → importera CSV:n → ny lista "Medlemmar".
4. Ny kampanj → avsändare **info@vadkul.se** / Josef på VADKUL → klistra in
   mejlet nedan → **behåll Campaigns avregistreringsfot** (lagkrav och
   spamskydd — ta aldrig bort den).
5. Skicka **vardagkväll ca 19–20 eller söndag kväll**.

## Ämne (välj/A-B-testa — Campaigns kan skicka två varianter)

- `En guldstjärna till dig som var tidig ⭐`
- `Du är en av de första 137 på VADKUL`

## Mejlet

> Hej!
>
> Du får det här mejlet för att du har ett konto på **vadkul.se** — och det
> gör dig till en av de första. Just nu är ni 137 stycken. Det vill jag fira.
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
> Sedan sist har kartan också blivit snabbare, fått stadssidor
> ([vadkul.se/evenemang](https://vadkul.se/evenemang)) och visar nu över
> 20 000 evenemang i hela Sverige.
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
