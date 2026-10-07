import { describe, expect, it } from 'vitest';
import {
    bucketFriendRows,
    friendAcceptWrites,
    friendRemoveWrites,
    friendRequestWrites,
    parseFriendRow,
    type FriendRow,
} from './friendStatus';

describe('parseFriendRow', () => {
    it('tolkar en giltig rad', () => {
        expect(parseFriendRow('abc', { status: 'accepted', name: 'Lena', photoURL: 'https://x/p.jpg' }))
            .toEqual({ uid: 'abc', name: 'Lena', photoURL: 'https://x/p.jpg', status: 'accepted' });
    });

    it('släpper igenom rader utan namn/bild (null)', () => {
        expect(parseFriendRow('abc', { status: 'incoming' }))
            .toEqual({ uid: 'abc', name: null, photoURL: null, status: 'incoming' });
    });

    it('avvisar okänd status, skräp och tomt id', () => {
        expect(parseFriendRow('abc', { status: 'blocked' })).toBeNull();
        expect(parseFriendRow('abc', null)).toBeNull();
        expect(parseFriendRow('abc', 'sträng')).toBeNull();
        expect(parseFriendRow('', { status: 'accepted' })).toBeNull();
    });

    it('normaliserar tomt/blankt namn till null', () => {
        expect(parseFriendRow('abc', { status: 'accepted', name: '   ' })?.name).toBeNull();
    });
});

describe('friendRequestWrites', () => {
    it('skriver outgoing hos mig med DIN profil och incoming hos dig med MIN', () => {
        const w = friendRequestWrites(
            { uid: 'me', name: 'Josef', photoURL: 'https://x/me.jpg' },
            { uid: 'you', name: 'Lena', photoURL: 'https://x/you.jpg' },
        );
        expect(w).toEqual([
            { owner: 'me', friend: 'you', data: { status: 'outgoing', name: 'Lena', photoURL: 'https://x/you.jpg' } },
            { owner: 'you', friend: 'me', data: { status: 'incoming', name: 'Josef', photoURL: 'https://x/me.jpg' } },
        ]);
    });

    it('utelämnar namn/bild som saknas eller inte är https', () => {
        const w = friendRequestWrites({ uid: 'me' }, { uid: 'you', name: '', photoURL: 'http://osäker/b.jpg' });
        expect(w[0].data).toEqual({ status: 'outgoing' });
        expect(w[1].data).toEqual({ status: 'incoming' });
    });

    it('klipper namn till 80 tecken (reglernas tak)', () => {
        const långt = 'x'.repeat(120);
        const w = friendRequestWrites({ uid: 'me', name: långt }, { uid: 'you' });
        expect(w[1].data?.name).toHaveLength(80);
    });

    it('vägrar sig själv och tomma uid', () => {
        expect(friendRequestWrites({ uid: 'me' }, { uid: 'me' })).toEqual([]);
        expect(friendRequestWrites({ uid: '' }, { uid: 'you' })).toEqual([]);
    });
});

describe('friendAcceptWrites', () => {
    it('accepterar bara från incoming - båda raderna blir accepted', () => {
        expect(friendAcceptWrites('me', 'you', 'incoming')).toEqual([
            { owner: 'me', friend: 'you', data: { status: 'accepted' } },
            { owner: 'you', friend: 'me', data: { status: 'accepted' } },
        ]);
    });

    it('vägrar från outgoing/accepted/saknad - man kan inte acceptera sin egen förfrågan', () => {
        expect(friendAcceptWrites('me', 'you', 'outgoing')).toEqual([]);
        expect(friendAcceptWrites('me', 'you', 'accepted')).toEqual([]);
        expect(friendAcceptWrites('me', 'you', null)).toEqual([]);
    });
});

describe('friendRemoveWrites', () => {
    it('raderar båda sidorna', () => {
        expect(friendRemoveWrites('me', 'you')).toEqual([
            { owner: 'me', friend: 'you', data: null },
            { owner: 'you', friend: 'me', data: null },
        ]);
    });

    it('vägrar sig själv', () => {
        expect(friendRemoveWrites('me', 'me')).toEqual([]);
    });
});

describe('bucketFriendRows', () => {
    const rows: FriendRow[] = [
        { uid: 'c', name: 'Örjan', photoURL: null, status: 'accepted' },
        { uid: 'a', name: null, photoURL: null, status: 'accepted' },
        { uid: 'b', name: 'Anna', photoURL: null, status: 'accepted' },
        { uid: 'd', name: 'Berit', photoURL: null, status: 'incoming' },
        { uid: 'e', name: 'Ville', photoURL: null, status: 'outgoing' },
    ];

    it('delar upp per status och sorterar på namn (sv), namnlösa sist', () => {
        const b = bucketFriendRows(rows);
        expect(b.accepted.map(r => r.uid)).toEqual(['b', 'c', 'a']); // Anna, Örjan, namnlös
        expect(b.incoming.map(r => r.uid)).toEqual(['d']);
        expect(b.outgoing.map(r => r.uid)).toEqual(['e']);
    });

    it('muterar inte indata', () => {
        const copy = rows.map(r => ({ ...r }));
        bucketFriendRows(rows);
        expect(rows).toEqual(copy);
    });
});
