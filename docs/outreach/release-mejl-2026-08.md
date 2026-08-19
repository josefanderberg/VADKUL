# Release-mejlet augusti 2026 — nyheter + boost + STJARNA2

**STATUS: UTKAST — inget skickat, inget schemalagt.** Uppföljaren till
[medlemsutskicket 28/7](medlemsmejl.md) (MEDLEM1, 166 mottagare, 6 inlösta).
Samma avsändare (**hej@vadkul.se**, "Josef på VADKUL"), samma kanal (**Zoho
Campaigns**, aldrig vanliga Zoho Mail), samma personalisering
(`$[FNAME|där]$` — bara i hälsningen).

Kampanjkod: **STJARNA2** — egen kod så attributionen kan skiljas från MEDLEM1/
STJARNA1/ARRANGOR1 (Firestore `users.starGiftCode == 'STJARNA2'`).

## Före utskick — checklista

- [x] ~~STJARNA2 saknas i koden~~ — finns nu i `STAR_GIFT_CODES`
      (`apps/functions/src/index.ts` rad ~127, commit 1169ff5).
- [x] ~~BLOCKERARE: redeemStarGift ej omdeployad~~ — **DEPLOYAD 19/8 22:4x**
      (prod-versionen var från 5/8, före STJARNA2 i 1169ff5). Skarptestat mot
      prod med ett tillfälligt konto, sedan raderat: STJARNA2 → `success:true`
      "Du har en stjärna! ⭐", andra försöket → "Du har redan hämtat din
      stjärna", påhittad kod → "Ogiltig gåvolänk." Länken i mejlet fungerar.
- [x] ~~Priser/nivåer~~ — mejlet nedskalat till det som är LIVE sedan 19/8:
      **EN nivå, 1 vecka, 99 kr** (riktiga Stripe-livepriset). Dag/månad göms
      på sajten och nämns inte i mejlet. "500 sidvisningar om dagen" är den
      ärliga trafiksiffran — de gamla 100×/1000×-påståendena är borttagna.
- [x] ~~Notis-tidpunkterna~~ — stegen 8 h/3 h/1 h/vid start är byggda
      (`eventReminderPrefs` i functions), meningen i mejlet stämmer.
- [ ] **Stadsanpassningen:** mejlet använder `$[CITY|…]$` på tre ställen (se
      nedan). Vid CSV-importen i Campaigns: mappa `city`-kolumnen till
      kontaktfältet **City** och verifiera i editorns merge-tag-väljare att
      taggen heter exakt `$[CITY|...]$` — justera i HTML:en om Campaigns
      genererar ett annat taggnamn. Skicka ett testmejl till dig själv med en
      kontakt UTAN stad och kolla att fallbacken ("din stad") läser bra.
- [x] Medlemslistan byggd 19/8: `medlemmar-2026-08-19.csv` (gitignorad, här i
      mappen) — 215 adresser, 205 med förnamn, 32 med stad (183 utan → får
      fallback-texten "din stad"). Dröjer utskicket flera dagar: bygg om
      listan (`build-medlemslista.mjs`, se medlemsmejl.md steg 0).
- [ ] Behåll Campaigns avregistreringsfot. Skicka vardagkväll 19–20 eller
      söndag kväll.

## Stadsanpassningen

`$[CITY|…]$` med fallback så kontakter utan stad får nationell text:

1. Nyhetslistan: "**$[CITY|Din stad]$ har fått en egen sida**"
2. Boost-sektionen: "Arrangerar du något i $[CITY|din stad]$ …"
3. Stjärnan: "kanske något du själv ska på i $[CITY|din stad]$?"

## Ämnesrad

**ANVÄND DENNA:**

- `Mycket nytt på kartan — och en ny stjärna till dig ⭐`

Det viktiga står först (syns på mobil, som kapar vid ~40 tecken), "ny" gör
att de 167 som fick MEDLEM1 i juli inte läser det som en repris, och gåvan —
inte boosten — är hooken. Ingen `$[CITY]$` i ämnesraden: 183 av 215 saknar
stad, så den varianten blir generisk för de flesta. Inget A/B-test heller;
på 215 mottagare är skillnaderna brus.

**Ratade (sparade om ämnesraden ska bytas):**

- `Nytt på VADKUL: din stad har fått en egen sida — och du en ny stjärna ⭐`
  (för lång — kapas mitt i på mobil)
- `Nytt i $[CITY|din stad]$ — och en guldstjärna till dig ⭐`

## Preheader

> Boosta ditt event i en vecka för 99 kr — och lös in din nya guldstjärna:
> ett dygns boost, gratis för dig som medlem.

## Mejlet

