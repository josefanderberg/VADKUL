# App Store-texterna (iOS, svenska)

_Ifyllt i App Store Connect 9/10 2026. Ändras texten i Connect, uppdatera här också._

**Namn (30):** VADKUL: Event nära dig

**Underrubrik (30):** Konserter, marknader och sport

**Reklamtext (170):**
Se vad som händer nära dig idag. Tusentals event i hela Sverige på en karta, från loppisar och konserter till hockey och barnaktiviteter. Gratis.

**Nyckelord (100):**
evenemang,aktiviteter,händer,idag,helgen,barn,konsert,loppis,marknad,teater,hockey,karta,nöje

**Beskrivning:**

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
Du behöver inget konto för att använda kartan. Vill du synka favoriter och svara Kommer skapar du ett konto med e-post, Google eller Apple.

**URL:er**
- Support: https://vadkul.se
- Marknadsföring: https://vadkul.se
- Integritetspolicy: https://vadkul.se/integritet

**Kategori:** Underhållning (primär), Livsstil (sekundär)

**Copyright:** 2026 VADKUL

---

## App Privacy (Connect → Appintegritet)

_Utkast 12/10 2026 inför build 7. Gäller appen som den är från build 7: konton på (KONTON_PÅ sedan 8/10), sociala lagret och Crashlytics. Det korta 9/10-utkastet (bara e-post, plats och push-token) täckte inte konton, användarinnehåll eller kraschdata._

**Spårning:** Nej. Ingen datatyp används för spårning (ingen annonsdata, inget delas med datamäklare, inget IDFA).

| Datatyp i formuläret | Vad det är i appen | Syfte | Kopplad till användaren |
|---|---|---|---|
| Kontaktinfo → E-postadress | Kontots e-post (frivilligt konto, e-post/Google/Apple) | Appfunktionalitet, Utvecklarens annonsering eller marknadsföring (medlemsmejlen) | Ja |
| Kontaktinfo → Namn | Visningsnamnet - syns som värd på egna event och i chatten | Appfunktionalitet | Ja |
| Användarinnehåll → Foton eller videor | Omslagsbild på event man skapar (Storage) | Appfunktionalitet | Ja |
| Användarinnehåll → E-post eller textmeddelanden | Eventchatten, publik och privat | Appfunktionalitet | Ja |
| Användarinnehåll → Annat användarinnehåll | Event man skapar eller tipsar om, önskningar, svar (Kommer), rapporter | Appfunktionalitet | Ja |
| Kontakter | Vänlistan i appen (Apples definition räknar socialt nätverk hit) | Appfunktionalitet | Ja |
| Identifierare → Användar-ID | Firebase-uid (konto, och anonymt uid för svar/tips utan konto) | Appfunktionalitet | Ja |
| Identifierare → Enhets-ID | FCM-token för push-notiser; från 4/11 även Analytics app-instans-id (slumpat, nollställs vid ominstallation) | Appfunktionalitet, Analys | Ja |
| **Diagnostik → Kraschdata** (NY i build 7) | Crashlytics: stackspår och appens tillstånd vid krasch eller fångat fel | Appfunktionalitet | Ja - uid följer med när man är inloggad |
| **Diagnostik → Annan diagnostikdata** (NY i build 7) | Enhetsmodell, iOS-version och liknande i kraschrapporten, Crashlytics installations-ID, vilket JS-paket som körde | Appfunktionalitet | Ja - samma rapport som ovan |
| **Användningsdata → Produktinteraktion** (NY 4/11, analytics) | Google Analytics för Firebase: skärmvisningar och handlingar (öppnat eventkort, Anmäl-klick, gilla, Kommer/Intresserad, skapat event, önskan, stjärna, delad inbjudan, introvalen) med event-slug/kategori/status - aldrig namn, e-post eller fritext | Analys | Nej - inget användar-id sätts, bara Firebases slumpade app-instans-id (vill man vara konservativ: Ja, som Crashlytics - överdeklarerat är inte fel) |
| Annan data → Andra datatyper | Profilens frivilliga fält: ålder, kön, hemort, har barn | Appfunktionalitet, Produktanpassning (familj- och 65+-källorna), Utvecklarens annonsering eller marknadsföring (stadsutskick) | Ja |

**Plats deklareras INTE** (ändrat mot 9/10-utkastet): positionen används bara på enheten för att välja region och visa kartan, och koordinaterna lämnar aldrig telefonen. Apple räknar då inte det som insamling. Hemorten i profilen väljs manuellt och står under Annan data ovan. Har Plats redan kryssats i 9/10 är det överdeklarerat men inte fel - ta bort det när formuläret ändå uppdateras.

**Analytics i klartext (4/11 2026):** Google Analytics för Firebase i båda apparna, samma GA4-egendom som vadkul.se (vadkul-app d28ab17: `data/matning`). Skärmvisningar per rutt och webbens handlingsnamn (event_view, event_anmal_click, event_like, event_rsvp, event_create, event_wish, star_placed, invite_share, welcome_*/startstad_*) med slug/kategori/status som enda parametrar. Inget användar-id, ingen IDFA och ingen ATT-prompt: iOS byggs med RNFB:s `withoutAdIdSupport` (FirebaseAnalyticsCore utan IdentitySupport), så "Spårning: Nej" står kvar. Dev-byggen mäter inte. Finns i native-byggen gjorda efter 4/11 - tidigare byggen mäter ingenting, oavsett OTA.

