import { describe, expect, it } from 'vitest';
import type { LinkEvent } from '@/types';
import { friendRsvpVisible, pickFriendEventIds, upcomingFriendEvents } from './friendEvents';

describe('friendRsvpVisible', () => {
    it('utelämnat fält = synlig (default på)', () => {
        expect(friendRsvpVisible({})).toBe(true);
        expect(friendRsvpVisible(null)).toBe(true);
        expect(friendRsvpVisible(undefined)).toBe(true);
    });

    it('bara ett uttryckligt false stänger av', () => {
        expect(friendRsvpVisible({ rsvpVisibleToFriends: false })).toBe(false);
        expect(friendRsvpVisible({ rsvpVisibleToFriends: true })).toBe(true);
        expect(friendRsvpVisible({ rsvpVisibleToFriends: 0 })).toBe(true);
    });
});

describe('pickFriendEventIds', () => {
    it('senast svarade först (listorna är append-ordnade)', () => {
        expect(pickFriendEventIds(['a', 'b'], ['c'])).toEqual([
            { id: 'b', status: 'going' },
            { id: 'a', status: 'going' },
            { id: 'c', status: 'interested' },
        ]);
    });

    it('dubblett mellan listorna: Kommer vinner', () => {
        expect(pickFriendEventIds(['a'], ['a', 'b'])).toEqual([
            { id: 'a', status: 'going' },
            { id: 'b', status: 'interested' },
        ]);
    });

    it('tolkar skräp defensivt och respekterar taket', () => {
        expect(pickFriendEventIds('inte-en-lista', null)).toEqual([]);
        expect(pickFriendEventIds(['a', 42, '', 'b'], undefined).map(p => p.id)).toEqual(['b', 'a']);
        expect(pickFriendEventIds(['a', 'b', 'c'], ['d'], 2)).toHaveLength(2);
    });
});

function evt(id: string, time: Date, extra: Partial<LinkEvent> = {}): LinkEvent {
    return {
        id,
        title: id,
        url: '',
        time,
        createdAt: time,
        locationName: 'Plats',
        lat: 56.9,
        lng: 14.8,
        hostName: 'Värd',
        ...extra,
    } as LinkEvent;
}

describe('upcomingFriendEvents', () => {
    const now = new Date('2026-10-07T12:00:00').getTime();

    it('filtrerar passerade, sorterar kommande i tidsordning', () => {
        const resolved = new Map<string, LinkEvent>([
            ['sen', evt('sen', new Date('2026-10-09T18:00:00'))],
            ['tidig', evt('tidig', new Date('2026-10-08T10:00:00'))],
            ['förbi', evt('förbi', new Date('2026-10-06T19:00:00'))],
        ]);
        const rows = upcomingFriendEvents(
            [{ id: 'sen', status: 'going' }, { id: 'förbi', status: 'going' }, { id: 'tidig', status: 'interested' }],
            resolved,
            now,
        );
        expect(rows.map(r => r.evt.id)).toEqual(['tidig', 'sen']);
        expect(rows[0].status).toBe('interested');
    });

    it('hoppar över id som inte gick att slå upp', () => {
        const rows = upcomingFriendEvents(
            [{ id: 'saknas', status: 'going' }],
            new Map(),
            now,
        );
        expect(rows).toEqual([]);
    });

    it('event utan klockslag räknas som passerat först kl 20 (delade gränsen)', () => {
        const resolved = new Map<string, LinkEvent>([
            ['heldag', evt('heldag', new Date('2026-10-07T00:00:00'), { hasSpecificTime: false })],
        ]);
        expect(upcomingFriendEvents([{ id: 'heldag', status: 'going' }], resolved, now)).toHaveLength(1);
        const efterÅtta = new Date('2026-10-07T20:00:01').getTime();
        expect(upcomingFriendEvents([{ id: 'heldag', status: 'going' }], resolved, efterÅtta)).toHaveLength(0);
    });
});
