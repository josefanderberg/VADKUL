/**
 * venueFromText.ts — plocka plats-ledtrådar ur fritext och föreningsnamn.
 *
 * PRO/SPF-fallet (ägaren 24/8, Canasta i Vislanda): riktiga platsen står i
 * beskrivningen ("Vi spelar i Folkets Hus, Caféet, på tisdagar …") och orten
 * i föreningsnamnet ("PRO Vislanda") — men eventet låg på kommunhuvudortens
 * centroid. Två rena extraktorer, testade i venueFromText.test.ts:
 *
 *   extractVenueFromText  "Vi spelar i Folkets Hus, Caféet …" → "Folkets Hus"
 *   ortFromForeningsnamn  "PRO Vislanda" → "Vislanda"
 */

/** Sista ordet i en venue-fras: byggnads-/platssuffix. OBS bestämd form är
 *  "(en)?/(et)?" — `gården?` hade missat "gård" (matchar bara gårde/gården). */
const VENUE_TAIL = /^(hus(et)?|gård(en)?|kyrka(n)?|kapell(et)?|skola(n)?|hall(en)?|stuga(n)?|caf[ée]e?t|lokal(en)?|bygdegård(en)?|församlingshem(met)?|församlingsgård(en)?|hembygdsgård(en)?|sockenstuga(n)?|folkhögskola(n)?|bibliotek(et)?|torg(et)?|park(en)?|ip|arena(n)?|scen(en)?|klubbstuga(n)?|missionshus(et)?|pastorsexpedition(en)?|center|centret|centrum)$/i;

/** Frasstart: "i/på/vid" följt av VERSAL — filtrerar bort "på tisdagar" osv. */
const PHRASE_RE = /\b(?:i|på|vid)\s+([A-ZÅÄÖ][\p{L}'’-]*(?:\s+[\p{L}'’-]+){0,3})/gu;

