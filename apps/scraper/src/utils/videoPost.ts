/**
 * videoPost.ts — ren logik för videoinlägg (FB + IG).
 *
 * Används av schedule-video-post.ts. Ingen I/O här — allt är testat i
 * videoPost.test.ts. Graph-anropen bor i socialPublish.ts.
 *
 * BAKGRUND: Facebook schemalägger videor själv (`scheduled_publish_time`),
 * men Instagrams Content Publishing API kan inte schemalägga alls. IG-reelen
 * publiceras därför av en körning som STARTAS strax före klockslaget (GitHub
 * Actions-workflown videoinlagg.yml, lage=ig): containern skapas och
 * bearbetas direkt, sedan väntar körningen till utsatt tid och publicerar.
 * `reelTiming` avgör om körningen ska vänta, publicera direkt eller avbryta.
 */

/**
 * Lokal tid ("2026-10-26 11:00" eller "2026-10-26T11:00") → epoch ms, tolkad
 * i processens TZ (workflown och vitest kör Europe/Stockholm). Ogiltigt
 * datum, eller ett klockslag som inte finns (sommartidsskarven), ger null.
 */
export function parseLocalTime(s: string): number | null {
    const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const [y, mo, d, h, mi] = [+m[1], +m[2] - 1, +m[3], +m[4], +m[5]];
    const date = new Date(y, mo, d, h, mi, 0, 0);
    if (date.getFullYear() !== y || date.getMonth() !== mo || date.getDate() !== d
        || date.getHours() !== h || date.getMinutes() !== mi) return null;
    return date.getTime();
}

/** Klockslag för loggar, alltid Stockholmstid oavsett var jobbet kör. */
export function formatStockholm(ms: number): string {
    return new Date(ms).toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', hour12: false })
        .replace(/:\d{2}$/, '');
}

/** Så länge en IG-körning får vänta på klockslaget (containern lever 24 h,
 *  men en runner ska inte stå och sova i timmar). */
export const REEL_MAX_WAIT_MS = 45 * 60 * 1000;
/** Färskvara: har klockslaget passerat med mer än så här publiceras inte
 *  reelen alls — samma tanke som STALE_MS i igQueue.ts, fast snävare: det
 *  här är ett enstaka inlägg med ett valt klockslag. */
export const REEL_MAX_LATE_MS = 60 * 60 * 1000;

export type ReelTiming =
    | { action: 'vänta'; waitMs: number }
    | { action: 'publicera-nu'; lateMs: number }
    | { action: 'för-tidigt'; waitMs: number }
    | { action: 'för-sent'; lateMs: number };

/**
 * Vad en IG-körning ska göra givet nu och utsatt tid:
 *   vänta         — klockslaget ligger inom väntfönstret: förbered, sov, publicera
 *   publicera-nu  — klockslaget har passerat men inte med mer än maxLate
 *   för-tidigt    — längre fram än maxWait: avbryt, starta körningen senare
 *   för-sent      — äldre än maxLate: avbryt, inlägget får inte trilla ut sent
 */
export function reelTiming(
    now: number,
    publishAt: number,
    opts: { maxWaitMs?: number; maxLateMs?: number } = {},
): ReelTiming {
    const maxWait = opts.maxWaitMs ?? REEL_MAX_WAIT_MS;
    const maxLate = opts.maxLateMs ?? REEL_MAX_LATE_MS;
    const delta = publishAt - now;
    if (delta > maxWait) return { action: 'för-tidigt', waitMs: delta };
    if (delta > 0) return { action: 'vänta', waitMs: delta };
    const late = now - publishAt;   // ≥ 0 (aldrig -0: now - publishAt, inte -delta)
    if (late <= maxLate) return { action: 'publicera-nu', lateMs: late };
    return { action: 'för-sent', lateMs: late };
}

/** Läsbar varaktighet för loggar: "12 min", "1 h 5 min", "40 s". */
export function formatDuration(ms: number): string {
    const s = Math.round(Math.abs(ms) / 1000);
    if (s < 60) return `${s} s`;
    const min = Math.round(s / 60);
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60), rest = min % 60;
    return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/**
 * Objektnamn i Storage för en uppladdad video: mappen marketing-videos/,
 * filnamnet translittererat till ASCII (Meta hämtade aldrig en URL med rått
 * ö, se igImage.ts) och en tidsstämpel så en omkörning aldrig träffar
 * Googles CDN-cache med gammalt innehåll.
 */
export function videoStorageKey(fileName: string, now: number): string {
    const base = fileName.replace(/\.[^.]+$/, '');
    const ext = (fileName.match(/\.([a-z0-9]+)$/i)?.[1] ?? 'mp4').toLowerCase();
    const safe = base
        .toLowerCase()
        .replace(/å/g, 'a').replace(/ä/g, 'a').replace(/ö/g, 'o')
        .replace(/é/g, 'e').replace(/ü/g, 'u')
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-{2,}/g, '-')
        .replace(/^-|-$/g, '')
        || 'video';
    const stamp = new Date(now).toISOString().slice(0, 16).replace(/[-T:]/g, '');
    return `marketing-videos/${safe}-${stamp}.${ext}`;
}

/** MIME-typ Meta behöver se på video-URL:en. */
export function videoContentType(fileName: string): string {
    return /\.mov$/i.test(fileName) ? 'video/quicktime' : 'video/mp4';
}
