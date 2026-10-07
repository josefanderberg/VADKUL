import { describe, expect, it } from 'vitest';
import {
    isThreadMember,
    parsePrivateThread,
    pickPrivateThread,
    privateChatKey,
    privateInviteThreadId,
    threadOthersLabel,
    type PrivateThreadLite,
} from './privateChat';

describe('privateChatKey', () => {
    it('URL-enkodar id:t (skrapade events id är en URL)', () => {
        expect(privateChatKey('https://ex.se/a?b=1', undefined)).toBe(encodeURIComponent('https://ex.se/a?b=1'));
    });

    it('veckoserietillfällen går på SERIENS dokument (rsvpShareId)', () => {
        expect(privateChatKey('doc123__2026-10-12', true)).toBe('doc123');
        // Skrapade event har inget serie-suffix att strippa.
        expect(privateChatKey('doc123__2026-10-12', undefined)).toBe(encodeURIComponent('doc123__2026-10-12'));
    });
});

describe('parsePrivateThread', () => {
    it('tolkar medlemsmappen och sorterar uid:n', () => {
        const t = parsePrivateThread('inviter1', {
            eventId: 'x',
            inviterName: 'Josef',
            members: { b: true, a: true, borttagen: false, '': true },
        });
        expect(t).toEqual({ id: 'inviter1', inviterName: 'Josef', members: ['a', 'b'] });
    });

    it('avvisar skräp', () => {
        expect(parsePrivateThread('x', null)).toBeNull();
        expect(parsePrivateThread('x', { members: ['lista'] })).toBeNull();
        expect(parsePrivateThread('', { members: {} })).toBeNull();
    });
});

const tråd = (id: string, members: string[], inviterName: string | null = null): PrivateThreadLite =>
    ({ id, members, inviterName });

describe('isThreadMember', () => {
    it('kollar medlemskap, null-uid är aldrig medlem', () => {
        expect(isThreadMember(tråd('a', ['me']), 'me')).toBe(true);
        expect(isThreadMember(tråd('a', ['me']), 'du')).toBe(false);
        expect(isThreadMember(tråd('a', ['me']), null)).toBe(false);
    });
});

describe('pickPrivateThread', () => {
    const mine = tråd('me', ['me', 'x']);
    const invited = tråd('inviter', ['inviter', 'me']);
    const other = tråd('någon', ['någon', 'me']);

    it('min egen tråd går före', () => {
        expect(pickPrivateThread([other, invited, mine], 'me', 'inviter')).toBe(mine);
    });

    it('sedan den jag bjöds till via ?fran=', () => {
        expect(pickPrivateThread([other, invited], 'me', 'inviter')).toBe(invited);
    });

    it('sedan första medlemskapet, annars null', () => {
        expect(pickPrivateThread([other], 'me', null)).toBe(other);
        expect(pickPrivateThread([], 'me', 'inviter')).toBeNull();
    });
});

describe('threadOthersLabel', () => {
    it('inbjudarens namn när jag INTE är inbjudaren', () => {
        expect(threadOthersLabel(tråd('inviter', ['inviter', 'me'], 'Josef'), 'me')).toBe('Josef');
    });

    it('antal inbjudna när jag ÄR inbjudaren', () => {
        expect(threadOthersLabel(tråd('me', ['me', 'a'], 'Josef'), 'me')).toBe('1 inbjuden');
        expect(threadOthersLabel(tråd('me', ['me', 'a', 'b'], 'Josef'), 'me')).toBe('2 inbjudna');
        expect(threadOthersLabel(tråd('me', ['me'], 'Josef'), 'me')).toBeNull();
    });
});

describe('privateInviteThreadId', () => {
    it('medlem i någon annans tråd → länken leder dit', () => {
        expect(privateInviteThreadId(tråd('inviter', ['inviter', 'me']), 'me')).toBe('inviter');
    });

    it('min egen tråd → mitt uid', () => {
        expect(privateInviteThreadId(tråd('me', ['me', 'a']), 'me')).toBe('me');
    });

    it('ingen tråd, eller en jag inte är med i (bara inbjuden) → min egen', () => {
        expect(privateInviteThreadId(null, 'me')).toBe('me');
        expect(privateInviteThreadId(tråd('inviter', ['inviter']), 'me')).toBe('me');
    });
});
