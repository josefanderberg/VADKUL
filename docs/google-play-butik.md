# Google Play-texterna (Android, svenska)

_Utkast 11/10 2026, klart att klistra in i Play Console. Fylls texten i (eller ändras) i konsolen, uppdatera här också. Systerdokument: `app-store-butik.md` (iOS, ifyllt i Connect 9/10)._

**Appnamn (max 30):** VADKUL: Event nära dig
_(22 tecken - samma som App Store)_

**Kort beskrivning (max 80):**
Se vad som händer nära dig. Tusentals event i hela Sverige på en karta. Gratis.
_(79 tecken)_

**Fullständig beskrivning (max 4000, 1021 tecken):**

VADKUL visar allt som händer nära dig på en karta. Konserter, loppisar, hockey, teater, barnaktiviteter, föreläsningar och mycket mer, samlat från tusentals arrangörer i hela Sverige.

Öppna appen och se direkt vad som händer idag, imorgon eller i helgen. Varje event är en bricka på kartan, sorterad efter kategori, så du hittar rätt på några sekunder.

SÅ FUNKAR DET
• Kartan visar event nära dig, dag för dag
• Bläddra mellan idag, imorgon och hela veckan
• Filtrera på kategori: musik, sport, mat, familj, konst och mer
• Sök bland event, platser och arrangörer
• Spara favoriter med ett hjärta
• Dela event med vänner

HELA SVERIGE
Från Ystad till Kiruna. Eventen hämtas varje natt från arrangörers webbplatser, biljettsajter, kommuner, föreningar och kyrkor, så kartan är alltid aktuell.

ARRANGERAR DU NÅGOT?
Lägg upp ditt event gratis så syns det på kartan.

GRATIS OCH UTAN KONTO
Du behöver inget konto för att använda kartan. Vill du synka favoriter och svara Kommer skapar du ett konto med e-post eller Google.

_(Skillnad mot App Store-beskrivningen: "eller Apple" borttaget ur kontomeningen - Sign in with Apple finns bara på iOS.)_

**Kategori:** Appar → Evenemang (rekommenderad - Play har en egen Evenemang-kategori för eventupptäckt, träffsäkrare än Underhållning). Alternativ: Underhållning (då matchar det App Store).

**Taggar (väljs ur Plays fasta lista, max 5):** Evenemang, Musik, Kartor och navigering, Familj, Sport - ta de närmaste motsvarigheterna som konsolen erbjuder.

**Kontaktuppgifter (Butiksinställningar → Butiksuppgifter):**
- E-post: hej@vadkul.se
- Webbplats: https://vadkul.se

**Integritetspolicy:** https://vadkul.se/integritet

**Grafiska tillgångar** (allt ligger i `docs/butik-assets/`):
- Appikon 512x512: `play-ikon-512.png` (platt blå bakgrund, ingen alfa)
- Funktionsbild 1024x500: `play-feature-grafik-1024x500.png`
- Skärmbilder till Play: `play/skarmbild-*.png` (1320x2640 = exakt 2:1, Plays tak; komponerade presentationsbilder med rubrik på blå platta)
- Skärmbilder till App Store: `skarmbild-*.png` (1320x2868, 6,9-tumsformatet) - samma kompositioner i iOS-måtten
- Råa simulatordumpar som underlag: `ra/skarmbild-*.png` (laddas inte upp)

---

## Checklista - det bara Josef kan göra i konsolerna

### App Store Connect (iOS)
- [ ] **App Privacy-formuläret**: kolla om det fylldes i 9/10, annars: Data som samlas in = E-postadress (kontofunktion, frivillig), Ungefärlig/Exakt plats (appfunktion, lagras EJ på server, kopplas ej till användaren), Identifierare (push-token för notiser). Ingen spårning, inga annonser.
- [ ] Ladda upp skärmbilderna (6,9-tum, 1320x2868) och den nya marknadsikonen om Connect ber om en separat (`app-store-ikon-1024.png`).

### Google Play Console (Android)
- [ ] **Finns Play-kontot?** Okänt om ett Google Play Console-utvecklarkonto ens är registrerat (25 USD engångsavgift + identitetsverifiering, kan ta några dagar). Kolla FÖRST - allt annat nedan väntar på det.
- [ ] **Datasäkerhetsformuläret** (utkast till svar):
  - Samlas data in? Ja, men bara med frivilligt konto.
  - E-postadress: samlas in vid kontoskapande (frivilligt), används för kontofunktioner, delas ej, kan raderas.
  - Plats (ungefärlig/exakt): används i appen för att visa event nära dig, skickas EJ till servern, lagras EJ.
  - Push: FCM-token lagras för notiser (app-funktionalitet).
  - Annonser: inga. Ingen tredjepartsdelning. Ingen spårning.
  - Dataradering: användaren raderar kontot inifrån appen (Profil → Radera konto), då försvinner all kontodata.
- [ ] **Innehållsklassningen** (IARC-enkäten): inga våldsamma/sexuella inslag, inget köp, ingen användargenererad kommunikation utan konto - men ange att appen visar användarskapat innehåll (event + eventchatt för inloggade) och har rapporteringsväg. Väntat utfall: 3+/E for Everyone.
- [ ] **Play-skärmbilderna**: använd `play/`-varianterna (1320x2640, exakt 2:1 - Plays tak för telefonskärmbilder). Bilderna är tagna på iPhone; vill Google se Android-UI någon gång går de att ta om på en Android-enhet, men kravlistan (320-3840 px, max 2:1, PNG utan alfa, under 8 MB) är uppfylld som de är.
- [ ] **Produktions-aab:en** från 9/10 finns byggd, men inget Play-butiksbeslut är taget - det här dokumentet gör materialet redo, inte beslutet.
