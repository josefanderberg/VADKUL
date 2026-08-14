# PUBLICERINGSKONSOL /admin/outreach — implementationsplan

## 0. Ramar som planen är byggd inom (ur Facebook-faktan)

Dessa fem beslut styr hela arkitekturen och får inte förhandlas bort senare:

| Beslut | Grund |
|---|---|
| **Grupp-postning är och förblir 100 % manuell.** Konsolen genererar text, öppnar gruppen och loggar — den postar aldrig. | Groups API borttagen efter v3.2, `/docs/features-reference/groups-api/` 301:ar till dödsattesten, noll grupp-permissions i `/docs/permissions`. Ingen betal-, partner- eller whitelistväg finns. |
| **Ingen kod, inget UI och inget fält får handla om Facebook-EVENT.** | `/docs/graph-api/reference/event/`: Creating/Updating/Deleting = "You can't perform this operation on this endpoint", och Marketing-Partner-gate. `pages_events` är konverteringshändelser, inte event. |
| **Endast FB-SIDAN automatiseras** — `POST /v25.0/{page-id}/feed`, `message` + `link`, schemaläggning **10 min–30 dygn** (bygg mot 30, inte 75). Permissions: exakt `pages_manage_posts` + `pages_read_engagement` + `pages_show_list`. | `/docs/pages-api/posts/` + `/docs/graph-api/reference/page/feed/`. `pages_manage_engagement` behövs inte; `pages_read_user_engagement` existerar inte. |
| **Ingen stadssegmentering via `feed_targeting`.** Fältet är en ranking-preferens ("more likely… may still see it anyway"), inte ett filter. Stadsstyrningen sker genom *vilken grupp* och *vilken länk*, aldrig genom targeting. | `/page/feed`-referensen. |
| **Varje regel i motorn bär ett `evidence`-fält.** `'meta'` (förstahandsbelagd) vs `'husregel'` (obelagd men klok). Frekvenstaken 2–3/dag, "aldrig identisk copy-paste", "aldrig URL-shortener", "backa vid call_count > 80" är **husregler** och ska visas som sådana i UI:t — de får varna, aldrig hårdblockera. | Metas dokument innehåller inga frekvenssiffror; demote-punkten om copy-paste gäller *kommentarer*, inte inlägg. |

Två åtgärder utanför koden som planen förutsätter (skriv in dem som checklistrader i konsolens FB-sida-panel, etapp 5):
1. **Domänverifiera `vadkul.se` i Meta Business Manager** och koppla till sidan — annars går rubrik/bild på länkinlägg inte att styra, och `ownership_permissions{can_customize_link_posts}` måste anropas *före* varje ny länk.
2. **Egen VADKUL-grupp** är den enda äkta grupp-automatiseringen som finns (Admin Assist → recurring post, sidan kan vara admin för upp till 200 grupper). Den sätts upp manuellt i FB; konsolen håller bara *innehållet* till den.

Och en varning som ska stå i konsolen om egen grupp startas: **"If you manage a group, we may also count violations you approve as strikes against that group."** Att godkänna någon annans regelbrytande inlägg ger *er* grupp en strike.

---

## 1. Filstruktur

### Nya filer

```
apps/web/src/types/outreach.ts                                  ← alla typer + enums (delas server/klient)
apps/web/src/lib/outreach/hash.ts                               ← FNV-1a-textfingeravtryck + trigram-likhet
apps/web/src/lib/outreach/rules.ts                              ← regelmotorn (mognad, tak, kollisioner, varningar)
apps/web/src/lib/outreach/scoring.ts                            ← priorityScore + förklaringssträngar
apps/web/src/lib/outreach/eventPicker.ts                        ← plocka RIKTIGA event för en ort (server-only)
apps/web/src/lib/outreach/draftGenerator.ts                     ← Claude-motorn + persistDraft (delas av ✨ och cronen)
apps/web/src/lib/outreach/planner.ts                            ← delningskön: urval, färskvara, dubblettflagg
apps/web/src/lib/outreach/cronAuth.ts                           ← delad hemlighet för maskinanrop (plan/ready)
apps/web/src/lib/outreach/templates.ts                          ← mallvarianter A/B/C/D + Östersund + tipsfrågan
apps/web/src/lib/outreach/linkTarget.ts                         ← härledd länk + UTM + ref-parameter
apps/web/src/lib/outreach/repo.ts                               ← Admin-SDK-CRUD mot outreach*-collections

apps/web/src/app/api/admin/outreach/queue/route.ts              ← GET  kö + dagens kvot
apps/web/src/app/api/admin/outreach/draft/route.ts              ← POST generera + spara utkast för EN grupp
apps/web/src/app/api/admin/outreach/plan/route.ts               ← POST morgonkörningen: dagens sats utkast
apps/web/src/app/api/admin/outreach/ready/route.ts              ← GET  delningskön (färska + inaktuella)
apps/web/src/app/api/admin/outreach/log/route.ts                ← POST bekräfta postat · PATCH utfall/engagemang
apps/web/src/app/api/admin/outreach/contacts/route.ts           ← GET/PATCH kontaktfält (memberCount, postingMode…)
apps/web/src/app/api/admin/outreach/stats/route.ts              ← GET aggregerad statistik
apps/web/src/app/api/admin/outreach/notes/route.ts              ← GET/PATCH Claude-anteckningar (anta/förkasta)
apps/web/src/app/api/admin/outreach/page-post/route.ts          ← POST publicera/schemalägg på FB-SIDAN (etapp 5)
apps/web/src/app/api/outreach/hit/route.ts                      ← PUBLIK klick-beacon (ingen auth, ingen PII)

apps/web/src/app/(v1)/admin/outreach/page.tsx                   ← force-dynamic wrapper
apps/web/src/app/(v1)/admin/outreach/OutreachConsole.tsx        ← skal + flikar
apps/web/src/app/(v1)/admin/outreach/panels/TodayPanel.tsx
apps/web/src/app/(v1)/admin/outreach/panels/QueuePanel.tsx
apps/web/src/app/(v1)/admin/outreach/panels/SharePanel.tsx      ← "Att dela": dagens färdiga inlägg
apps/web/src/app/(v1)/admin/outreach/panels/CopyButton.tsx      ← delad kopiera-knapp
apps/web/src/app/(v1)/admin/outreach/panels/DraftPanel.tsx
apps/web/src/app/(v1)/admin/outreach/panels/LogPanel.tsx
apps/web/src/app/(v1)/admin/outreach/panels/StatsPanel.tsx
apps/web/src/app/(v1)/admin/outreach/panels/NotesPanel.tsx
apps/web/src/app/(v1)/admin/outreach/panels/PagePanel.tsx       ← etapp 5
apps/web/src/components/ui/OutreachBeacon.tsx                   ← läser ?ref= och pingar /api/outreach/hit

apps/scraper/src/scripts/import-outreach-md.ts                  ← ENGÅNGSIMPORT ur md-filerna
apps/scraper/src/scripts/outreach-brief.ts                      ← Claude-anteckningar (nattlig/manuell)
apps/scraper/src/scripts/outreach-star-tally.ts                 ← users-svep på starGiftCode → outreachStats
```

### Ändrade filer