const bareWord = (w: string) => w.replace(/[^\p{L}'’-]/gu, '');

/**
 * Första kapitaliserade frasen efter i/på/vid vars ord slutar i ett
 * platssuffix. "Vi spelar i Folkets Hus, Caféet, på tisdagar" → "Folkets Hus".
 * Returnerar null när texten inte ger någon tydlig plats.
 */
export function extractVenueFromText(text: string | null | undefined): string | null {
    if (!text) return null;
    for (const m of text.matchAll(PHRASE_RE)) {
        const words = m[1].split(/\s+/);
        for (let end = 0; end < words.length; end++) {
            if (VENUE_TAIL.test(bareWord(words[end]))) {
                const phrase = words.slice(0, end + 1).map(bareWord).filter(Boolean).join(' ');
                if (phrase.length >= 5) return phrase;
            }
        }
    }
    return null;
}

/** Ord i föreningsnamn som inte är orter. */
const ORT_STOP = /^(kultur|samorg\w*|distrikt(et)?|city|centrum|seniorerna|väst(ra)?|öst(ra)?|norr(a)?|söd(er|ra)|gamla|nya)$/i;

/**
 * Orten ur ett PRO-/SPF-föreningsnamn: "PRO Vislanda" → "Vislanda",
 * "PRO Vislanda-Blädinge" → "Vislanda", "SPF Seniorerna Alvesta" → "Alvesta".
 * Max två ord, stoppord filtreras — hellre null än fel ort.
 */
export function ortFromForeningsnamn(name: string | null | undefined): string | null {
    if (!name) return null;
    const m = name.trim().match(/^(?:PRO|SPF)(?:\s+Seniorerna)?\s+(.+)$/i);
    if (!m) return null;
    const rest = m[1].split('-')[0].trim();
    const words = rest.split(/\s+/).filter(Boolean);
    if (words.length === 0 || words.length > 2) return null;
    if (words.some(w => ORT_STOP.test(w) || w.replace(/[^\p{L}]/gu, '').length < 3)) return null;
    const ort = words.join(' ');
    return /^[A-ZÅÄÖ]/.test(ort) ? ort : null;
}

/** Ord som gör en text till en BYGGNAD/plats (inte bara ett salongsnamn). */
const BUILDING_RE = /(?<!\p{L})(?:bio(?:graf(?:en)?)?|teater(?:n)?|kulturhus(?:et)?|arena(?:n)?|hus(?:et)?|scen(?:en)?|hall(?:en)?|center|centrum|centret|gård(?:en)?|kyrka(?:n)?|museum|museet|park(?:en)?|skola(?:n)?|folkets|konserthus(?:et)?|filmhus(?:et)?|kursgård(?:en)?|folkhögskola(?:n)?|bibliotek(?:et)?)(?!\p{L})/iu;
/** Salongs-/rumsord: "Salong Lillan", "Sal 2", "Stora scenen" är rum, inte byggnader. */
const ROOM_RE = /^(?:salong|sal|scen|studio|rum|lokal|stora|lilla|black box|kino|terass(?:en)?|foaj[ée]n?)(?!\p{L})/iu;

/**
 * "Saga - Bio 3:an" → "Bio 3:an", "Salong Lillan - Garvaren Bio" → "Garvaren Bio".
 * Biografer/scener på Tickster m.fl. namnger platsen som "SALONG - BYGGNAD".
 * Geokodas hela strängen träffar salongsnamnet fel ort: Piteås Bio 3:an låg
 * 14 km bort mellan Svensbyn och Hemmingsmark (community-kritik 2026-09-04),
 * och de tre salongerna fick tre olika platser. Returnerar byggnaden när
 * högerdelen ser ut som en byggnad och vänsterdelen inte gör det (eller är
 * ett rumsord); annars null — "Kulturhuset - Stora scenen" lämnas orörd.
 */
export function venueBuildingOf(venueName: string | null | undefined): string | null {
    const m = (venueName ?? '').trim().match(/^(.{2,40}?)\s+[-–—]\s+(.{3,80})$/);
    if (!m) return null;
    const [, left, right] = m;
    if (!BUILDING_RE.test(right)) return null;
    if (BUILDING_RE.test(left) && !ROOM_RE.test(left)) return null;
    return right.trim();
}

/** Byggnadsord SIST i ett ord ("Centralteatern", "Sparbankshallen", "Folkets Hus"). */
const BUILDING_TAIL_RE = /(?:teater(?:n)?|kulturhus(?:et)?|konserthus(?:et)?|arena(?:n)?|hus(?:et)?|hall(?:en)?|bio(?:n)?|biograf(?:en)?|museum|museet|opera(?:n)?|kyrka(?:n)?|scen(?:en)?|center|centrum)$/i;
/** Rum sist i namnet: "… Stora Scen", "… Scen 2", "… Lilla salen", "… Salong 3". */
const ROOM_TAIL_RE = /^(.{3,}?)\s+(?:(?:stora|lilla|nya|gamla|övre|nedre)\s+)?(?:scen(?:en)?|sal(?:en)?|salong(?:en)?|studio(?:n)?|foaj[ée]n?)(?:\s*\d{1,2})?$/i;
/** Ensamma rumsord — aldrig en byggnad. */
const BARE_ROOM_RE = /^(?:sal(?:en)?|salong(?:en)?|scen(?:en)?|studio(?:n)?|rum|lokal|stora|lilla)$/i;

/**
 * Byggnaden bakom ett salongsnamn, i den ordning de ska provas (#247,
 * platsgranskningen 15/11: 266 Tickster-event låg på ortens mittpunkt, de
 * flesta med salongens namn som plats). Formerna:
 *   "Saga - Bio 3:an"                       → Bio 3:an      (venueBuildingOf)
 *   "Nalen – Stora Salen"                   → Nalen         (rummet till höger)
 *   "Unga Klara, Kulturhuset Stadsteatern"  → Kulturhuset Stadsteatern
 *   "Arena Varberg, Sparbankshallen"        → Arena Varberg, Sparbankshallen
 *   "Wermland Opera Stora Scen"             → Wermland Opera
 *   "Norrbottensteatern Scen 2"             → Norrbottensteatern
 *   "Sara Kulturhus Hjortronet"             → Sara Kulturhus
 *   "Kino 2"                                → Kino          (salongsnumret)
 * Tom lista när namnet redan är byggnaden. Ren funktion.
 */
export function buildingCandidatesOf(venueName: string | null | undefined): string[] {
    const v = (venueName ?? '').trim().replace(/\s+/g, ' ');
    if (!v) return [];
    const out: string[] = [];
    const add = (b: string | null | undefined) => {
        const t = (b ?? '').trim().replace(/[,\s–—-]+$/, '');
        if (t.length >= 3 && t.toLowerCase() !== v.toLowerCase() && !BARE_ROOM_RE.test(t) && !out.some(o => o.toLowerCase() === t.toLowerCase())) out.push(t);
    };

    add(venueBuildingOf(v));
    // "Byggnad – Rum": rummet till höger.
    const dash = v.match(/^(.{2,40}?)\s+[-–—]\s+(.{3,80})$/);
    const roomRight = (r: string) => ROOM_RE.test(r) || /^\S*(?:salen|salongen|scenen)$/i.test(r);
    if (dash && roomRight(dash[2].trim()) && !ROOM_RE.test(dash[1].trim())) add(dash[1]);
    // "Rum, Byggnad" / "Byggnad, Hall": segmenten som slutar på ett byggnadsord.
    const segs = v.split(',').map(s => s.trim()).filter(Boolean);
    if (segs.length >= 2) {
        for (const seg of segs) {
            const last = seg.split(' ').pop() ?? '';
            // "Hall Nord", "Hall A": en hall i huset, inte huset.
            if (!ROOM_RE.test(seg) && !/^hall(?:en)?\s/i.test(seg) && (BUILDING_RE.test(seg) || BUILDING_TAIL_RE.test(last))) add(seg);
        }
    }
    const head = segs[0] ?? v;
    // "Wermland Opera Stora Scen", "Norrbottensteatern Scen 2".
    if (dash) return out;
    const roomTail = head.match(ROOM_TAIL_RE);
    if (roomTail && !BARE_ROOM_RE.test(roomTail[1])) add(roomTail[1]);
    // "Sara Kulturhus Hjortronet": ett rumsnamn efter byggnadsordet — som
    // inte får stå först ("Arena Varberg" är byggnaden själv).
    const afterBuilding = head.match(/^(.*?(?:kulturhus(?:et)?|konserthus(?:et)?|teater(?:n)?|folkets hus|arena(?:n)?))\s+\p{Lu}[\p{L}-]+$/iu);
    if (afterBuilding && !/^(?:kulturhus|konserthus|teater|folkets hus|arena)/i.test(afterBuilding[1])) add(afterBuilding[1]);
    // Arenornas hallar: "Vilundaparkens Ishall A", "Kungsbacka Ishall (A)",
    // "NKT Arena Karlskrona A-Hall", "Ulriksdals IP Hall 3" (swehockey, #247).
    const hall = head.match(/^(.{4,}?)\s+(?:\((?:[A-D]|\d)\)|[A-D]-?hall(?:en)?|hall\s*(?:[A-D]|\d{1,2})|[A-D])$/iu);
    if (hall) add(hall[1]);
    // "Kino 2": salongsnumret (när inget rums- eller hallord redan tagit det).
    const numbered = roomTail || hall ? null : head.match(/^(.{4,40}?)\s+\d{1,2}$/);
    if (numbered) add(numbered[1]);
    return out;
}
