# Release-mejlet september 2026 — höstsäsongen + ombyggda stadssidor + STJARNA3

**STATUS: UTKAST — inget skickat, inget schemalagt.** Uppföljaren till
[release-mejlet 19–20/8](release-mejl-2026-08.md) (STJARNA2). Samma avsändare
(**hej@vadkul.se**, "Josef på VADKUL"), samma kanal (**Zoho Campaigns**, aldrig
vanliga Zoho Mail), samma personalisering (`$[FNAME|där]$` bara i hälsningen).

Kampanjkod: **STJARNA3** — egen kod så attributionen kan skiljas från
MEDLEM1/STJARNA1/STJARNA2/ARRANGOR1 (Firestore `users.starGiftCode == 'STJARNA3'`).

## Före utskick — checklista

- [x] ~~BLOCKERARE: STJARNA3 saknas i koden~~ — **DEPLOYAD + SKARPTESTAD 7/9.**
      STJARNA3 + kortformerna `3`/`S3` i `STAR_GIFT_CODES` (commit 6fee86c),
      `firebase deploy --only functions:redeemStarGift` körd. Testat mot prod
      med tillfälligt konto (raderat efteråt): STJARNA3 → `success:true`
      "Du har en stjärna! ⭐", andra försöket och S3-aliaset → "Du har redan
      hämtat stjärnan…", påhittad kod → "Ogiltig gåvolänk." Länken i mejlet
      fungerar. (Testreceptets gotcha: API-nyckeln är referer-låst —
      `signInWithCustomToken` kräver `Referer: https://vadkul.se/`.)
- [x] **Medlemslistan byggd 7/9 (ombyggd samma kväll med `cityslug`):**
      `medlemmar-2026-09-07.csv` (gitignorad, här i mappen) — **262 adresser,
      249 med förnamn, 74 med stad** (188 utan → fallback-texten "din stad"),
      **71 med stadssideslug** (styr delningsbilden i mejlet). ~47 nya sedan
      19/8-listan (215). Dröjer utskicket flera dagar: bygg om
      (`build-medlemslista.mjs`, se medlemsmejl.md steg 0).
- [ ] **Importen i Campaigns: välj UPPDATERA befintliga kontakter**, inte
      hoppa över dubbletter — city-täckningen har ökat 32 → 74 och befintliga
      kontakter ska få sin stad ifylld. Mappa `city` → kontaktfältet **City**.
- [ ] **Merge-taggarna MÅSTE skapas för hand (LÄRDOM 8/9):** Zoho har BARA
      tre fördefinierade kontakttaggar — FNAME, LNAME, EMAIL. **`$[CITY]$` har
      aldrig varit en giltig tagg** (augustimejlet levererade sannolikt rå
      taggtext till mottagarna; testutskickens "TEST"-attrapper maskerar ALLT
      taggformat och bevisar ingenting). Gör: Inställningar →
      Sammanslagningstaggar → Skapa → Contact Custom Tag: fält City, namn
      `CITY`, mailstandard `din stad` → taggen blir `$[UD:CITY|din stad]$`
      (formen HTML:en nu använder). Skapa även `CITYSLUG` (standard
      `stockholm`) för framtiden.
- [ ] **Delningsbilden är STATISK i Zoho (LÄRDOM 8/9):** editorn rehostar
      alla externa img-URL:er till stratus.campaign-image.eu vid varje spar —
      en URL med merge-tagg fryses till 0-evenemang-fallbacken. Per-stad-bild
      går alltså INTE i Zoho. Gör: ladda upp en dagsfärsk Stockholmsbild
      (JPEG <1 MB: `sips -s format jpeg -s formatOptions 85 …`) via
      editorns bildknapp på utskicksdagen; bildtexten i HTML:en är redan
      anpassad ("för Stockholm just nu — varje stad får sin egen").
- [ ] **Verifiera med SKARPT utskick till enmanslista** (klonad kampanj →
      listan `Skarptest` med bara ägaren): "Hej Josef!", "sidan för Växjö"
      ×2, Stockholmsbilden laddad. Zohos testmejl-funktion kan INTE verifiera
      merge (attrapper) — lita aldrig på den.
