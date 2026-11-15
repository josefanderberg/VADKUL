/**
 * listingProbe.ts — hitta en sajts listsida och dess detaljsidor. Ren modul
 * (ingen I/O); hämtningarna och besluten bor i scripts/bulk-probe.ts.
 *
 * Proben kunde bara läsa strukturerad data (Tribe, wp-v2, sitemap + JSON-LD).
 * De flesta krogar, biografer och små scener har ingetdera: programmet står
 * på en vanlig sida som startsidan länkar till ("Evenemang", "Program", "På
 * gång"). Den sidan är antingen
 *
 *   - en KATALOG: kort som länkar till en detaljsida per event
 *     (/event/<namn>/) → sitemap-motorn med isHtmlCatalog läser den redan, eller
 *   - ett PROGRAM på en enda sida, utan detaljsidor → listing-motorn
 *     (utils/listingBlocks).
 *
 * Den här modulen pekar ut listsidan och, för kataloger, länkfamiljen.
 */

import * as cheerio from 'cheerio';

// ─── robots.txt ──────────────────────────────────────────────────────────────

function ruleMatches(rule: string, path: string): boolean {
    const anchored = rule.endsWith('$');
    const body = anchored ? rule.slice(0, -1) : rule;
    const re = new RegExp(`^${body.split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}${anchored ? '$' : ''}`);
    return re.test(path);
}

/**
 * Får en robot hämta sökvägen? Läser gruppen för "*" (och för vårt eget namn,
 * om sajten nämner det). Längsta matchande regel vinner, Allow vid lika —
 * samma tolkning som de stora sökmotorerna. Tom eller oläslig fil = tillåtet.
 */
export function robotsAllows(robotsTxt: string, path: string, agent = 'vadkul'): boolean {
    const groups: { agents: string[]; rules: { allow: boolean; path: string }[] }[] = [];
    let current: (typeof groups)[number] | null = null;
    let lastWasAgent = false;
    for (const raw of robotsTxt.split(/\r?\n/)) {
        const line = raw.replace(/#.*$/, '').trim();
        const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
        if (!m) continue;
        const key = m[1].toLowerCase(); const value = m[2].trim();
        if (key === 'user-agent') {
            if (!current || !lastWasAgent) { current = { agents: [], rules: [] }; groups.push(current); }
            current.agents.push(value.toLowerCase());
            lastWasAgent = true;
        } else {
            lastWasAgent = false;
            if (current && value) current.rules.push({ allow: key === 'allow', path: value });
        }
    }
    const own = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a)));
    const rules = (own.length ? own : groups.filter((g) => g.agents.includes('*'))).flatMap((g) => g.rules);
    let best: { allow: boolean; len: number } | null = null;
    for (const r of rules) {
        let hit = false;
        try { hit = ruleMatches(r.path, path); } catch { hit = false; }
        if (!hit) continue;
        if (!best || r.path.length > best.len || (r.path.length === best.len && r.allow)) best = { allow: r.allow, len: r.path.length };
    }
    return best ? best.allow : true;
}

// ─── Listsidan ───────────────────────────────────────────────────────────────

/** Ord som pekar ut en programsida, i sökvägen eller länktexten. */
const STRONG_PATH_RE = /evenemang|(?<![a-z])events?(?![a-z])|kalend|program|pa-?gang|whats-?on|konsert|forestall|spelning|pa-?scen/i;
const LISTING_WORD_RE = /evenemang|(?<![a-zåäö])events?(?![a-zåäö])|kalend|program|p[aå][- ]?g[aå]ng|what'?s[- ]?on|konsert|(?<![a-zåäö])live(?![a-zåäö])|f[oö]rest[aä]ll|h[aä]nder|spelning|p[aå][- ]?scen|quiz|n[oö]jen|aktivitet/i;
/** Sidor som säljer lokalen eller hör till sajtens drift — aldrig programmet. */
const NOT_LISTING_RE = /boka|bokning|hyr[-/]|hyra|konferens|catering|privat|f[oö]retag|anordna|arrangera|br[oö]llop|festv[aå]ning|kontakt|presentkort|jobb|karri[aä]r|shop|butik|login|logga-?in|cart|varukorg|integritet|cookie|villkor|policy|\.(?:pdf|jpe?g|png|ics|zip)$/i;

/** Sista segmentet ser ut som ett enskilt event: tre ord eller fler, eller datum/id i slugen. */
const EVENT_SLUG_RE = /^(?:[^-]+-){2,}[^-]+$|\d{4}-\d{2}-\d{2}|-\d{3,}$/;

const bareHost = (h: string): string => h.toLowerCase().replace(/^www\./, '');

/**
 * Startsidans länkar till sidor som kan bära programmet, mest sannolik först.
 * Hela sidan läses — länken står oftast i menyn. Högst `max`, alltid på samma
 * sajt, aldrig djupare än tre nivåer.
 */