> Hej $[FNAME|där]$!
>
> Det var ett tag sedan sist — och det har byggts en hel del på **vadkul.se**.
> Här är det viktigaste, kort och gott:
>
> **Nytt på kartan sedan sist**
>
> - 🗺️ **$[CITY|Din stad]$ har fått en egen sida** — med en levande karta högst upp.
>   Bläddra dag för dag och se allt som händer nära dig:
>   [vadkul.se/evenemang](https://vadkul.se/evenemang)
> - 🔍 **Sök din ort** — sökrutan hittar nu **291 orter**, från Stockholm till
>   Vimmerby, och flyger dit direkt.
> - 📅 **Kalendern bor nu uppe i kartan** — byt dag med pilarna, hoppa via
>   kalendern eller zooma ut och se hela veckan på en gång.
> - 🔔 **Notiser!** Slå på påminnelser på event du gillar — upp till fyra:
>   8 h, 3 h och 1 h före, och en när det börjar. Du missar inget.
> - 💡 Dessutom: **tipsa om event utan konto**, och dina kategorifilter sparas
>   till nästa besök.
>
> **Nyhet: Boosta ditt event 🚀**
>
> Arrangerar du något i $[CITY|din stad]$ — eller har du skapat ett event på
> kartan? Nu kan du **boosta** det: eventet får en **guldmarkör ⭐** och ligger
> **alltid synligt på kartan**, före allt annat, i en hel vecka.
>
> **99 kr — en hel vecka.** Kartan har runt **500 sidvisningar om dagen** —
> under boostveckan syns ditt event tydligt för flera tusen besök.
>
> Öppna ditt event på kartan och tryck på **Boosta** — klart på en minut.
>
> **Och en gåva till dig ⭐**
>
> Som tack för att du är medlem får du en **ny guldstjärna** — en gratis boost
> i **24 timmar** till valfritt event. Så här använder du den:
>
> 1. Öppna [vadkul.se/?stjarna=STJARNA2](https://vadkul.se/?stjarna=STJARNA2)
>    och logga in
> 2. Öppna valfritt event på kartan — kanske något du själv ska på i
>    $[CITY|din stad]$?
> 3. Tryck på ⭐
>
> Eventet får guldmarkör och syns för alla i ett helt dygn. Du har en
> stjärna, så välj med omsorg 😊
>
> Tack för att du är med!
>
> /Josef, som bygger VADKUL på kvällar och helger

*(Avregistreringen ligger i mejlets EGEN sidfot — `$[LI:UNSUBSCRIBE]$` +
`$[LI:SUB_PREF]$`. Zoho vägrar annars och byter ut hela foten mot sin
standard, vilket tar med "du får det här mejlet för att…"-raden. Ta aldrig
bort taggarna.)*

## HTML-versionen

[release-mejl-2026-08.html](release-mejl-2026-08.html) — mejlklient-säker
(tabellayout, inline-CSS, max 600 px, inga bilder — logotypen är text).
Klistra in i Campaigns HTML-editor. Merge-taggarna `$[FNAME|där]$` (hälsningen)
och `$[CITY|…]$` (tre ställen, se Stadsanpassningen ovan) står redan i HTML:en.
Priset 99 kr/vecka är det riktiga Stripe-livepriset — inga platshållare kvar.

## Vad som medvetet INTE är med

- **Livebilder** — panelen togs bort från eventkortet 5/8 (c3f8cfe).
- **Önska event ✨** — nämndes redan i 28/7-mejlet, inte nytt sedan sist.

## Spårning (val i Campaigns)

- **Öppningar + länkklick: PÅ** — visar om det är boosten eller stjärnan som
  drar klicken.
- **Google Analytics: UTM ligger i HTML:ens länkar — koppla INTE Zoho mot
  Google.** Campaigns GA-ruta kräver att man loggar in med Google-kontot och
  hämtar en spårningskod (deras integration är byggd för gamla Universal
  Analytics). Onödigt: webben kör Firebase Analytics = en GA4-property
  (`G-JY54WK822P`), och GA4 läser UTM-parametrar av sig själv. Alla tre
  länkarna bär därför `utm_source=zoho&utm_medium=email&utm_campaign=
  medlemsmejl-aug-2026` + `utm_content` = `stadssida` / `stjarnknapp` /
  `sidfot`. Kontrollerat med webbens egen parsningslogik att stjärnlänken
  fortfarande läser ut STJARNA2 och att UTM överlever till GA4 (koden raderar
  BARA `stjarna`-parametern).
- **Svarsspårning: AV.** Svaren på ett personligt skrivet mejl är det
  värdefullaste som kommer tillbaka och ska landa i vanliga inkorgen utan
  mellanhänder; på 208 mottagare räknas de för hand. Kolla att svarsadressen
  är hej@vadkul.se.

## Efteråt

- Öppnings-/klicksiffror: Campaigns-rapporten.
- Trafiken från mejlet: GA4, källa/medium = Zohos UTM (`utm_campaign` =
  kampanjnamnet).
- Inlösta stjärnor: Firestore `users` → `starGiftCode == 'STJARNA2'`.
- Boost-köp: `boostPayments`-collectionen + Stripe-dashboarden.