- [ ] Verifiera merge-taggarna mot en RIKTIG kontakt (test till adress utanför
      listan visar attrapper som "TEST" — det är inte fel). Kolla
      fallback-läsningen med en kontakt utan stad.
- [ ] Behåll mejlets EGEN sidfot med `$[LI:UNSUBSCRIBE]$` + `$[LI:SUB_PREF]$` —
      tas de bort ersätter Zoho hela foten med sin standard.
- [ ] Avsändare **hej@vadkul.se** (den enda verifierade i Campaigns).
      Svarsadress hej@vadkul.se, svarsspårning AV.
- [ ] Skicka vardagkväll 19–20 eller söndag kväll.

## Siffrorna i mejlet

- **"Över 35 000 kommande evenemang"** — SQLite-spegeln 7/9: 37 990 framtida
  synliga rader i `link_events`. Avrundat nedåt med marginal; kolla igen vid
  utskick om det dröjer.
- Boostpriset **99 kr/vecka** = Stripe-livepriset, oförändrat sedan 19/8.
- **~500 sidvisningar om dagen** — samma ärliga trafiksiffra som 19/8; har
  trafiken ändrats markant, uppdatera eller stryk.

## Stadsanpassningen

`$[UD:CITY|din stad]$` (custom-taggen, se checklistan) med fallback på två
ställen (188 av 262 saknar stad — fallbacken är normalfallet, så ingen
stad i ämnesraden):

1. Stadssidepunkten: "sidan för $[UD:CITY|din stad]$"
2. Stjärnsteget: "kanske något du själv ska på i $[UD:CITY|din stad]$?"

Delningsbilden är en statisk Stockholmsbild uppladdad i Zoho — per-stad-bild
via `$[UD:CITYSLUG|stockholm]$` i img-src är omöjlig eftersom Zoho rehostar
externa bild-URL:er (se checklistan). Cityslug-kolumnen/-fältet behålls ändå
— datat är på plats om Zoho någon gång tillåter dynamiska bilder.

## Ämnesrad

**ANVÄND DENNA:**

- `Över 35 000 event i höst — och en ny stjärna till dig ⭐`

Siffran är hooken och står först (mobil kapar vid ~40 tecken), "ny stjärna"
signalerar till STJARNA2-mottagarna att det inte är en repris. Inget A/B-test —
261 mottagare är fortfarande brus.

**Ratade (sparade om ämnesraden ska bytas):**

- `Hösten är här: konserter, arenor och 35 000 event på kartan` (stjärnan —
  gåvan — försvinner helt)
- `Nytt: biljettevent på kartan + en guldstjärna till dig ⭐` ("biljettevent"
  är internspråk)

## Preheader

> Hela höstsäsongen är inne — ny design, konserter med biljettlänk, ombyggda
> stadssidor och en ny guldstjärna: ett dygns boost, gratis för dig.

## Mejlet

