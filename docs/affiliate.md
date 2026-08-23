# Affiliate — förarbete (2026-08-24)

Researchunderlag inför affiliate-intäkter. **Inget är byggt ännu** — detta är
beslutsunderlaget + den färdiga tekniska designen, så att aktiveringen är en
eftermiddags arbete när avtalen finns. Grundprincip (ägarbeslut): monetisera
ENDAST länkar användarna ändå klickar på — biljettknappen på eventkortet.
Inga banners, inga off-topic-produkter.

Framtaget via parallell research 2026-08-23/24 (Impact-mekanik, svensk
marknadsföringsjuridik, programinventering, kodbasanalys, intäktskalkyl) med
adversariell faktagranskning av de beslutspåverkande påståendena. Confidence
anges där det spelar roll; ⚠ = kunde inte verifieras publikt.

---

## TL;DR — de fyra sakerna som styr beslutet

1. **Klicken går i dag till Tickster/Nortic — men jämförelsen med TM är
   inte rättvis.** Mätt klickdata (eventStats 16/7–23/8): Tickster 71
   utklick (~4 934 exponerade event), Nortic 55, Billetto 20, Ticketmaster 0
   — men TM hade bara **84 svenska event** exponerade under perioden
   (30-dagarsfönstret; 90-dagarsfönstret med 647 nya kom först 23/8).
   Vid Ticksters klickfrekvens (~1,4 %/event) är förväntansvärdet ~1 klick —
   nollan är brus, ingen gåta. Kvar står ändå: ~86 % av dagens biljettklick
   går till plattformar UTAN publikt program → **direktkontakt med Tickster
   och Nortic är värdefull oavsett**, och TM-spårets potential kan bedömas
   först efter några veckor med det breddade lagret på kartan.
2. **Pengarna är små vid dagens trafik.** ~100 biljettklick/mån ger i bästa
   scenario ~100–200 kr/mån, i troligt scenario ~10–40 kr/mån. Break-even mot
   Firebase-kostnaden (~270 kr/mån) kräver ~8–23× dagens biljettklick.
   Trafiken är spaken — inte provisionen. Wrappningen är dock så billig att
   bygga att den ändå är värd att slå på när avtal finns.
3. **Juridiken är hanterbar men obligatorisk:** varje provisionslänk måste
   märkas "Annons" i direkt anslutning (MFL + RON-praxis), och en kort
   förklaringssida behövs. Ingen cookiebanner-ändring krävs så länge inga
   Impact-skript läggs på vadkul.se.
4. **Tekniken är redan halvbyggd:** id/url-separationen i aggregatet,
   klicktelemetrin (eventStats) och SubId-kandidaten (eventShareSlug) finns.
   Flip-switchen är en per-domän-tabell bredvid `publicUrl()` i
   aggregate-events.ts.

---

## 1. Hur Impact-spårningen fungerar (verifierat mot Impacts docs)

- **Länkformat:** `https://<trackingdomän>/c/<AccountId>/<AdId>/<CampaignId>?u=<procentkodad mål-URL>`.
  För Ticketmaster är trackingdomänen `ticketmaster.evyy.net`. Vårt AccountId
  är **7528311**; AdId/CampaignId fås i Impact-UI:t efter godkännande.
- **Deep links:** appenda `u=encodeURIComponent(kanonisk eventsida)` på
  baslänken → klicket landar på exakt eventsidan. Det betyder att wrappningen
  kan ske **statiskt i aggregeringssteget utan API-anrop**: baslänk + u=.
  (Om deep linking skulle vara avstängt för annonsen failar inte klicket —
  användaren hamnar på defaultsidan.)
- **API finns** för programmatisk länkgenerering om det någonsin behövs:
  `POST https://api.impact.com/Mediapartners/{AccountSID}/Programs/{ProgramId}/TrackingLinks`
  (Basic Auth med AccountSID/AuthToken från kontots API-inställningar; svar
  innehåller `TrackingURL`; max 5 000 vanity-länkar/konto).
- **SubId för mätning:** `?subId1=&subId2=&subId3=` + `sharedId` appendas på
  spårlänken. Endast bokstäver/siffror (slugga å/ä/ö), max 255 tecken. SubId
  syns bara för oss i partnerrapporterna → **subId1 = eventShareSlug** ger
  1:1-join mot vår egen klickdata (se §5).
