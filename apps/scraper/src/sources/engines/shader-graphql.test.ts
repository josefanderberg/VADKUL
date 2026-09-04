import { describe, it, expect } from 'vitest';
import { parseLocationStage, mapTixEventNode, ShaderGraphqlConfig } from './shader-graphql';

const CITIES = ['Linköping', 'Norrköping'];

describe('parseLocationStage', () => {
    it('"Scen - Stad" → venue + stad', () => {
        expect(parseLocationStage('Stora Teatern - Linköping', CITIES))
            .toEqual({ venueName: 'Stora Teatern', city: 'Linköping' });
        expect(parseLocationStage('Teaterbaren - Norrköping', CITIES))
            .toEqual({ venueName: 'Teaterbaren', city: 'Norrköping' });
    });

    it('"Scen, Stad" → venue + stad', () => {
        expect(parseLocationStage('Crusellhallen, Linköping', CITIES))
            .toEqual({ venueName: 'Crusellhallen', city: 'Linköping' });
    });

    it('stad inbakad i scennamnet rensas ur venue', () => {
        expect(parseLocationStage('Stora Teatern Linköping - onumrerad', CITIES))
            .toEqual({ venueName: 'Stora Teatern', city: 'Linköping' });
    });

    it('ingen stad → bara venue', () => {
        expect(parseLocationStage('Winden', CITIES))
            .toEqual({ venueName: 'Winden', city: undefined });
        expect(parseLocationStage('Annan spelplats', CITIES))
            .toEqual({ venueName: 'Annan spelplats', city: undefined });
    });

    it('tom/null → tomt objekt', () => {
        expect(parseLocationStage(null, CITIES)).toEqual({});
        expect(parseLocationStage('  ', CITIES)).toEqual({});
    });
});

describe('mapTixEventNode', () => {
    const config: ShaderGraphqlConfig = {
        endpoint: 'https://cms.shader.build/ostgotateatern/graphql',
        eventBaseUrl: 'https://www.ostgotateatern.se',
        cities: CITIES,
    };
    // Riktig nod från ostgotateatern-tenanten 2026-09-04
    const node = {
        id: 'tix_112601',
        startDate: '2026-09-05T15:00:00+02:00',
        endDate: '2026-09-05T18:00:00+02:00',
        purchaseUrl: 'https://tix.se/sv/ostgota/buyingflow/tickets/27179/112601/',
        locationStage: 'Stora Teatern - Linköping',
        performance: { id: '1820', title: 'Mrs. Doubtfire ', subtitle: 'Hjärtevärmande familjemusikal', pageUrl: '/pa-scen/mrs-doubtfire' },
    };

    it('mappar en komplett nod med exakt tid och stad ur scenen', () => {
        const ev = mapTixEventNode(node, config, new Map([['1820', 'Musikalen bygger på filmen.']]))!;
        expect(ev.title).toBe('Mrs. Doubtfire');
        expect(ev.startDate.toISOString()).toBe('2026-09-05T13:00:00.000Z');
        expect(ev.endDate?.toISOString()).toBe('2026-09-05T16:00:00.000Z');
        expect(ev.url).toBe('https://www.ostgotateatern.se/pa-scen/mrs-doubtfire');
        expect(ev.venueName).toBe('Stora Teatern');
        expect(ev.city).toBe('Linköping');
        expect(ev.description).toBe('Musikalen bygger på filmen.');
        expect(ev.hasSpecificTime).toBe(true);
    });

    it('utan about → subtitle som beskrivning', () => {
        const ev = mapTixEventNode(node, config, new Map())!;
        expect(ev.description).toBe('Hjärtevärmande familjemusikal');
    });

    it('stad saknas + ingen defaultCity → null (hellre bortfall än fel ort)', () => {
        expect(mapTixEventNode({ ...node, locationStage: 'På turné' }, config, new Map())).toBeNull();
    });

    it('stad saknas + defaultCity → defaultCity', () => {
        const ev = mapTixEventNode(
            { ...node, locationStage: 'Winden' },
            { ...config, defaultCity: 'Linköping' },
            new Map(),
        )!;
        expect(ev.city).toBe('Linköping');
        expect(ev.venueName).toBe('Winden');
    });

    it('scenens stad vinner över defaultCity', () => {
        const ev = mapTixEventNode(
            { ...node, locationStage: 'Stora Teatern - Norrköping' },
            { ...config, defaultCity: 'Linköping' },
            new Map(),
        )!;
        expect(ev.city).toBe('Norrköping');
    });

    it('titel/pageUrl/startDate saknas → null', () => {
        expect(mapTixEventNode({ ...node, performance: { ...node.performance, title: ' ' } }, config, new Map())).toBeNull();
        expect(mapTixEventNode({ ...node, performance: { ...node.performance, pageUrl: '' } }, config, new Map())).toBeNull();
        expect(mapTixEventNode({ ...node, startDate: undefined }, config, new Map())).toBeNull();
    });
});

describe('mapTixEventNode – bilder', () => {
    const config: ShaderGraphqlConfig = {
        endpoint: 'https://cms.shader.build/ostgotateatern/graphql',
        eventBaseUrl: 'https://www.ostgotateatern.se',
        cities: CITIES,
    };
    const node = {
        id: 'tix_1',
        startDate: '2026-09-05T15:00:00+02:00',
        locationStage: 'Stora Teatern - Linköping',
        performance: { id: '1820', title: 'Mrs. Doubtfire', pageUrl: '/pa-scen/mrs-doubtfire' },
    };

    it('bild ur images-mappen per performance-id', () => {
        const ev = mapTixEventNode(node, config, new Map(), new Map([['1820', 'https://cdn.x/img.jpg']]))!;
        expect(ev.imageUrl).toBe('https://cdn.x/img.jpg');
    });

    it('ingen bild → undefined', () => {
        const ev = mapTixEventNode(node, config, new Map(), new Map())!;
        expect(ev.imageUrl).toBeUndefined();
    });
});
