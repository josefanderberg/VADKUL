/**
 * iCalendar (.ics) engine.
 *
 * Många kommuner och kulturhus publicerar .ics-flöden gratis. Filerna är små,
 * stabila, och har precis det vi behöver: titel, datum, plats, beskrivning, URL.
 *
 * Config:
 *   urls:        string[]            — en eller flera .ics-URLs
 *   defaultUrl?: string              — fallback URL om VEVENT saknar URL-fält
 *   userAgent?:  string
 *   timeoutMs?:  number
 *
 * Detta är en enkel parser som täcker huvudfallen. För kantfall (recurring events,
 * komplex unfolding) finns biblioteket `node-ical` om vi vill uppgradera senare.
 */

import { RawEvent, EngineContext } from '../types';
import { domainLimiter } from '../rateLimiter';
import { fetchWithRetry } from '../../utils/fetchWithRetry';
import { decodeHtmlEntities } from '../../utils/text';

const DEFAULT_UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface IcalConfig {
    urls: string[];
    defaultUrl?: string;
    userAgent?: string;
    timeoutMs?: number;
}

async function fetchIcs(url: string, cfg: IcalConfig, signal?: AbortSignal): Promise<string | null> {
    await domainLimiter.wait(url);
    try {
        const res = await fetchWithRetry(url, {
            headers: { 'User-Agent': cfg.userAgent ?? DEFAULT_UA, 'Accept': 'text/calendar,text/plain' },
        }, { signal, timeoutPerAttemptMs: cfg.timeoutMs ?? 20_000, label: url });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

/** Unfold long lines: iCalendar fortsätter rader som börjar med space/tab. */
function unfold(raw: string): string[] {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const out: string[] = [];
    for (const line of lines) {
        if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
            out[out.length - 1] += line.slice(1);
        } else {
            out.push(line);
        }
    }
    return out;
}

/** Avkoda iCal-escapes (\\n, \\,, \\;). */
function unescape(v: string): string {
    return v
        .replace(/\\n/gi, '\n')
        .replace(/\\,/g, ',')
        .replace(/\\;/g, ';')
        .replace(/\\\\/g, '\\');
}

/** Tolka DATE eller DATE-TIME (UTC, lokal, eller med TZID). */
function parseIcsDate(value: string, params: Record<string, string>): Date | null {
    if (!value) return null;
    const v = value.trim();

    // YYYYMMDD (date only) → tolka som lokal midnatt
    if (/^\d{8}$/.test(v)) {
        const y = parseInt(v.slice(0, 4), 10);
        const m = parseInt(v.slice(4, 6), 10) - 1;
        const d = parseInt(v.slice(6, 8), 10);
        return new Date(y, m, d, 0, 0, 0);
    }

    // YYYYMMDDTHHMMSSZ (UTC)
    if (/^\d{8}T\d{6}Z$/.test(v)) {
        const y = parseInt(v.slice(0, 4), 10);
        const m = parseInt(v.slice(4, 6), 10) - 1;
        const d = parseInt(v.slice(6, 8), 10);
        const h = parseInt(v.slice(9, 11), 10);
        const mi = parseInt(v.slice(11, 13), 10);
        const s = parseInt(v.slice(13, 15), 10);
        return new Date(Date.UTC(y, m, d, h, mi, s));
    }

    // YYYYMMDDTHHMMSS (lokal eller TZID-styrd)
    if (/^\d{8}T\d{6}$/.test(v)) {
        const y = parseInt(v.slice(0, 4), 10);
        const m = parseInt(v.slice(4, 6), 10) - 1;
        const d = parseInt(v.slice(6, 8), 10);
        const h = parseInt(v.slice(9, 11), 10);
        const mi = parseInt(v.slice(11, 13), 10);
        const s = parseInt(v.slice(13, 15), 10);
        // TZID hanteras inte korrekt här — vi antar Stockholms-tid (lokal körning)
        return new Date(y, m, d, h, mi, s);
    }

    const fallback = new Date(v);
    return isNaN(fallback.getTime()) ? null : fallback;
}

/** Tolka rad: "PROP;PARAM1=v;PARAM2=v:value" */
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;
    const left = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const parts = left.split(';');
    const name = parts[0].toUpperCase();
    const params: Record<string, string> = {};
    for (let i = 1; i < parts.length; i++) {
        const eq = parts[i].indexOf('=');
        if (eq > 0) params[parts[i].slice(0, eq).toUpperCase()] = parts[i].slice(eq + 1);
    }
    return { name, params, value };
}

function parseVEvents(ics: string): Array<Record<string, { value: string; params: Record<string, string> }>> {
    const lines = unfold(ics);
    const events: any[] = [];
    let current: any = null;
    for (const line of lines) {
        if (line === 'BEGIN:VEVENT') {
            current = {};
        } else if (line === 'END:VEVENT') {
            if (current) events.push(current);
            current = null;
        } else if (current) {
            const parsed = parseLine(line);
            if (parsed) {
                current[parsed.name] = { value: parsed.value, params: parsed.params };
            }
        }
    }
    return events;
}

function vEventToRawEvent(v: any, fallbackUrl: string): RawEvent | null {
    const summary = v['SUMMARY']?.value;
    if (!summary) return null;
    const dt = v['DTSTART'];
    const start = dt ? parseIcsDate(dt.value, dt.params) : null;
    if (!start) return null;
    const end = v['DTEND'] ? parseIcsDate(v['DTEND'].value, v['DTEND'].params) : null;

    const location = v['LOCATION']?.value ? unescape(v['LOCATION'].value) : undefined;
    return {
        externalId: v['UID']?.value,
        title: decodeHtmlEntities(unescape(summary)).trim(),
        startDate: start,
        endDate: end || undefined,
        url: v['URL']?.value || fallbackUrl,
        venueName: location,
        // Vissa feeds (WP-kalendrar) lägger HTML i DESCRIPTION — avkoda entiteter
        description: v['DESCRIPTION']?.value ? decodeHtmlEntities(unescape(v['DESCRIPTION'].value)) : undefined,
        organizer: v['ORGANIZER']?.value,
    };
}

export const icalEngine = async (
    config: IcalConfig,
    ctx: EngineContext,
): Promise<RawEvent[]> => {
    const results: RawEvent[] = [];
    const seen = new Set<string>();
    for (const url of config.urls) {
        ctx.log(`fetching ${url}`);
        const ics = await fetchIcs(url, config, ctx.signal);
        if (!ics) {
            ctx.log(`  failed to fetch`);
            continue;
        }
        const vevents = parseVEvents(ics);
        ctx.log(`  ${vevents.length} VEVENT entries`);
        for (const v of vevents) {
            const ev = vEventToRawEvent(v, config.defaultUrl || url);
            if (!ev) continue;
            const dedup = ev.externalId || ev.url + '|' + ev.startDate.toISOString();
            if (seen.has(dedup)) continue;
            seen.add(dedup);
            results.push(ev);
        }
    }
    return results;
};