```
/Users/josefanderberg/source/VADKUL/infra/firebase/firestore.rules
    → nya regler 19–21 (se §3). KRÄVER MANUELL DEPLOY.

/Users/josefanderberg/source/VADKUL/infra/firebase/firestore.indexes.json
    → två index (se §3).

/Users/josefanderberg/source/VADKUL/apps/web/src/lib/firestore-admin.ts
    → requireAdmin (rad 107-109) får samma e-postkortslutning som firestore.rules:25.
      Detta LÖSER gate-glappet utan att ägaren måste sätta isAdmin manuellt:

        const email = decoded.email ?? '';
        const snap  = await getAdminDb().collection('users').doc(decoded.uid).get();
        const ok    = email === 'admin@admin.com' || snap.data()?.isAdmin === true;
        if (!ok) return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };

      (Sätt ändå isAdmin:true på ägarens users-dokument — regel 8 rad 213-214 i firestore.rules
       kollar FÄLTET, inte funktionen, så scrapade linkEvents kräver det.)

/Users/josefanderberg/source/VADKUL/apps/web/src/app/(v1)/admin/AdminClient.tsx
    → länkkort "Publiceringskonsol →/admin/outreach" ovanför Eventrapporter.
      Återanvänd Shell/Section/Empty (rad 194-221) i konsolen.

/Users/josefanderberg/source/VADKUL/apps/web/src/app/(v1)/evenemang/[stad]/page.tsx
/Users/josefanderberg/source/VADKUL/apps/web/src/app/(v2)/layout.tsx
    → montera <OutreachBeacon /> (klientkomponent, Suspense-wrappad pga useSearchParams).
      Sidorna förblir force-static — beaconen körs i browsern.

/Users/josefanderberg/source/VADKUL/docs/outreach/*.md
    → efter verifierad import: flyttas till docs/outreach/ARCHIVE/ med header
      "FRUSEN 2026-07-XX — sanningen bor nu i Firestore/admin-konsolen. Redigera inte."
      facebook-grupplista.md, facebook-grupper.md, arrangorer.md, medlemsmejl.md.
      README.md, mail-mallar.md, facebook-poster.md STANNAR (de är mallar/metod, inte data).
```

---

## 2. Firestore-schema

Tre collections. Alla är **server-only** — klienten når dem bara via API-routes bakom `requireAdmin`. Det följer samma princip som `aggregatedEvents` (rules rad 294-297) och undviker att återskapa egress-problemet.

### 2.1 `outreachContacts/{id}`

`id` = slug av det ordagranna namnet (FB-grupp) eller av `orgName` (arrangör). Likalydande gruppnamn ⇒ separata dokument, aldrig sammanslagning.

```ts
// apps/web/src/types/outreach.ts
export type OutreachKind = 'fb-grupp' | 'arrangor' | 'medlemslista';
export type PostingMode  = 'approval' | 'direct' | 'unknown';
export type ContactStatus = 'orörd' | 'utkast' | 'postad' | 'väntar-godkännande'
                          | 'borttagen' | 'avskriven';

export interface OutreachContact {
  id: string;
  kind: OutreachKind;

  /* --- identitet --- */
  name: string;                 // ORDAGRANT gruppnamn / arrangörsnamn (unikhetsnyckel)
  listNumber?: number;          // 1–83, spårbarhet mot facebook-grupplista.md
  city?: string;                // "Byske", "Halmstad", "Åmål/Säffle"
  citySlug?: string | null;     // 'halmstad' | 'goteborg' | null
  hasCityPage: boolean;         // true bara för de 31 med /evenemang/<slug>
  lat?: number; lng?: number;   // ← NYCKELFÄLT: gör att även de 60 orterna utan
  radiusKm?: number;            //   stadssida kan få RIKTIGA lokala event i utkastet
  groupUrl?: string;            // FB-URL — konsolens "Öppna gruppen"-knapp
  memberCount?: number;         // fylls i manuellt, driver priorityScore

  /* --- publiceringsregler --- */
  postingMode: PostingMode;     // STYR länkplaceringen (approval→i inlägget, direct→kommentar)
  groupRulesNote?: string;      // "annonsera endast onsdagar"
  allowedWeekdays?: number[];   // 0–6, tolkad ur groupRulesNote; tom = alla
  linkAllowed: boolean;         // false ⇒ mallen byter till "googla vadkul"
  joinedGroupAt?: Timestamp;    // driver NY MEDLEM-varningen
  isBigGroup?: boolean;
  moderationRisk?: 'låg' | 'medel' | 'hög';
  doNotPost: boolean;

  /* --- historik (denormaliserad från outreachLog) --- */
  lastPostedAt?: Timestamp;
  nextAllowedAt?: Timestamp;    // = lastPostedAt + 21 d, skrivs vid bekräftad postning
  postCount: number;
  lastOutcome?: LogOutcome;
  usedVariants: string[];       // 'B' får förekomma EXAKT en gång
  status: ContactStatus;

  /* --- ranking --- */
  eventSupplyThisWeek?: number; // cachad, skrivs om av kö-routen vid varje anrop
  eventSupplyAt?: Timestamp;
  priorityScore?: number;

  /* --- arrangörsspecifikt (kind==='arrangor') --- */
  orgName?: string;
  eventCount?: number;          // 355, 177, 174 …
  cities?: string[];
  domain?: string;              // abf.se
  email?: string;
  emailSourceNote?: string;
  prio?: 1 | 2 | 3;
  exampleEvents?: { title: string; time?: string }[];
  replyStatus?: 'inget svar' | 'svar' | 'nej';
  linkUrl?: string;             // MÅLRADEN: den publicerade inlänken
  clicksSent?: number;          // summerat ur eventStats per hostName/domain
  followUpDueAt?: Timestamp;    // skickat + 7–10 d
  bounced?: boolean;

  /* --- admin-DM (0 loggade idag; prio 1-metoden sedan 18/7) --- */
  adminName?: string;
  adminProfileUrl?: string;
  adminDmStatus?: 'ej kontaktad' | 'DM skickad' | 'ja' | 'nej' | 'inget svar';
  adminDmSentAt?: Timestamp;
  adminDmNote?: string;

  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**Härledda fält beräknas i `lib/outreach/`, lagras inte:** `linkTarget` (via `hasCityPage`), `priorityScore` (cachas men räknas alltid om), `isMature`.

### 2.2 `outreachLog/{autoId}`

**En rad per publiceringsförsök.** Utkast och postning är samma dokument i olika status — det är precis vad 23/7-förvirringen kräver: `draftCreatedAt` och `postedAt` är separata fält på samma rad, och `confirmedByOwner` är grinden mellan dem.

```ts
export type LogChannel = 'fb-grupp' | 'fb-sida' | 'email' | 'messenger-dm' | 'admin-dm' | 'campaign';
export type LogStatus  = 'utkast' | 'postat-obekräftat' | 'postat' | 'i-godkännandekö'
                       | 'godkänt-uppe' | 'borttagen' | 'nekad' | 'okänt';
export type LogOutcome = 'publicerat-direkt' | 'krävde-godkännande' | 'godkänt-uppe'
                       | 'borttagen' | 'nekad' | 'okänt';
export type LinkPlacement = 'i-inlägget' | 'i-första-kommentaren' | 'ingen-länk';
export type StarCode = 'STJARNA1' | 'ARRANGOR1' | 'MEDLEM1' | null;

