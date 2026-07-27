// src/types/outreach.ts
//
// Datamodellen för publiceringskonsolen /admin/outreach.
//
// Sanningen bor i tre SERVER-ONLY Firestore-collections (outreachContacts,
// outreachLog, outreachNotes) — klienten når dem enbart via
// /api/admin/outreach/* bakom requireAdmin(). Se docs/outreach/admin-konsol-plan.md.
//
// OBS tidsfält: epoch-MILLISEKUNDER (number), inte Firestore-Timestamp.
// Skälet är att typerna delas av web-klienten, API-routes (Admin SDK) och
// scraper-skript — tre miljöer med olika Timestamp-klasser. Number är
// entydigt, sorterbart i queries och JSON-serialiserbart rakt av.

export type OutreachKind = 'fb-grupp' | 'arrangor' | 'medlemslista';
export type PostingMode = 'approval' | 'direct' | 'unknown';
export type ContactStatus =
    | 'orörd' | 'utkast' | 'postad' | 'väntar-godkännande' | 'borttagen' | 'avskriven';

export type LogChannel = 'fb-grupp' | 'fb-sida' | 'email' | 'messenger-dm' | 'admin-dm' | 'campaign';
export type LogStatus =
    | 'utkast' | 'postat-obekräftat' | 'postat' | 'i-godkännandekö'
    | 'godkänt-uppe' | 'borttagen' | 'nekad' | 'okänt';
export type LogOutcome =
    | 'publicerat-direkt' | 'krävde-godkännande' | 'godkänt-uppe'
    | 'borttagen' | 'nekad' | 'okänt';
export type LinkPlacement = 'i-inlägget' | 'i-första-kommentaren' | 'ingen-länk';

// Stjärnkoden sätts ALLTID av kanalen (aldrig fritt val i UI): fb-* → STJARNA1,
// email/messenger-dm → ARRANGOR1, campaign → MEDLEM1. Så hålls attributionen
// ren per kanal (starGiftCode på users-dokumentet).
export type StarCode = 'STJARNA1' | 'ARRANGOR1' | 'MEDLEM1' | null;

export interface OutreachContact {
    id: string;                   // slug av ordagrant namn (fb-grupp) / orgName (arrangör)
    kind: OutreachKind;

    /* --- identitet --- */
    name: string;                 // ORDAGRANT gruppnamn — unikhetsnyckel, likalydande grupper = olika docs
    listNumber?: number;          // 1–83, radnumret i facebook-grupplista.md (spårbarhet)
    city?: string;
    citySlug?: string | null;     // 'halmstad' | null — bara de 31 med egen /evenemang/<slug>
    hasCityPage: boolean;
    lat?: number; lng?: number;   // gör att även orter UTAN stadssida får lokala event i utkasten
    radiusKm?: number;
    groupUrl?: string;            // FB-URL — "Öppna gruppen"-knappen
    memberCount?: number;

    /* --- publiceringsregler --- */
    postingMode: PostingMode;     // styr länkplaceringen (approval → i inlägget)
    groupRulesNote?: string;
    allowedWeekdays?: number[];   // 0=sön … 6=lör; tom/frånvarande = alla dagar
    linkAllowed?: boolean;
    joinedGroupAt?: number;
    isBigGroup?: boolean;
    moderationRisk?: 'låg' | 'medel' | 'hög';
    doNotPost: boolean;

    /* --- historik (denormaliserad från outreachLog vid bekräftad postning) --- */
    lastPostedAt?: number;
    nextAllowedAt?: number;       // = lastPostedAt + 21 dygn (3-veckorsregeln)
    postCount: number;
    lastOutcome?: LogOutcome;
    usedVariants: string[];       // variant 'B' (maker-storyn) får förekomma EXAKT en gång
    status: ContactStatus;

    /* --- ranking (cache — räknas alltid om i kö-routen) --- */
    eventSupplyThisWeek?: number;
    eventSupplyAt?: number;
    priorityScore?: number;

    /* --- arrangörsspecifikt (kind === 'arrangor') --- */
    orgName?: string;
    eventCount?: number;
    cities?: string[];
    domain?: string;
    email?: string;
    emailSourceNote?: string;
    prio?: 1 | 2 | 3;
    exampleEvents?: { title: string; time?: string }[];
    replyStatus?: 'inget svar' | 'svar' | 'nej';
    linkUrl?: string;             // MÅLRADEN: den publicerade inlänken
    clicksSent?: number;          // summeras ur eventStats av outreach-star-tally
    followUpDueAt?: number;       // skickat + 8 dygn
    bounced?: boolean;

    /* --- admin-DM --- */
    adminName?: string;
    adminProfileUrl?: string;
    adminDmStatus?: 'ej kontaktad' | 'DM skickad' | 'ja' | 'nej' | 'inget svar';
    adminDmSentAt?: number;
    adminDmNote?: string;

