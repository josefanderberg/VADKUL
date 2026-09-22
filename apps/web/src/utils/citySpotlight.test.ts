import { describe, it, expect } from 'vitest';
import {
    composeSpotlightRows, spotDistKm, spotWhen, spotFrame, SPOTLIGHT_MAX_BOOSTED, SPOTLIGHT_MAX_VADKUL,
    groupSpotEvents, spotSpanTag, spotRangeWhen, spotRangeDayLabel, type SpotEvent,
} from './citySpotlight';

const NOW = new Date('2026-09-04T18:00:00Z').getTime();
const at = (h: number) => new Date(NOW + h * 36e5).toISOString();
const ev = (id: string, time: string) => ({ id, title: id, time });

describe('composeSpotlightRows', () => {
    it('boost vinner över vadkul och dubbletter hamnar bara i boost-nivån', () => {
        const user = [ev('u1', at(2)), ev('u2', at(4))];
        const statics = [ev('s1', at(1)), ev('s2', at(3))];
        const { boosted, vadkul } = composeSpotlightRows(user, statics, new Set(['u1', 's2']), NOW);
        expect(boosted.map(e => e.id)).toEqual(['u1', 's2']);
        expect(boosted.find(e => e.id === 'u1')).toMatchObject({ vadkul: true, boosted: true });
        expect(boosted.find(e => e.id === 's2')).toMatchObject({ vadkul: false, boosted: true });
        // u1 får inte dubblera i vadkul-nivån; s1 (extern, oboostat) hör inte hemma alls.
        expect(vadkul.map(e => e.id)).toEqual(['u2']);
    });

    it('filtrerar passerade event men behåller nyss startade (1 h-fönstret)', () => {
        const user = [ev('gammal', at(-3)), ev('nyss', at(-0.5)), ev('snart', at(1))];
        const { vadkul } = composeSpotlightRows(user, [], new Set(), NOW);
        expect(vadkul.map(e => e.id)).toEqual(['nyss', 'snart']);
    });

    it('respekterar nivåernas tak', () => {
        const user = Array.from({ length: 10 }, (_, i) => ev(`u${i}`, at(i + 1)));
        const boostedIds = new Set(user.slice(0, 6).map(e => e.id));
        const { boosted, vadkul } = composeSpotlightRows(user, [], boostedIds, NOW);
        expect(boosted.length).toBe(SPOTLIGHT_MAX_BOOSTED);
        expect(vadkul.length).toBeLessThanOrEqual(SPOTLIGHT_MAX_VADKUL);
    });
});

describe('spotDistKm', () => {
    it('Piteå–Boden är ~57 km, samma punkt är 0', () => {
        expect(spotDistKm(65.317, 21.479, 65.317, 21.479)).toBe(0);
        const d = spotDistKm(65.317, 21.479, 65.825, 21.689);
        expect(d).toBeGreaterThan(50);
        expect(d).toBeLessThan(65);
    });
});

describe('spotWhen', () => {
    it('idag/imorgon/veckodag och midnatt utan klockslag', () => {
        expect(spotWhen(at(1), NOW)).toMatch(/^Idag /);
        expect(spotWhen(at(26), NOW)).toMatch(/^Imorgon /);
        expect(spotWhen('2026-09-12T15:00:00Z', NOW)).toMatch(/12 sep/);
        // Lokal midnatt (22:00Z sommartid) = datum utan klockslag.
        expect(spotWhen('2026-09-11T22:00:00Z', NOW)).not.toMatch(/\d\d:\d\d/);
    });
});

describe('spotFrame', () => {
    it('guld vinner över grön, grön över blå, tips är blå', () => {
        expect(spotFrame({ boosted: true, hosted: true })).toBe('gold');
        expect(spotFrame({ boosted: false, hosted: true })).toBe('hosted');
        expect(spotFrame({ boosted: false, hosted: false })).toBe('tip');
    });

    it('hosted följer med raden genom composeSpotlightRows', () => {
        const { vadkul } = composeSpotlightRows([{ ...ev('u1', at(1)), hosted: true }], [], new Set(), NOW);
        expect(vadkul[0]).toMatchObject({ hosted: true, vadkul: true, boosted: false });
    });
});