export interface OutreachLogEntry {
  id: string;
  contactId: string;
  contactName: string;          // denormaliserat ORDAGRANT
  channel: LogChannel;

  /* --- loggregeln --- */
  draftCreatedAt: Timestamp;
  postedAt?: Timestamp;
  confirmedByOwner: boolean;    // status blir 'postat' FÖRST när denna är true
  status: LogStatus;

  /* --- innehållet --- */
  variant: string;              // 'A' | 'B' | 'C' | 'D' | 'ostersund' | 'tipsfragan' | '25/7-V1' …
  bodyText: string;             // hela texten (behövs för copy-paste-kontrollen)
  bodyHash: string;             // 16 hex, FNV-1a — duplikatspärr mot andra grupper
  firstCommentText?: string;
  linkPlacement: LinkPlacement;
  linkUrl?: string;
  starCode: StarCode;           // sätts AUTOMATISKT av kanal, aldrig fritt valbar
  starLinkIncluded: boolean;
  utmSource?: string;           // 'facebook'
  utmCampaign?: string;         // 'grupper-v02'
  refId?: string;               // = detta dokuments id; klick-beaconens nyckel

  /* --- färskvaran --- */
  mentionedEvents: { eventId: string; title: string; timeISO: string; emoji?: string }[];
  eventCountClaimed?: number;   // siffran i texten ("över 300 event")
  eventsDataFetchedAt: Timestamp;
  earliestMentionedEventISO?: string;  // måste > postedAt i approval-grupper
  filteredCategories?: string[];       // ['bio']

  /* --- utfall --- */
  outcome: LogOutcome;
  outcomeCheckedAt?: Timestamp; // null ⇒ konsolen påminner (5 av 20 står kvar på '?')
  approvalReleasedAt?: Timestamp;
  removedAt?: Timestamp;

  /* --- mätning --- */
  likes?: number; comments?: number; shares?: number;
  engagementCheckedAt?: Timestamp;
  ownRepliesCount?: number;     // regeln "svara på varenda kommentar första dygnet"
  clicksFromPost: number;       // ökas av /api/outreach/hit
  clicksByDay?: Record<string, number>;

  /* --- mejlspecifikt --- */
  subjectLine?: string;
  followUpAt?: Timestamp;
  bounced?: boolean;
  fallbackNote?: string;

  /* --- FB-sidan (etapp 5) --- */
  fbPostId?: string;            // "{page-id}_{post-id}" — krävs för update/delete
  fbScheduledPublishTime?: number;   // unix-sek, 10 min–30 dygn
  fbCreatedByThisApp: boolean;  // "An app can only update a Page post if the post was made using that app."
  fbBucUsagePct?: number;       // ur X-Business-Use-Case-Usage.call_count

  nextAllowedAt?: Timestamp;    // denormaliserat postedAt + 21 d
  notes?: string;
  importedFrom?: string;        // 'facebook-grupplista.md#rad12' — spårbarhet
}
```

### 2.3 `outreachNotes/{autoId}` — Claudes anteckningar

```ts
export interface OutreachNote {
  id: string;
  kind: 'insikt' | 'regelförslag' | 'mallförbättring' | 'varning';
  title: string;                 // "Länk i kommentar korrelerar med direktpublicering"
  body: string;                  // Claudes text, svenska
  basedOnLogIds: string[];       // exakt vilka rader den läste — spårbarhet
  sampleSize: number;            // n. UI visar "n=4" och gråar ut slutsatser vid n<5
  confidence: 'låg' | 'medel' | 'hög';
  status: 'förslag' | 'antagen' | 'förkastad';
  appliesTo?: { variant?: string; citySlug?: string; postingMode?: PostingMode };
  model: string;                 // 'claude-opus-5'
  createdAt: Timestamp;
  decidedAt?: Timestamp;
}
```

**Antagna anteckningar är inte dekoration** — `outreachNotes` med `status:'antagen'` läses av `/api/admin/outreach/draft` och skickas in som constraint-lista till mallgeneratorn. Det är den konkreta mekaniken bakom "den ser till att jag har mitt innehåll".

---

## 3. firestore.rules + index

### Tillägg till `/Users/josefanderberg/source/VADKUL/infra/firebase/firestore.rules`

Läggs sist, före den stängande `}` (efter regel 18, rad 439):

```
    // 19. OUTREACH-KONTAKTER (FB-grupper, arrangörer, medlemslistan)
    // 20. OUTREACH-LOGG (varje publiceringsförsök)
    // 21. OUTREACH-ANTECKNINGAR (Claudes insikter)
    //
    // HELT STÄNGDA för klienter — exakt samma modell som aggregatedEvents (regel 10).
    // All läsning och skrivning går via /api/admin/outreach/* med Admin SDK bakom
    // requireAdmin(). Anledningar: (a) datan innehåller adminnamn, mejladresser och
    // hela inläggstexter som inte ska ligga publikt, (b) en öppen list-query på 83+
    // dokument från varje admin-sidladdning återskapar egress-mönstret från juli,
    // (c) shape-låsning i rules skulle behöva ~120 rader för fält vi ändå bara
    // skriver server-side. Firebase Console kringgår reglerna, så manuell
    // inspektion fungerar fortfarande.
    match /outreachContacts/{docId} { allow read, write: if false; }
    match /outreachLog/{docId}      { allow read, write: if false; }
    match /outreachNotes/{docId}    { allow read, write: if false; }
```

> **`firebase deploy --only firestore:rules` måste köras manuellt.** Före deploy returnerar API-routerna ändå rätt data (Admin SDK kringgår reglerna) — men klientkod som av misstag läser direkt skulle få tyst tillgång. Deploya reglerna i samma svep som etapp 1.

### Tillägg till `firestore.indexes.json`

`clicksFromPost` uppdateras ofta; övriga queries är små. Endast två index behövs:

```json
{ "collectionGroup": "outreachLog", "queryScope": "COLLECTION", "fields": [
    { "fieldPath": "contactId", "order": "ASCENDING" },
    { "fieldPath": "draftCreatedAt", "order": "DESCENDING" } ], "density": "SPARSE_ALL" },
{ "collectionGroup": "outreachLog", "queryScope": "COLLECTION", "fields": [
    { "fieldPath": "channel", "order": "ASCENDING" },
    { "fieldPath": "postedAt", "order": "DESCENDING" } ], "density": "SPARSE_ALL" }
