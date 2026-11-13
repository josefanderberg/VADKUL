/**
 * Uppmaningen att logga in efter ett svar utan konto (#214).
 *
 * Kommer/Intresserad kräver inget konto: svaret skrivs direkt på en anonym
 * session (AuthContext.ensureTipIdentity). Josef 13/11: "det är ju jättemånga
 * anonyma ... är det inte bättre att få upp login eller registrera eller en
 * popup som säger att man ska logga in för att spara sitt val och få notiser".
 * Svaret ska fortfarande gå igenom utan konto (de flesta är engångsbesökare,
 * mätt 29/10: 6 av 120 kom tillbaka), så uppmaningen kommer EFTER svaret och
 * går att tacka nej till. Loggar man in länkas den anonyma sessionen till
 * kontot (signInWithGoogle/register), så svaret följer med.
 *
 * Ren logik: när uppmaningen får visas. Kartsidan ((v2)/page.tsx) visar den.
 */
import type { EventRsvpStatus } from '../types';

/** localStorage: när man senast tackade nej (ms sedan epoken). */
export const RSVP_LOGIN_PROMPT_KEY = 'vadkul_rsvp_login_prompt_dismissed';
/** Efter "Inte nu" är det tyst så här länge. */
export const RSVP_LOGIN_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export interface RsvpLoginPromptInput {
    /** Finns ett riktigt (inte anonymt) konto inloggat? */
    hasAccount: boolean;
    /** Läget efter trycket: null = svaret togs bort. */
    next: EventRsvpStatus | null;
    /** Har uppmaningen redan visats under det här besöket? */
    shownThisVisit: boolean;
    /** Sparat värde under RSVP_LOGIN_PROMPT_KEY (null = aldrig tackat nej). */
    dismissedAt: string | null;
    now: number;
}

/**
 * Visas uppmaningen efter det här trycket? Bara när ett svar faktiskt sattes
 * av någon utan konto, högst en gång per besök, och inte inom en vecka efter
 * att man tackat nej.
 */
export function shouldPromptRsvpLogin({ hasAccount, next, shownThisVisit, dismissedAt, now }: RsvpLoginPromptInput): boolean {
    if (hasAccount || next === null || shownThisVisit) return false;
    if (dismissedAt === null) return true;
    const at = Number(dismissedAt);
    // Trasigt eller framtida värde (ställd klocka): räkna som aldrig nekat.
    if (!Number.isFinite(at) || at > now) return true;
    return now - at >= RSVP_LOGIN_PROMPT_COOLDOWN_MS;
}

/** Rubriken i uppmaningen - påminnelsen gäller Kommer (1 h före, #185). */
export function rsvpLoginPromptText(next: EventRsvpStatus): string {
    return next === 'going'
        ? 'Logga in så sparas ditt svar och du får en påminnelse innan det börjar.'
        : 'Logga in så sparas ditt svar och följer med till dina andra enheter.';
}
