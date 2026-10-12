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

## 2b-ii. GUI-genomgång från skärmbilder (mobil, 6/10)

Josef tog 11 skärmbilder av happymap.se i mobil-Safari (Växjö/Linköping). Bilderna ligger inte i
repot (publikt). Det här är vad de visar, yta för yta, och hur det står mot vår karta i dag.

| Yta | happymap | VADKUL i dag |
|---|---|---|
| Landning | Mörk Nordenkarta med **värmekarta** över eventtätheten (ända ut till Danmark/Finland) och "Upptäck event i **Uppsala**" där stadsnamnet växlar | Kartan öppnar direkt i din stad, välkomstruta med veckans antal (ägarbeslut: inget intro, ingen Sverigeöversikt) |
| Första val | Modal "Vad händer nära dig?" → **Visa event nära mig** (GPS) eller **Välj en ort** (sök + 12 snabbval + "Hela Sverige") | Tyst GPS → närmaste stad; stadssök i sökpanelen |
| Onboarding | **"Vad vill du få förslag på?"** — 16 intressen i färgade cirklar, **utan konto**, "Vi använder det för förslagen i Upptäck", Hoppa över / Logga in | Ingen intresseonboarding ("Tips för dig" borttagen på ägarbeslut) |
| Navigering | **5-flikars tabbar**: Karta · Planer/Kalender · Chatt · Upptäck · Profil | Allt på kartan: profil · dagplatta · sök upptill, + och 🔥 nertill (ägarbeslut 15/9) |
| Kartan | Mörk basemap. **Runda kategorifärgade markörer med ikon + titel i kategorifärgen**, små omärkta prickar för resten; vid låg zoom **värmekarta** och **temperatur per ort** utsatt på kartan | Nöjesfältet (ljus), droppbrickor med emoji, 50 tända närmast, etiketter från zoom 9/13, multibrickor, guldboost |
| Hörnknappar | **+ nere till vänster** (som vi), **Min plats nere till höger**, **Logga in-pill uppe till höger**, header-pill "Happymap · Stad · ☀ 12°" | + nere till vänster, 🔥 nere till höger, Min plats dold, profil uppe till vänster |
| Filter | Egen filtersida: **Tid och datum**, **Pris: Gratis / Max 200 SEK**, **16 kategorier med flerval** (ring + bock), Rensa, "Visa resultat"; valda chips ligger kvar i sökfältet, Filter-knapp med räknare (5) | Dagväljare i botten; **en kategori åt gången** i sökpanelen (ägarbeslut 16/9); 11 kategorier; inget prisfilter |
| Lista | Fullständigt listläge: miniatyr (bild, annars kategoriikon i kategorifärg), "Idag · Tid ej angiven", titel, **lokal · avstånd (3,3 km)**, chips: kategori, **"↻ Varje tisdag"**, **"75 SEK" / "Pris okänt"**, dagavdelare IMORGON | Listan under kortet (Månaden · Populärt, 30 dagar), avstånd i kortet, "Gratis"-etikett i stadssidornas listor |
| Eventsida | **Helsida** (inte ark): kategori · Gratis, titel, tid + **väder för eventet (☁ 6°)**, **"↻ 9 datum till ›"**, **🔔 Påminn mig**, beskrivning, **arrangörsrad med foto → arrangörssida**, plats · 1,8 km · **Visa på kartan · Hitta hit ↗**, **Kalender ›**, prisrad, sticky **"Jag kommer" + "Intresserad"**, dela, meny | Bottenark med fyra stopp, ♥ (sparat + påminnelse, kräver konto), ANMÄL/BOKA, Dela, Rapportera, chatt, serie-etikett i härkomstraden; kalenderexport finns som död kod |
| Väder | Genomgående: header-pill, **temperatur per ort på kartan**, per event, och en **hel prognossida** (timme för timme + tio dygn med nederbörd) | Inget |

**Andra omgången (7 skärmar, Växjö): eventsidan i botten, skapa-flödet och inbjudan**