```

---

## 4. Engångsimport — `apps/scraper/src/scripts/import-outreach-md.ts`

Körs med `--dry-run` först, sedan `--commit`. Idempotent (`set({merge:true})` på deterministiska id:n) så den kan köras om utan dubbletter.

**Källor och parsning:**

| Källa | Rader | Vad som extraheras |
|---|---|---|
| `docs/outreach/facebook-grupplista.md` | 83 pipe-rader `\| # \| Grupp \| Länk \| Postat · metod · utfall \|` | Ett `outreachContacts`-dokument per rad. `hasCityPage` = `Länk`-kolumnen börjar med `/evenemang/`. `citySlug` = resten. Postat-kolumnen splittas på ` · ` → datum (`17/7` → `2026-07-17`), metod (`länk i inlägg` / `länk i kommentar` → `linkPlacement`), utfall (`BORTTAGEN`/`publicerat direkt`/`KRÄVDE GODKÄNNANDE`/`?`), plus fetstil-svansen `**26 likes, 15 komm., 1 delning**` → likes/comments/shares. Icke-tom postat-kolumn ⇒ även en `outreachLog`-rad. |
| `docs/outreach/facebook-grupper.md` | loggtabellen rad 68–88 + `## N. <Grupp>`-avsnitten (rad 92+) och `### A–G` (rad 346–570) | Fyller på loggraderna med **bodyText** (kodblocken under respektive rubrik), variant, `nextAllowedAt` och `notes`. Matchas mot masterlistan på normaliserat gruppnamn med manuell aliastabell i skriptet för de fem som skiljer sig: `"Vad händer i Tierp kommun (utan s — exakta gruppen)"`→`"Vad händer i Tierp kommun"`, `"Halmstad-grupp 1 (Vad händer i stan m. omnejd)"`→`"Halmstad - Vad händer i stan med omnejd"`, `"Halmstad-grupp 2 (Vad händer i Halmstad?)"`→`"Vad händer i Halmstad?"`, `"Vad händer i Gränna (grupp)"`→`"Vad händer i Gränna"`, `"Vad händer i Tierps kommun?"` (rubrik 6). |
| samma fil, löptext | Borås/Kalmar/Uppsala/Gävle 23/7 | **Saknas i loggtabellen.** Hårdkoda dessa fyra i en `MANUAL_23_7`-array i skriptet med kommentar om varför. 16 + 4 = 20, vilket ska matcha masterlistan — skriptet **assertar** det och avbryter annars. |
| `docs/outreach/arrangorer.md` | 120 `- [ ]/[x] **Namn** — N event · städer · \`domän\` · mall` + följerad `t.ex. _X_ · _Y_ · skickat: · svar: · länk:` | 120 `outreachContacts` med `kind:'arrangor'`, `prio` av vilket `## Prio N`-avsnitt raden ligger under. `[x]` + `skickat: 2026-07-17` ⇒ `outreachLog`-rad med `channel:'email'`, `confirmedByOwner:true`, `followUpAt = skickat + 8 d` (samtliga 10 är förfallna → hamnar direkt i "Att göra idag"). |
| `docs/outreach/medlemsmejl.md` | — | Ett kontaktdokument `kind:'medlemslista'`, 137 mottagare, `starCode:'MEDLEM1'`, status blockerad. Ingen PII importeras — medlemmar-*.csv är gitignorad och ska så förbli. |

**Fält som inte finns i md-filerna och därför blir tomma:** `groupUrl`, `memberCount`, `lat/lng`, `adminName`. Skriptet skriver en fil `docs/outreach/ARCHIVE/att-fylla-i.md` med de 83 raderna och tomma kolumner — konsolens kö-vy markerar dessa grupper med ⚠ "saknar koordinat: kan inte generera lokala event" resp. "saknar URL". Att fylla i `lat/lng` för de 60 orterna utan stadssida är den enskilt största kvalitetshöjaren för utkasten och kan göras inkrementellt direkt i konsolen (`PATCH /api/admin/outreach/contacts`).

**Verifieringssteg innan md-filerna arkiveras** (skriptets `--verify`): 83 kontakter, 20 loggrader med `confirmedByOwner:true`, 13 `linkPlacement:'i-inlägget'` / 7 `'i-första-kommentaren'`, 7 med `starLinkIncluded:true`, 3 `'borttagen'`, 8 `'publicerat-direkt'`, 3 `'krävde-godkännande'`, 1 `'godkänt-uppe'`, 5 `'okänt'`, summa 52 likes / 25 kommentarer / 1 delning, 120 arrangörer varav 10 skickade. Stämmer siffrorna inte: avbryt, arkivera ingenting.

---

## 5. Kö-vyn — vilka grupper är mogna idag

### `lib/outreach/rules.ts`

```ts
export interface Gate { id: string; ok: boolean; label: string;
                        evidence: 'meta' | 'husregel'; hard: boolean }

export function gatesFor(c: OutreachContact, ctx: DayContext): Gate[]
```

| Grind | Villkor | hard | evidence |
|---|---|---|---|
| `karens` | `!nextAllowedAt \|\| nextAllowedAt <= idag` | ✔ blockerar | husregel (3-veckorsregeln är egen disciplin) |
| `doNotPost` | `!c.doNotPost` | ✔ | — (eget beslut efter borttagning) |
| `dagstak` | `ctx.postedToday < 3` | ✖ varnar från 2, rödmarkerar vid 3 | husregel — **inga frekvenssiffror finns hos Meta** |
| `stadskrock` | ingen annan postning i samma `city` senaste 7 dagarna | ✖ varnar | husregel |
| `veckodag` | `allowedWeekdays` tom eller innehåller idag | ✔ | gruppens egna regler ("annonsera endast onsdagar") |
| `nymedlem` | `joinedGroupAt` äldre än 5 dygn | ✖ varnar | husregel (Borås-noten) |
| `variantB` | `!usedVariants.includes('B')` — annars är B utgråad | ✔ på just variant B | eget beslut |
| `admin-dm-tak` | `ctx.dmsSentToday < 5` | ✖ varnar | husregel |
| `strikevarning` | `moderationRisk === 'hög'` ⇒ tipsa om admin-DM först | ✖ | delvis meta (strikes räknas mot sida/grupp) |

`DayContext` byggs i `/api/admin/outreach/queue` med tre små queries mot `outreachLog` (idag, senaste 7 d, admin-DM idag).

### `lib/outreach/scoring.ts` — förväntat värde

Urvalsregeln i dokumenten är entydig: **utbudet driver reaktionen** (Helsingborg 305 event → 26 likes; Karlstad 98 → 5). Därför dominerar eventutbudet:

```
priorityScore =
    0.50 * norm(eventSupplyThisWeek, 0..400)     // utbudet – den bevisade drivaren
  + 0.20 * norm(memberCount, 0..20000)           // räckvidd (saknas ⇒ 0.5 neutralt)
  + 0.12 * (status === 'orörd' ? 1 : 0)          // 63 av 83 är orörda
  + 0.10 * cityPageBonus                         // 1.0 om hasCityPage (djuplänk = bättre landning)
  + 0.08 * historyBonus                          // 1.0 direkt-publicerande, 0.5 okänd, 0 approval
  − 0.15 * riskPenalty                           // moderationRisk hög + isBigGroup utan admin-DM
```

`scoring.ts` returnerar också en **förklaringssträng** som visas i kortet: *"305 event denna vecka · orörd · egen stadssida · publicerar direkt"*. Ägaren ska aldrig behöva gissa varför en grupp ligger överst.

`eventSupplyThisWeek` beräknas live i kö-routen via `eventPicker.countForContact(c)` och cachas på kontakten (`eventSupplyAt`) i 6 h.

### UI: `TodayPanel.tsx` + `QueuePanel.tsx`

