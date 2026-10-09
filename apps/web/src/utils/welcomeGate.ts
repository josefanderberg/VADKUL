/**
 * Välkomstrutan visas när ett BESÖK börjar — inte vid varje sidladdning.
 *
 * Bakgrunden (mejl från en användare 8/10: "vid flera tillfällen hoppar appen
 * tillbaka till startsidan"): mobilen laddar om kartsidan av sig själv mycket
 * oftare än man tror. iOS slänger en bakgrundsflik/hemskärmsapp med tung
 * WebGL-karta så fort man varit iväg en stund (t.ex. i bokningslänken som
 * öppnas i ny flik), tillbaka-knappen från arrangörssidan laddar om, och
 * dra-ned-för-att-uppdatera triggas av svep på paneler. Varje omladdning
 * öppnade välkomstrutan igen för utloggade, och mitt i ett besök ser det ut
 * som att appen hoppar till startsidan.
 *
 * Regeln: kartsidan stämplar "senast aktiv" när den döljs/lämnas. Kommer man
 * tillbaka inom WELCOME_RESUME_MS räknas det som SAMMA besök och rutan hoppas
 * över. Ett nytt besök (längre bort, ny enhet, rensad lagring) får rutan som
 * vanligt — ägarbeslutet 11/8 ("utloggade möts av intron") gäller fortfarande.
 */
export const LAST_ACTIVE_KEY = 'vadkul_senast_aktiv';

/** Hur länge en paus räknas som samma besök. Samma tröskel som webbanalysens sessioner. */
export const WELCOME_RESUME_MS = 30 * 60 * 1000;

/**
 * Ska välkomstrutan auto-öppnas? REN funktion: `raw` är det lagrade värdet
 * (ms sedan epoch som sträng) eller null. Trasigt/saknat värde = nytt besök.
 * Framtida tidsstämpel = flyttad systemklocka; räknas som färsk hellre än att
 * visa rutan mitt i ett besök.
 */
export function shouldAutoShowWelcome(raw: string | null, nowMs: number): boolean {
    if (!raw) return true;
    const t = Number(raw);
    if (!Number.isFinite(t) || t <= 0) return true;
    return nowMs - t > WELCOME_RESUME_MS;
}

/**
 * ALLTID FÖR UTLOGGADE vid en ny navigering (ägarbeslut 8/10 kväll, Josef:
 * "kan den inte alltid visas vid utloggat läge?"): ny flik, inskriven adress
 * eller länk ('navigate') får alltid rutan. Bara när WEBBLÄSAREN laddar om
 * sidan av sig själv eller via tillbaka ('reload'/'back_forward' - iOS
 * slänger bakgrundsfliken, tillbaka från arrangörssidan) gäller 30-minuters-
 * regeln ovan, så Håkan-felet ("hoppar till startsidan") inte kommer tillbaka.
 * Okänd typ (gamla webbläsare) = bara 30-minutersregeln. REN funktion.
 */
export function shouldAutoShowWelcomeFor(navType: string | null, raw: string | null, nowMs: number): boolean {
    if (navType === 'navigate') return true;
    return shouldAutoShowWelcome(raw, nowMs);
}

/** Sidladdningens typ ur Navigation Timing, eller null. */
function readNavigationType(): string | null {
    try {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        return nav?.type ?? null;
    } catch {
        return null;
    }
}

/** Läs lagringen och avgör. Privat läge m.fl. kastar → behandla som nytt besök. */
export function readShouldAutoShowWelcome(nowMs: number = Date.now()): boolean {
    if (typeof window === 'undefined') return true;
    let raw: string | null = null;
    try { raw = window.localStorage.getItem(LAST_ACTIVE_KEY); } catch { return true; }
    return shouldAutoShowWelcomeFor(readNavigationType(), raw, nowMs);
}

/** Stämpla "senast aktiv". Tyst vid fel — det här är en bekvämlighet. */
export function markActive(nowMs: number = Date.now()): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(LAST_ACTIVE_KEY, String(nowMs));
    } catch { /* full/avstängd lagring — strunt samma */ }
}