| Yta | happymap | VADKUL i dag |
|---|---|---|
| Eventsidans botten | "Drop-in.", "Från 10 år." i texten; **arrangörsrad med bild**; plats · 1,2 km · Visa på kartan · **Hitta hit**; **Kalender**; pris; **"Mer info ↗"** (utlänk till källan) | Härkomstrad + ANMÄL/BOKA-utlänk, ingen kalender, ingen Hitta hit |
| **Miljö** | Rad "Miljö · Inomhus/Utomhus" per event (styr vädrets relevans) | Finns inte |
| **Gå tillsammans** | Grönt kort: "Fråga någon du känner om de vill följa med. De som säger ja syns här, och ni får en egen chatt om kvällen." Knappen **"Fråga någon"** öppnar **telefonens delningsark** (SMS, Snapchat …) — **"De behöver inte appen för att svara."** | Ingen inbjudan. Native share finns (delar `/e/`-länken) |
| **Jag kommer** | Toast "Du kommer · sparat i Planer · Ångra"; knappen blir "✓ Du kommer"; **Intresserad** bredvid | ♥ = sparat + påminnelse (kräver konto) |
| **Kommentarer** | Publikt synliga under eventet ("Inga kommentarer än. Skriv den första.") | Chatten kräver inloggning **även för att läsa** |
| Utforska mer | Sök-chips med nyckelord ur eventet ("Digitalt", "Läslov") | Inget |
| **Mer på <lokal>** | Karusell med lokalens övriga event (bild, tid, chips "✓ Du kommer", "Gratis"), **× för "inte intresserad"** | Multibricka för samma koordinat, ingen "mer här"-rad i kortet |
| **Källa + färskhet** | **"Från bibliotek.vaxjo.se · kontrollerad idag"** | Källdomänen syns i sök, ingen "kontrollerad"-stämpel |
| **Skapa (+)** | Fyra typer: **Häng** ("Spontant. Nu eller snart. Vänner ser var du är och hakar på"), **Event** ("Öppet för alla eller bara vänner"), **Arrangörssida** ("Artist, förening, kår eller klubb"), **Ställe** ("Bar, scen, kafé eller lokal") — "Ett ställe kan också lägga upp egna event" | + → placera på kartan → Jag arrangerar / Tipsa / Önska |
| Ny arrangörssida | Namn (**"Skriv namnet så visar vi om ni redan finns hos oss"** = dubblettkoll mot skrapade arrangörer), Ort, en rad, **Intressen** (flerval), Webbplats, Bild (sidans banner), "Skapa sidan" | Arrangörssidor genereras ur skrapdata (2 000+); ingen självbetjäning |

**Den viktigaste lärdomen i omgång två: inbjudan kräver ingen vängraf.** "Fråga någon" är en vanlig
delningslänk via telefonens delningsark; mottagaren svarar utan app, och de som säger ja hamnar på
eventet med en egen chatt. Vängrafen växer *ur* accepterade inbjudningar — inte tvärtom. Det vänder
ordningen i vårt spår 3 (se planen).

**Vad skärmarna betyder för planen (fört in i `produktplan-2026-10.md`):**

- **Prisfilter = Gratis + maxbelopp**, inte bara gratis (B1). De skriver dessutom **"Pris okänt"** öppet där vi
  tiger — överväg samma ärlighet, det gör "Gratis" trovärdigare.
- **Väder är mer än en rad i kortet**: temperatur i stadsplattan + per event är billigt (samma SMHI-anrop);
  per-ort-temperaturer på kartan och en prognossida är nice-to-have (B2).
- **"Jag kommer" + "Intresserad" sida vid sida** — exakt uppdelningen i beslut 1: ♥ ≈ Intresserad/sparat,
  "Jag kommer" som egen knapp. Stärker rekommendationen.
- **"Hitta hit"** (vägbeskrivning från koordinaterna) och **arrangörsrad med bild som länkar till
  arrangörssidan** — vi har 2 000+ arrangörssidor men kortet visar bara värdnamnet som filter. Timmar (B5b).
- **Flerval + 16 kategorier** (Nattliv, Karaoke, Film, Quiz, Föreläsningar, Festivaler …) är ett
  **ägarbeslut**: 16/9 låste en kategori åt gången, och taxonomin bor i `@vadkul/kontrakt` (delas med
  appen). En finare taxonomi skulle tömma vår `other` (5 004 event) — beslut 8.
- **Värmekarta, tabbar och intresseonboarding** står medvetet utanför planen: Sverigeöversikten och
  "Tips för dig" är borttagna på ägarbeslut, och en tabbar bryter "allt på kartan". Noterat, inte föreslaget.