**Att göra idag** överst — en handlingslista, inte en tabell:
- `Dagens kvot: 1 av 3 postade · 0 av 5 admin-DM` (husregel-badge)
- **Följ upp** — loggrader med `postedAt` ≥ 24 h sedan och `outcomeCheckedAt == null` (de 5 kroniska `?`-raderna) och rader med `engagementCheckedAt == null`.
- **Släpp-kollen** — `status:'i-godkännandekö'` äldre än 24 h (Eskilstuna 24/7).
- **Mejluppföljning förfallen** — 10 arrangörer sedan ~24–27/7. En uppföljning, sedan släpp.
- **Svara på kommentarer** — rader postade < 24 h med `comments > ownRepliesCount`.

**Kön** under: kort sorterade på `priorityScore` desc, filtrerat på `gatesFor(...).every(g => !g.hard || g.ok)`. Varje kort: gruppnamn (ordagrant), ort, utbudssiffra, medlemsantal, `postingMode`-badge som säger vilken länkplacering som blir vald, mjuka varningar, och två knappar: **Skapa utkast** och **Öppna gruppen** (`groupUrl`). En "Visa blockerade (N)"-toggle visar de spärrade med nedräkning till `nextAllowedAt`.

---

## 6. Utkast med riktiga event

### `lib/outreach/eventPicker.ts` (server-only, Admin SDK)

```ts
export async function pickEventsForContact(c, opts): Promise<PickedEvents>
```

1. **Hämta live-data, inte deploy-snapshoten.** `cityData.ts` läser `public/*.json` (kommentaren rad 4-7 säger det rakt ut) och är modul-cachead — fel för en konsol som ska räkna om vid postningstillfället. Läs i stället `aggregatedEvents` direkt med `getAdminDb()` enligt samma mönster som `apps/web/src/app/api/events/[layer]/route.ts:98,131` (index-doc + shards + merge). Lagren `destinations` (tid/plats/kategori) och `cards` (bild/host/attendees) slås ihop på `id`.
2. **Lägg till användarskapade event och tips.** `linkEvents where userCreated == true` — de finns *inte* i aggregaten (`linkEventService.ts:27-67`, samma varning i `e/[slug]/shareData.ts:9`). En stadslista som missar VADKUL-egna event underdriver siffran vi själva skriver i inlägget.
3. **Geo-filtrera på kontakten**, inte på stad. `hasCityPage` ⇒ använd `CITIES`-posten (`cityData.ts:15-47`) och `CITY_RADIUS_KM = 35`. Annars ⇒ kontaktens egna `lat/lng` + `radiusKm ?? 25`. Detta är hela poängen med att lägga koordinater på kontakten: **Byske, Malå, Kville och Harads kan få riktiga lokala event trots att länken går till vadkul.se.**
4. **Filtrera bort bio** — `category === 'bio'`, `hostName` matchar `/filmstaden|sf bio/i`, titel innehåller `Sv. tal` / `(Eng. tal)`. Sparas i `filteredCategories`.
5. **Datumfönster.** `direct`-grupp: från nu. `approval`- eller `unknown`-grupp: **från och med dagen EFTER tänkt postningsdag** (24/7-regeln — ett kölagt inlägg får aldrig nämna event som redan varit). Fönstrets slut = +7 dygn.
6. **Rangordna dragplåster** — sortera på `attendees` desc, sedan `isHostVerified`, sedan `coverImage` finns, sedan tid. Ta 4 (5 om utbudet > 200). Sprid över minst 3 olika dagar och 3 olika kategorier. Dolly Style-vinkeln 23/7 publicerades direkt — namnge det största namnet i första raden.
7. Returnera även `weekCount` (samma beräkning som `api/marketing/ad/[stad]/route.tsx:46`) och `fetchedAt`.

### `lib/outreach/templates.ts`

Rena funktioner, inga sidoeffekter:

```ts
export const VARIANTS = {
  A:          helgtipset,        // arbetshästen, tors/fre, återkommande
  B:          makerStoryn,       // EN gång per grupp — spärras av usedVariants
  C:          fragan,            // kaxigare ton, sparsamt
  D:          kommentarssvaret,  // svar när NÅGON ANNAN frågar; kort, ingen intro
  ostersund:  ostersundMallen,   // 24/7-formatet: intro → 4 emoji-rader → karta+antal → stjärnrad → fråga
  tipsfragan: tipsfragan,        // låg-utbudsvinkel: be om tips i stället för att tipsa
};
export function renderDraft(input: DraftInput): RenderedDraft
```

`renderDraft` gör fyra saker mekaniskt så ägaren aldrig behöver komma ihåg dem:

| Regel | Implementation |
|---|---|
| **Länkmålet** | `linkTarget.ts`: `hasCityPage ? \`https://vadkul.se/evenemang/${citySlug}\` : 'https://vadkul.se'`. Ren funktion, går aldrig att skriva över i UI:t → **404-djuplänkar blir omöjliga.** |
| **Länkplaceringen** | `postingMode === 'approval' \|\| 'unknown'` ⇒ `'i-inlägget'` (det finns inget kommentarsfält före godkännande). `'direct'` ⇒ `'i-första-kommentaren'` + separat `firstCommentText`. `linkAllowed === false` ⇒ `'ingen-länk'` och mallen byter till "googla vadkul". |
| **Stjärnkoden** | Av kanal, inte av användarval: `fb-grupp`/`fb-sida` → `STJARNA1`, `email`/`messenger-dm` → `ARRANGOR1`, `campaign` → `MEDLEM1`. `ARRANGOR1` kan **inte** hamna i ett FB-inlägg eftersom kanalvalet är det enda sättet att sätta den. |
| **Spårning** | `?utm_source=facebook&utm_campaign=grupper-v02&ref=<logId>` på länken. **Ingen URL-shortener** (husregel, obelagd men behålls) — det är vår egen domän, hela vägen. |

Automatiska varningar under förhandsvisningen:
- **Duplikatvarning**: `bodyHash` finns redan, eller trigram-Jaccard > 0.6 mot någon av de 20 senaste `bodyText` → *"87 % lik inlägget i Vad händer i Nyköping (24/7) — byt formuleringar."*
- **Färskvaruvarning**: `eventsDataFetchedAt` > 12 h → *"Eventen är X h gamla. Räkna om innan du postar."* + knapp Räkna om.
- **Datumvarning**: `earliestMentionedEventISO <= idag` i en approval-grupp → hård spärr på Bekräfta-knappen.

### DraftPanel — flödet

Ett klick från kön ⇒ genererat utkast med:
- Textrutan (redigerbar), **📋 Kopiera inlägget** (`navigator.clipboard.writeText`), och när `linkPlacement === 'i-första-kommentaren'` en andra ruta **📋 Kopiera första kommentaren**.
- Faktarad: *"4 event · 305 denna vecka · länk: /evenemang/helsingborg · stjärna: STJARNA1 · länk i första kommentaren"*.
- **Spara utkast** ⇒ `outreachLog` med `status:'utkast'`, `draftCreatedAt` satt, `postedAt` tomt.
- **Öppna gruppen** ⇒ `groupUrl` i ny flik.
- **Jag har postat det** ⇒ modal som kräver aktiv bekräftelse ⇒ `confirmedByOwner:true`, `postedAt:now`, `status:'postat'`, och transaktionellt på kontakten: `lastPostedAt`, `nextAllowedAt = +21 d`, `postCount++`, `usedVariants += variant`, `status:'postad'`.

