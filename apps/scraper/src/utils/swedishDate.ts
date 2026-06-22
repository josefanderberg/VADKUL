/**
 * Svensk datumtolkare — fristående utility som flera scrapers kan dela.
 *
 * Hanterar de vanligaste formaten på svenska eventsajter:
 *   - "20 juni"                  → år gissas baserat på nutid
 *   - "20 juni 2026"             → exakt datum
 *   - "20 juni kl 19:00"
 *   - "20 juni 2026 kl. 19:00"
 *   - "Torsdag 20 juni"
 *   - "20/6 19:00"
 *   - "2026-06-20"               → ISO
 *   - "idag kl 19:00", "imorgon kl 18:00"
 *
 * findFirstDateInText() är huvudfunktionen för fri-text-extraktion:
 * scannar igenom en lång sträng och returnerar första rimliga datum.
 */

const MONTH_MAP: Record<string, number> = {
    jan: 0, januari: 0,
    feb: 1, februari: 1,
    mar: 2, mars: 2,
    apr: 3, april: 3,
    maj: 4,
    jun: 5, juni: 5,
    jul: 6, juli: 6,
    aug: 7, augusti: 7,
    sep: 8, september: 8,
    okt: 9, oktober: 9,
    nov: 10, november: 10,
    dec: 11, december: 11,
};

const WEEKDAY_MAP: Record<string, number> = {
    'måndag': 1, 'mån': 1,
    'tisdag': 2, 'tis': 2,
    'onsdag': 3, 'ons': 3,
    'torsdag': 4, 'tors': 4, 'tor': 4,
    'fredag': 5, 'fre': 5,
    'lördag': 6, 'lör': 6,
    'söndag': 0, 'sön': 0,
};

const MONTH_PATTERN = Object.keys(MONTH_MAP).sort((a, b) => b.length - a.length).join('|');
const WEEKDAY_PATTERN = Object.keys(WEEKDAY_MAP).sort((a, b) => b.length - a.length).join('|');

/**
 * Bygg datum från komponenter — om datumet är mer än 30 dagar i bakåt antas
 * det vara nästa år (vanligt för listor som inte specar år).
 */
function buildDate(day: number, month: number, year: number, hour = 0, minute = 0, now = new Date()): Date | null {
    if (day < 1 || day > 31 || month < 0 || month > 11) return null;
    const d = new Date(year, month, day, hour, minute, 0, 0);
    if (isNaN(d.getTime())) return null;
    // Round-trip-validering: JS rullar över omöjliga datum (t.ex. 30 feb → 2 mars,
    // 31 nov → 1 dec) tyst. Avvisa dem hellre än att publicera fel dag.
    if (d.getFullYear() !== year || d.getMonth() !== month || d.getDate() !== day) return null;
    return d;
}

function inferYearForward(day: number, month: number, hour: number, minute: number, now: Date): Date | null {
    const year = now.getFullYear();
    const d = buildDate(day, month, year, hour, minute);
    if (!d) return null;
    // Om datumet är mer än 30 dagar i bakåt → nästa år
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (d < thirtyDaysAgo) {
        return buildDate(day, month, year + 1, hour, minute);
    }
    return d;
}

/**
 * Tolka en SINGLE datum-sträng. Hittar inte datum i fritext — använd
 * findFirstDateInText för det.
 */