export function listingCandidates(homeHtml: string, homeUrl: string, max = 5): string[] {
    let home: URL;
    try { home = new URL(homeUrl); } catch { return []; }
    const $ = cheerio.load(homeHtml);
    const scored = new Map<string, number>();
    $('a[href]').each((_i, el) => {
        const href = ($(el).attr('href') ?? '').trim();
        if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) return;
        let u: URL;
        try { u = new URL(href, home); } catch { return; }
        if (!/^https?:$/.test(u.protocol) || bareHost(u.hostname) !== bareHost(home.hostname)) return;
        const segs = u.pathname.split('/').filter(Boolean);
        if (segs.length === 0 || segs.length > 3) return;
        let path: string;
        try { path = decodeURIComponent(u.pathname); } catch { path = u.pathname; }
        if (NOT_LISTING_RE.test(path)) return;
        // Ett enskilt event (/events/concert-trinix-en-tournee/) är ingen listsida:
        // dess "fler event"-länkar försvinner med eventet (ifsuede.com 15/11).
        // Katalogen ovanför provas i stället.
        if (segs.length >= 2 && EVENT_SLUG_RE.test(segs[segs.length - 1])) {
            const parent = `${u.origin}/${segs.slice(0, -1).join('/')}/`;
            scored.set(parent, Math.max(scored.get(parent) ?? 0, 3 * 10 - (segs.length - 1)));
            return;
        }
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        const score = STRONG_PATH_RE.test(path) ? 3 : LISTING_WORD_RE.test(path) ? 2 : (text.length <= 40 && LISTING_WORD_RE.test(text) && !NOT_LISTING_RE.test(text)) ? 1 : 0;
        if (score === 0) return;
        // Kortare sökväg = själva listan, inte ett enskilt event under den.
        const key = `${u.origin}${u.pathname}`;
        scored.set(key, Math.max(scored.get(key) ?? 0, score * 10 - segs.length));
    });
    return [...scored.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length).slice(0, max).map(([url]) => url);
}

// ─── Länkfamiljen ────────────────────────────────────────────────────────────

export interface LinkFamily {
    /** Katalogen som detaljsidorna ligger i: "/event". */
    dir: string;
    /** Detaljsidorna, absoluta. */
    links: string[];
    /** urlPatterns-rad för sitemap-motorn, som regex-literal i en sträng. */
    pattern: string;
}

/** En katalog som bär event — eller en listsida som gör det. */
const EVENT_DIR_RE = /event|evenemang|kalend|program|konsert|forestall|show|(?<![a-z])live(?![a-z])|biljett|pa-?gang|scen|spelning|aktivitet|whats-?on|happening|produktion/i;
/**
 * Kataloger som aldrig är event: arkiv, taggar, butik, nyheter, språkrötter —
 * och utställningar, som pågår i månader och annars hamnar på sin SISTA dag
 * (första framtida datum i texten; Jönköpings läns museum 15/11 2026).
 */
const STOP_SEG_RE = /^(?:category|kategori|tag|tagg|author|page|sida|wp-content|wp-json|produkt|product|shop|butik|nyheter|news|blogg?|press|en|sv|de|feed|search|sok|utstallning(?:ar)?|exhibitions?)$/i;
const FILE_RE = /\.(?:pdf|jpe?g|png|gif|webp|ics|zip|docx?|xlsx?)$/i;

/** Så många länkar måste dela katalog för att det ska vara en familj. */
export const MIN_FAMILY = 3;

/**
 * Listsidans detaljlänkar: den största gruppen länkar som delar katalog
 * ("/event/a", "/event/b", "/event/c"). Bara innehållet räknas — meny och
 * sidfot är borta — och katalogen eller listsidan själv måste heta något med
 * event/program/konsert. Länkar direkt under roten ("/quiz-pa-fredag/") godtas
 * inte: där går ett event inte att skilja från "/meny/" och "/kontakt/".
 */
export function detailLinkFamily(listHtml: string, listUrl: string): LinkFamily | null {
    let list: URL;
    try { list = new URL(listUrl); } catch { return null; }
    const $ = cheerio.load(listHtml);
    $('script, style, noscript, template, nav, footer').remove();
    $('header').each((_i, el) => {
        const $el = $(el);
        if ($el.parent().is('body') || $el.find('nav').length > 0) $el.remove();
    });
    const listPath = list.pathname.replace(/\/+$/, '');
    const groups = new Map<string, Set<string>>();
    $('a[href]').each((_i, el) => {
        const href = ($(el).attr('href') ?? '').trim();
        if (!href || /^(?:#|javascript:|mailto:|tel:)/i.test(href)) return;
        let u: URL;
        try { u = new URL(href, list); } catch { return; }
        if (!/^https?:$/.test(u.protocol) || bareHost(u.hostname) !== bareHost(list.hostname)) return;
        const segs = u.pathname.split('/').filter(Boolean);
        if (segs.length < 2 || FILE_RE.test(u.pathname) || segs.some((s) => STOP_SEG_RE.test(s))) return;
        const path = u.pathname.replace(/\/+$/, '');
        if (path === listPath || listPath.startsWith(`${path}/`)) return;        // listan själv eller en förälder
        const dir = `/${segs.slice(0, -1).join('/')}`;
        const set = groups.get(dir) ?? new Set<string>();
        set.add(`${u.origin}${path}`);
        groups.set(dir, set);
    });
    const listIsEventish = EVENT_DIR_RE.test(listPath);
    const ranked = [...groups.entries()]
        .filter(([dir, set]) => set.size >= MIN_FAMILY && (EVENT_DIR_RE.test(dir) || listIsEventish))
        .sort((a, b) => Number(EVENT_DIR_RE.test(b[0])) - Number(EVENT_DIR_RE.test(a[0])) || b[1].size - a[1].size);
    if (ranked.length === 0) return null;
    const [dir, set] = ranked[0];
    const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
    return {
        dir,
        links: [...set],
        pattern: `/^https?:\\/\\/(?:www\\.)?${esc(bareHost(list.hostname))}${esc(dir)}\\/[^\\/?#]+\\/?$/i`,
    };
}
