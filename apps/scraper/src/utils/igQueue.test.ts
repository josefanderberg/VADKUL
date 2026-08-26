import { describe, it, expect } from 'vitest';
import {
    dueItems, queueId, replaceItem, staleItems, upsertQueueItem, STALE_MS,
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

describe('replaceItem', () => {
    it('patchar bara posten med rätt id', () => {
        const q = [item({ id: 'a' }), item({ id: 'b' })];
        const after = replaceItem(q, 'b', { status: 'publicerad', igMediaId: '99' });
        expect(after[0].status).toBe('väntar');
        expect(after[1]).toMatchObject({ status: 'publicerad', igMediaId: '99' });
    });
});