- **Attribution TM:** 30 dagars fönster, last-click (bekräftat även på TM:s
  egen affiliatesida). Provision ⚠: tredjepartskällor spretar — US-programmet
  uppges vara **flat ~$0.30/order** av en källa, ~1 % av andra; nordiska
  villkor står först i Impact-kontraktet. **Läs kontraktet innan byggtid
  läggs** — flat $0.30 ändrar hela kalkylen.
- **Viktigt undantag (officiellt, TM:s FAQ):** ingen provision på primary-
  försäljning under presale eller **de första 24 h efter public onsale** —
  och nyskrapade "just släppta" event klickas ofta exakt då.
- **Utbetalning:** actions är pending under en locking-period (brandet kan
  reversera vid inställda event/återköp), sedan locked → payout enligt
  kontraktets schema + minsta utbetalningströskel. Exakta perioder: Impact →
  My Brands → Ticketmaster → View and Manage Contract.
- **Godkännande:** ansökan via developer.ticketmaster.com (Affiliate Partner
  Sign Up). Kravbild: "websites and apps capable of bringing distinct and
  unique audiences". Vanliga avslagsskäl (tredjepart): tunn sajt, låg trafik.
  Godkännande ger alla 25 marknader (Sverige inkluderad) med separata
  marknadskontrakt.
- **Avstängningsgrunder:** fejkade klick/konverteringar, cookie-dropping,
  trademark-budgivning ("Ticketmaster" i sökannonser), egna köp via egen
  länk (klassisk termineringsgrund). Inget av detta är relevant för vår
  modell — men dokumenterat så ingen framtida idé råkar bryta.

## 2. Juridik (Sverige)

- **Märkningsplikt:** provisionslänkar är marknadsföring (MFL 9 §; Konsument-
  verket räknar uttryckligen provision som betalt samarbete). Praxis:
  *Kissie-domen* (PMÖD 2019) — reklam ska identifieras "redan vid flyktig
  kontakt", märkning FÖRST/i direkt anslutning, "Annons"/"Reklam" godtas,
  vaga ord underkänns. *RON 1705-104*: omärkta affiliatelänkar i redaktionellt
  utseende **fälldes**. IAB Sveriges branschrekommendation (2024): märk varje
  kommersiell länk + förklaringssida.
- **Vår tillämpning:** märket sitter på eventkortets ANMÄL-knapp när länken
  är wrappad ("Annons"-chip i direkt anslutning), + en sida
  `vadkul.se/annonslankar`: *"Eventen väljs ut oberoende av VADKUL. Vissa
  biljettlänkar (märkta Annons) leder till externa sajter där VADKUL får
  provision vid köp."* Märkningsflaggan följer med från aggregeringen (samma
  ställe som wrappningen) så webben vet exakt vilka kort som ska märkas.
  OBS: IAB-mallens grundlagsresonemang gäller inte oss (inget utgivningsbevis)
  — hela MFL gäller fullt ut, vilket inte ändrar något i praktiken.
- **Cookies/GDPR:** Impact sätter INGA cookies på publisherns sajt — kedjan
  är redirect via deras domän (irclickid → TM sätter förstapartscookies).
  Så länge vi **inte lägger Impact-skript/pixlar på vadkul.se** behöver
  cookiebannern inte ändras och vi blir inte personuppgiftsansvariga för
  spårningen (utlänk ≠ inbäddad resurs à la Fashion ID). Lägg ändå en rad i
  integritetspolicyn om utgående affiliatelänkar — billig transparens.
- **Moms** ⚠: B2B-huvudregeln (beskattas där köparen finns). Öppen fråga:
  vilken enhet blir motpart (Impact US? EU-bolag? TM-enhet?) — syns först på
  self-billing-underlaget; och Skatteverkets "faktisk användning och
  utnyttjande"-regel för marknadsföringstjänster behöver stämmas av före
  första bokförda utbetalningen. Punkt till redovisningen, inte till koden.
- **Sanktionsbild:** RON = publicitet; KO/PMD = förbud vid vite. Märkning är
  billig — gör rätt från start.

## 3. Programkarta (verifierad 2026-08-23)

**Färdiga program, biljetter:**
| Program | Status | Villkor |
|---|---|---|
| Ticketmaster via Impact | **Ansökan pågår** (konto 7528311) | 30 d, last-click; provision ⚠ se kontrakt; 24h-onsale-undantag |
| Tickster | Inget publikt program | **86 % av våra biljettklick ihop med Nortic → direktkontakt värd mest** |
| Nortic | Inget publikt program | ” |
| Billetto | Inget publisher-program (deras "Smart Links" är arrangörsverktyg) | — |
| AXS (SHL) | Inget publikt program (ren B2B) | — |
| Eventbrite | ⚠ Oklart: T&C uppdaterade nov 2025 finns, men ingen öppen signup; FlexOffers-varianten betalar för arrangörsvärvning (fel modell) | Lägg ingen tid |

