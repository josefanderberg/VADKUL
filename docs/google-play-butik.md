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
- Kompositionsskript: `komponera.py` (Pillow; `python3 komponera.py ra/<råbild>.png "<titel>" <namn>` skriver alla tre varianterna)
- Skärmbilder till App Store: `skarmbild-*.png` (1320x2868, "iPhone med Dynamic Island (stor skärm)") och `app-store-mellan/skarmbild-*.png` (1206x2622, "iPhone med Dynamic Island (mellanstor skärm)" - den storleken KRÄVS av Connect sedan hösten 2026) - samma kompositioner i iOS-måtten
- Råa simulatordumpar som underlag: `ra/skarmbild-*.png` (laddas inte upp). Alla fem togs om 29/10 med appens nya utseende (systemsymboler för tid/plats/profil, ingen dev-bubbla i bild - ingen retusch behövs); de retuscherade 12-13/10-originalen ligger i c4cd8162

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

**LÄGET 28/10 2026 (Josefs id-verifiering godkänd, appen skapad av Claude i Chrome):**
- App-id i Play Console: **4972256691435731258** (`play.google.com/console/u/0/developers/8028380077267418101/app/4972256691435731258/app-dashboard`). Paket `se.vadkul.app`, svenska, app, gratis. Josef godkände 28/10 utvecklarpolicyn, exportvillkoren och Play App Signing-villkoren.
- KLART i konsolen: integritetspolicy (vadkul.se/integritet), annonser = nej, annons-id = nej, myndighetsapp = nej, finans = inga, hälsa = inga, målgrupp 13+ (13-15, 16-17, 18+), IARC-klassning inskickad (PEGI 3 / ESRB Everyone / USK 0; kategori "alla andra apptyper", användarinnehåll med block/rapport/moderering, onlineinnehåll ja, inget våld/sex/språk/droger, position delas inte), datasäkerhet inskickad (10 datatyper, se nedan), appkategori Event, kontakt hej@vadkul.se + vadkul.se, standardbutiksuppgifter sparade med texterna ovan, ikon, funktionsbild och fem skärmbilder i ordningen karta, eventbild, lista, sök, stadssida (29/10 omtagna - lista ersatt av bildflöde, ladda upp de nya). AI-deklarationen: "Märk inte tillgångar" (skärmbilderna är riktiga, ikonen är varumärket) - säg till om molnet är AI-genererat.
- Datasäkerheten som den skickades: Namn, E-post, Användar-id, Övrig info (optionella, Appfunktioner + Kontohantering/Anpassning, e-post även Utvecklarkommunikation), Andra meddelanden i appen, Foton, Annat användargenererat innehåll (optionella, Appfunktioner), Kraschloggar, Diagnostik, Enhets-id (obligatoriska, Appfunktioner + Analys). Inget delas, inget temporärt, krypterat vid överföring, raderings-URL vadkul.se/integritet#radera-konto, konton via lösenord + OAuth. "Kontakter" deklarerades INTE (vänlistan är inte adressboken).
- Inloggningsuppgifter (appåtkomst): KLART 28/10 kväll. Posten "Demo" har användarnamn demo@vadkul.se, lösenord (Josef skrev in det själv) och engelska anvisningar; kontot finns i Firebase Auth med lösenord. "Inloggningsuppgifterna ger fullständig åtkomst" är ikryssad.
- Play App Signing-nyckeln: SHA-1 `22:DC:76:B3:5E:85:85:E1:86:03:5E:33:4B:CD:AF:51:97:DE:98:AE`, SHA-256 `0A:12:43:1B:A9:98:23:6C:AC:2E:2E:B2:D3:30:15:C2:01:84:34:FD:31:E5:C5:65:5C:CF:77:EB:7C:BB:86:93`. Båda ligger på Firebase Android-appen sedan 28/10 (Management API) och SHA-256 i `apps/web/public/.well-known/assetlinks.json` (commit 42bcccdf, push = deploy).
- **28/10 kl 15: `eas submit` kördes två gånger (EAS-inlämningar c1ec6319 och 34cfa203) och båda föll med `EAS_GOOGLE_PLAY_PERMISSION_DENIED`; direkt test mot Android Publisher API (`edits.insert`) ger 403 PERMISSION_DENIED för servicekontot. Alltså är servicekontot inte inbjudet med appbehörighet än (eller inte propagerat). Intern testning har nu e-postlistan `VADKUL-testare` (ja223hm@gmail.com) vald och utkastet "release 1" utan paket. aab:en ligger kopierad i `~/Downloads/vadkul-build5.aab` för manuell dragning. OBS: `eas submit --key` finns inte i eas-cli 24; nyckeln ges via profilen `submit.intern.android.serviceAccountKeyPath` (lokal, ej committad, i vadkul-app/eas.json).
- **INTERNT TEST LIVE 28/10 kl 15:37:** Josef drog aab:en (versionskod 5, 1.0.0) till biblioteket, Claude la den i utkastet, skrev Viktig information och publicerade. Status "Aktiv, har inte granskats" (intern testning kräver ingen granskning; appen heter tillfälligt se.vadkul.app för testare tills den granskats). Testlista `VADKUL-testare` (ja223hm@gmail.com). **Testlänk:** https://play.google.com/apps/internaltest/4701717812594484841 (bara för adresser på listan; upp till 100). Enda varningen: ingen deobfuskeringsfil (Expo obfuskerar inte).
- **SLUTEN TESTNING FÖRBEREDD 28/10 kl 18:** spåret "Stängt test - Alpha" (track-id 4700883920840232915) har land Sverige, testare = Google-gruppen `vadkul-android@googlegroups.com` (https://groups.google.com/g/vadkul-android, Josefs grupp; e-postlistor och grupper är ömsesidigt uteslutande i Play, så Josef måste själv vara med i gruppen), och version 5 (1.0.0) med Viktig information som UTKAST. Publiceras (= skickas till Googles granskning) så snart demokontots e-post + lösenord ligger under Appinnehåll → Inloggningsuppgifter. Medlemsmejlet: `docs/outreach/android-testare-mejl-2026-10.html`.
- **SLUTEN TESTNING INSKICKAD TILL GRANSKNING 28/10 kväll:** inskicket var blockerat av "Ofullständig deklaration för datasäkerhet". Steg 1-3 var ifyllda men i steg 4 (Dataanvändning och hantering) var bara Namn, E-post och Användar-id Slutförda; de sju andra fylldes i då (svaren i posten "Datasäkerheten som den skickades" ovan, Övrig info = Appfunktioner + Anpassning) och förhandsgranskningen säger "Ingen data delas med tredje part". Därefter skickades 13 ändringar (Stängt test - Alpha med version 5, Sverige, gruppen; svenska butiksuppgifter; innehållsklassning, målgrupp, integritetspolicy, annonser, hälsoappar, datasäkerhet; appkategori) till granskning. Hanterad publicering är AV, så spåret går live direkt när Google godkänt (vanligen inom 7 dagar). Status: Publiceringsöversikten → "Ändringarna granskas".
  - **NÄSTA efter godkännandet:** skicka medlemsmejlet (opt-in-länken play.google.com/apps/testing/se.vadkul.app blir aktiv först då), samla minst 12 testare i gruppen som stannar 14 dagar i följd, ansök sedan om produktionsåtkomst.
  - Gotcha: Play visar statusen per datatyp bara i steg 4; "datatyperna valda" i steg 3 räcker inte. Kolla Publiceringsöversiktens "Visa problem" innan inskick.
- _(Tidigare)_ **NÄSTA: sluten testning.** Skapa spåret under Testa och lansera → Sluten testning, lyft upp version 5 dit ("Flytta upp version"), e-postlista med minst 12 testare, skicka till granskning. 14 dagar med 12 anmälda testare i följd → ansök om produktionsåtkomst. Opt-in-länken för slutna spår har formen play.google.com/apps/testing/se.vadkul.app.
- _(Historik)_ **AAB-UPPLADDNINGEN:** webbläsarverktyget tar max 10 MB, aab:en är 102 MB. Vägen är `eas submit`: Android Publisher API är aktiverat i vadkul-f2cb2 och servicekontot `play-publicering@vadkul-f2cb2.iam.gserviceaccount.com` finns (nyckel i `~/.config/vadkul/play-publicering-sa.json`, utanför repot). **Josef bjuder in servicekontot** i Play Console → Användare och behörigheter → Bjud in nya användare → e-posten ovan → appbehörigheter: "Visa appinformation" + "Hantera versioner för testkanaler" (helst även produktion). Därefter:
  `cd vadkul-app && npx eas-cli submit -p android --profile production --path <aab> --key ~/.config/vadkul/play-publicering-sa.json`
  (aab:en = build 5, `eas build:list` eller artefaktlänken nedan; profilen i eas.json sätter track internal + draft). Alternativ utan API: Josef drar aab:en själv till Testa och lansera → Internt test → "Skapa ny version" (utkastet "release 1" är påbörjat).
- Sluten testning med 12 testare i 14 dagar krävs innan produktion (personligt konto). Skapa spåret under Testa och lansera → Sluten testning, lägg testarnas e-post som lista.
- [x] **Finns Play-kontot?** JA (sett 25/10 i Chrome, som var inloggat på ja223hm@gmail.com): ett **personligt** utvecklarkonto "Vadkul", konto-id 8028380077267418101, utan någon skapad app ("Skapa din första app"). Kontot är INTE färdigkonfigurerat - konsolen kräver två steg innan appar kan publiceras, båda bara Josef kan göra:
  - [ ] **Verifiera din identitet** (Hem → "Sätt igång"): ladda upp en officiell id-handling, Google granskar ("kan ta några dagar"). Claude får inte hantera id-handlingar.
  - [ ] **Verifiera telefonnumret för kontakt** (Hem → "Visa detaljer"): går först när id-handlingen är godkänd; sms/samtal till det nummer som står under Kontoinformation.
  - Personligt konto → sluten testning med minst 12 testare i 14 dagar krävs innan produktion låses upp; intern testning (upp till 100 testare via mejllista) går direkt. Appen går sannolikt att skapa och fylla i (butikssida, formulär, intern testning) parallellt med verifieringen - att skapa den kräver att Josef godkänner Googles utvecklarpolicy och USA:s exportvillkor.
  - _Ursprunglig anteckning 23/10:_ okänt om kontot fanns; panelen saknade Google-session.
  - **Appen går INTE att skapa förrän kontot är verifierat (provat 25/10 kl 19):** skapa-formuläret (namn "VADKUL: Event nära dig", paket `se.vadkul.app`, svenska, app, gratis, alla tre deklarationer ikryssade) avvisas med "Det här paketnamnet används redan" - men samma fel kommer för `se.vadkul.android` och ett slumpat `com.zq7xtest.kontrollprov`, så det är inte paketnamnet utan kontot. Play Store ger 404 på se.vadkul.app, aktivitetsloggen visar bara "Kontot har skapats" 9/10 23:18 och Gmail-kontot har bara detta utvecklarkonto. När id-verifieringen är godkänd: kör formuläret igen med samma värden (Josef godkände 25/10 utvecklarpolicyn, exportvillkoren och Play App Signing-villkoren).
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
  - **Raderings-URL (formuläret kräver en webbadress när appen har konton):** https://vadkul.se/integritet#radera-konto - avsnittet "Radera ditt konto" lades till 23/10 (commit 55608549 i huvudrepot). Ute på vadkul.se först när main pushas.
- [ ] **Målgruppen** ("Målgrupp och innehåll" - separat från IARC): appen riktar
  sig till VUXNA (föräldrar och eventbesökare); barn/familj är en INNEHÅLLS-
  kategori, inte målgruppen. Välj **13 år och uppåt** (eller äldre) och kryssa
  ALDRIG i någon grupp under 13 - då slår Googles Families-policy in (hårdare
  granskning; eventchatten och kontona blir granskningsproblem). IARC-utfallet
  nedan är innehållsklassning och påverkas inte av målgruppsvalet.
- [ ] **Innehållsklassningen** (IARC-enkäten): inga våldsamma/sexuella inslag, inget köp, ingen användargenererad kommunikation utan konto - men ange att appen visar användarskapat innehåll (event + eventchatt för inloggade) och har rapporteringsväg. Väntat utfall: 3+/E for Everyone.
- [ ] **Play-skärmbilderna** (ordning beslutad 25/10, Josef: "inte bara listor, event med bilder också"; 28/10: den nya eventbilden ERSÄTTER gamla 02, vars filer är borttagna - finns i git-historiken, 84514826): **01 karta, 02 eventbild, 03 bildflöde, 04 sök, 05 stadssida** (29/10, Josef om App Store-bilderna: "3/5 är typ bara en lista" - alla fem togs om i simulatorn "iPhone 16 Pro Max VADKUL-butik" med appens nya utseende): 02 = Streetstar Showcase på Berwaldhallen, kortet utfällt med stor omslagsbild; 03 `skarmbild-03-bildflode` ERSÄTTER 03-lista = kortets Populärt-lista med stora bilder under eventet; 04 = kortets sök "jazz" med Visa bilder på; 05 = Göteborgs stadssida med kartbilden överst (Stockholms hade en blodig skräckaffisch i Skapade på VADKUL just då). Alla kompositioner görs med `docs/butik-assets/komponera.py` (receptet uppmätt ur originalen: Fredoka SemiBold 75 px ur webbens .next-bygge, hörnradie 60, slagskugga 10/24/50/60 %) ur en råbild i `ra/` (1320x2868) och skrivs till `play/` (1320x2640), roten (1320x2868) och `app-store-mellan/` (1206x2622). Använd `play/`-varianterna
- [x] **Produktions-aab:en**: build 5 FÄRDIG 23/10 21:59 (versionCode 5, EAS-bygge 3492edc4, artefakt https://expo.dev/artifacts/eas/g2YgM6rD-tKY5CYkd31M4glPG3UX9mRqus2m9eZcCSs.aab - giltig 30 dagar, commit ce525fb i vadkul-app, fingeravtryck cb8aab9d = dagens kod). Byggd från en REN git-worktree på HEAD (`git worktree add --detach <tmp> HEAD` + `cp -Rc node_modules <tmp>/node_modules`), eftersom checkouten hade okommitterade intro-/startval-ändringar från en annan session och EAS packar arbetsträdet. Androids byggkvot var inte slut (bara iOS-kvoten). Laddas upp till intern testning när inloggningen är klar. Build 2 (9/10) är förbrukad.
- [ ] **App access-deklarationen**: chatten, vänner och Kommer kräver konto, så välj "vissa funktioner är begränsade" och ange demokontot från App Store Connect-inskicket (lösenordet har bara Josef).

### Firebase Console (djuplänkarna - gäller BÅDA plattformarna)

Upptäckt 16/10: `vadkul.se/.well-known/apple-app-site-association` och
`assetlinks.json` svarar 200 men är **tomma** - universal links/app links ur
vadkul.se-länkar öppnar alltså inte appen, trots `associatedDomains` i app.json.
Hosting körde appAssociation i AUTO-läge och genererade filerna automatiskt ur
Firebase-projektets appinställningar, så första fixen var ren konsol - **ingen deploy**.
Det räckte för iOS men inte för Android; sedan 25/10 ligger båda filerna
statiskt i repot i stället (se posten "assetlinks.json statiskt" nedan):

- [x] **iOS:** KLART (kollat 23/10 via Firebase Management API: App Store-ID 6820135961 + Team-ID 66D54NKWK7 ligger på iOS-appen, och AASA:n på vadkul.se listar `66D54NKWK7.se.vadkul.app`). Ursprunglig instruktion: Firebase Console → Projektinställningar → Allmänt → iOS-appen →
  fyll i **App Store-ID** och **Team-ID** (Apple Developer → Membership).
  Hosting börjar servera korrekt AASA direkt. OBS: Apples CDN cachar AASA,
  så enheter kan behöva upp till ett dygn (eller ominstallation av appen)
  innan universal links slår igenom.
- [x] **Android, uppladdningsnyckeln:** GJORT 23/10 via Firebase Management API (`POST firebase.googleapis.com/v1beta1/projects/vadkul-f2cb2/androidApps/1:888495806926:android:0576fefa5ae7eed361739f/sha` med firebase-tools-token). EAS-keystorens SHA-1 `91:55:72:1B:3A:3C:1A:75:DB:91:72:7F:03:E1:B9:C9:35:04:3B:35` och SHA-256 `0A:98:75:E8:99:61:5F:43:3D:BE:73:1E:3A:D4:ED:4F:EF:83:5D:59:48:C7:0A:EA:7B:6B:78:5F:80:3E:91:8D` (lästa med `keytool -printcert -jarfile build.aab`). Firebase skapade Android-OAuth-klienten automatiskt, så Google-inloggning funkar i byggen signerade med EAS-nyckeln (dev/preview/aab direkt). Appens google-services.json i repot saknar fortfarande den klienten - spelar ingen roll, RN Google Signin använder webClientId.
- [ ] **Android, Play App Signing-nyckeln:** Play signerar OM butiksbyggena med Googles egen nyckel. Hämta dess SHA-1 + SHA-256 under Play Console → Setup → App signing (finns först när appen är skapad) och lägg till dem på samma sätt - annars ger Google-inloggningen DEVELOPER_ERROR i butiksversionen och app links faller.
- [x] **assetlinks.json statiskt (25/10):** filen var fortfarande `[]` 25/10 trots SHA-256:an i Firebase och en ny deploy. Löst i repot i stället: `apps/web/public/.well-known/assetlinks.json` (paketnamnet + EAS-nyckelns SHA-256) och `apps/web/public/.well-known/apple-app-site-association` (exakt kopia av det Hosting genererade för iOS, JSON-jämförd mot produktionen) ligger som statiska filer, och `firebase.json` har `"appAssociation": "NONE"` plus `Content-Type: application/json` på båda sökvägarna (Firebases egen guide för app links gör precis så). Varför NONE: Hostings API beskriver AUTO som att filerna "skapas automatiskt ur projektets appar" och NONE som "ingen specialhantering" av sökvägarna, och dokumentationen lovar ingenstans att en deployad fil vinner över den genererade - så AUTO är avstängt för att det statiska innehållet ska gälla med säkerhet. Firebase-tools default-ignore `**/.*` stoppar INTE `.well-known/<fil>` (kollat mot `listFiles` i 14.18 och 15.22.4: bara filer vars eget namn börjar med punkt faller bort) och Next-adaptern kopierar hela `public/` till hosting-katalogen. Går ut med nästa push till main (deploy.yml bygger på firebase.json + apps/web).
  **OBS Play App Signing:** när Googles signeringsnyckel finns (posten ovan) ska dess SHA-256 läggas till i `sha256_cert_fingerprints`-listan i samma statiska fil, inte bara i Firebase Console - Hosting genererar inte längre filen. Bygg aldrig om listan utan EAS-nyckeln: interna testbyggen och dev-klienter är signerade med den.
- [ ] Kvittera efter deployen: `curl -sS https://vadkul.se/.well-known/assetlinks.json`
  ska lista `se.vadkul.app` + fingeravtrycket, `curl -sSI https://vadkul.se/.well-known/apple-app-site-association`
  ska ge `content-type: application/json` och kroppen bundle-id:t under `details`.
  Googles egen kontroll: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://vadkul.se&relation=delegate_permission/common.handle_all_urls`
  ska svara med ett statement för paketet.
