/**
 * Minne över sid-/seed-event som hämtats och AVFÄRDATS på datum — så att de
 * inte laddas om varje natt. Nattkörningen 28/9 laddade ~2 700 FB-eventsidor
 * (seed-filen + sidbevakningarnas /events-flikar, som även listar gamla event)
 * som låg utanför 30-dagarsfönstret; de sparas aldrig och kom därför tillbaka
 * i kön nästa natt igen. En sidladdning ≈ 10 s → timmar per natt.
 *
 *   - passerat event        → hoppas över för gott (datumet ändras inte)
 *   - event bortom fönstret → hoppas över tills det kommer inom fönstret
 *   - inget parsbart datum  → vilar NO_DATE_RETRY_DAYS dagar, sen nytt försök
 *
 * Gäller bara event med requiresParsedDate (sid-/seed-spåret): där är datumet
 * betrott, så beslutet går att minnas. Rena funktioner + tunn fil-IO.
 */
import * as fs from 'fs';

export interface RejectEntry {
    /** Eventets betrodda starttid (ISO) när det avfärdades på fönstret. */
    eventTime?: string;
    /** Inget datum kunde parsas — försök igen efter denna tidpunkt (ISO). */
    retryAfter?: string;
}
export type RejectMemory = Record<string, RejectEntry>;

export const NO_DATE_RETRY_DAYS = 14;
/** Passerade poster glöms efter ett år så filen inte växer för evigt. */
const PAST_KEEP_DAYS = 365;
const DAY = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
    const s = new Date(d);
    s.setHours(0, 0, 0, 0);
    return s;
}

function horizonEnd(now: Date, horizonDays: number): Date {
    const e = new Date(now);
    e.setDate(e.getDate() + horizonDays);
    e.setHours(23, 59, 59, 999);
    return e;
}

/** true ⇒ ladda inte sidan i natt. */
export function shouldSkip(mem: RejectMemory, url: string, now: Date = new Date(), horizonDays = 30): boolean {
    const e = mem[url];
    if (!e) return false;
    if (e.eventTime) {
        const t = new Date(e.eventTime);
        if (isNaN(t.getTime())) return false;
        if (t < startOfDay(now)) return true;              // passerat — för gott
        return t > horizonEnd(now, horizonDays);           // bortom fönstret — tills vidare
    }
    if (e.retryAfter) return now < new Date(e.retryAfter);
    return false;
}

export function rememberOutsideWindow(mem: RejectMemory, url: string, eventTime: Date): void {
    if (isNaN(eventTime.getTime())) return;
    mem[url] = { eventTime: eventTime.toISOString() };
}

export function rememberNoDate(mem: RejectMemory, url: string, now: Date = new Date()): void {
    mem[url] = { retryAfter: new Date(now.getTime() + NO_DATE_RETRY_DAYS * DAY).toISOString() };
}

/** Släpp poster som inte längre gör nytta (gamla passerade, utgångna no-date). */
export function pruneMemory(mem: RejectMemory, now: Date = new Date()): RejectMemory {
    const out: RejectMemory = {};
    const pastCutoff = new Date(now.getTime() - PAST_KEEP_DAYS * DAY);
    for (const [url, e] of Object.entries(mem)) {
        if (e.eventTime && new Date(e.eventTime) < pastCutoff) continue;
        if (!e.eventTime && e.retryAfter && new Date(e.retryAfter) <= now) continue;
        out[url] = e;
    }
    return out;
}

export function loadRejectMemory(file: string): RejectMemory {
    try {
        if (!fs.existsSync(file)) return {};
        const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
        return raw && typeof raw === 'object' && !Array.isArray(raw) ? pruneMemory(raw) : {};
    } catch {
        return {};
    }
}

export function saveRejectMemory(file: string, mem: RejectMemory): void {
    try {
        fs.writeFileSync(file, JSON.stringify(mem), 'utf-8');
    } catch (err) {
        console.error('⚠️ Kunde inte skriva FB-avfärdningsminnet:', (err as Error)?.message);
    }
}
