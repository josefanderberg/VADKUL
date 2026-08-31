/**
 * Fakta-tabeller på svenska event-sidor — "Tid: / Plats: / Pris: / Arrangör:".
 *
 * Mönstret är nästan universellt på kommunala CMS:er (SiteVision-kommunernas
 * `lp-event-details`-tabeller, Episervers definitionslistor m.fl.): all
 * strukturerad eventinfo ligger i ett litet nyckel/värde-block bredvid
 * brödtexten, medan sidan i övrigt saknar JSON-LD och microdata.
 *
 * Utan den här läsningen faller sitemap-motorn tillbaka på "första
 * gatuadressen i sidtexten", vilket på en kommunsajt är kommunhusets
 * besöksadress i sidhuvudets kontaktruta — ALLA eventen hamnar då på samma
 * punkt (Älvkarleby 2026-08-30: 23 event på Centralgatan 3, "Plats: Rio Bio
 * Gävlevägen 24" oläst).
 *
 * Rena funktioner — ingen fetch, ingen DB.
 */

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { extractStreetAddress } from './swedishAddress';

export interface EventFacts {
    /** Rå textsträng ur "Tid"-raden ("2 september kl 19.00") */
    time?: string;
    venueName?: string;
    address?: string;
    city?: string;
    price?: string;
    organizer?: string;
}

/** Etikett (normaliserad, utan kolon) → vilket fält raden bär. */
const LABELS: [RegExp, keyof EventFacts | 'place'][] = [
    [/^(tid|tidpunkt|datum|datum och tid|tid och datum|när)$/, 'time'],
    [/^(plats|lokal|var|spelplats|scen|plats\/lokal|evenemangsplats|plats för evenemanget)$/, 'place'],
    [/^(adress|gatuadress)$/, 'address'],
    [/^(pris|biljettpris|entré|entre|kostnad|avgift)$/, 'price'],
    [/^(arrangör|arrangor|arrangörer|arrangeras av|värd)$/, 'organizer'],
];

/**
 * Etiketter som avslöjar en KONTAKTruta, inte en eventtabell. Kommunsajternas
 * sidhuvud har "Öppet / Telefon / E-post / Besök"-tabellen på varje sida —
 * hittar vi någon av dem hoppar vi över hela tabellen, även om den råkar ha
 * en rad som heter "Adress".
 */
const CONTACT_LABELS = /^(öppet|öppettider|telefon|tel|e-post|epost|mejl|besök|besöksadress|postadress|fax|org\.?nummer|organisationsnummer)$/;

const CITY_LIKE = /^[A-ZÅÄÖ][\p{L}\- ]{1,29}$/u;

function normLabel(s: string): string {
    return s.replace(/\s+/g, ' ').trim().replace(/[:：]\s*$/, '').toLowerCase();
}

/** Cell-text med <br> som radbrytning (cheerio klistrar annars ihop raderna). */
function cellText($: cheerio.CheerioAPI, el: AnyNode): string {
    const c = $(el).clone();
    c.find('br').replaceWith('\n');
    return c
        .text()
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .join(', ');
}

/**
 * Läs Tid/Plats/Pris/Arrangör ur nyckel/värde-block INOM `root`.
 *
 * `root` MÅSTE vara sidans huvudinnehåll (se contentScope i sitemap-motorn) —
 * körs den mot hela dokumentet plockar den kommunhusets kontaktruta.
 * Första träffen per fält vinner; okända etiketter ignoreras.
 */
