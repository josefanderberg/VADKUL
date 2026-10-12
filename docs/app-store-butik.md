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
| Identifierare → Enhets-ID | FCM-token för push-notiser | Appfunktionalitet | Ja |
| **Diagnostik → Kraschdata** (NY i build 7) | Crashlytics: stackspår och appens tillstånd vid krasch eller fångat fel | Appfunktionalitet | Ja - uid följer med när man är inloggad |
| **Diagnostik → Annan diagnostikdata** (NY i build 7) | Enhetsmodell, iOS-version och liknande i kraschrapporten, Crashlytics installations-ID, vilket JS-paket som körde | Appfunktionalitet | Ja - samma rapport som ovan |
| Annan data → Andra datatyper | Profilens frivilliga fält: ålder, kön, hemort, har barn | Appfunktionalitet, Produktanpassning (familj- och 65+-källorna), Utvecklarens annonsering eller marknadsföring (stadsutskick) | Ja |

**Plats deklareras INTE** (ändrat mot 9/10-utkastet): positionen används bara på enheten för att välja region och visa kartan, och koordinaterna lämnar aldrig telefonen. Apple räknar då inte det som insamling. Hemorten i profilen väljs manuellt och står under Annan data ovan. Har Plats redan kryssats i 9/10 är det överdeklarerat men inte fel - ta bort det när formuläret ändå uppdateras.

**Kraschdatan i klartext:** inget skickas från dev-byggen. Inga loggrader med innehåll, inga e-postadresser eller namn - bara uid för inloggade (anonyma och utloggade får tomt id). Crashlytics sparar stackspår och tillhörande id:n i 90 dagar. Det är en global Firebase-tjänst utan val av lagringsplats, så datan kan behandlas utanför EU - till skillnad från kontodatan i Firestore (europe-north1/north2), som integritetspolicyn i dag beskriver som enda lagringsplats.