// ── EN rad per sak (22/9): Växjö Konstrunda lör 10 + sön 11 okt kl 11 låg som
// två separata dokument och två rader på stadssidan.
describe('groupSpotEvents', () => {
    const kr = (id: string, iso: string, over: Partial<SpotEvent> = {}): SpotEvent =>
        ({ id, title: 'Växjö Konstrunda', time: iso, locationName: 'Gårdsby Hantverkshus', ...over });
    const LOR = '2026-10-10T09:00:00Z'; // lör 10 okt 11:00 svensk tid
    const SON = '2026-10-11T09:00:00Z';

    it('konstrundan: två separata dokument dagar i rad blir en rad med 2 dagar', () => {
        const out = groupSpotEvents([kr('a', LOR), kr('b', SON)]);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ id: 'a', time: LOR, days: 2, lastTime: SON, docIds: ['a', 'b'] });
    });

    it('en dagsserie (ett dokument, utvecklat) blir en rad med ETT dokument-id', () => {
        const out = groupSpotEvents([
            kr('kr1__2026-10-10', LOR, { seriesId: 'kr1' }),
            kr('kr1__2026-10-11', SON, { seriesId: 'kr1' }),
            kr('kr1__2026-10-12', '2026-10-12T09:00:00Z', { seriesId: 'kr1' }),
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ days: 3, docIds: ['kr1'] });
    });

    it('lucka mellan dagarna = separata rader (samma sak en vecka senare är inte "2 dagar")', () => {
        const out = groupSpotEvents([kr('a', LOR), kr('b', '2026-10-17T09:00:00Z')]);
        expect(out.map(e => e.days)).toEqual([undefined, undefined]);
    });

    it('annan titel eller annan plats slås inte ihop', () => {
        expect(groupSpotEvents([kr('a', LOR), kr('b', SON, { title: 'Julmarknad' })])).toHaveLength(2);
        expect(groupSpotEvents([kr('a', LOR), kr('b', SON, { locationName: 'Stadsbiblioteket' })])).toHaveLength(2);
    });

    it('titel och plats jämförs utan skiftläge och extra mellanslag', () => {
        expect(groupSpotEvents([kr('a', LOR), kr('b', SON, { title: '  växjö   KONSTRUNDA ' })])).toHaveLength(1);
    });

    it('två tillfällen samma dag förblir två rader', () => {
        const out = groupSpotEvents([kr('a', LOR), kr('b', '2026-10-10T16:00:00Z')]);
        expect(out).toHaveLength(2);
    });

    it('veckoserie: bara nästa tillfälle, rytmen följer med', () => {
        const out = groupSpotEvents([
            kr('q__1', LOR, { seriesId: 'q', rhythm: 'Varje vecka', title: 'Pubquiz' }),
            kr('q__2', '2026-10-17T09:00:00Z', { seriesId: 'q', rhythm: 'Varje vecka', title: 'Pubquiz' }),
        ]);
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ id: 'q__1', rhythm: 'Varje vecka', docIds: ['q'] });
        expect(spotSpanTag(out[0])).toBe('Varje vecka');
    });

    it('i composeSpotlightRows: gruppen tar en plats och boostas via vilket dokument som helst', () => {
        const now = new Date('2026-10-01T12:00:00Z').getTime();
        const { vadkul, boosted } = composeSpotlightRows([kr('a', LOR), kr('b', SON)], [], new Set(), now);
        expect(vadkul).toHaveLength(1);
        expect(boosted).toHaveLength(0);
        const b = composeSpotlightRows([kr('a', LOR), kr('b', SON)], [], new Set(['b']), now);
        expect(b.boosted.map(e => e.id)).toEqual(['a']);
        expect(b.vadkul).toHaveLength(0);
    });

    it('första dagen passerad: raden är den dag som är kvar, utan "2 dagar"', () => {
        const now = new Date('2026-10-11T06:00:00Z').getTime();
        const { vadkul } = composeSpotlightRows([kr('a', LOR), kr('b', SON)], [], new Set(), now);
        expect(vadkul.map(e => [e.id, e.days])).toEqual([['b', undefined]]);
    });
});

describe('spotRangeWhen / spotRangeDayLabel', () => {
    const now = new Date('2026-09-22T10:00:00Z').getTime();

    it('samma månad: "lör 10-sön 11 okt. 11:00"', () => {
        expect(spotRangeWhen('2026-10-10T09:00:00Z', '2026-10-11T09:00:00Z', now)).toBe('lör 10-sön 11 okt. 11:00');
    });

    it('över månadsskifte skrivs båda månaderna', () => {
        expect(spotRangeWhen('2026-10-30T17:00:00Z', '2026-11-01T18:00:00Z', now)).toBe('fre 30 okt.-sön 1 nov. 18:00');
    });

    it('idag och imorgon i klartext', () => {
        expect(spotRangeWhen('2026-09-22T16:00:00Z', '2026-09-23T16:00:00Z', now)).toBe('Idag-imorgon 18:00');
    });

    it('utfällningens dagrad', () => {
        expect(spotRangeDayLabel('2026-10-10T09:00:00Z', '2026-10-11T09:00:00Z')).toBe('lördag 10-söndag 11 oktober');
    });

    it('chip bara för flera dagar', () => {
        expect(spotSpanTag({ days: 2 })).toBe('2 dagar');
        expect(spotSpanTag({})).toBeNull();
    });
});

describe('bild först i spotlighten (22/9)', () => {
    it('event med bild ligger överst, sedan tid, inom båda nivåerna', () => {
        const user = [
            { id: 'utan1', title: 'Utan bild tidig', time: at(1) },
            { id: 'med', title: 'Med bild sen', time: at(30), coverImage: 'https://x/y.jpg' },
            { id: 'utan2', title: 'Utan bild mitt', time: at(5) },
        ];
        const { vadkul } = composeSpotlightRows(user, [], new Set(), NOW);
        expect(vadkul.map(e => e.id)).toEqual(['med', 'utan1', 'utan2']);
        const b = composeSpotlightRows(user, [], new Set(['utan1', 'med']), NOW);
        expect(b.boosted.map(e => e.id)).toEqual(['med', 'utan1']);
    });
});