export function parseSwedishDate(dateStr: string, now: Date = new Date()): Date | null {
    if (!dateStr) return null;
    const s = dateStr.toLowerCase().trim();

    // ISO: 2026-06-20 eller 2026-06-20T19:00:00
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[t\s](\d{1,2}):(\d{2}))?/);
    if (iso) {
        return buildDate(parseInt(iso[3], 10), parseInt(iso[2], 10) - 1, parseInt(iso[1], 10),
            iso[4] ? parseInt(iso[4], 10) : 0, iso[5] ? parseInt(iso[5], 10) : 0);
    }

    // "idag kl 19:00"
    if (s.startsWith('idag')) {
        const m = s.match(/(\d{1,2})[:.](\d{2})/);
        const d = new Date(now); d.setHours(0, 0, 0, 0);
        if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return d;
    }
    // "imorgon kl 18:00"
    if (s.startsWith('imorgon')) {
        const m = s.match(/(\d{1,2})[:.](\d{2})/);
        const d = new Date(now); d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 1);
        if (m) d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
        return d;
    }

    // "DD/MM YYYY" eller "DD/M"
    const slash = s.match(/^(\d{1,2})\/(\d{1,2})(?:\s+(\d{4}))?(?:\s+(?:kl\.?\s*)?(\d{1,2})[:.](\d{2}))?/);
    if (slash) {
        const day = parseInt(slash[1], 10);
        const month = parseInt(slash[2], 10) - 1;
        const year = slash[3] ? parseInt(slash[3], 10) : now.getFullYear();
        const hour = slash[4] ? parseInt(slash[4], 10) : 0;
        const min = slash[5] ? parseInt(slash[5], 10) : 0;
        if (slash[3]) return buildDate(day, month, year, hour, min);
        return inferYearForward(day, month, hour, min, now);
    }

    // "(weekday)? DD month (YYYY)? (kl)? HH:MM"
    const re = new RegExp(
        `(?:${WEEKDAY_PATTERN})?\\s*(\\d{1,2})\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?(?:[\\s,]+(?:kl\\.?\\s*|·\\s*)?(\\d{1,2})[:.](\\d{2}))?`,
    );
    const m = s.match(re);
    if (m) {
        const day = parseInt(m[1], 10);
        const month = MONTH_MAP[m[2]];
        const year = m[3] ? parseInt(m[3], 10) : null;
        const hour = m[4] ? parseInt(m[4], 10) : 0;
        const min = m[5] ? parseInt(m[5], 10) : 0;
        if (year !== null) return buildDate(day, month, year, hour, min);
        return inferYearForward(day, month, hour, min, now);
    }

    return null;
}

/**
 * Scanna en längre text efter ALLA datum och returnera bästa kandidaten.
 *
 * "Bästa" = första **framtida** datum (>= idag), eller idag.
 * Detta undviker att vi snappar upp publish-datum / skapad-datum som ofta
 * finns längre upp i HTML:n och är tidigare än själva eventet.
 *
 * Fall tillbaka på första datumet om inget framtida hittas.
 */