**Kraschdatan i klartext:** inget skickas från dev-byggen. Inga loggrader med innehåll, inga e-postadresser eller namn - bara uid för inloggade (anonyma och utloggade får tomt id). Crashlytics sparar stackspår och tillhörande id:n i 90 dagar. Det är en global Firebase-tjänst utan val av lagringsplats, så datan kan behandlas utanför EU - till skillnad från kontodatan i Firestore (europe-north1/north2), som integritetspolicyn i dag beskriver som enda lagringsplats.

## Julsäsongen 2026 (#192)

_17/11 2026 ca 13:05: In-App Event + header + sökbild INSKICKADE för granskning ("3 Items Submitted", upp till 48 h, mejl när klart). Reklamtexten bytt samma dag på liveversionen 1.1.1 (fältet var tomt där innan - oktobertexten följde inte med till 1.1.1)._

_18/11 2026 ca 20:55: den inskickningen AVBRUTEN och ersatt av den röda julversionen (Josef 18/11: "rött tema och lite snöflingor som glittrar", granar mörkgröna, paket gula, "skriv göteborg större"). Ny inskickning: eventet med nya kort- och detaljbilder + `header-rod-3840x1646.png` + `sokbild-rod-3840x2560.jpg`, "3 Items Submitted" igen. Publiceringsstarten fick flyttas till 19/11 00:00 - Connect kräver att den ligger i framtiden när eventet läggs för granskning igen. De gröna tillgångarna från 17/11 ligger kvar oanvända i Asset Library (utan "rod" i namnet). En tillgång kan inte få en ny fil, bara laddas upp på nytt, och Apple kan bara avbryta en hel inskickning._

**När granskningen är klar:** versionssidan (Distribution -> 1.1.1) har en plats "0 of 1 Header Asset - Browse approved assets". Den godkända headern måste väljas där och publiceras, annars syns den inte. Kolla samma sak för sökbilden. Fyll i status här.

Bilderna ligger i `docs/butik-assets/app-store-jul-2026/` och är renderade med `docs/butik-assets/rendera-julkarta.mjs`: webbens kartstil mot egna Protomaps-kakel (samma licensväg som stadssidornas kartbilder, `docs/kartbilder.md`) och de riktiga julmarknaderna kring Göteborg som 🎄-brickor. Jultemat (`--jul`): vinterblek karta, mörkgröna granbrickor, gula paket och röda tomtar som extra brickor, kartans egna moln, glittrande snöflingor, "Göteborg" i stor kartstil (`--ort`) och "Julen är nära" i en röd bubbla på header och sökbild (inom Apples art safe area). Eventbilderna har ingen text utom ortnamnet - Apple lägger eventets namn ovanpå. Inga alfakanaler. Exakta renderkommandon finns i #192.

**Header och sökbild (Asset Library, visas på iOS 27 och senare).** Granskas mot den senaste versionen och kräver ingen ny version. Byts tillbaka efter jul.
- Header 21:9: `header-3840x1646.png` (i Connect: `header-rod-3840x1646.png`). Connect avvisade jpg-versionen ("File dimensions are invalid") trots rätt mått och att dokumentationen tillåter jpg - ladda upp headern som PNG.
- Sökträff 3:2: `sokbild-3840x2560.jpg` (i Connect: `sokbild-rod-3840x2560.jpg`)

**In-App Event**
- Namn (30): Julmarknader nära dig
- Kort beskrivning (50): Hundratals julmarknader på kartan i hela Sverige.
- Lång beskrivning (120): Från stora julmarknader i stan till julbasarer i bygdegården. Se vilka som är öppna idag och i helgen, nära dig.
- Märke: Special Event. Syfte: locka nya användare. Normal prioritet, inget köp krävs.
- Period: 21/11-20/12 2026 (30 dagar; Apples tak är 31). Marknadsförs från godkännandet. Julmarknaderna per vecka 17/11: v47 170, v48 303, v49 243, v50 76, v51 10.
- Djuplänk (krävs av Connect): `https://vadkul.se/sok?q=julmarknad` - appens sökskärm med julmarknader, närmast först.
- Bara Sverige (1 av 175 länder). Publiceringsstart 19/11 00:00, alltså synligt i App Store så fort det är godkänt.
- Kortbild 16:9: `event-kort-1920x1080.jpg`. Detaljbild 9:16: `event-detalj-1080x1920.jpg` (i Connect med "-rod-" i namnet).

**Reklamtext under säsongen (170, kräver ingen granskning):**
Julmarknader nära dig: hundratals julmarknader och julbasarer i hela Sverige ligger på kartan. Se vad som är öppet idag och i helgen. Gratis, utan konto.

Efter jul: tillbaka till den vanliga reklamtexten överst i filen och ta bort headern/sökbilden (eller byt mot en året-runt-bild).

**Nyckelordet "julmarknad"** ingår inte här. Nyckelorden är låsta per version och läggs in med nästa version (1.1.2).