    notes?: string;
    createdAt: number;
    updatedAt: number;
}

export interface OutreachLogEntry {
    id: string;
    contactId: string;
    contactName: string;          // denormaliserat ORDAGRANT namn
    channel: LogChannel;

    /* --- loggregeln: postat FÖRST efter ägarens bekräftelse --- */
    draftCreatedAt: number;
    postedAt?: number;
    confirmedByOwner: boolean;
    status: LogStatus;

    /* --- månadsschemat: utkast planeras upp till en månad framåt --- */
    plannedFor?: number;          // tänkt publiceringsdag (epoch ms)
    recheckAt?: number;           // = plannedFor − 7 dygn: då ska eventen räknas
                                  // om och utkastet godkännas på nytt (färskvara)
    recheckedAt?: number;         // satt när omkollen är gjord

    /* --- innehållet --- */
    variant?: string;             // 'A' | 'B' | … | 'ostersund' | '25/7-V1'
    bodyText?: string;            // HELA inläggstexten — grunden för copy-paste-spärren
    bodyHash?: string;            // FNV-1a 16 hex av normaliserad bodyText
    firstCommentText?: string;
    linkPlacement?: LinkPlacement;
    linkUrl?: string;
    starCode?: StarCode;
    starLinkIncluded?: boolean;
    utmSource?: string;
    utmCampaign?: string;
    refId?: string;               // klick-beaconens nyckel (?ref= i länken)

    /* --- färskvaran --- */
    // grade 1–5 = hur bra eventet är som DRAGPLÅSTER i ett inlägg (stort namn,
    // bild, många anmälda, engångshändelse) — sätts av eventPicker, visas i
    // utkastet och kan justeras av ägaren.
    mentionedEvents?: { eventId: string; title: string; timeISO: string; emoji?: string; grade?: number }[];
    eventCountClaimed?: number;
    eventsDataFetchedAt?: number;
    earliestMentionedEventISO?: string;
    filteredCategories?: string[];

    /* --- utfall --- */
    outcome: LogOutcome;
    outcomeCheckedAt?: number;    // null/frånvarande ⇒ TodayPanel påminner
    approvalReleasedAt?: number;
    removedAt?: number;

    /* --- mätning --- */
    likes?: number; comments?: number; shares?: number;
    engagementCheckedAt?: number;
    ownRepliesCount?: number;
    clicksFromPost?: number;      // ökas av /api/outreach/hit (etapp 4)
    clicksByDay?: Record<string, number>;

    /* --- mejlspecifikt --- */
    subjectLine?: string;
    followUpAt?: number;
    bounced?: boolean;

    nextAllowedAt?: number;       // denormaliserat postedAt + 21 dygn
    notes?: string;
    importedFrom?: string;        // 'facebook-grupplista.md#rad12'
}

export interface OutreachNote {
    id: string;
    kind: 'insikt' | 'regelförslag' | 'mallförbättring' | 'varning';
    title: string;
    body: string;
    basedOnLogIds: string[];
    sampleSize: number;           // UI gråar ut slutsatser vid n < 5
    confidence: 'låg' | 'medel' | 'hög';
    status: 'förslag' | 'antagen' | 'förkastad';
    appliesTo?: { variant?: string; citySlug?: string; postingMode?: PostingMode };
    model: string;
    createdAt: number;
    decidedAt?: number;
}

/* ── DTO:er för kö-routen (det klienten faktiskt får) ───────────────────── */

export interface QueueGate {
    id: string;
    ok: boolean;
    label: string;
    evidence: 'meta' | 'husregel' | 'gruppregel' | 'eget-beslut';
    hard: boolean;                // hard && !ok ⇒ bort ur kön; mjuk ⇒ varning på kortet
}

export interface QueueItem {
    contact: OutreachContact;
    gates: QueueGate[];
    score: number;
    scoreExplanation: string;     // "305 event denna vecka · orörd · egen stadssida"
    blocked: boolean;             // någon hård grind fälld
}

export interface TodayAction {
    type: 'följ-upp-utfall' | 'släpp-kollen' | 'mejluppföljning' | 'svara-kommentarer';
    label: string;
    contactName: string;
    logId?: string;
    contactId: string;
    dueSince?: number;
    groupUrl?: string;            // fb-åtgärder: "Öppna gruppen"-länken i raden
    email?: string;               // mejluppföljning: mailto-länken i raden
}

export interface QueueResponse {
    generatedAt: number;
    quota: { postedToday: number; maxPerDay: number };
    visits: { today: number; yesterday: number };   // outreachStats/siteVisits (beacon)
    actions: TodayAction[];
    queue: QueueItem[];           // mogna, sorterade på score desc
    blocked: QueueItem[];         // spärrade, med nedräkning via nextAllowedAt
    counts: { contacts: number; groups: number; organizers: number; logged: number };
}
