import type { LinkEvent } from '@/types';
import { isSeriesEvent, seriesRhythmLabel } from './weeklySeries';

/**
 * Profilens "Mina event": EN rad per sak man skapat, inte per tillfälle.
 *
 * Två sorters upprepning slås ihop:
 *  1. SERIER: ett dokument med repeatWeekly eller repeatDays, utvecklat
 *     till tillfällen av expandSeries (Josef 14/9: "nu blir det en jättelång
 *     lista").
 *  2. SAMMA EVENT INLAGT FLERA GÅNGER — separata dokument med samma titel på
 *     samma plats (Josef 16/9, destilleribesöken på Stobirk: fyra datum som
 *     inte kunde läggas som serie eftersom de har oregelbunden rytm och olika
 *     klockslag). De hör ihop för ögat och ska höra ihop i listan.
 *
 * Raden representeras av NÄSTA KOMMANDE tillfälle (en helt passerad grupp av
 * sitt senaste), så datumet på raden är det som faktiskt händer härnäst.
 * `docIds` bär alla dokument raden står för — soptunnan raderar hela gruppen,
 * annars hade man fått ta bort fyra Stobirk-rader en och en.
 */
export interface MyEventRow {
    /** Tillfället raden visar. */
    evt: LinkEvent;
    /** Dokument-id:n raden står för (serier: seriens bas-id, en gång). */
    docIds: string[];
    /** Hur många tillfällen raden döljer. 1 = vanligt engångsevent. */
    count: number;
    /** Chip efter titeln: "Varannan vecka" eller "4 tillfällen". Saknas för engångsevent. */
    tag?: string;
}

/** Dokument-id:t bakom ett (möjligen utvecklat) tillfälle. */
function docIdOf(evt: LinkEvent): string {
    return (evt.seriesId ?? evt.id).split('__')[0];
}

/** Serienyckel — samma stam som raderingen redan går på. Null = ingen serie. */
function seriesKeyOf(evt: LinkEvent): string | null {
    return evt.seriesId ?? (isSeriesEvent(evt) ? evt.id.split('__')[0] : null);
}

/**
 * Nyckel för "samma event igen": titel + plats. Platsen är locationName när
 * den finns (Stobirk-fallet: fyra dokument, samma adressrad) och annars
 * koordinaten — två olika event med samma titel i olika orter ska INTE slås
 * ihop.
 */
function repeatKeyOf(evt: LinkEvent): string {
    const title = evt.title.trim().toLowerCase().replace(/\s+/g, ' ');
    const place = evt.locationName?.trim().toLowerCase().replace(/\s+/g, ' ');
    const where = place || `${evt.lat.toFixed(3)},${evt.lng.toFixed(3)}`;
    return `${title}@@${where}`;
}

/** Nästa kommande i högen; är allt passerat representerar det senaste. */
function representative(occurrences: LinkEvent[], nowMs: number): LinkEvent {
    const upcoming = occurrences.filter(e => e.time.getTime() >= nowMs);
    const pickEarliest = upcoming.length > 0;
    const pool = pickEarliest ? upcoming : occurrences;
    return pool.reduce((best, e) => {
        const better = pickEarliest
            ? e.time.getTime() < best.time.getTime()
            : e.time.getTime() > best.time.getTime();
        return better ? e : best;
    });
}

export function buildMyEventRows(events: LinkEvent[], nowMs: number): MyEventRow[] {
    // Steg 1: veckoserier — alla tillfällen av ETT dokument blir en rad.
    const loose: LinkEvent[] = [];
    const bySeries = new Map<string, LinkEvent[]>();
    for (const evt of events) {
        const key = seriesKeyOf(evt);
        if (!key) { loose.push(evt); continue; }
        const arr = bySeries.get(key);
        if (arr) arr.push(evt); else bySeries.set(key, [evt]);
    }

    const rows: MyEventRow[] = [];
    for (const occurrences of bySeries.values()) {
        const evt = representative(occurrences, nowMs);
        rows.push({
            evt,
            docIds: [docIdOf(evt)],
            count: occurrences.length,
            tag: seriesRhythmLabel(evt),
        });
    }

    // Steg 2: separata dokument som är samma event om och om igen.
    const byRepeat = new Map<string, LinkEvent[]>();
    for (const evt of loose) {
        const key = repeatKeyOf(evt);
        const arr = byRepeat.get(key);
        if (arr) arr.push(evt); else byRepeat.set(key, [evt]);
    }
    for (const group of byRepeat.values()) {
        const evt = representative(group, nowMs);
        rows.push(group.length > 1
            ? {
                evt,
                // I tidsordning: raderingen (och bekräftelsedialogen) ska följa
                // samma ordning som listan man tittat på.
                docIds: [...group].sort((a, b) => a.time.getTime() - b.time.getTime()).map(docIdOf),
                count: group.length,
                tag: `${group.length} tillfällen`,
            }
            : { evt, docIds: [docIdOf(evt)], count: 1 });
    }

    return rows.sort((a, b) => a.evt.time.getTime() - b.evt.time.getTime());
}
