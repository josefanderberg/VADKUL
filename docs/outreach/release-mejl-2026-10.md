# Medlemsmejl oktober 2026 - appen och förturen

Utkast skrivet 2026-10-07. HTML: `release-mejl-2026-10.html` (samma Zoho-säkra
tabellmall som augusti/september). Uppföljare till `release-mejl-2026-09.md`.

## Budskapet

1. Vi är 874 medlemmar och närmar oss 1 000. Siffran = medlemslistan 8/10
   (konton med e-post; de 54 anonyma kontona utan e-post räknas inte).
   ÄGARBESLUT 8/10: skriv ut exakta antalet, inte "aktiva" (aktivitet går
   inte att belägga ur inloggningsdatan).
2. Riktiga appen släpps snart - och när vi passerar tröskeln släpps den FÖRST
   till medlemmar som bjudit in en vän som tackat ja (förtur).
3. Nytt: Kommer/Intresserad i eventkortet, Bjud med-inbjudan, stadssida och
   arrangörssida hänger ihop, och (på väg) notis när en vän tänker gå på något.

## Zoho Campaigns

- Kampanjnamn: `Medlemsmejl okt 2026 (appen)`
- Typ: Regular email, HTML-editorn (klistra in koden)
- Avsändare: hej@vadkul.se
- Ämne: `Appen är nästan här - bjud med en vän och få den först 📱`
- Preheader ligger i HTML:en ("Vi är 874 och närmar oss 1 000 - du som bjuder
  med en vän får appen först.")
- utm_campaign: `medlemsmejl-okt-2026`
- Taggar som används: `$[FNAME|där]$`, `$[UD:CITY|din stad]$` (egna fältet
  City måste finnas som Contact Custom Tag - det skapades i september),
  `$[LI:UNSUBSCRIBE]$` + `$[LI:SUB_PREF]$` i sidfoten (får ALDRIG tas bort).
- LÄRDOM från 8/9: testutskick maskerar taggformatet - enda giltiga
  verifieringen är skarpt utskick till en enmanslista (klonad kampanj).
- **Noll bilder i mejlet** (Josefs beslut 7/10): externa bilder blockeras tills
  mottagaren tryckt "visa bilder", så loggan (molnet MED smiley) är pixelkonst
  i ren HTML - RLE-tabeller genererade pixel för pixel ur appikonen
  (pwa-icon-bla-192-rund.png; headern 96x96-upplösning vid 2 px/cell = 192 px,
  signaturen 48x48 vid 2 px/cell = 96 px). Headern mattas mot bakgrundsblått
  (#006AA7) så molnet svävar fritt - plattkantens egna blåa nyanser snäpps
  till bakgrunden (dist2 < 5500), annars blir det prickiga hörnbågar.
  Signaturen mattas mot vitt. Mejlet renderar komplett hos alla direkt.
  Lägg inte in bilder i Zoho-editorn.
  Hela mejlet är ~49 kB - håll det under Gmails 102 kB-klipp om mer läggs till
  (klippet döljer sidfoten med avregistreringen och kan sinka öppningsspårningen).
  OBS: skärmdumpar/mobilklienter som SKALAR mejlet kan ge ett lätt
  scanline-mönster i pixelloggan (tabellceller kantutjämnas inte som bilder);
  vid 100 % är den pixelperfekt (radhöjder verifierade exakt 2 px). Bedöm på
  riktigt testmejl i telefonen före utskick.
- Designbeslut 7/10: det blå headerbandet från sep-mallen är rivet - vitt
  rubrikhuvud med gul accentlinje; signaturen är namn/titel/vadkul.se i
  arrangörsmejlens form, inte "/Josef som bygger på kvällar och helger".
- Designbeslut 8/10: HELA bakgrunden är VADKUL-blå (#006AA7) med vit extra fet
  VADKUL-titel (Arial Black, kursiv) och gul linje - flaggfärgerna. Ljus text
  i tagline och sidfot.
- Designbeslut 8/10 v2 (commit efter c40c5c6e): det stora vita kortet RIVET -
  allt står direkt på blått med vit brödtext och GULA sektionsetiketter;
  förtur-rutan är det enda vita kortet; knappen är en fylld blå PILL
  (border-radius 999px, loggans mjuka form) med pulsringen; båda molnen
  mattas mot blått och svävar fritt. ÅTERSTÄLLNING om Josef ångrar sig:
  `git show c40c5c6e:docs/outreach/release-mejl-2026-10.html` = versionen
  före ombygget (grå bakgrund, vitt kort, kantknapp).
- Adresser som ren text (t.ex. "på vadkul.se") länkas av mejlappen själv i
  standardblått = blått på blått (Josef såg det 8/10). Varje adress skrivs
  därför som egen <a> med färgen inline + inre <span>, och <style> har
  skyddsnätet för Apple Mail (x-apple-data-detectors) och Gmail (u + #body).
  Skriv aldrig en adress som ren text i det här mejlet.
- OBS mörkt läge: vita texter/länkar på färgad bakgrund kan målas om av
  Gmail-appens mörka läge (arrangörsmejlens lärdom 1/10). Kolla testmejlet
  i mörkt läge innan utskick - ser länkarna fel ut, flytta dem till ljus yta.
- **Pulsknappen**: "Hitta något..."-knappen har en pulsande ring via
  <style>/@keyframes (klass vk-puls) - progressiv förbättring: Apple Mail/iOS
  spelar den, Gmail/Outlook visar statisk knapp. prefers-reduced-motion
  stänger av den. VERIFIERA i testmejlet att Zoho inte strippar <style>-blocket;
  gör den det är knappen bara statisk, inget går sönder.

## Listan

Byggs om före utskick (PII: rådumpen och CSV:n raderas efter importen):

    PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" \
      firebase auth:export <tmp>/raw.json --format=json --project vadkul-f2cb2
    cd docs/outreach && node build-medlemslista.mjs <tmp>/raw.json

Vid Zoho-importen: VÄLJ "uppdatera befintliga kontakter" så gamla kontakter
får City/Cityslug, och mappa kolumnerna email/firstname/city/cityslug.

## SKICKA INTE FÖRRÄN

- [x] **PR #111 (sociala paketet) är mergad och deployad** - Kommer/Intresserad,
      Bjud med och stadssidornas arrangörsrad ligger där. Mejlet lovar dem.
      (Mergad + Actions-deployen grön 7/10 21:16 UTC.)
- [x] **Rules-deployen är körd** (`firebase deploy --only firestore:rules` -
      eventRsvps + eventStats-vitlistorna), annars failar svaren tyst.
      (Körd 7/10 22:21.)
- [ ] Bestäm hur förturen bokförs: Bjud med-länken bär `?inb=1&fran=<uid>`,
      men "vänner ur accepterade inbjudningar" (B6) är inte byggt än. Antingen
      byggs en enkel bokföring av fran-uid vid accepterat svar, eller så mäts
      förturen manuellt. Mejlet lovar bara "bjud in en vän som tackar ja".
- [ ] Notisen "när en vän tänker gå" är skriven som "på väg"/"snart" i mejlet
      (push till inbjudaren är inte byggd) - lova inte mer än så i ämnesraden.
- [x] Siffran: 874 i ingressen och preheadern (= listan 8/10). Byggs listan
      om före utskick, byt siffran på båda ställena så de stämmer med listan.
      8/10: 928 konton i Auth, 874 unika mejladresser - "närmar oss" håller.
- [ ] Listan ombyggd 8/10 -> `medlemmar-2026-10-08.csv` (874 adresser, 840 med
      förnamn, 577 med stad, 530 med stadssideslug). Bygg om igen om utskicket
      dröjer mer än ett par dagar.

## Öppningar, klick och påminnelsen

Zoho Campaigns spårar öppningar och klick per kontakt automatiskt (Reports →
kampanjen → Opened/Clicked, exporterbara listor). Planen:

1. Skicka kampanjen (vardagkväll 19-20 eller söndag kväll, som tidigare).
2. Efter ~5-7 dagar: Reports → "Not opened" → spara som segment.
3. Klona kampanjen till segmentet med ny ämnesrad (t.ex. "Sista chansen till
   förtur på appen 📱") - det är påminnelsen.
4. "Opened men inte klickat" kan få en mjukare variant, eller lämnas.

Avregistrerade och studsar hanterar Zoho själv - de följer med till
påminnelselistan som exkluderade automatiskt.
