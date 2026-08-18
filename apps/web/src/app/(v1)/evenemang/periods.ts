// Delade period-helpers för klientfiltren ("Idag"/"Imorgon"/"I veckan") på
// /evenemang-sidorna (topplistan + stads-/kategorisidornas daglista). Ingen
// fs-import här — filen måste gå att importera från klientkomponenter
// (cityData.ts är server-only). Sidorna är statiskt byggda; datumen räknas
// mot användarens RIKTIGA klocka i svensk tidszon, så filtren pekar rätt
// även om deployen är några dagar gammal.

// 'week' ersatte 'weekend' 18/8 (Josef): veckan visar volymen bättre — samma
// byte som intro-radens "N i veckan" och topplistans "Mest i veckan".
export type Period = 'all' | 'today' | 'tomorrow' | 'week';

const TZ = 'Europe/Stockholm';
const keyFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dateKey = (d: Date) => keyFmt.format(d);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export const PERIODS: { key: Period; label: string; unit: string }[] = [
    { key: 'all', label: 'Alla', unit: 'event' },
    { key: 'today', label: 'Idag', unit: 'idag' },
    { key: 'tomorrow', label: 'Imorgon', unit: 'imorgon' },
    { key: 'week', label: 'I veckan', unit: 'i veckan' },
];

/** "Idag"/"Imorgon" för en dagnyckel, annars null (t.ex. "Lör"). Klockberoende
 *  precis som periodKeys — får bara kallas EFTER mount, annars kan byggdagens
 *  "idag" krocka med besökarens och hydreringen spricka. */
export function relativeDayLabel(key: string): string | null {
    const now = new Date();
    if (key === dateKey(now)) return 'Idag';
    if (key === dateKey(addDays(now, 1))) return 'Imorgon';
    return null;
}

/** Dagens nyckel (svensk tid). Klockberoende — bara efter mount. */
export function todayKey(): string {
    return dateKey(new Date());
}

/** Kommande veckans dagnycklar: idag + 6 dagar framåt. Samma definition som
 *  cityData.weekKeys — den är server-only (fs-import), och stadsindexets rader
 *  ska visa exakt samma "i veckan"-tal som stadssidornas intro-rad. Ändras den
 *  ena måste den andra följa med. */
export function weekKeys(): string[] {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => dateKey(addDays(now, i)));
}

/** Vilka 'YYYY-MM-DD'-nycklar (svensk tid) perioden motsvarar just nu.
 *  null = ingen dagbegränsning (Alla). */
export function periodKeys(period: Period): string[] | null {
    if (period === 'all') return null;
    const now = new Date();
    if (period === 'today') return [dateKey(now)];
    if (period === 'tomorrow') return [dateKey(addDays(now, 1))];
    // I veckan = idag + 6 dagar framåt (samma definition som weekKeys).
    return weekKeys();
}
