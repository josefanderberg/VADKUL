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
- Skärmbilder till App Store: `skarmbild-*.png` (1320x2868, "iPhone med Dynamic Island (stor skärm)") och `app-store-mellan/skarmbild-*.png` (1206x2622, "iPhone med Dynamic Island (mellanstor skärm)" - den storleken KRÄVS av Connect sedan hösten 2026) - samma kompositioner i iOS-måtten
- Råa simulatordumpar som underlag: `ra/skarmbild-*.png` (laddas inte upp). 03-05 är retuscherade: dev-buildens kugghjulsbubbla borttagen (finns inte i produktionsbygget); originalen ligger i c4cd8162

---

## Checklista - det bara Josef kan göra i konsolerna

### App Store Connect (iOS)
- [ ] **App Privacy-formuläret**: uppdatera innan appen skickas till granskning. Svaren står i `app-store-butik.md` under "App Privacy" (utkast 12/10). Nytt mot 9/10: Diagnostik → Kraschdata och Annan diagnostikdata (Crashlytics, från build 7), plus konto- och användarinnehållet som 9/10-utkastet saknade (namn, foton, chatt, vänner, profilfält). Plats tas bort - koordinaterna lämnar aldrig telefonen. Ingen spårning, inga annonser.
- [ ] **Åldersklassningen**: svara på enkäten utifrån innehållet - med eventchatten
  och användarinnehållet (modererat; anmäl + blockera finns sedan build 8) landar
  den troligen på 13+ i Apples nya nivåer (4+/9+/13+/16+/18+). Registrera INTE
  appen i barnkategorin ("Made for Kids") - målgruppen är vuxna/föräldrar,
  barnaktiviteterna är innehåll för dem, inte en app för barn.
- [ ] Ladda upp skärmbilderna under versionens "Förhandsvisningar och skärmbilder": mellanstor skärm = `app-store-mellan/` (1206x2622, krävs), stor skärm = `skarmbild-*.png` (1320x2868). Fel mått ger "File dimensions are invalid". Header-/sökrutan (creative assets, 21:9 / 3:2 / 16:9) är något annat och frivillig. Marknadsikonen om Connect ber om en separat (`app-store-ikon-1024.png`).

### Google Play Console (Android)
- [ ] **Finns Play-kontot?** Okänt om ett Google Play Console-utvecklarkonto ens är registrerat (25 USD engångsavgift + identitetsverifiering, kan ta några dagar). Kolla FÖRST - allt annat nedan väntar på det.
- [ ] **Datasäkerhetsformuläret** (utkast till svar, uppdaterat 12/10 inför build 7 - samma underlag som App Privacy i `app-store-butik.md`):
  - Samlas data in? Ja. Kraschdata från alla installationer (Crashlytics, från build 7); kontodata och användarinnehåll bara med frivilligt konto.
  - Krypteras under överföring? Ja (HTTPS). Delas med tredje part? Nej - Firebase är tjänsteleverantör, vilket inte räknas som delning.
  - Personlig info → Namn, E-postadress, Användar-ID: kontot (frivilligt). Syfte: Appfunktioner och Kontohantering; e-posten även Utvecklarkommunikation (medlemsmejlen). Kan raderas.
  - Personlig info → Annan info: profilens frivilliga ålder, kön, hemort och har barn. Syfte: Appfunktioner och Anpassning.
  - Foton och videor → Foton: omslagsbild på event man skapar. Appfunktioner.
  - Meddelanden → Andra meddelanden i appen: eventchatten (publik och privat). Appfunktioner.
  - Kontakter: vänlistan i appen. Appfunktioner.
  - Appaktivitet → Annat användargenererat innehåll: event man skapar eller tipsar om, önskningar, svar, rapporter. Appfunktioner.
  - **Appinformation och prestanda → Kraschloggar + Diagnostik** (NYTT i build 7): Crashlytics-rapporter med stackspår, enhetsmodell och Android-version. Obligatoriskt (går inte att stänga av i appen). Syfte: Analys och Appfunktioner. Kopplas till uid när man är inloggad, annars till ett installations-ID.
  - Enhets-ID eller andra ID: FCM-token för push och Crashlytics installations-ID (Google räknar Firebase-installations-ID hit). Syfte: Appfunktioner och Analys.
  - Plats: deklareras INTE - positionen används bara på enheten och skickas aldrig till servern, så den räknas inte som insamlad (förra utkastet listade den).
  - Annonser: inga. Ingen spårning.
  - Dataradering: användaren raderar kontot inifrån appen (Profil → Radera konto), då försvinner kontodatan. Kraschrapporter rensas automatiskt efter 90 dagar.
- [ ] **Målgruppen** ("Målgrupp och innehåll" - separat från IARC): appen riktar
  sig till VUXNA (föräldrar och eventbesökare); barn/familj är en INNEHÅLLS-
  kategori, inte målgruppen. Välj **13 år och uppåt** (eller äldre) och kryssa
  ALDRIG i någon grupp under 13 - då slår Googles Families-policy in (hårdare
  granskning; eventchatten och kontona blir granskningsproblem). IARC-utfallet
  nedan är innehållsklassning och påverkas inte av målgruppsvalet.
- [ ] **Innehållsklassningen** (IARC-enkäten): inga våldsamma/sexuella inslag, inget köp, ingen användargenererad kommunikation utan konto - men ange att appen visar användarskapat innehåll (event + eventchatt för inloggade) och har rapporteringsväg. Väntat utfall: 3+/E for Everyone.
- [ ] **Play-skärmbilderna**: använd `play/`-varianterna (1320x2640, exakt 2:1 - Plays tak för telefonskärmbilder). Bilderna är tagna på iPhone; vill Google se Android-UI någon gång går de att ta om på en Android-enhet, men kravlistan (320-3840 px, max 2:1, PNG utan alfa, under 8 MB) är uppfylld som de är.
- [ ] **Produktions-aab:en** från 9/10 finns byggd, men inget Play-butiksbeslut är taget - det här dokumentet gör materialet redo, inte beslutet.

### Firebase Console (djuplänkarna - gäller BÅDA plattformarna)

Upptäckt 16/10: `vadkul.se/.well-known/apple-app-site-association` och
`assetlinks.json` svarar 200 men är **tomma** - universal links/app links ur
vadkul.se-länkar öppnar alltså inte appen, trots `associatedDomains` i app.json.
Hosting kör appAssociation i AUTO-läge och genererar filerna automatiskt ur
Firebase-projektets appinställningar, så fixen är ren konsol - **ingen deploy**:

- [ ] **iOS:** Firebase Console → Projektinställningar → Allmänt → iOS-appen →
  fyll i **App Store-ID** och **Team-ID** (Apple Developer → Membership).
  Hosting börjar servera korrekt AASA direkt. OBS: Apples CDN cachar AASA,
  så enheter kan behöva upp till ett dygn (eller ominstallation av appen)
  innan universal links slår igenom.
- [ ] **Android:** samma vy → Android-appen → lägg till **SHA-256-fingeravtrycket**
  från EAS-nyckeln (`eas credentials` i vadkul-app visar det). Då fylls
  assetlinks.json i automatiskt.
- [ ] Kvittera efteråt: `curl https://vadkul.se/.well-known/apple-app-site-association`
  ska visa bundle-id:t under `details`, och `assetlinks.json` ska lista
  paketnamnet + fingeravtrycket.
