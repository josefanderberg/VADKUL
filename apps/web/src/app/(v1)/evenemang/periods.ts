// Delade period-helpers för klientfiltren ("Idag"/"Imorgon"/"I helgen") på
// /evenemang-sidorna (topplistan + stads-/kategorisidornas daglista). Ingen
// fs-import här — filen måste gå att importera från klientkomponenter
// (cityData.ts är server-only). Sidorna är statiskt byggda; datumen räknas
// mot användarens RIKTIGA klocka i svensk tidszon, så filtren pekar rätt
// även om deployen är några dagar gammal.

export type Period = 'all' | 'today' | 'tomorrow' | 'weekend';

const TZ = 'Europe/Stockholm';
const keyFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dowFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' });
const dateKey = (d: Date) => keyFmt.format(d);
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

export const PERIODS: { key: Period; label: string; unit: string }[] = [
    { key: 'all', label: 'Alla', unit: 'event' },
    { key: 'today', label: 'Idag', unit: 'idag' },
    { key: 'tomorrow', label: 'Imorgon', unit: 'imorgon' },
    { key: 'weekend', label: 'I helgen', unit: 'i helgen' },
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
    // I helgen = nästkommande lör+sön; på lördag = idag+imorgon, på söndag = idag.
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dowFmt.format(now));
    if (dow === 0) return [dateKey(now)];
    const sat = addDays(now, 6 - dow);
    return [dateKey(sat), dateKey(addDays(sat, 1))];
}
