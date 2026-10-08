/**
 * FÖRTUREN till appen (löftet 8/10): oktobermejlet lovar förtur till den som
 * bjuder med en vän som tackar ja, Facebook-inläggen till den som bjuder in en
 * vän att bli medlem. Båda vägarna bokförs i forturInbjudningar/{inbjuden}_{fran}
 * - ETT dokument per par, så varje inbjudare vars vän tackar ja får sin förtur
 * även om vännen blivit bjuden av flera.
 *
 * Flödet: en länk med ?fran=<uid> (Bjud med, privata chatten - eller vilken
 * vadkul.se-länk som helst) lägger inbjudaren på enheten i 30 dagar, och den
 * senaste länken vinner. När besökaren sedan skapar konto ('konto') eller
 * svarar Kommer/Intresserad ('svar') skrivs posten av services/forturService.
 * Reglerna låser posten till den inbjudnas eget uid, och ett 'svar' måste
 * finnas i eventRsvps. Listan tas ut med docs/outreach/build-forturlista.mjs.
 *
 * Den här modulen är den rena logiken + lagringsomslaget (som mapFilter).
 */

export type ForturTyp = 'konto' | 'svar';

export const FORTUR_KEY = 'vadkul_fortur_fran';

/** En inbjudan som legat en månad utan konto eller svar räknas inte längre. */
export const FORTUR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Samma uid-form som kartan och /e/-omdirigeringen godtar för ?fran=. */
const UID_RE = /^[A-Za-z0-9]{10,64}$/;
/** eventShareSlug: 16 hex-tecken. Samma mönster står i reglerna. */
const SLUG_RE = /^[0-9a-f]{16}$/;

export interface PendingFortur {
    /** Inbjudarens uid. */
    fran: string;
    /** När länken öppnades (ms). */
    at: number;
}

export interface ForturPost {
    /** Dokument-id: `${inbjuden}_${fran}`. */
    id: string;
    data: {
        inbjuden: string;
        fran: string;
        typ: ForturTyp;
        eventSlug?: string;
    };
}

/** Inbjudarens uid ur en querystring, eller null om den saknas/är trasig. */
export function franFromSearch(search: string): string | null {
    const fran = new URLSearchParams(search).get('fran');
    return fran && UID_RE.test(fran) ? fran : null;
}

/**
 * Den personliga inbjudningslänken (profilens "Bjud in en vän"): startsidan
 * med ?fran=<uid>, samma parameter som Bjud med bär. Ingen eventkoppling -
 * vännen räknas när hen skapar konto (FB-inläggens "bli medlem").
 */
export function memberInviteUrl(origin: string, uid: string): string {
    return `${origin}/?fran=${encodeURIComponent(uid)}`;
}

/** Det som skrivs till lagringen - exporterad för testerna. */
export function serializePendingFortur(fran: string, nowMs: number): string {
    return JSON.stringify({ fran, at: nowMs });
}

/** Tolka det lagrade värdet. Trasigt eller utgånget ger null. */
export function parsePendingFortur(raw: string | null, nowMs: number): PendingFortur | null {
    if (!raw) return null;
    let obj: unknown;
    try { obj = JSON.parse(raw); } catch { return null; }
    if (!obj || typeof obj !== 'object') return null;
    const { fran, at } = obj as Record<string, unknown>;
    if (typeof fran !== 'string' || !UID_RE.test(fran)) return null;
    if (typeof at !== 'number' || !Number.isFinite(at)) return null;
    if (nowMs - at > FORTUR_MAX_AGE_MS) return null;
    return { fran, at };
}

/**
 * Posten som ska skrivas för den inbjudna, eller null när inget ska
 * bokföras: ingen väntande inbjudan, egen länk (fran === inbjuden) eller ett
 * 'svar' utan giltigt event-slug. Tiden (tid) sätts av tjänsten med
 * serverTimestamp - reglerna kräver request.time.
 */
export function forturPost(
    pending: PendingFortur | null,
    inbjuden: string,
    typ: ForturTyp,
    eventSlug?: string,
): ForturPost | null {
    if (!pending || !UID_RE.test(inbjuden) || pending.fran === inbjuden) return null;
    if (typ === 'svar' && !(eventSlug && SLUG_RE.test(eventSlug))) return null;
    return {
        id: `${inbjuden}_${pending.fran}`,
        data: {
            inbjuden,
            fran: pending.fran,
            typ,
            ...(typ === 'svar' ? { eventSlug } : {}),
        },
    };
}

/**
 * Lägg ?fran=<uid> ur adressen på enheten. Anropas i FÖRSTA klientrendern
 * (AuthProvider) - kartsidan skriver om adressen i sina effekter.
 */
export function rememberForturFran(search = window.location.search, nowMs = Date.now()): void {
    const fran = franFromSearch(search);
    if (!fran) return;
    try {
        window.localStorage.setItem(FORTUR_KEY, serializePendingFortur(fran, nowMs));
    } catch { /* privat läge - inbjudan gäller då inte */ }
}

/** Den väntande inbjudan på enheten. null = ingen (eller privat läge). */
export function readPendingFortur(nowMs = Date.now()): PendingFortur | null {
    try {
        return parsePendingFortur(window.localStorage.getItem(FORTUR_KEY), nowMs);
    } catch { return null; }
}

export function clearPendingFortur(): void {
    try { window.localStorage.removeItem(FORTUR_KEY); } catch { /* privat läge */ }
}