- **Inbjudan via delningslänk först, vänner sedan** (B8 före B6) — vi har redan native share av `/e/`-länken
  och en anonym session för tips, så mottagaren kan svara utan konto precis som hos dem.
- **Chatten läsbar utloggad** (skriva kräver konto) — deras kommentarer syns för alla; våra kräver inloggning
  för att ens läsa. Billigt och bra för både engagemang och SEO (B5c).
- **"Från <domän> · kontrollerad <datum>"** i kortet — förtroendestämpel som vi kan ge nästan gratis, nattkedjan
  kontrollerar ju varje källa (B5d).
- **"Mer på <lokal>"** i kortet — vi har `locationName`, det är en filtrerad rad (B5e).
- **Miljö inomhus/utomhus** — audit-daemonen kan klassa det; gör vädret (B2) relevant i rätt kort.
- **Självbetjänad arrangörs-/ställesida med dubblettkoll mot skrapade arrangörer** — exakt vår C4-claim,
  men som ett skapa-flöde. Deras "Ställe" = vår B3 platssida + självbetjäning.

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

> Not: egna live-skärmdumpar gick inte att ta — deras host (Vercel) blockerar automatiserade
> webbläsare. Avsnitt 2b bygger på deras publikt serverade klientkod och sidor; avsnitt 2b-ii på
> Josefs egna skärmbilder 6/10. Inget kommer från deras backend.

## 2e. Checklista: allt de har mot vad vi har

_Legend: ✅ har · ◐ delvis · ❌ saknas · ❓ inte sett (frågor längst ner). Källa: 18 skärmbilder 6/10,
publik klientkod, /about och /for-arrangorer. Kolumnen "Vi" gäller webben i dag._

### Karta & upptäckt

| Funktion | happymap | Vi | Kommentar |
|---|:---:|:---:|---|
| Karta med event (MapLibre) | ✅ | ✅ | |
| Mörk kartstil | ✅ | ❌ | Vårt UI följer OS, men kartan är alltid ljus (nöjesfältet, ägarbeslut 4/9) |
| Värmekarta vid låg zoom | ✅ | ❌ | Sverigeöversikt borttagen på ägarbeslut |
| Landningssida med värmekarta + växlande stadsnamn | ✅ | ❌ | Vi öppnar direkt i din stad (ägarbeslut) |
| "Visa event nära mig" (GPS) | ✅ | ✅ | Hos oss tyst vid start |
| Min plats-knapp | ✅ | ❌ | Dold hos oss (`{false && …}`) |
| Ortväljare med snabbval + sök | ✅ | ✅ | Vi: 291 orter i sök |
| "Hela Sverige"-läge | ✅ | ❌ | |
| Temperatur i stadsplattan | ✅ | ❌ | |
| Temperatur per ort på kartan | ✅ | ❌ | |
| Väder per event | ✅ | ❌ | |
| Prognossida (timme + tio dygn) | ✅ | ❌ | |
| Markörer med kategorifärg + ikon + titel i färg | ✅ | ◐ | Vi: emoji-droppar, kategorinamn från zoom 9, titel från 13 |
| Listläge med dagavdelare | ✅ | ◐ | Vår lista ligger under kortet (Månaden · Populärt) |
| Avstånd till event | ✅ | ✅ | |
| Dag/vecka-väljare | ◐ | ✅ | De har datumfilter; vi dag/vecka-platta + kalender |
| Populärt-filter (🔥) | ❓ | ✅ | |
| Boost-/guldbrickor | ❌ | ✅ | |

### Filter & sök

| Funktion | happymap | Vi | Kommentar |
|---|:---:|:---:|---|
| Kategorifilter | ✅ | ✅ | |
| Flerval av kategorier | ✅ | ❌ | En åt gången hos oss (ägarbeslut 16/9) |
| Antal kategorier | 16 | 11 | De: Nattliv, Karaoke, Film, Quiz, Föreläsningar, Festivaler extra |
| Prisfilter: Gratis | ✅ | ❌ | |
| Prisfilter: maxbelopp | ✅ | ❌ | |
| Datumfilter | ✅ | ✅ | |
| Valda filter som chips i sökfältet + räknare | ✅ | ◐ | Vi: en bricka under dagplattan |
| Fritextsök (titel/plats/arrangör) | ✅ | ✅ | Vi även ort-tolkning "jazz göteborg" |
| "Utforska mer"-nyckelord ur eventet | ✅ | ❌ | |
| Arrangörsfilter | ❓ | ✅ | |
| Opt-in-källor (kyrkan, PRO, Korpen) | ❌ | ✅ | De visar allt rakt av |