**Eventnära, självbetjäning (upplevelser/attraktioner — scope-beslut krävs):**
| Program | Provision | Cookie | Anteckning |
|---|---|---|---|
| Viator (Tripadvisor) | 8 % | 30 d | Gratis signup utan trafikkrav; PayPal veckovis utan tröskel. Snabbaste vägen till första kronan |
| GetYourGuide (direkt) | 8 % ⚠(delvis tredjepartssiffror) | 31 d | partner.getyourguide.com, svar 24–48 h; direktprogrammet slår Awin-varianten (7 %) |
| Tiqets (direkt) | marginaldelning, ej publicerad ⚠ | — | Säljer svenska attraktioner (t.ex. Junibacken); via Travelpayouts 8 %/30 d |
| Adtraction (nätverk) | per annonsör | — | Gratis konto. Belagda eventnära: Greatdays, My Perfect Day, Box Experience — **upplevelsepresenter = produktköp, inte event; använd bara där kontexten matchar** |
| Awin (nätverk) | per annonsör | — | 5 GBP återbetalningsbar deposition; SE-katalogen kräver konto för genomsökning |

Scope-rekommendation: Viator/GYG/Tiqets kan motiveras som *eventnära* (guidade
turer och attraktioner är saker man "går på"), men de är ett **medvetet
scope-beslut för ägaren** — de lägger till innehåll, inte bara monetiserar
befintligt. Ticketmaster + Tickster/Nortic-direktspåret rör inte scopet alls.

## 4. Teknisk design (färdig att bygga — men byggs INTE förrän avtal finns)

Kodbasen är redan förberedd; kartläggningen bekräftade:

- **En enda chokepoint för utklick:** `handleVisitSite` i
  `apps/web/src/components/ui/LinkEventCard.tsx` (rad ~231) — båda
  ANMÄL-knapparna går via den, och den anropar redan `recordEventClick`.
  Stadssidor, /e/-delningssidor och sociala inlägg länkar bara till
  vadkul.se → **behöver ingen åtgärd**.
- **Flip-switchen:** en per-domän-tabell bredvid `publicUrl()` i
  `apps/scraper/src/scripts/aggregate-events.ts`:
  `AFFILIATE_WRAP: Record<domän, (cleanUrl, subId) => trackingUrl>` som fylls
  i med den riktiga Impact-baslänken vid aktivering. `id`-fältet (rå kanonisk
  URL, rad ~115) rörs ALDRIG — det bär share-slugs och descriptions-nycklar.
- **Wrappa i separat fält:** lägg wrappad länk som **`outUrl`** bredvid `url`
  i cards-lagret (i stället för att ersätta `url`): favicon-rendering,
  källklassningen (`utils/sources.ts`) och `domain`-fältet i klickstatistiken
  läser alla värddomänen ur `url` och skulle gå sönder av en
  evyy.net-redirect. Webben använder `outUrl ?? url` i `handleVisitSite` +
  visar "Annons"-märket när `outUrl` finns. Kalenderexporten
  (`utils/calendarLinks.ts`) fortsätter läsa `url` → kanoniska länkar i
  folks kalendrar (medvetet beslut).
- **SubId = `eventShareSlug(id)`:** 16 hex, stabil, redan doc-id i
  `eventStats` → Impacts "Performance by Sub ID" kan joinas 1:1 mot vår egen
  klickdata utan ny telemetri. Slug-funktionen måste kopieras till scrapern
  (webbens utils importeras inte därifrån) — **`eventShareSlug.test.ts` är
  GULDTEST, algoritmen får aldrig ändras**.
- **Mätning:** eventStats loggar redan views (25 777 sedan 12/7) och utklick
  (461 sedan 16/7, CTR ~1,8 %) med domän. Vid aktivering: lägg
  `clicksWrapped`-räknare i `recordEventClick` så vår klickvolym kan stämmas
  av mot Impacts klickrapport (diff = adblockers/bortfall).
- **Tester i samma veva:** `publicUrl` saknar i dag enhetstester (lucka mot
  CLAUDE.md-regeln). Wrap-steget ska testas: TM-länk wrappas med rätt subId;
  övriga domäner orörda; `id` identiskt före/efter; gamla 8469859-parametrar
  strippas fortfarande.
