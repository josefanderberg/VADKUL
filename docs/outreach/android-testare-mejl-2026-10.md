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

## Innan utskick: kollat 29/10

- **Testet är godkänt och live** (Stängt test - Alpha, version 5, släppt 28/10 22:12),
  så installationslänken fungerar och mejlet kan gå ut. Texten under "Bra att veta"
  är omskriven: raden om att länken "vaknar" är borta, i stället "Gruppen först,
  sedan länken". Steg 2 säger nu att man trycker **Bli testare** på testsidan - det
  är det trycket som räknas mot Googles 12 testare.
- **Gruppen** `https://groups.google.com/g/vadkul-android`: synlig för alla på webben,
  "Alla på webben kan gå med" (ingen manuell godkänning). Gruppens e-post
  `vadkul-android@googlegroups.com` är testlistan i Play Console.
  **Vem kan göra inlägg** och **Vem kan visa medlemmar** ändrades 29/10 från
  Gruppmedlemmar till Gruppansvariga (Josef: "Ja, ändra båda"), så testarna kan
  inte mejla alla andra testare eller se varandras namn.
- **Länkarna** (curl 29/10): App Store-länken landar på "VADKUL: Event nära dig",
  testsidan kräver Google-inloggning (väntat), gruppen svarar 200.

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
