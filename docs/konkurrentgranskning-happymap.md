# Konkurrentgranskning: happymap.se vs VADKUL

_Arbetsdokument. Underlag insamlat 2026-10-06 från happymaps publika sidor (startsida, /about, /vad-hander,
stadssidor) och deras publikt serverade JS-bundlar. Ingen data hämtad ur deras backend._

## TL;DR

- **Volym & räckvidd:** happymap uppger **139 809 kommande event i 1 156 orter** (21 län + grannländer),
  mot våra **44 910 i ~291 sökbara orter / 71 stadssidor**. ~3× event, ~4× orter.
- **Deras strategiska vad:** en **social lager ovanpå kartan** — vänner, närvaro ("ute nu"),
  hangouts, gruppplaner, DM/trådar. De säljer "hitta något att göra + någon att göra det med".
  Vi är en ren upptäckts-/kartprodukt.
- **Positionering:** ideell förening, **noll annonser, noll spårare, gratis för alltid**. Det är en
  rak motsats till våra Hotjar + Firebase Analytics + Ticketmaster-affiliate + boost-betalningar.
- **Eventgap (stickprov Stockholm, 100 närmaste):** vi saknar **~46%** av deras närtidslistning
  (fuzzy-matchning). Tydliga källhål: Nalen/Debaser-konserter, Fotografiska/Folkuniversitet-kurser,
  stand-up/open mic, Botkyrka konsthall.

---

## 1. Eventjämförelse

### Headline-siffror (deras publika sidtitlar)

| | happymap | VADKUL |
|---|---|---|
| Kommande event totalt | 139 809 | 44 910 |
| Orter | 1 156 | 291 sökbara / 71 stadssidor |
| Stockholm | 7 842 | ~4 082 (15 km) |
| Gratis i Stockholm | 971 | (ingen separat siffra) |
| Geografi | 21 län + grannländer | Sverige |

> Reservation: räknemetod kan skilja (expansion av återkommande tillfällen, tidshorisont,
> grannländer, pyttesmå orter). Men riktningen är tydlig — de har bredare täckning.

### Stickprov: Stockholm, 100 närmaste event (deras JSON-LD)

- Exakt titelmatchning mot vår fulla DB: **36/100**
- Fuzzy (titeltoken ≥60% _eller_ delad lokal, samma dag): **54/100**
- **→ vi saknar ~46 av 100** närtidsevent i Stockholm.

Vad vi missar (kategorier bland de 46):

| Kategori | Antal | Exempel |
|---|---|---|
| Övrigt/lokalt | 22 | Öppen förskola, Gallerian 50 år, drop-in-gruppträning |
| Kurs/workshop | 6 | Fotokurs @ Fotografiska, "Kom igång och skriv" @ Folkuniversitetet |
| Konsert/livemusik | 6 | Holly Humberstone, Craig Finn, Woody @ Nalen; Hot Property @ Debaser Nova |
| Stand-up/komedi | 5 | Söder Stand up, BIG BEN STAND UP, Open Mic Wednesdays |
| Kyrka/community | 3 | Öppen hemgrupp, körövning |
| Teater/scen | 2 | Gästspel @ Ö2, opera/musikal |
| Senior/PRO | 2 | Bridge, IT-support, tennis 65+ @ PRO Vantör |

**Konkret källhål att täppa — RÄTTELSE efter registerkoll (6/10):** det är inte "källor vi inte skrapar"
utan främst **utbyte**: `nalen` och `folkuniversitetet` står som `status: 'dead'` i `sources/registry.ts`,
`debaser` som `experimental` (tider blir date-only p.g.a. "Dörrar 18.00"). Helt utan källa (0 event hos oss):
Fotografiska, Botkyrka Konsthall, Big Ben, Norra Brunn, Söder Stand up, Glenn Miller Café, China Teatern.
Åtgärdsplanen ligger i `docs/produktplan-2026-10.md`, spår 1.

---

## 2. Funktioner de har som vi inte har

### Social lager (deras kärna — vår största blinda fläck)

Från deras publika klientkod framgår ett helt socialt system:

- **Vängraf** (connections, close friends) + **invite-länkar/referrals**.
- **Närvaro** — "vänner ute nu", presence-ping. Du ser vilka vänner som är aktiva/på väg någonstans.
- **Hangouts** — skapa en öppen träff och träffa nya människor; synliga hangouts i närheten.
- **Gruppplaner** — förslag + röstning + medlemmar ("vart ska vi?"-planering i grupp).
- **DM/trådar** — privata meddelanden och gruppchatt (läskvitton, mutes).
- **Opt-in platsdelning** — "du väljer om och med vem du delar din plats".

