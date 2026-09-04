import { describe, it, expect } from 'vitest';
import {
    dueItems, forcedItems, queueId, replaceItem, staleItems, upsertQueueItem, STALE_MS,
    type IgQueueItem,
} from './igQueue';

const at = (h: number, d = 27) => new Date(2026, 7, d, h, 0, 0).getTime();

const item = (over: Partial<IgQueueItem> = {}): IgQueueItem => ({
    id: 'malmo-2026-08-27-06',
    town: 'Malmö',
    caption: 'Veckan i Malmö 👇',
    imageUrl: 'https://vadkul.se/api/marketing/ad/malmo',
    publishAt: at(6),
    status: 'väntar',
    ...over,
});

describe('queueId', () => {
    it('ger samma nyckel för samma ort och timme', () => {
        expect(queueId('Malmö', at(6))).toBe(queueId('malmö', at(6) + 59 * 60_000));
    });

    it('skiljer orter och timmar åt', () => {
        expect(queueId('Malmö', at(6))).not.toBe(queueId('Malmö', at(7)));
        expect(queueId('Malmö', at(6))).not.toBe(queueId('Lund', at(6)));
    });
});

describe('upsertQueueItem', () => {
    it('lägger till nytt och uppdaterar befintligt på id', () => {
        const one = upsertQueueItem([], item());
        expect(one).toHaveLength(1);

        const two = upsertQueueItem(one, item({ caption: 'Ny text' }));
        expect(two).toHaveLength(1);
        expect(two[0].caption).toBe('Ny text');
    });

    it('rör ALDRIG en redan publicerad post — omkörning får inte dubbelposta', () => {
        const published = [item({ status: 'publicerad', igMediaId: '123' })];
        const after = upsertQueueItem(published, item({ caption: 'Omkörning' }));
        expect(after[0].status).toBe('publicerad');
        expect(after[0].caption).toBe('Veckan i Malmö 👇');
    });
});

describe('dueItems', () => {
    const now = at(7);

    it('tar med det som förfallit och lämnar framtiden i fred', () => {
        const q = [item({ id: 'a', publishAt: at(6) }), item({ id: 'b', publishAt: at(9) })];
        expect(dueItems(q, now).map(x => x.id)).toEqual(['a']);
    });

    it('hoppar över allt som inte väntar', () => {
        const q = [
            item({ id: 'a', publishAt: at(6), status: 'publicerad' }),
            item({ id: 'b', publishAt: at(6), status: 'förfallen' }),
            item({ id: 'c', publishAt: at(6) }),
        ];
        expect(dueItems(q, now).map(x => x.id)).toEqual(['c']);
    });

    it('vägrar posta gammalt — torsdagens lista ska inte ut på lördagen', () => {
        const old = item({ publishAt: now - STALE_MS - 1 });
        expect(dueItems([old], now)).toEqual([]);
        expect(staleItems([old], now).map(x => x.id)).toEqual([old.id]);
    });

    it('publicerar i tidsordning', () => {
        const q = [item({ id: 'sen', publishAt: at(6) }), item({ id: 'tidig', publishAt: at(5) })];
        expect(dueItems(q, now).map(x => x.id)).toEqual(['tidig', 'sen']);
    });
});

describe('forcedItems', () => {
    // September — dagens tre inlägg 2/9 hann bli förfallna medan token var trasig.
    const sep = (d: number, h: number) => new Date(2026, 8, d, h, 0, 0).getTime();
    const q = [
        item({ id: 'sundsvall-2026-09-02-08', publishAt: sep(2, 8), status: 'förfallen' }),
        item({ id: 'landskrona-2026-09-02-06', publishAt: sep(2, 6), status: 'förfallen' }),
        item({ id: 'nyköping-2026-09-02-07', publishAt: sep(2, 7), status: 'förfallen' }),
        item({ id: 'luleå-2026-09-03-06', publishAt: sep(3, 6) }),
    ];

    it('ett datum tar hela dagen, förfallna inräknade, i tidsordning', () => {
        expect(forcedItems(q, ['2026-09-02']).map(x => x.id))
            .toEqual(['landskrona-2026-09-02-06', 'nyköping-2026-09-02-07', 'sundsvall-2026-09-02-08']);
    });

    it('ett exakt id tar bara den posten — och färskvaran spelar ingen roll', () => {
        expect(forcedItems(q, ['luleå-2026-09-03-06']).map(x => x.id)).toEqual(['luleå-2026-09-03-06']);
        expect(forcedItems(q, ['Sundsvall-2026-09-02-08 ']).map(x => x.id)).toEqual(['sundsvall-2026-09-02-08']);
    });

    it('tomt eller okänt urval ger inget', () => {
        expect(forcedItems(q, [])).toEqual([]);
        expect(forcedItems(q, ['', ' '])).toEqual([]);
        expect(forcedItems(q, ['2026-09-04'])).toEqual([]);
        expect(forcedItems(q, ['2026-09'])).toEqual([]);
    });

    it('rör ALDRIG en redan publicerad post — inte ens tvingat', () => {
        const done = [item({ id: 'malmo-2026-09-02-06', publishAt: sep(2, 6), status: 'publicerad', igMediaId: '1' })];
        expect(forcedItems(done, ['2026-09-02'])).toEqual([]);
        expect(forcedItems(done, ['malmo-2026-09-02-06'])).toEqual([]);
    });
});

describe('replaceItem', () => {
    it('patchar bara posten med rätt id', () => {
        const q = [item({ id: 'a' }), item({ id: 'b' })];
        const after = replaceItem(q, 'b', { status: 'publicerad', igMediaId: '99' });
        expect(after[0].status).toBe('väntar');
        expect(after[1]).toMatchObject({ status: 'publicerad', igMediaId: '99' });
    });
});