Knappen heter medvetet *"Jag har postat det"* och inte *"Posta"* — det finns inget API bakom, och gränssnittet får aldrig antyda att det finns.

---

## 6.5 Delningskön — utkasten skriver sig själva varje morgon (BYGGD)

Målet är att öppna konsolen på morgonen och hitta dagens stadsinlägg färdiga,
ett per grupp, redo att kopieras in. **Inget av detta postar något** — det är
fortfarande copy-paste i Facebooks eget gränssnitt, precis som §0 kräver.

### Varför samma morgon och inte ett månadsschema

`plannedFor`/`recheckAt` i datamodellen ritade upp ett schema 30 dagar framåt.
Loggen säger att det är fel form för just gruppinlägg: **LÄRDOM 30/7** — tre
utkast skrivna 28/7 postades 30/7, Västmanlandsinlägget gick upp med två av
fem rader redan passerade, och Mölndalsinlägget avvisades helt. Konkreta event
är färskvara. Delningskön skriver därför en liten sats **samma morgon som den
ska delas**, och märker allt som hunnit bli inaktuellt i stället för att låta
det ligga kvar och se färdigt ut.

(Månadsschemat är fortfarande rätt form för de EVIGA inläggen i
[../social/inlagg-plan.md](../social/inlagg-plan.md) — de innehåller inga
datum och kan schemaläggas veckor framåt på FB-sidan, etapp 5.)

### Kedjan

```
GitHub Actions (06:00 UTC)  →  POST /api/admin/outreach/plan
        │                             │  Bearer OUTREACH_CRON_SECRET
        │                             ├─ buildQueueResponse: rankar de 83 grupperna
        │                             ├─ selectForPlanning: dagens urval
        │                             ├─ generateDraft × N (parallellt, claude-opus-5)
        │                             └─ persistDraft → outreachLog (status 'utkast')
        │
        └─ ägaren öppnar /admin/outreach → "Att dela"
                                      │  GET /api/admin/outreach/ready
                                      ├─ Kopiera → Öppna gruppen → Postat ✓
                                      └─ POST /api/admin/outreach/log → karens + kvot
```

### Urvalsreglerna (`selectForPlanning`)

Hårda grindar gäller som vanligt (karens, avskriven, veckodag). Utöver dem
hoppar den automatiska vägen över mer än den manuella gör, eftersom ingen
människa tittar när den kör:

| Hoppas över | Varför |
|---|---|
| Mjuka grindar som fälls (stadskrock, ny medlem, hög moderationsrisk) | I konsolen är de varningar man kan välja bort. Utan människa i loopen är de stopp. |
| Grupp som redan har ett färskt oanvänt utkast | Gör körningen idempotent — kör den två gånger och andra gången skapar noll. |
| Två grupper i samma ort samma morgon | Grinden ser bara *bekräftade* postningar, så satsen måste hålla reda på sig själv. |
| `eventSupplyThisWeek < 3` | Tipsfrågeformatet (Malå) kan vara helt rätt — men det är ett ägarbeslut, inte något en cron tar en dagsplats för. Generera manuellt. |
| Saknad koordinat | Utan lat/lng blir "i trakten" en gissning. Det var precis det Nykvarn-inlägget gjorde. |

Satsens storlek: `MAX_POSTS_PER_DAY − postade idag − färska utkast i kön`.

### Färskvarugrinden (`draftFreshness`)

Ett utkast flyttas från **Att dela** till **Inaktuella** när:

- någon eventrad ligger före **midnatt i dag** (inte före "nu" — ett
  heldagsevent lagras kl 00:00 och är fortfarande aktuellt kl 09:00), eller
- utkastet är äldre än **36 timmar** — då har kartdatat hunnit ändras oavsett
  vad raderna säger.

Varje rad kopplas tillbaka till kandidaten den kom ur (`resolveMentionedEvents`)
— det är den kopplingen som bär `timeISO`, och samma steg fångar en titel som
modellen skrivit utan underlag (`unmatchedTitles` ⇒ varning på kortet).

### Uppsättning

1. `openssl rand -hex 32` → lägg värdet **både** i `apps/web/.env`
   (`OUTREACH_CRON_SECRET=…`) och som repo-secret `OUTREACH_CRON_SECRET`.
2. `ANTHROPIC_API_KEY` måste finnas i `apps/web/.env` — annars svarar routen 503.
3. Deploya webben (secreten följer med `.env` till SSR-funktionen).

Utan steg 1 fungerar allt utom cronen: knappen **Skriv dagens utkast** i
Att dela-fliken gör exakt samma sak manuellt.

---

## 7. Utfall och statistik

### Utfallsloggning (`LogPanel.tsx` + `PATCH /api/admin/outreach/log`)

Varje rad har en kompakt utfallsrad: `[Publicerat direkt] [I kö] [Godkänt/uppe] [Borttagen] [Nekad]` + tre sifferfält (likes/kommentarer/delningar) + `ownRepliesCount`. Varje sparning sätter `outcomeCheckedAt`/`engagementCheckedAt` — vilket är det enda som stänger de 5 kroniska `?`-raderna och den 80-procentiga engagemangsblindheten.

Automatiska påminnelser i TodayPanel vid +24 h och +72 h. `borttagen`/`nekad` ⇒ modal som föreslår `doNotPost:true` och `moderationRisk:'hög'`.

### `GET /api/admin/outreach/stats`

Ett fullt svep över `outreachLog` (< 1000 dokument, billigt) + gruppering i minnet. Returnerar per dimension — **variant**, **ort/citySlug**, **linkPlacement**, **postingMode**, **veckodag**, **starLinkIncluded** — och per dimension:

```ts
{
  n: number;                    // antal postade
  nMeasured: number;            // antal med outcomeCheckedAt !== null
  approvedRate: number;         // (godkänt-uppe + publicerat-direkt) / nMeasured
  removedRate: number;          // (borttagen + nekad) / nMeasured
  queuedRate: number;           // krävde-godkännande / nMeasured
  likesAvg, likesMedian, commentsAvg, sharesSum: number;   // bara rader med engagementCheckedAt
  clicksSum: number;            // ur clicksFromPost
  clicksPerPost: number;
  eventSupplyAvg: number;       // för att korrelera utbud ↔ engagemang
}
```

**Statistikhygien i UI:t, inte bara i datan.** Varje kort visar `n=` och gråas ut med texten *"för få mätpunkter"* vid `nMeasured < 5`. Med dagens facit betyder det att i princip allt är grått — vilket är sant och nyttigt. Ett scatter-diagram `eventSupplyThisWeek` (x) mot `likes` (y) med de 4 mätta punkterna visar den enda korrelation som faktiskt finns i datan idag.

### Klick — `refId`-beacon (ingen shortener, ingen GA4)

`eventStats.clicks` mäter ANMÄL-klick på *eventkort* och kan inte attribuera trafik från ett FB-inlägg. Därför:

