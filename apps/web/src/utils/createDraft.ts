import type { EventCategoryType } from '@/utils/categories';
import type { RepeatRhythm } from '@/utils/weeklySeries';

// ── Utkastet i skapa-formuläret ──────────────────────────────────────────────
// Josef 8/10: "om man skriver in lite och sen stänger ner den, så ska det ju
// vara kvar under sessionen". Att stänga skapa-rutan (Avbryt, Escape, klick
// bredvid) sparar det man skrivit här; nästa gång rutan öppnas står det kvar,
// i samma flik (Jag arrangerar / Jag tipsar bara / Önska event). Utkastet
// rensas först när eventet/önskan faktiskt skapats.
//
// sessionStorage (per flik, överlever omladdning men inte att fliken stängs)
// = "under sessionen". Bilden är en File och kan inte serialiseras — den
// hålls bara i minnet (page.tsx) och tappas vid omladdning.
//
// Redigering av befintligt event och "Skapa eventet av önskan" är förifyllda
// från något annat och sparas ALDRIG som utkast.

export const CREATE_DRAFT_KEY = 'vadkul_create_draft';

export type CreateDraft = {
    v: 1;
    kind: 'event' | 'wish';
    role: 'host' | 'tip';
    title: string;
    /** datetime-local-sträng, '' = ingen. */
    time: string;
    category: EventCategoryType;
    place: string;
    price: string;
    description: string;
    url: string;
    host: string;
    repeats: boolean;
    repeatInterval: RepeatRhythm;
    repeatTimes: number | null;
    showMoreDetails: boolean;
};

/** Har användaren skrivit något alls? Bara flikval/tid räknas inte — tiden
 *  förifylls ju automatiskt varje gång rutan öppnas. */
export function draftHasContent(d: CreateDraft): boolean {
    return [d.title, d.place, d.price, d.description, d.url, d.host].some(s => s.trim() !== '');
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** REN parsning/validering (testbar): JSON → utkast, eller null när det är
 *  trasigt/främmande. Kategorin valideras av anroparen mot EVENT_CATEGORIES. */
export function parseCreateDraft(json: string): CreateDraft | null {
    let raw: unknown;
    try { raw = JSON.parse(json); } catch { return null; }
    if (!raw || typeof raw !== 'object') return null;
    const d = raw as Record<string, unknown>;
    if (d.v !== 1) return null;
    const rhythm = d.repeatInterval;
    const times = d.repeatTimes;
    const draft: CreateDraft = {
        v: 1,
        kind: d.kind === 'wish' ? 'wish' : 'event',
        role: d.role === 'host' ? 'host' : 'tip',
        title: str(d.title),
        time: str(d.time),
        category: (str(d.category) || 'other') as EventCategoryType,
        place: str(d.place),
        price: str(d.price),
        description: str(d.description),
        url: str(d.url),
        host: str(d.host),
        repeats: d.repeats === true,
        repeatInterval: rhythm === 2 || rhythm === 'daily' ? rhythm : 1,
        repeatTimes: typeof times === 'number' && Number.isInteger(times) && times > 0 ? times : null,
        showMoreDetails: d.showMoreDetails === true,
    };
    return draft;
}

/** Utkastets tid gäller bara om den inte redan passerat — annars förifylls
 *  en ny tid som vanligt (ett event "igår kl 19" vore fel förval). */
export function draftTimeStillValid(time: string, nowMs: number): boolean {
    if (!time) return false;
    const ms = new Date(time).getTime();
    return Number.isFinite(ms) && ms >= nowMs;
}

/** Läs utkastet. Får aldrig kasta — privat läge utan storage = inget utkast. */
export function loadCreateDraft(): CreateDraft | null {
    try {
        const json = sessionStorage.getItem(CREATE_DRAFT_KEY);
        return json ? parseCreateDraft(json) : null;
    } catch { return null; }
}

/** Spara utkastet; ett tomt utkast tar bort posten. */
export function saveCreateDraft(d: CreateDraft): void {
    try {
        if (draftHasContent(d)) sessionStorage.setItem(CREATE_DRAFT_KEY, JSON.stringify(d));
        else sessionStorage.removeItem(CREATE_DRAFT_KEY);
    } catch { /* ingen storage — utkastet lever bara i minnet */ }
}

export function clearCreateDraft(): void {
    try { sessionStorage.removeItem(CREATE_DRAFT_KEY); } catch { /* ingen storage */ }
}