Vi har per-event-chatt och anmälan/deltagarlista (bara för VADKUL-arrangerade event). Vi har
_ingen_ vängraf, närvaro, hangouts, DM eller gruppplanering.

### Övriga funktioner de har

- **Väder på event** — "se tid, plats och väder innan du bestämmer dig". Vi har inget.
- **Platssidor per lokal/arena** — `/plats/{stad}/{venue}` med program + priser. Vi har
  arrangörssidor men inte lokalsidor.
- **Gratis som förstklassigt filter** — egna `/vad-hander/{stad}/gratis`-sidor (971 i Sthlm).
  Vi visar pris som text, inget gratis-filter på kartan.
- **Arrangör självbetjäning med affisch + QR + webbmärke** — verktyg för att värva arrangörer.
  Plus "organizer claims" (hävda sina event). Vi har skapa-event men inte affisch/QR-paketet.
- **Följ serie** — prenumerera på en återkommande serie. Vi grupperar serier i "Mina event"
  men har ingen publik "följ serien".

### Teknik

- Backend: **Supabase (Postgres)** vs vår Firebase/Firestore.
- Egen **vektor-tileserver** (tiles.happymap.se) och **bildproxy via Cloudflare**
  (img.happymap.se/cdn-cgi/image). Kartmotor: MapLibre GL — samma som vår.
- Next.js, Vercel-hosting.

---

## 2b. GUI & medlemsinteraktioner — djupdyk

happymap är i praktiken en **social samordningsapp ovanpå en eventkarta**, inte bara en karta.
Nedan är deras medlemsvända funktionsyta, avläst ur deras publika klientkod (knapptexter, flöden).
Appen är tvåspråkig (sv/en). **VADKUL saknar i stort sett allt detta.**

**A. Vängraf & närvaro**
- Lägg till vänner, **vänförfrågningar** (visar ditt namn), **nära vänner** (egen nivå), blockera/avblockera.
- **Närvaro:** "Aktiv nu / Live nu", "Visa när jag senast var aktiv" (på/av — av = ingen ser).
  Vänner ser om du varit aktiv nyligen.

**B. RSVP ("Kommer") som social signal** — på vilket event som helst, inte bara egna
- "Jag kommer", återkommande: "Jag kommer varje gång", bocka specifika datum.
- Social synlighet: "Vänner kommer", "En vän ska hit", "Visa vilka som kommer",
  "Visa vänner vad jag ska på" (på/av; "Ingen kan se vad du ska på"). Se deltagare som delar profil.
- Påminnelser om det du ska på.

**C. Hangouts (spontana träffar)** — "Hangout now"
- Lägg ut en hangout på kartan, bara idag/imorgon ("hangouts är inte en kalender"), syns för vänner
  under ditt namn, välj vilka som ser den, gå med / lämna / avsluta / redigera / rapportera / dela,
  värdskap överlämnas om du lämnar, "ping när hangouten flyttar".

**D. Planer (gruppbeslut/röstning)** — "Make a plan"
- Titel ("Dinner Friday"), förslag med datum + **röster**, bjud in folk, landar i varje väns
  "Planer"-flik, avboka/lämna, notis när planen ändras, vädermedveten.

**E. Inbjudningar & privata event**
- Bjud in vänner till event/planer/hangouts; "Välj vilka du bjuder in", "Vilka är inbjudna?".
- **Privata event:** bara du + inbjudna ser dem, dold adress tills man fått plats, automatisk
  gruppchatt, "alla svarar på sin egen inbjudan", ping när ni bjudit in varandra.
- **Inbjudningslänkar / referral** ("A friend invited you").

**F. Gruppchatt / DM**
- Chatt per event/hangout/plan: skicka, ta bort, nya meddelanden, mute/unmute, läskvitton.

**G. Samlad notis-/aktivitetsinkorg**
- "Vänförfrågningar, inbjudningar, meddelanden och uppdateringar om event och hangouts hamnar här."

**H. Personalisering — "Smakprofil" / "Picks for you"** (helt frånvarande hos oss)
- "Din smakprofil", "Dina intressen" (justerbara), "Recommended for you", "Tonight for you",
  "For you and friends", "Inte intresserad", lär sig av vad du sparar. En **rekommendationsmotor**.

**I. Väder (SMHI)** — "Väder för detta event", "Regn väntas", väderkoll på utomhusplaner.