- `apps/web/src/components/ui/OutreachBeacon.tsx` — klientkomponent i Suspense: läser `?ref=` ur `useSearchParams()`, `sessionStorage`-dedupar, `navigator.sendBeacon('/api/outreach/hit', JSON.stringify({ref}))`, och tar bort parametern med `history.replaceState`. Ingen personlig data, ingenting i URL:en efteråt.
- `apps/web/src/app/api/outreach/hit/route.ts` — publik, `force-dynamic`. Validerar att `ref` matchar `/^[A-Za-z0-9_-]{10,30}$/`, gör `FieldValue.increment(1)` på `clicksFromPost` + `clicksByDay['ÅÅÅÅ-MM-DD']`. Skriver **aldrig** ett nytt dokument (skydd mot att någon spammar in rader), och den ligger inte i `firestore.rules` — Admin SDK gör skrivningen.
- Sidorna `evenemang/[stad]` och `(v2)/layout.tsx` förblir statiska; bara beaconen är dynamisk.

### Arrangörsstatistik (`clicksSent`) och stjärn-napp

- `apps/scraper/src/scripts/outreach-star-tally.ts`: sveper `users` på `starGiftCode` (`STJARNA1`/`ARRANGOR1`/`MEDLEM1`), räknar per kod och per vecka från `createdAt`, skriver `outreachStats/star-tally`. Det är den enda vägen — fältet är server-only (`functions/src/index.ts:169,233`).
- Samma skript sveper `eventStats` (fullt collection-svep, gruppering på `hostName`/`domain` i minnet — precis metoden README.md:45-53 beskriver manuellt) och skriver tillbaka `clicksSent` på arrangörskontakterna. Det ger uppföljningsmejlets *"vi har skickat X besökare vidare till era event"* utan Firebase Console.

> **Känd lucka som inte tystas ned:** `eventStats` har `clicksByMonth` men ingen tidsserie för `views`, och varken geo eller kategori. Konsolen visar därför klick-per-arrangör men **inte** visningar över tid. Att lägga till `viewsByMonth` kräver ändring i `eventStatsService.ts:21` **och** i `hasOnly`-listorna i `firestore.rules:421` och `:430` **och** en rules-deploy. Det är en separat, medveten uppgift — inte något denna plan smyger in.

---

## 8. Automatisering: FB-sidan — och bara den

### `PagePanel.tsx` + `POST /api/admin/outreach/page-post`

Det enda stället i hela konsolen där en knapp faktiskt publicerar. Panelen inleds med en checklista som måste vara grön:

- [ ] `vadkul.se` domänverifierad i Meta Business Manager och kopplad till sidan
- [ ] `GET /{url-node}?fields=ownership_permissions{can_customize_link_posts}` returnerar `true` för länken — **"You must call this endpoint before posting new links."** Utan detta får vi bara det Meta skrapar ur vår OG-metadata.
- [ ] App Review godkänd för `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` — inget mer
- [ ] Long-lived page token i env (`FB_PAGE_ID`, `FB_PAGE_TOKEN`, server-only) — "do not have an expiration date and only expire or are invalidated under certain conditions"

Routen:

```
POST https://graph.facebook.com/v25.0/{page-id}/feed
  message=<text>  link=<länk>
  [ published=false & scheduled_publish_time=<unix-sek> ]   // 10 min – 30 dygn
```

