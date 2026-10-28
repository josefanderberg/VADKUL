# Medlemsmejl: appen på App Store och Android-testare (oktober 2026)

Utkast skrivet 2026-10-28. HTML: `android-testare-mejl-2026-10.html`, byggd ur
oktobermallen (`release-mejl-2026-10.html`): samma blå bakgrund, pixelloggan,
signaturen och sidfoten är orörda. Bara innehållsblocket är nytt.

## Budskapet

1. Appen finns nu på App Store (iPhone). Knapp: "Hämta appen på App Store".
2. Android-versionen är klar men Google kräver sluten testning: minst 12
   testare anmälda i 14 dagar i följd innan produktion kan sökas (personligt
   Play-konto skapat efter nov 2023). Vi söker testare bland medlemmarna.
3. Testarna går med i en Google-grupp (testlistan i Play Console) och
   installerar via `play.google.com/apps/testing/se.vadkul.app`.

## Innan utskick: tre luckor i HTML:en

- **`GRUPPNAMN-HAR`** i knappen "Jag vill testa på Android": byt mot gruppens
  riktiga adress, `https://groups.google.com/g/<gruppnamn>`. Josef skapar
  gruppen på groups.google.com med "Vem kan gå med: alla" (annars måste varje
  ansökan godkännas för hand). Samma gruppadress sätts som testlista i Play
  Console → Testa och lansera → Sluten testning → Testare.
- **Timing:** installationslänken fungerar först när den slutna testversionen
  är publicerad efter Googles granskning (några dagar för en ny app). Antingen
  skickas mejlet efter godkännandet, eller nu med gruppen som enda steg och ett
  kort uppföljningsmejl när länken lever. Texten under "Bra att veta" täcker
  båda fallen ("vaknar när Google släppt igenom").
- **App Store-länken** `https://apps.apple.com/se/app/id6820135961` (Apple ID
  ur App Store Connect) - kontrollera i telefonen att den öppnar VADKUL.

## Zoho Campaigns

- Kampanjnamn: `Medlemsmejl okt 2026 (App Store + Android-testare)`
- Typ: Regular email, HTML-editorn (klistra in koden). Inga bilder i editorn.
- Avsändare: hej@vadkul.se
- Ämne: `Appen är här - och vi söker dig som har Android 📱`
- Preheader ligger i HTML:en ("VADKUL finns nu på App Store. Har du Android?
  Vi söker testare som får appen först.")
- utm_campaign: `android-testare-2026-10` (utm_content: appstore, playlank,
  signatur, sidfot)
- Taggar: `$[FNAME|där]$` och i sidfoten `$[LI:UNSUBSCRIBE]$` + `$[LI:SUB_PREF]$`
  (får aldrig tas bort). `$[UD:CITY]$` används inte i det här mejlet.
- Storlek ~45 kB, under Gmails 102 kB-klipp.
- Som i oktober: testutskick maskerar taggformatet, verifiera med skarpt
  utskick till en enmanslista (klonad kampanj) och bedöm pixelloggan i
  telefonen före utskick.

## Efter utskicket

- Play Console visar antalet anmälda testare under Sluten testning → Testare.
  Vid 12 anmälda börjar 14-dagarsklockan; den nollas inte av att fler går med,
  men av att antalet sjunker under 12.
- När 14 dagar passerat: Play Console → Produktion → "Ansök om produktionsåtkomst"
  (Google ställer frågor om hur testet gick). Därefter granskas
  produktionsversionen separat.
