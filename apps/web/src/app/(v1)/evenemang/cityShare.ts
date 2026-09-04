/**
 * Rena hjälpare för stads-/kategorisidornas delningsbild (opengraph-image).
 * Fristående från satori/fs så de kan testas.
 */
import type { CityEvent } from './cityData';
import { pickRecommended, shortDayLabel } from './cityData';

export type ShareLine = { emoji: string; title: string; when: string };

/** "1234" → "1 234" (svensk tusentalsavgränsning, vanligt mellanslag). */
export function formatCount(n: number): string {
    return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Kapa vid ordgräns med ellips; max räknas i tecken. */
export function truncateTitle(title: string, max = 48): string {
    const t = title.trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max - 1);
    const sp = cut.lastIndexOf(' ');
    return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/** Radera till bilden: pickRecommended (spridning över kategori/värd/plats),
 *  bara kommande, kapade titlar, "Lör 6/9"-etikett. */
export function pickShareLines(events: CityEvent[], n = 3, now = Date.now()): ShareLine[] {
    const upcoming = events.filter(e => new Date(e.time).getTime() >= now - 60 * 60 * 1000);
    return pickRecommended(upcoming, n).map(e => ({
        emoji: e.emoji || '🎉',
        title: truncateTitle(e.title),
        when: shortDayLabel(e.time),
    }));
}
