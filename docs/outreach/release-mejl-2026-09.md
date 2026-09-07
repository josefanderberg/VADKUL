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
- [ ] **Cityslug-fältet:** skapa ett eget kontaktfält **Cityslug** i Campaigns
      och mappa CSV-kolumnen `cityslug` dit. Kolla i HTML-editorns
      merge-tag-väljare vad taggen faktiskt heter (egna fält kan få t.ex.
      `$[CONTACT_CF…]$`) och byt i så fall ut `$[CITYSLUG|stockholm]$` i
      bildens `src` i HTML:en. Fallbacken ska vara `stockholm`.
- [ ] **Testa delningsbilden i testutskick till RIKTIGA kontakter:** en med
      stadssideslug (bilden ska visa den staden) och en utan (bilden ska visa
      Stockholm). Extra skyddsnät finns: routen svarar 200 med en
      fallback-bild även för trasig/okänd slug (verifierat 7/9), så en
      felmappad tagg ger fel stad — aldrig trasig bild.
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

`$[CITY|…]$` med fallback på två ställen + `$[CITYSLUG|stockholm]$` i bildens
URL (188 av 262 saknar stad — fallbacken är normalfallet, så ingen `$[CITY]$`
i ämnesraden):

1. Stadssidepunkten: "sidan för $[CITY|din stad]$"
2. Stjärnsteget: "kanske något du själv ska på i $[CITY|din stad]$?"
3. **Delningsbilden:** `https://vadkul.se/evenemang/$[CITYSLUG|stockholm]$/delningsbild.png`
   — den dagsfärska "veckans höjdpunkter"-bilden för mottagarens stad (71 st),
   Stockholm för resten. Bilden är ~1 MB och hämtas från vadkul.se när mejlet
   öppnas (via mejlklientens bildproxy) — den bäddas INTE in i mejlet.

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
>   en egen länk, och delar du en stadssida får länken automatiskt en bild med
>   **veckans höjdpunkter**. Skicka till en kompis, så landar hen rätt direkt.
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
begäran: logotypen i **fet kursiv** (Georgia/serif), en uppercase-kicker i
topplisten, mer luft — och EN bild: delningsbilden per stad (se
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
