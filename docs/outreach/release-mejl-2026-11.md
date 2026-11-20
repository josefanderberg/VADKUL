# Medlemsmejl november 2026 - nya kartan, appen och fler Android-testare

Utkast skrivet 2026-11-20 (#265). HTML: `release-mejl-2026-11.html`, byggd ur
`android-testare-mejl-2026-10.html` (samma blå bakgrund, ordmärke, signatur och
sidfot). INTE skickat.

## Budskapet

1. **Nytt: kartan har fått nytt utseende**, i tre delar (Josef 20/11: "Kan du
   presentera andra saker. Designen på kartan och titlar som visas"):
   kartdesignen (skog, sjöar, fält, vita vägar, moln: #222, #233, #234), titlarna
   vid varje event (#261, #262) och platsskyltarna (#216, #225, #231, #242).
   Frågan till medlemmarna: känns nya kartan bra, är titlarna lätta att läsa,
   dyker skyltarna upp lagom tidigt? Svar på mejlet.
2. **Android: vi behöver några testare till.** Google avslog produktionsansökan
   18/11 och vill se 14 dagars testning till med minst 12 testare (#157). 20/11
   räknade Play Console exakt 12, trots 19 medlemmar i Google-gruppen. Samma tre
   steg som i oktober, men steg 3 ber nu om feedback (telefonmodell, vad som
   krånglade), eftersom nästa ansökan måste kunna säga vad testarna tyckte.
3. **Påminnelse om appen på App Store** för dem med iPhone.

## Betygsraden 1-5 (20/11)

Josef: "kan man göra det till ett formulär man skickar ut? ... typ att det finns att
man röstar 1-5". Ett riktigt formulär går inte i mejl (de flesta mejlappar tar bort
formulärfält). I stället fem runda knappar 1-5 under "Vad tycker du om nya kartan?".
Varje knapp är en mailto-länk till hej@vadkul.se med färdigt ämne "Nya kartan: N av 5"
och en rad att skriva på. Ingen kod på sajten behövs, och rösterna räknas genom att
söka på ämnet i inkorgen. Nackdel: mottagaren måste trycka Skicka i sin mejlapp.
Alternativet om svaren blir få: fem vanliga länkar till en tacksida på vadkul.se som
räknar rösten (kräver kod och deploy).

## Bilderna (nytt, ägarbeslut 20/11)

Josef 20/11: "sen vill jag att vi inkluderar bilder. det är bättre, så blir det
ett enklare och tydligare mail." Det ersätter "noll bilder" från 7/10 för
INNEHÅLLSBILDER. Loggan är fortfarande text (30/10-beslutet står kvar).

| Fil | Vad | Mått |
|---|---|---|
| `apps/web/public/mejl/2026-11/kartan-utzoomad.jpg` | Växjö med omnejd utzoomat, tagen från vadkul.se 20/11: skog, sjöar, vita vägar, moln och event med titlar. Platspricken (Josefs position) är bortlappad | 1040x516, 69 kB |
| `apps/web/public/mejl/2026-11/skyltar-karta.jpg` | Kartan över centrala Växjö, tagen från vadkul.se 20/11: event plus skyltar för bio, lekplatser och park | 1080x612, 108 kB |
| `apps/web/public/mejl/2026-11/skyltar-tre-hojder.png` | De 14 skyltarna i tre grupper: över staden, över kvarteret, nere på gatan | 1200x520, 38 kB |

- **Bilderna måste ligga på vadkul.se innan mejlet skickas.** Mejlet pekar på
  `https://vadkul.se/mejl/2026-11/...`, och de adresserna finns först när filerna
  är pushade till main och deployen är klar. Kvittera med
  `curl -sI https://vadkul.se/mejl/2026-11/kartan-utzoomad.jpg` (ska ge 200, samma för de två andra) före utskick.
- Outlook och en del andra blockerar bilder tills mottagaren trycker "visa bilder".
  Båda bilderna har därför alt-text som säger samma sak, och all text och alla
  knappar står utanför bilderna.
- Kartbilden: muspekaren är bortlappad och kartans krom (stadsplattan, dagväljaren)
  bortklippt. Skripten ligger i `underlag/mejlkarta-2026-11.cjs`,
  `underlag/mejlkarta-utzoomad-2026-11.cjs` (tar källbild, målfil) och
  `underlag/mejlbilder-2026-11.cjs` (kör med node, sharp ur rotens node_modules).
  Skyltbilderna kommer ur appens bakade `vadkul-app/assets/skyltar/`.
- Det blev ingen före-efter-bild: det finns ingen sparad bild av samma kartutsnitt
  från före skyltarna, och en påhittad "före" vore inte ärlig. De tre höjderna
  säger mer.
- Grupperingen i bilden är förenklad till tre steg. På webben tänds bad från zoom
  12, museer och bibliotek från 13, kvarterets skyltar från 15 och matställena
  från 16. Appen tänder varje steg ett snäpp tidigare (#251).
- Förhandsvisning med lokala bilder: `underlag/release-mejl-2026-11-forhandsvisning.html`.

## Zoho Campaigns

**UTKASTET FINNS (20/11):** kampanjen "Medlemsmejl nov 2026 (nya kartan + Android-testare)",
id 292391000000395002, på kontot hej@vadkul.se. Ämne, avsändare (Josef på VADKUL,
hej@vadkul.se) och innehåll är ifyllda. INGA mottagare valda, inget skickat.
- Zoho visar "Saknad(e) bild(er)" för de tre bildadresserna tills de är pushade och
  deployade. Ladda upp HTML-filen igen efter deployen om varningen står kvar.
- Ämnet ligger UTAN 📍: emojin blev ett frågetecken när den skrevs in via Chrome.
  Lägg till den för hand med emojiknappen i ämnesfältet om den ska med.
- Vägen som fungerar: Skapa innehåll -> Importera/ladda upp HTML -> Ladda upp från
  dator -> HTML-filen. "HTML-kodredigerare" är en vanlig textredigerare: inklistrad
  kod hamnar som synlig text, och dess Redigera HTML-dialog kraschade (Zohos eget
  skriptfel, knappen Infoga svarade inte).
- Chrome måste vara inloggat på hej@vadkul.se. Ett annat Zoho-konto ger en
  välkomstruta som vill skapa en ny organisation.

- Kampanjnamn: `Medlemsmejl nov 2026 (skyltar + Android-testare)`
- Typ: Regular email, HTML-editorn (klistra in koden). Ladda inte upp bilderna i
  editorn, de hämtas från vadkul.se.
- Avsändare: hej@vadkul.se. Svaren på frågorna kommer dit.
- Ämne: `Kartan har fått nytt utseende - och vi söker fler Android-testare 📍`
- Preheader ligger i HTML:en.
- utm_campaign: `medlemsmejl-nov-2026` (utm_content: tagline, kartbild-utzoomad, kartbild, karta,
  playlank, appstore, signatur, sidfot)
- Taggar: `$[FNAME|där]$`, i sidfoten `$[LI:UNSUBSCRIBE]$` + `$[LI:SUB_PREF]$`
  (får aldrig tas bort).
- Storlek 19 kB HTML, långt under Gmails 102 kB-klipp.
- **Mottagare: alla medlemmar UTOM de 18 som redan är med i testgruppen.** De fick
  ett eget mejl 20/11 (`android-testare-mejl-2026-11.md`). Adresserna ligger i
  `medlemmar-android-testare-2026-11-20.csv` (gitignorad, PII). Antingen väljs de
  bort som uteslutningslista i kampanjen, eller så filtreras de bort ur CSV:n
  innan importen. Hur uteslutningen ser ut i Campaigns är inte kontrollerat.
- Bygg om medlemslistan strax före utskicket (`build-medlemslista.mjs`, se
  `medlemsmejl.md`).
- Som förut: testutskick maskerar taggformatet. Verifiera med skarpt utskick till
  en enmanslista och titta på mejlet i telefonen, särskilt att bilderna laddar.

## Inte kontrollerat

- Mejlet är inte sett i en riktig mejlklient. HTML:en följer oktobermallen, men
  bildernas rundade hörn och skalning är nya.
- Om Android-testarna (bygge vc5 med OTA) har skyltarna. Mejlet säger bara att
  skyltarna finns i iPhone-appen och på kartan.

## Efter utskicket

- Nya testare: Play Console -> Översikt, raden "N testare har deltagit".
- Svar om skyltarna och från nya testare samlas i `android-testare-mejl-2026-11.md`
  (testarna) respektive här nedanför (skyltarna).