### Eventsida / kort

| Funktion | happymap | Vi | Kommentar |
|---|:---:|:---:|---|
| Helsides eventsida | ✅ | ◐ | Vi: bottenark med fyra stopp |
| Bild, tid, plats, beskrivning | ✅ | ✅ | |
| Återkommande: "9 datum till" med navigering | ✅ | ◐ | Vi: serie-etikett, ingen datumnavigering |
| Påminn mig | ✅ | ◐ | Via ♥, kräver konto |
| Arrangörsrad med bild → arrangörssida | ✅ | ◐ | Sidorna finns, kortet länkar inte dit |
| Visa på kartan | ✅ | ✅ | |
| Hitta hit (vägbeskrivning) | ✅ | ❌ | |
| Lägg i kalender | ✅ | ❌ | Död kod finns (`calendarLinks.ts`) |
| Pris | ✅ | ◐ | Vi: text när känt (20 % av eventen) |
| "Pris okänt" öppet | ✅ | ❌ | |
| Mer info-utlänk till källan | ✅ | ✅ | ANMÄL/BOKA |
| Miljö inomhus/utomhus | ✅ | ❌ | |
| "Jag kommer" på alla event | ✅ | ❌ | Vi: anmälan bara för VADKUL-event |
| "Intresserad" | ✅ | ◐ | ♥ gilla/spara |
| Gå tillsammans / "Fråga någon" (inbjudan via delningslänk, svar utan app) | ✅ | ❌ | |
| Vilka kommer / vänner kommer | ✅ | ◐ | Deltagarlista bara för VADKUL-event |
| Kommentarer synliga för alla | ✅ | ◐ | Vår chatt kräver inloggning även för läsning |
| "Mer på <lokal>" | ✅ | ◐ | Multibricka för samma koordinat |
| × "inte intresserad" på kort | ✅ | ❌ | |
| Källa + "kontrollerad idag" | ✅ | ◐ | Härkomstrad finns, ingen kontrollstämpel |
| Dela | ✅ | ✅ | |
| Delningssida med OG-bild per event | ❓ | ✅ | |
| Rapportera event | ❓ | ✅ | Troligen i "…"-menyn hos dem |
| Boosta eventet | ❌ | ✅ | |
| Stjärnmärkning | ❌ | ✅ | |

### Konto & socialt

| Funktion | happymap | Vi | Kommentar |
|---|:---:|:---:|---|
| Konto (e-post/Google) | ✅ | ✅ | Deras inloggningssätt ej sett |
| Utforska utan konto | ✅ | ✅ | |
| Intresseonboarding utan konto | ✅ | ❌ | "Tips för dig" borttagen hos oss |
| Smakprofil / "För dig" / "Tonight for you" | ✅ | ❌ | |
| Vänner + vänförfrågningar | ✅ | ❌ | Firestore-regler finns, ingen UI |
| Nära vänner | ✅ | ❌ | |
| Blockera | ✅ | ❌ | |
| Närvaro "Aktiv nu" | ✅ | ❌ | |
| Inbjudningar till event | ✅ | ❌ | |
| Privata event (bara vänner) | ✅ | ❌ | |
| Häng (spontan träff, vänner ser var du är) | ✅ | ❌ | |
| Planer (gruppbeslut med röstning) | ✅ | ❌ | |
| "Planer"-flik = min agenda | ✅ | ◐ | Sparade event i profilpanelen |
| Gruppchatt / DM | ✅ | ❌ | Eventchatt finns |
| Chatt-flik | ✅ | ❌ | |
| Notisinkorg (förfrågningar, inbjudningar, uppdateringar) | ✅ | ❌ | |
| Push: påminnelse före event | ✅ | ✅ | |
| Push: väderlarm för utomhusplan | ✅ | ❌ | |
| Push: veckans helgtips | ❓ | ✅ | |
| Följ serie / arrangör | ✅ | ❌ | |
| Inbjudningslänk / referral | ✅ | ❌ | Rester i koden |
| Publik profil | ✅ | ❌ | |
| Dela plats med vänner (opt-in) | ✅ | ❌ | |
| Önskningar ("det här vill jag skulle hända") | ❌ | ✅ | |
| Delta/anmäl på VADKUL-event med deltagarlista | ❌ | ✅ | De har anmälan också (se arrangör) |