export function findFirstDateInText(text: string, now: Date = new Date()): Date | null {
    if (!text) return null;
    const clean = text
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8211;/g, '–')
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const candidates: Date[] = [];

    // 1. ISO (med eller utan tid)
    const isoRe = /(\d{4})-(\d{2})-(\d{2})(?:t(\d{1,2}):(\d{2}))?/g;
    let i: RegExpExecArray | null;
    while ((i = isoRe.exec(clean)) !== null) {
        const d = buildDate(
            parseInt(i[3], 10), parseInt(i[2], 10) - 1, parseInt(i[1], 10),
            i[4] ? parseInt(i[4], 10) : 0, i[5] ? parseInt(i[5], 10) : 0,
        );
        if (d) candidates.push(d);
    }

    // 2. "DD MONTH YYYY [HH:MM]"
    const yearRe = new RegExp(
        `(\\d{1,2})\\s+(${MONTH_PATTERN})\\s+(\\d{4})(?:[\\s,]+(?:kl\\.?\\s*)?(\\d{1,2})[:.](\\d{2}))?`,
        'g',
    );
    let y: RegExpExecArray | null;
    while ((y = yearRe.exec(clean)) !== null) {
        const d = buildDate(
            parseInt(y[1], 10), MONTH_MAP[y[2]], parseInt(y[3], 10),
            y[4] ? parseInt(y[4], 10) : 0, y[5] ? parseInt(y[5], 10) : 0,
        );
        if (d) candidates.push(d);
    }

    // 2b. "MONTH DD, YYYY [HH:MM:SS [fm/em]]" — amerikansk ordning, ofta hos
    // sajter som använder Tribe Events Calendar eller liknande engelska teman
    // även med svenska månadsnamn. Ex: "juni 6, 2026 10:00:00 fm CEST".
    const usOrderRe = new RegExp(
        `(${MONTH_PATTERN})\\s+(\\d{1,2}),?\\s*(\\d{4})(?:[\\s,]+(?:kl\\.?\\s*)?(\\d{1,2})[:.](\\d{2})(?::(\\d{2}))?\\s*(fm|em)?)?`,
        'g',
    );
    let u: RegExpExecArray | null;
    while ((u = usOrderRe.exec(clean)) !== null) {
        let hour = u[4] ? parseInt(u[4], 10) : 0;
        const minute = u[5] ? parseInt(u[5], 10) : 0;
        const ampm = u[7];
        if (ampm === 'em' && hour < 12) hour += 12;
        if (ampm === 'fm' && hour === 12) hour = 0;
        const d = buildDate(
            parseInt(u[2], 10), MONTH_MAP[u[1]], parseInt(u[3], 10),
            hour, minute,
        );
        if (d) candidates.push(d);
    }

    // 3. "DD MONTH [HH:MM]" utan år — gissa år framåt
    const noYearRe = new RegExp(
        `(\\d{1,2})\\s+(${MONTH_PATTERN})(?:[\\s,]+(?:kl\\.?\\s*)?(\\d{1,2})[:.](\\d{2}))?`,
        'g',
    );
    let n: RegExpExecArray | null;
    while ((n = noYearRe.exec(clean)) !== null) {
        const d = inferYearForward(
            parseInt(n[1], 10), MONTH_MAP[n[2]],
            n[3] ? parseInt(n[3], 10) : 0, n[4] ? parseInt(n[4], 10) : 0, now,
        );
        if (d) candidates.push(d);
    }

    if (candidates.length === 0) return null;

    // Föredra första framtida datum (>= idag).
    const futureDates = candidates.filter((d) => d >= todayStart);
    if (futureDates.length === 0) return candidates[0];

    // Skydd: om första framtida datumet är IDAG, hoppa över det och leta nästa
    // (idag är ofta build-/publication-/last-updated-datum i HTML:n). Använd
    // bara "idag" om inget senare datum finns.
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const isToday = (d: Date) => d >= todayStart && d < tomorrowStart;
    const afterToday = futureDates.filter((d) => !isToday(d));
    if (afterToday.length > 0) return afterToday[0];

    // Bara "idag"-datum finns — använd det
    return futureDates[0];
}

/**
 * Normalisera ett "bara datum"-event (hasSpecificTime=false) till en neutral
 * eftermiddagstid i stället för lokal midnatt.
 *
 * Bakgrund: buildDate() skapar `new Date(y, m, d, 0, 0)` = LOKAL midnatt. När
 * det serialiseras med toISOString() blir det 22:00Z (sommar/CEST) eller
 * 23:00Z (vinter/CET) FÖREGÅENDE dag. Det ser ut som ett riktigt klockslag
 * (00:00 lokalt) OCH kan rulla över dygnsgränsen vid rendering.
 *
 * Lösning: pinna 12:00 UTC på eventets STOCKHOLMS-lokala kalenderdag. Stockholm
 * är UTC+1/+2, så 12:00Z = 13:00 (vinter) / 14:00 (sommar) lokalt — tydligt
 * dagtid (≈14:00 som önskat) och datumet rullar aldrig. Intl-baserad så den är
 * oberoende av maskinens tidszon.
 */
export function normalizeDateOnlyTime(d: Date): Date {
    if (isNaN(d.getTime())) return d;
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Stockholm',
        year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(d); // "YYYY-MM-DD"
    return new Date(`${ymd}T12:00:00.000Z`);
}
