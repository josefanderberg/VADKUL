/**
 * Rena hjälpare för stads-/kategorisidornas delningsbild (opengraph-image).
 * Fristående från satori/fs så de kan testas.
 */
import type { CityEvent } from './cityData';
import { pickRecommended, shortDayLabel, clockLabel } from './cityData';

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

/** Rader till bilden: veckans bästa (pickRecommended — spridning över
 *  kategori/värd/plats), bara inom `horizonDays` framåt, kapade titlar,
 *  "Lör 6/9 · 19:00" (klockslag när eventet har ett). Delas länken varje dag
 *  (ägarens plan 4/9) ska bilden vara den dagens veckolista. */
export function pickShareLines(events: CityEvent[], n = 5, now = Date.now(), horizonDays = 7): ShareLine[] {
    const from = now - 60 * 60 * 1000;
    const to = now + horizonDays * 24 * 60 * 60 * 1000;
    const upcoming = events.filter(e => {
        const t = new Date(e.time).getTime();
        return t >= from && t < to;
    });
    return pickRecommended(upcoming, n).map(e => ({
        emoji: e.emoji || '🎉',
        title: truncateTitle(e.title, 44),
        when: e.hasSpecificTime ? `${shortDayLabel(e.time)} · ${clockLabel(e.time)}` : shortDayLabel(e.time),
    }));
}