- **Kända medvetna hål:** (a) användarskapade event läses live utanför
  aggregatet och wrappas inte (rätt i v1 — tips är inte kuraterat innehåll);
  (b) 99 historiska evyy.net-URL:er ligger som primärnycklar i DB (4 framtida
  synliga) — de åldras ut; rör dem inte (PK/slug-risk), `publicUrl` packar
  redan upp dem i utkanten.

## 5. Intäktskalkyl (mätt 2026-08-23, antaganden explicita)

Utbud: 35 520 framtida synliga event varav biljettplattformar 8,2 %
(Tickster 1 265, TM 692 — varav bara ~30 % .se, Nortic 614, Billetto 332).
Mätta utklick: ~100–115 biljettklick/mån; biljettplattformarna får 32 % av
alla utklick från 8,2 % av utbudet (4× överrepresenterade = köpintention
finns).

Tratt (EPC = konvertering × provision/order; ordervärde ~400 kr enligt
Svensk Lives 2025-data, konvertering 1–5 % antaget):
- **Låg** (TM flat $0.30, 1 % konv): ~0,03 kr/klick → **~3 kr/mån**
- **Medel** (1–3 % provision, 3 % konv): ~0,12–0,36 kr/klick → **~12–36 kr/mån**
- **Hög** (5 % provision, 5 % konv): ~1–2 kr/klick → **~100–200 kr/mån**

Alla scenarier förutsätter att de klickade destinationerna är affilierade —
i dag är det 0 % (TM får inga klick; Tickster/Nortic saknar program).
Break-even mot Firebase (~270 kr/mån) kräver ~8–23× dagens biljettklick i
medelscenariot. **Slutsats: trafiktillväxt är förutsättningen; affiliate är
en gratis option att montera, inte en intäktsplan i sig.**

OBS (korrigerat 2026-08-24): TM:s nolla i klickdatan är INTE en gåta —
under mätperioden var bara 84 svenska TM-event exponerade (förväntansvärde
~1 klick vid Ticksters frekvens), och 647 av dagens 692 kom in 23/8 med det
breddade fönstret. Mät om efter ~4 veckor med nya lagret innan TM-spårets
klickpotential döms. .dk/.no-lagret (~65 % av TM-eventen) är INTE död vikt:
programmet onboardar alla marknader med separata kontrakt (DK/NO inkluderade),
så danska/norska klick blir också provisionsgrundande — och geografiskt är de
relevanta (Köpenhamn 30 min från Malmö/Lund; norska gränsstäder). Wrap-tabellen
i §4 ska därför täcka ticketmaster.se/.dk/.no från start, med respektive
marknadskontrakts baslänk om Impact skiljer dem åt (kontrollera vid onboarding
om AdId/CampaignId är per marknad).

## 6. Aktiveringsplan (när Impact-godkännandet kommer)

1. Läs Ticketmaster-kontraktet i Impact: provisionsmodell (flat vs %),
   giltiga marknader/TLD:er, locking/payout-schema. **Avbryt om flat $0.30 —
   omprioritera till Tickster-direktspåret.**
2. Hämta AdId/CampaignId + bekräfta att deep linking är aktivt; bygg
   baslänken; testa ett manuellt klick → syns det i Impact-rapporten?
3. Bygg enligt §4 (wrap-tabell + outUrl + subId + tester) — uppskattat en
   eftermiddag. Kör aggregatet, verifiera 0 påverkan på id/slugs
   (guldtestet) + webbens tsc/tester.
4. Webben: "Annons"-chip vid knappen + `vadkul.se/annonslankar` +
   integritetspolicy-rad. (Frontend = MacBookens domän per arbetsdelningen.)
5. Mät 30 dagar: subId-rapport vs eventStats.clicksWrapped; först därefter
   beslut om Viator/GYG/Tiqets-scopet.

Parallellt, oberoende av Impact: **direktmejl till Tickster och Nortic** om
provisions-/partneravtal (samma mall som Everysport-mejlet; vi kan visa
faktiska klicksiffror ur eventStats).

## Öppna frågor
- TM-kontraktets provisionsmodell för Norden (avgör allt) ⚠
- Momsmotpart + "användning och utnyttjande"-frågan (Skatteverket) ⚠
- Kräver TM-kontraktet FTC-stil disclosure utöver svensk märkning? ⚠
- TM-klickfrekvens med nya 90d-lagret — mät om ~20/9 (fönstret breddades 23/8)
- Awins SE-katalog inifrån: finns bio/nöjesparker där? (kräver konto)
