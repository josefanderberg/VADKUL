import { describe, it, expect } from 'vitest';
import {
    INVITE_TTL_MS, friendInviteUrl, isInviteUid, parseParkedInvite, pickFriendInvite, registerLanding, serializeInvite,
} from './friendInvite';

const UID = 'aBc123XyZ0aBc123XyZ0aBc123Xy';
const NU = Date.UTC(2026, 9, 13, 20, 0);

describe('friendInviteUrl', () => {
    it('bygger ?van-länken', () => {
        expect(friendInviteUrl('https://vadkul.se', UID)).toBe(`https://vadkul.se/?van=${UID}`);
        expect(friendInviteUrl('https://vadkul.se/', UID)).toBe(`https://vadkul.se/?van=${UID}`);
    });
});

describe('isInviteUid', () => {
    it('nekar sökvägar och skräp', () => {
        expect(isInviteUid(UID)).toBe(true);
        expect(isInviteUid('a/b/c/d/e/f')).toBe(false);
        expect(isInviteUid(null)).toBe(false);
    });
});

describe('parseParkedInvite', () => {
    it('läser tillbaka en färsk inbjudan', () => {
        expect(parseParkedInvite(serializeInvite(UID, NU), NU + 1000)).toEqual({ fran: UID, at: NU });
    });
    it('en inbjudan äldre än 7 dagar har gått ut', () => {
        expect(parseParkedInvite(serializeInvite(UID, NU), NU + INVITE_TTL_MS + 1)).toBeNull();
    });
    it('trasigt innehåll ger null', () => {
        expect(parseParkedInvite('{', NU)).toBeNull();
        expect(parseParkedInvite(JSON.stringify({ fran: 'x/y', at: NU }), NU)).toBeNull();
        expect(parseParkedInvite(null, NU)).toBeNull();
    });
});

describe('pickFriendInvite', () => {
    const parkerad = { fran: 'parkeradUid123', at: NU };
    it('länken vinner över den parkerade', () => {
        expect(pickFriendInvite(UID, parkerad, null)).toBe(UID);
        expect(pickFriendInvite(null, parkerad, null)).toBe('parkeradUid123');
        expect(pickFriendInvite('ogiltig/länk', parkerad, null)).toBe('parkeradUid123');
    });
    it('ens egen länk ger ingen banner', () => {
        expect(pickFriendInvite(UID, null, UID)).toBeNull();
        expect(pickFriendInvite(null, null, null)).toBeNull();
    });
});

describe('registerLanding', () => {
    it('första landningen räknas, omklicket inte', () => {
        const forsta = registerLanding(null, UID, NU);
        expect(forsta.count).toBe(true);
        const andra = registerLanding(forsta.next, UID, NU + 1000);
        expect(andra.count).toBe(false);
    });
    it('en annan inbjudare räknas separat', () => {
        const forsta = registerLanding(null, UID, NU);
        expect(registerLanding(forsta.next, 'annanInbjudare99', NU).count).toBe(true);
    });
    it('utgången post rensas - landningen räknas igen', () => {
        const forsta = registerLanding(null, UID, NU);
        const senare = registerLanding(forsta.next, UID, NU + INVITE_TTL_MS + 1);
        expect(senare.count).toBe(true);
        expect(JSON.parse(senare.next)).toEqual({ [UID]: NU + INVITE_TTL_MS + 1 });
    });
    it('trasigt värde = börja om och räkna', () => {
        expect(registerLanding('{', UID, NU).count).toBe(true);
        expect(registerLanding(JSON.stringify({ [UID]: 'hej' }), UID, NU).count).toBe(true);
    });
});