- **Schemaläggningsfönstret klampas till 30 dygn** i koden, inte 75. `/docs/pages-api/posts/` säger 30, `/page/feed` säger 75 — bygg mot den snävare och förvänta er inte att 31–75 fungerar deterministiskt.
- `published=false` **utan** `scheduled_publish_time` ger ett *opublicerat* inlägg (för annonser), inte ett schemalagt. Routen tillåter inte den kombinationen av misstag.
- **Ingen `targeting`, ingen `feed_targeting`.** Fältet finns inte i koden.
- Svaret sparas som `outreachLog` med `channel:'fb-sida'`, `fbPostId`, `fbCreatedByThisApp:true`. Redigering/radering exponeras bara för rader med den flaggan — "An app can only update a Page post if the post was made using that app."
- **Rate-limit-loggning**: läs `X-Business-Use-Case-Usage` ur svarshuvudet, plocka `type === 'pages'`, spara `call_count` som `fbBucUsagePct`. Visa i panelen med noten att Metas eget dokument är internt inkonsekvent (headern definierar `call_count` som en rullande **timme**, medan Pages-BUC-formeln `4800 × engaged users` är ett **24-timmarsfönster`) — logga siffran, lita inte på fönstret. Headern kan innehålla upp till 32 objekt. Vid felkod `4/17/32/80001/613` → paus + tydligt felmeddelande, ingen automatisk retry-loop.
- **En tyst sida har inget dokumenterat golv.** Threads-avsnittet har ett minimum på 10 impressions; Pages-avsnittet har ingen motsvarighet. Panelen visar därför en explicit varning att en helt ny sida kan ha en mycket låg reell kvot. Konservativ standard: max 2 sidinlägg/dygn (husregel).

### Egen VADKUL-grupp (dokumenterad, ej kodad)

En informationsruta i PagePanel, inte en integration:

> Skapa gruppen **som Sidan** (en Sida kan vara admin för upp till 200 grupper). Då kan Admin Assist → *"Publish a custom post"* köra dagligt/veckovis/månadsvis återkommande inlägg — Metas egen, dokumenterade automatisering, utan API, utan App Review, utan tredjepartsverktyg. Författaren blir den admin som satte upp inlägget.
> ⚠️ Som gruppadmin: **godkänn aldrig ett regelbrytande inlägg** — Meta räknar godkända överträdelser som strikes mot gruppen.

Konsolen kan generera texten till det återkommande inlägget (samma mallmotor, `channel:'fb-sida'`, `STJARNA1`) — men klistras in manuellt i Admin Assist.

### Sammanfattningstabell som ska ligga i UI:t

| Kanal | Automatiserbart | Vad konsolen gör |
|---|---|---|
| Andras FB-grupper | **Nej** — inget API, ingen betald väg, ingen partnerväg | Utkast + kopiera + öppna gruppen + logga efter bekräftelse |
| FB-event (spegla våra event) | **Nej** — går inte att skapa/uppdatera/radera via API | Inget. Länkinlägg är enda vägen. |
| Vår FB-sida | **Ja** — `/feed` med `message` + `link`, schema 10 min–30 dygn | Publicerar och schemalägger på riktigt |
| Egen VADKUL-grupp | **Ja, men i FB:s UI** (Admin Assist recurring) | Genererar texten; uppsättningen är manuell |
| Arrangörsmejl | **Nej** (5–10/vecka, ett i taget, aldrig BCC) | Mall + ämnesrads-A/B + uppföljningspåminnelse; skickas från Zoho |
| Medlemsutskick | Endast via **Zoho Campaigns**, aldrig Zoho Mail | Räknar `MEDLEM1`-napp; avregistreringsfoten rörs aldrig |

---

## 9. "Claude för anteckningar" — konkret

Tre delar, varav den tredje är den som faktiskt uppfyller *"den ser till att jag har mitt innehåll"*.

### 9.1 Analyskörningen — `apps/scraper/src/scripts/outreach-brief.ts`

Node + `@anthropic-ai/sdk`, körs manuellt eller nattligt. Nyckeln (`ANTHROPIC_API_KEY`) bor i scraper-appens env — **aldrig i web-klienten och aldrig i en publik route**.

- Läser `outreachContacts` + `outreachLog` med Admin SDK (`apps/scraper/service-account.json`).
- Bygger en **kompakt** payload: alla loggrader utan `bodyText`, plus full `bodyText` för de 20 senaste, plus statistikblocket från §7, plus tidigare `outreachNotes` med `status:'antagen'` (så den inte upprepar sig).
- Model: **`claude-opus-5`**, `thinking: { type: 'adaptive' }`, `output_config: { effort: 'high' }`. Strukturerat svar via `zodOutputFormat` (`@anthropic-ai/sdk/helpers/zod`) mot ett schema som exakt speglar `OutreachNote` — då kan resultatet skrivas rakt in i Firestore utan parsning.
- Systemprompten sätter tre hårda krav: **(1)** varje insikt måste ange `basedOnLogIds` och `sampleSize`; **(2)** `confidence:'hög'` är förbjudet vid n<5; **(3)** den får aldrig föreslå något som strider mot §0-ramarna (grupp-API, FB-event, `feed_targeting`, 75 dygn).
- Kostnad: ~30k in / 3k out per körning på $5/$25 per MTok ≈ **0,23 USD/körning**. Nattligt = under 8 USD/månad.
- Skriver resultatet som `outreachNotes` med `status:'förslag'`.

### 9.2 NotesPanel — ägaren avgör

Varje anteckning visas med titel, brödtext, `n=`, konfidens och länkar till de loggrader den bygger på. Två knappar: **Anta** / **Förkasta**. Inget skrivs om automatiskt.

### 9.3 Återkopplingen till utkasten — poängen

`POST /api/admin/outreach/draft` läser `outreachNotes` med `status:'antagen'` som matchar utkastets `variant`/`citySlug`/`postingMode`, och:

1. **Deterministiska regelförslag** (`kind:'regelförslag'` med `appliesTo`) blir riktiga grindar i `rules.ts` respektive vikter i `scoring.ts` — t.ex. "direktpublicerande grupper: alltid länk i kommentar" flyttar in i motorn.
2. **Innehållsinsikter** (`kind:'mallförbättring'`, `'insikt'`) skickas som en constraint-lista in i `templates.ts` — och när mallen behöver skrivas om skickas de som `system`-kontext till samma Claude-anrop som formulerar texten.

Loopen blir: *utfall loggas → Claude läser loggen → föreslår vad som funkar → ägaren antar → nästa utkast är skrivet enligt det.* Ingenting går live utan ägarens Anta-klick och Bekräfta-klick.

---

## 10. Etapper

### Etapp 1 — En sanning och en dagsvy (värde direkt, ~1 arbetsdag)
`types/outreach.ts` · `lib/outreach/{hash,rules,scoring,repo}.ts` · `import-outreach-md.ts` med `--dry-run/--verify/--commit` · rules-tillägg 19–21 + **manuell deploy** · `firestore-admin.ts`-patchen · `queue`-routen · `/admin/outreach` med TodayPanel + QueuePanel (read-only) · länk från AdminClient.

**Levererar redan här:** de två källorna som glidit isär blir en. De 5 okända utfallen, de 3 kölagda och de 10 förfallna mejluppföljningarna dyker upp som konkreta att-göra-rader. Kön säger vilka av de 63 orörda grupperna som är värda mest idag. Inget utkast behövs för att det ska vara nyttigt.

### Etapp 2 — Utkast med riktiga event — ✅ BYGGD (6/8 + 14/8)

Levererat 6/8: `eventPicker.ts` (live aggregatedEvents + snapshot-fallback,
geo per kontakt, 8 km-räknare, biovakt, datumfönster per postingMode,
helg-garanti i kandidattaket) + `POST /api/admin/outreach/draft` (Claude
`claude-opus-5`, strukturerad JSON-output, formatreglerna ur
facebook-grupper.md i systemprompten, de 5 senaste inläggen som
"skriv inte likadant"-underlag) + ✨-knapp på kandidatkorten i TodayPanel
med V1/V2-kopieringsrutor. Kräver `ANTHROPIC_API_KEY` (server-only, se
.env.example).

Levererat 14/8 — **delningskön** (§6.5): motorn bruten ur routen till
`draftGenerator.ts` och delad med `POST .../plan` (morgonkörningen via GitHub
Actions) · `planner.ts` med urval, färskvarugrind och trigram-dubblettflagg ·
utkasten SPARAS nu i `outreachLog` (`persistDraft`, båda vägarna) ·
`GET .../ready` + **Att dela**-fliken · `POST .../log` = Bekräfta postat, med
transaktionen mot kontakten (karens +21 d, `postCount++`, `usedVariants`).

ÅTERSTÅR ur etappen: `templates.ts`/`linkTarget.ts` (UTM + ref-parameter hör
ihop med etapp 4) och en redigerbar textruta — i dag kopieras texten som den är.

Fyll i `lat/lng` för orterna utan stadssida löpande i konsolen — det är detta som gör utkasten lokala även för de 60. Grupper utan koordinat hoppas över av morgonkörningen.

### Etapp 3 — Utfall och statistik (~1 dag)
LogPanel · `log`-routens PATCH · påminnelser vid +24 h/+72 h · `stats`-routen · StatsPanel med n-hygien och utbud-mot-engagemang-diagrammet · de två indexen.

### Etapp 4 — Attribution (~halv dag)
`OutreachBeacon.tsx` · `/api/outreach/hit` · beacon i `evenemang/[stad]` och `(v2)/layout.tsx` · `outreach-star-tally.ts` (starGiftCode + eventStats→`clicksSent`) · klick- och stjärnkolumner i StatsPanel.
Först nu blir UTM meningsfullt — 0 av 20 postningar hade det, och `grupper-v02` blir kampanjnamnet för första taggade omgången.

### Etapp 5 — FB-sidan (~1 dag kod, plus väntetid på App Review)
`page-post`-routen · PagePanel med checklistan · `ownership_permissions`-kontrollen · BUC-headerloggningen · rutan om egen VADKUL-grupp.
**Blockerad av två externa steg:** domänverifiering och App Review. Kodas gärna parallellt med etapp 3–4, men går inte live förrän de är klara.

### Etapp 6 — Claude-anteckningar (~1 dag)
`outreach-brief.ts` · `notes`-routen · NotesPanel med Anta/Förkasta · inkopplingen av antagna anteckningar i `draft`-routen.
Ligger sist av en anledning: med n=20 loggrader varav 4 mätta finns det ännu inte tillräckligt underlag. Efter etapp 3–4 kommer varje ny postning in med utfall, engagemang och klick — då har analysen något att arbeta med.

---

## 11. Vad planen medvetet *inte* gör

- Ingen automatisk gruppostning, ingen headless-browser-lösning, inget tredjepartsverktyg som påstår sig posta i grupper. Det finns ingen laglig väg och konsolen ska inte antyda att det gör det.
- Inga Facebook-event, varken skapade, uppdaterade eller speglade.
- Ingen `feed_targeting`-baserad stadssegmentering.
- Ingen URL-shortener (husregel, obelagd — men vår egen domän räcker och ger bättre kontroll).
- Ingen öppning av `aggregatedEvents` för klienten. All eventdata i konsolen hämtas server-side med Admin SDK.
- Ingen PII i repot: medlemslistan importeras som ett aggregat (137 st, kod `MEDLEM1`), aldrig som rader.