export function extractEventFacts($: cheerio.CheerioAPI, root: cheerio.Cheerio<AnyNode>): EventFacts {
    const facts: EventFacts = {};
    let place: string | undefined;

    const take = (rawLabel: string, rawValue: string) => {
        const label = normLabel(rawLabel);
        const value = rawValue.replace(/\s+/g, ' ').trim();
        if (!label || !value || value.length > 200) return;
        for (const [re, field] of LABELS) {
            if (!re.test(label)) continue;
            if (field === 'place') { if (!place) place = value; return; }
            if (!facts[field]) facts[field] = value;
            return;
        }
    };

    root.find('table').each((_i, table) => {
        const rows: [string, string][] = [];
        let contactTable = false;
        $(table).find('tr').each((_j, tr) => {
            const th = $(tr).find('th').first();
            const td = $(tr).find('td').first();
            if (!th.length || !td.length) return;
            const label = normLabel(th.text());
            if (CONTACT_LABELS.test(label)) { contactTable = true; return false; }
            rows.push([label, cellText($, td[0])]);
        });
        if (contactTable) return;
        for (const [k, v] of rows) take(k, v);
    });

    // <p><strong>Tid:</strong> 29 september klockan 16.00-17.00</p>
    // Samma faktablock, utan tabell — vanligt i WordPress-/Episerver-teman
    // (motala.se lägger det i en <aside class="notify-box">).
    root.find('p').each((_i, para) => {
        const strong = $(para).children('strong, b').first();
        if (!strong.length) return;
        const label = normLabel(strong.text());
        if (!label || !/[:：]\s*$/.test(strong.text().trim()) || CONTACT_LABELS.test(label)) return;
        const whole = cellText($, para as AnyNode);
        const value = whole.slice(strong.text().replace(/\s+/g, ' ').trim().length).replace(/^[\s,:]+/, '');
        take(label, value);
    });

    root.find('dl').each((_i, dl) => {
        const dts = $(dl).find('dt').toArray();
        let contactList = false;
        for (const dt of dts) {
            if (CONTACT_LABELS.test(normLabel($(dt).text()))) { contactList = true; break; }
        }
        if (contactList) return;
        for (const dt of dts) {
            const dd = $(dt).next('dd').first();
            if (dd.length) take($(dt).text(), cellText($, dd[0]));
        }
    });

    if (place) {
        const parsed = parsePlaceValue(place);
        if (parsed.venueName) facts.venueName = parsed.venueName;
        if (parsed.address && !facts.address) facts.address = parsed.address;
        if (parsed.city) facts.city = parsed.city;
    }
    if (facts.address) {
        const street = extractStreetAddress(facts.address);
        if (street) facts.address = street;
    }
    return facts;
}

/**
 * Dela upp en "Plats"-sträng i venue / gatuadress / ort.
 *
 *   "Rio Bio Gävlevägen 24"            → venue "Rio Bio",     adress "Gävlevägen 24"
 *   "Biblioteket, Ågatan 7, Skutskär"  → venue "Biblioteket", adress "Ågatan 7", ort "Skutskär"
 *   "Stadshuset, Sessionssalen"        → venue "Stadshuset"   (INGEN ort — se nedan)
 *
 * Sista segmentet tolkas som ort BARA när det finns ett adress-segment före
 * det (eller när det är ett postnummer + ort). Annars skulle "Stadshuset,
 * Sessionssalen" ge orten "Sessionssalen" och dra eventet ur kartan.
 */
export function parsePlaceValue(raw: string): { venueName?: string; address?: string; city?: string } {
    const value = (raw || '').replace(/\s+/g, ' ').trim();
    if (!value || value.length > 120) return {};

    const segs = value.split(',').map((s) => s.trim()).filter(Boolean);

    if (segs.length === 1) {
        const street = extractStreetAddress(segs[0]);
        if (!street) return { venueName: segs[0] };
        const venue = segs[0].slice(0, segs[0].indexOf(street)).replace(/[\s,\-–]+$/, '').trim();
        return { venueName: venue || undefined, address: street };
    }

    let city: string | undefined;
    const last = segs[segs.length - 1];
    const withPostcode = last.match(/^\d{3}\s?\d{2}\s+(.+)$/);
    if (withPostcode) {
        city = withPostcode[1].trim();
        segs.pop();
    } else if (segs.length >= 3 && !/\d/.test(last) && CITY_LIKE.test(last)
        && segs.slice(1, -1).some((s) => /\d/.test(s))) {
        city = last;
        segs.pop();
    }

    const venueName = segs.find((s) => !/\d/.test(s));
    const addrSegs = segs.filter((s) => /\d/.test(s));
    let address = addrSegs.length ? addrSegs.join(', ') : undefined;
    if (address) address = extractStreetAddress(address) ?? address;

    return { venueName, address, city };
}