**J. Profil** — publik profil + smakprofil; styr vilka event som syns; dölj enskilda event;
upptäck vilka som kommer via delade profiler.

## 2c. Arrangörs-CMS ("profi"-sidan) — djupdyk

Deras `/for-arrangorer` är ett förvånansvärt moget självbetjänings-CMS — **utan konto, utan mellanhand**:

- **Automatisk arrangörssida** vid ≥3 kommande event (`/arrangor`), uppdateras dagligen, delbar, SEO.
- **QR-affisch (A4)** att skriva ut och sätta upp — visar alltid aktuellt program. "Tar en halv minut."
- **Webbmärke** (`hm-badge.svg`) att klistra in på egen sajt/nyhetsbrev.
- **Egen sida för studentkår/sektion/nation.**
- **Ansökningsbaserad anmälan ("Du väljer"):** sökande svarar på upp till 3 frågor; arrangören
  sätter Ja/Kanske/Nej som **utkast**; batchar "Skicka besked" med utlovad tidsram (alla samtidigt
  eller löpande); **väntelista** vid avbokning; inbjudna bokar direkt; **vänner kan söka ihop och få
  samma besked**; dold adress tills man fått plats; appen påminner arrangören före utlovad deadline.
- **Reducerat pris "i mån av plats"** för definierade grupper (studenter/pensionärer/behov); sökande
  ber om det med ett tryck; bevis visas i entrén, inget laddas upp.
- **Flera tider** (prova-på 10/11/12), byt med ett tryck; kurser bokas som helhet.
- **Gratis biljett/betalning direkt till arrangören** via Swish/på plats/faktura — happymap rör aldrig
  pengarna och tar ingen avgift. **Deltagarlistan är arrangörens, exporterbar.**
- Ingen reklam, ingen spårning, inga cookies. "Gratis, för alltid."

**Jämfört med oss:** VADKUL har användarskapade event + "Jag arrangerar" med först-till-kvarn-anmälan.
Vi saknar ansökningsflödet, QR-affischen, webbmärket, listexport, reducerat-pris-logiken och multi-tid.

## 2d. Mobilapp

happymap har en **riktig mobilapp** — `/beta` ("Hämta Happymap") plus en iOS-listning i App Store
("HappyMaps", id6762518859). VADKUL är PWA (native-appen är bara en plan i `docs/app-plattform-plan.md`).

> Not: live-skärmdumpar av deras kart-GUI gick inte att ta — deras host (Vercel) blockerar
> automatiserade webbläsare. Analysen ovan bygger på deras publikt serverade klientkod och sidor,
> inte på skärmavläsning eller deras backend.

## 3. Vad VI har som de sannolikt inte har (våra styrkor)

- **Boost** — betald framlyftning (monetisering de uttryckligen avstår).
- **Stjärngåva** och **önskningar** — unika engagemangsfunktioner.
- **Mogen kart-UX** — dag/vecka-väljare, kategorichips med antal, multibrickor, boost-brickor,
  reveal-logik.
- **Djup SEO redan byggd** (71 stadssidor × 9 kategorier, JSON-LD, OG-bilder per stad/kategori/event,
  arrangörssidor) — men deras råa sidantal är större p.g.a. 1 156 orter.

---

## 4. Rekommendationer (utkast)

1. **Täpp källhålen i Stockholm först** (Nalen, Debaser, Fotografiska, Folkuniversitetet,
   stand-up-scener, Botkyrka konsthall) — störst omedelbar effekt på upplevd täckning.
2. **Överväg gratis-filter + väder** — billiga funktioner som de använder som säljpunkter.
3. **Bevaka deras sociala spel** — hangouts/vänner/planer är ett annat spel än vår upptäckt.
   Avgör medvetet om vi möter det eller dubblar ner på att vara bästa kartan.
4. **Positionering:** deras "ideell, noll annonser, noll spårare" är ett kommunikationshot givet
   våra trackers + affiliate + boost. Värt ett medvetet svar.

---

## Metod & gräns

Eventjämförelsen bygger på deras **publika stadssidor** (samma JSON-LD de serverar till Google),
inte på deras databas. En fullständig 1:1-diff av hela katalogen skulle kräva att tömma deras
backend via deras klientnyckel — det gör jag inte. Vill du ha ett bredare stickprov kan jag läsa
fler publika stadssidor (Göteborg, Malmö, Uppsala …) och bygga ihop en större men fortfarande
publik jämförelse.
