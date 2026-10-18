/**
 * Vän-inbjudan från profilen (Josef 13/10: "lägga till en vän direkt i
 * profilen så man delar en länk och bjuder in någon"). Länken är
 * vadkul.se/?van=<inbjudarens uid>; mottagaren ser en banner och blir vän
 * med inbjudaren via Cloud-funktionen acceptFriendInvite, som också delar ut
 * en stjärna var till nya konton (tak 5 för inbjudaren - besluten bor i
 * apps/functions/src/utils/friendInvite.ts).
 *
 * Inbjudan PARKERAS i localStorage så den överlever inloggningen (Google-
 * inloggningen kan ladda om sidan) och ett nytt konto som skapas en stund
 * senare. Den gäller i INVITE_TTL_MS - en gammal inbjudan ska inte dyka upp
 * veckor senare. Ren logik så den kan testas.
 */

export const FRIEND_INVITE_KEY = 'vadkul_van_inbjudan';
export const FRIEND_INVITE_PARAM = 'van';
/** Så länge en parkerad inbjudan gäller - samma 7 dagar som "nytt konto". */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Ett uid ur länken (samma regel som functions isInviteUid). */
export function isInviteUid(v: unknown): v is string {
    return typeof v === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(v);
}

export function friendInviteUrl(origin: string, uid: string): string {
    return `${origin.replace(/\/+$/, '')}/?${FRIEND_INVITE_PARAM}=${encodeURIComponent(uid)}`;
}

/** Delningstexten (navigator.share / urklipp). */
export const FRIEND_INVITE_TEXT = 'Häng med på VADKUL - kartan över allt som händer runt oss! Skapa konto via länken så blir vi vänner och får en stjärna var ⭐';

export interface ParkedInvite {
    fran: string;
    at: number;
}

export function serializeInvite(fran: string, nowMs: number): string {
    return JSON.stringify({ fran, at: nowMs } satisfies ParkedInvite);
}

/** Tolka den parkerade inbjudan defensivt; för gammal eller trasig = null. */
export function parseParkedInvite(raw: string | null, nowMs: number): ParkedInvite | null {
    if (!raw) return null;
    try {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (!isInviteUid(d.fran) || typeof d.at !== 'number' || !Number.isFinite(d.at)) return null;
        if (nowMs - d.at > INVITE_TTL_MS || d.at - nowMs > 60_000) return null;
        return { fran: d.fran, at: d.at };
    } catch {
        return null;
    }
}

/** localStorage-nyckeln för räknade landningar: { [inbjudarUid]: nowMs }. */
export const INVITE_LANDING_KEY = 'vadkul_van_landningar';

/** Ska den här ?van=-landningen räknas (friendInviteStats.landed)? En per
 *  inbjudare och webbläsare - omladdningar och omklick på samma länk ska
 *  inte blåsa upp statistiken. Gamla poster rensas med samma TTL som
 *  inbjudan; `next` skrivs alltid tillbaka till localStorage. */
export function registerLanding(
    raw: string | null,
    fran: string,
    nowMs: number,
): { count: boolean; next: string } {
    const seen: Record<string, number> = {};
    if (raw) {
        try {
            const d = JSON.parse(raw) as Record<string, unknown>;
            for (const [k, v] of Object.entries(d)) {
                if (isInviteUid(k) && typeof v === 'number' && Number.isFinite(v)
                    && nowMs - v <= INVITE_TTL_MS && v - nowMs <= 60_000) {
                    seen[k] = v;
                }
            }
        } catch { /* trasigt värde = börja om */ }
    }
    const count = !(fran in seen);
    if (count) seen[fran] = nowMs;
    return { count, next: JSON.stringify(seen) };
}

/** Vems inbjudan som gäller: länken vinner över en parkerad. Ens egen länk
 *  (man testar att öppna den själv) ger ingen banner. */
export function pickFriendInvite(
    paramValue: string | null,
    parked: ParkedInvite | null,
    myUid: string | null,
): string | null {
    const fran = isInviteUid(paramValue) ? paramValue : parked?.fran ?? null;
    if (!fran || fran === myUid) return null;
    return fran;
}