### Skapa & arrangör

| Funktion | happymap | Vi | Kommentar |
|---|:---:|:---:|---|
| Skapa event | ✅ | ✅ | |
| Skapa Häng | ✅ | ❌ | |
| Event bara för vänner | ✅ | ❌ | |
| Tipsa event utan konto | ❓ | ✅ | |
| Önska event | ❌ | ✅ | |
| Självbetjänad arrangörssida | ✅ | ❌ | Våra genereras ur skrapdata |
| Dubblettkoll mot skrapade arrangörer vid skapande | ✅ | ❌ | |
| Skapa Ställe (lokalsida) | ✅ | ❌ | |
| Platssidor per lokal | ✅ | ❌ | |
| Arrangörssidor | ✅ | ✅ | Vi: 2 000+ |
| QR-affisch | ✅ | ❌ | |
| Webbmärke | ✅ | ❌ | |
| Tipsa om en plats (URL → krypare) | ✅ | ◐ | Vi: tips med länk per event |
| Anmälan först till kvarn | ✅ | ✅ | |
| Ansökningsanmälan med frågor, Ja/Kanske/Nej | ✅ | ❌ | |
| Väntelista | ✅ | ❌ | Regel finns |
| Reducerat pris "i mån av plats" | ✅ | ❌ | |
| Flera tider att välja | ✅ | ❌ | |
| Betalning direkt till arrangör (Swish/kort), 0 avgift | ✅ | ❌ | Planerat (C5) |
| Deltagarlista export | ✅ | ◐ | Lista finns, ingen export |
| Boost (betald framlyftning) | ❌ | ✅ | |
| Biljettaffiliate (Ticketmaster) | ❌ | ✅ | |
| Arrangörsmejl med klickstatistik | ❌ | ✅ | Manuellt hos oss |

### Plattform & positionering

| Funktion | happymap | Vi | Kommentar |
|---|:---:|:---:|---|
| Native iOS-app | ✅ | ❌ | MVP finns i `vadkul-app` |
| Android-app | ❓ | ❌ | De har `/beta` |
| PWA (installbar) | ◐ | ✅ | De har manifest; installprompt ej sett |
| SEO: stadssidor | ✅ | ✅ | 1 156 orter mot 71 |
| SEO: kategorisidor per stad | ✅ | ✅ | |
| SEO: gratis-sidor per stad | ✅ | ❌ | |
| SEO: platssidor | ✅ | ❌ | |
| SEO: arrangörssidor | ✅ | ✅ | |
| Delningsbilder per stad/kategori | ❓ | ✅ | |
| Grannländer | ✅ | ❌ | |
| Egna kart-tiles | ✅ | ◐ | CARTO; pmtiles-reserv finns |
| Mörkt läge i UI | ✅ | ✅ | |
| Tvåspråkig (sv/en) | ✅ | ❌ | |
| "Ideell · noll annonser · noll spårare" | ✅ | ❌ | Vi: Hotjar, Analytics, affiliate, boost |
| Integritetspolicy | ✅ | ◐ | Vår är inaktuell |

### Inte sett än (frågor till Josef)

1. **Planer-fliken** inloggad — hur ser agendan ut, och en plan med röstning?
2. **Chatt-fliken** — trådlista, gruppchatt från "Gå tillsammans".
3. **Upptäck-fliken** — "För dig"/"Tonight for you"-flödet efter intressevalet.
4. **Profilen** — publik profil, smakprofil, inställningar (närvaro, "visa vad jag ska på").
5. **Skapa Häng** — formuläret och hur den syns på kartan för vänner.
6. **Skapa Event** — fälten, "bara vänner", bilduppladdning.
7. **Ställe-sidan** och **arrangörssidan som besökare** (program, QR-affisch, märke).
8. **Mottagarens vy** när man får en "Fråga någon"-länk utan konto.
9. **Inloggningen** — e-post/Google/Apple/magisk länk?
10. **Betalflödet** för ett betal-event (Swish-steget).
11. **Notisinkorgen** och vilka push-notiser som finns (helgtips?).
12. **Veckovy / populärt** — finns något motsvarande 🔥?

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
