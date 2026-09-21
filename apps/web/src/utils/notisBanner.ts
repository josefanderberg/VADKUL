// Notis-bannern i kartans botten-slot: "Vill du få helgtipsen för Växjö?"
// Bara 19 av 237 helgtips-mottagare hade notiser på (torsdagen 17/9) - de
// enda vägarna in var profilpanelens rad och en engångstoast efter första
// gillningen. Bannern är den synliga vägen, men bara där den kan leverera:
//
//   - I APPEN PÅ HEMSKÄRMEN (standalone). På iPhone finns web-push BARA där
//     (iOS 16.4+); på Android/dator hade det gått i webbläsaren också, men
//     den som sparat appen har redan visat att hen vill tillbaka - där
//     tjatar bannern minst och ger mest (Josef 21/9).
//   - Bara när webbläsaren ALDRIG fått frågan ('default'). 'denied' går inte
//     att fråga om från JS, och 'off' = användaren stängde av själv i
//     profilpanelen - det valet respekteras.
//   - "Inte nu" snoozar i 14 dagar, efter två nej aldrig mer. En banner som
//     dyker upp varje besök blir man blind för.
//
// Själva tillståndsfrågan MÅSTE komma från en riktig tapp (se
// enableEventReminders i utils/fcm) - bannern visar därför en knapp, den
// frågar aldrig av sig själv. React-fri modul så grinden kan testas.

import type { NotisStatus } from './fcm';

export const NOTIS_BANNER_KEY = 'vadkul_notis_banner';
/** "Inte nu" tystar bannern så här länge. */
export const NOTIS_BANNER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
/** Efter så många "Inte nu" visas den aldrig mer på enheten. */
export const NOTIS_BANNER_MAX_DISMISSALS = 2;
/** Väntan efter välkomstrutan - ingen banner i första sekunden av besöket. */
export const NOTIS_BANNER_DELAY_MS = 8000;

export interface NotisBannerMemory {
    dismissals: number;
    /** ms-epoch för senaste "Inte nu", 0 = aldrig. */
    lastDismissedAt: number;
}

const EMPTY: NotisBannerMemory = { dismissals: 0, lastDismissedAt: 0 };

/** localStorage-värdet → minnet. Trasigt eller saknat = aldrig avfärdad. */
export function parseNotisBannerMemory(raw: string | null): NotisBannerMemory {
    if (!raw) return EMPTY;
    try {
        const v = JSON.parse(raw) as Partial<NotisBannerMemory>;
        const dismissals = Number(v.dismissals);
        const lastDismissedAt = Number(v.lastDismissedAt);
        return {
            dismissals: Number.isFinite(dismissals) && dismissals > 0 ? Math.floor(dismissals) : 0,
            lastDismissedAt: Number.isFinite(lastDismissedAt) && lastDismissedAt > 0 ? lastDismissedAt : 0,
        };
    } catch {
        return EMPTY;
    }
}

export function recordNotisBannerDismissal(mem: NotisBannerMemory, now: number): NotisBannerMemory {
    return { dismissals: mem.dismissals + 1, lastDismissedAt: now };
}

export interface NotisBannerGate {
    /** Körs sidan som app från hemskärmen? */
    standalone: boolean;
    status: NotisStatus;
    memory: NotisBannerMemory;
}

/** Får bannern erbjudas det här besöket? (Kartans tystnadsregler och
 *  turordningen i botten-slotten avgörs i page.tsx.) */
export function shouldOfferNotisBanner(gate: NotisBannerGate, now: number): boolean {
    if (!gate.standalone) return false;
    if (gate.status !== 'default') return false;
    if (gate.memory.dismissals >= NOTIS_BANNER_MAX_DISMISSALS) return false;
    if (gate.memory.lastDismissedAt > 0 && now - gate.memory.lastDismissedAt < NOTIS_BANNER_SNOOZE_MS) return false;
    return true;
}

/**
 * Staden bannern lovar helgtips för. Kontots sparade stad vinner - det är
 * den helgtipset faktiskt skickas för (users.citySlug) - annars stadens namn
 * där kartan står, som då sparas på kontot när notiserna slås på. null =
 * ingen stad (ute på landet/utomlands) → bannern talar bara om notiser.
 */
export function notisBannerCity<C extends { name: string; slug: string }>(
    savedSlug: string | null | undefined,
    lookup: (slug: string) => C | null,
    mapCity: C | null,
): { city: C; saved: boolean } | null {
    const saved = savedSlug ? lookup(savedSlug) : null;
    if (saved) return { city: saved, saved: true };
    return mapCity ? { city: mapCity, saved: false } : null;
}