> Hej $[FNAME|där]$!
>
> Höstsäsongen är här — och kartan på **vadkul.se** är fullare än någonsin:
> **över 35 000 kommande evenemang**, från arenakonserter till syföreningar.
> Det viktigaste sedan sist:
>
> **Nytt på kartan sedan sist**
>
> - ✨ **Ny design på startsidan** — kartan har fått ett rejält lyft. Händer
>   flera saker på samma plats bläddrar du mellan dem direkt i eventkortet,
>   och att byta dag och hoppa mellan event går snabbare och smidigare än
>   förut.
> - 🎟️ **Konserter och arenor, med biljettlänk** — de stora scenerna finns nu
>   på kartan, och många event har en **Köp biljett**-knapp direkt i kortet,
>   ofta med pris.
> - 🍂 **Höstprogrammen är inne** — vi har kopplat på en mängd nya lokala
>   källor, så även mindre orter har fått ordentligt med event i höst.
> - 🏙️ **Stadssidorna är ombyggda** — på sidan för $[CITY|din stad]$ filtrerar
>   du på kategori med ett tryck och **fäller ut event direkt i listan**:
>   anmäl dig, öppna kartan eller dela — utan att lämna sidan.
>   [vadkul.se/evenemang](https://vadkul.se/evenemang)
> - 🔗 **Dela — med automatisk förhandsbild** — varje event och stadssida har
>   en egen länk, och delar du en stadssida på **Facebook, Messenger eller
>   WhatsApp** får länken automatiskt en bild med **veckans höjdpunkter**.
>   Skicka till en kompis, så landar hen rätt direkt.
>
> *(Här: delningsbilden för mottagarens stad — `$[CITYSLUG|stockholm]$` — med
> bildtexten "Så här ser förhandsbilden ut just nu — den byggs om automatiskt
> varje dag.")*
>
> **Boosta ditt event 🚀**
>
> Arrangerar du något? Boosten är kvar: **99 kr för en hel vecka** — eventet
> får en **guldmarkör ⭐** och ligger alltid synligt på kartan, före allt
> annat. Kartan har runt **500 sidvisningar om dagen**. Öppna ditt event och
> tryck på **Boosta**.
>
> **Och en ny stjärna till dig ⭐**
>
> Som tack för att du är medlem: en **guldstjärna** — en gratis boost i
> **24 timmar** till valfritt event. Så här:
>
> 1. Öppna [vadkul.se/?stjarna=STJARNA3](https://vadkul.se/?stjarna=STJARNA3)
>    och logga in
> 2. Öppna valfritt event på kartan — kanske något du själv ska på i
>    $[CITY|din stad]$?
> 3. Tryck på ⭐
>
> Eventet får guldmarkör och syns för alla i ett helt dygn. En stjärna har du,
> så välj med omsorg 😊
>
> Tack för att du är med!
>
> /Josef, som bygger VADKUL på kvällar och helger

## HTML-versionen

[release-mejl-2026-09.html](release-mejl-2026-09.html) — samma mejlklient-säkra
mall som sist (tabellayout, inline-CSS, max 600 px). Nytt 7/9 på Josefs
begäran: logotypen som i **WelcomeOverlay** (sans, font-weight 900, kursiv,
versaler, gult streck under — INTE serif, den varianten revs), en
uppercase-kicker i topplisten, mer luft — och EN bild: delningsbilden per stad (se
Stadsanpassningen). Klistra in i Campaigns **HTML-editor** (inte drag-and-drop
— mal sönder tabellayouten). Merge-taggarna `$[FNAME|där]$`, `$[CITY|…]$` (två
ställen) och `$[CITYSLUG|stockholm]$` (bildens src) står redan i.

## Vad som medvetet INTE är med

- **Notiserna, ortsöket, kalendern i kartan** — var med i 19/8-mejlet, inte
  nytt sedan sist.
- **Ticketmaster/affiliate som ord** — medlemmen ser "Köp biljett", resten är
  internt.
- **Kategorisidorna/SEO-arbetet** — syns inte som nyhet för en medlem.

## Spårning (val i Campaigns)

- **Öppningar + länkklick: PÅ.**
- **Google Analytics: koppla INTE Zoho mot Google** — UTM ligger redan i
  HTML:ens länkar och GA4 (`G-JY54WK822P`) läser dem själv. Alla länkar bär
  `utm_source=zoho&utm_medium=email&utm_campaign=medlemsmejl-sep-2026` +
  `utm_content` = `stadssida` / `stjarnknapp` / `sidfot`.
- **Svarsspårning: AV** — svaren ska landa orörda i hej@vadkul.se.

## Efteråt

- Öppnings-/klicksiffror: Campaigns-rapporten.
- Trafiken: GA4, `utm_campaign=medlemsmejl-sep-2026`.
- Inlösta stjärnor: Firestore `users` → `starGiftCode == 'STJARNA3'`.
- Boost-köp: `boostPayments` + Stripe-dashboarden.
