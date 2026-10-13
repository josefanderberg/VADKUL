import { describe, it, expect } from 'vitest';
import {
    INVITER_REWARD_CAP, friendRowFields, inviteMessage, isInviteUid, isNewAccount, planFriendInvite,
    type InviteState,
} from './friendInvite';

const DAG = 24 * 60 * 60 * 1000;
const NU = Date.UTC(2026, 9, 13, 20, 0);

const NY_VÄN: InviteState = {
    blocked: false,
    callerIsNew: true,
    alreadyRecruited: false,
    inviterRewarded: 0,
    callerRow: null,
    inviterRow: null,
};

describe('isInviteUid', () => {
    it('godtar Firebase-uid:n och nekar sökvägar och skräp', () => {
        expect(isInviteUid('aBc123XyZ0aBc123XyZ0aBc123Xy')).toBe(true);
        expect(isInviteUid('users/x')).toBe(false);
        expect(isInviteUid('')).toBe(false);
        expect(isInviteUid(42)).toBe(false);
        expect(isInviteUid('a'.repeat(129))).toBe(false);
    });
});

describe('isNewAccount (högst 7 dagar)', () => {
    it('ett konto från idag och från för 7 dagar sedan räknas som nytt', () => {
        expect(isNewAccount(NU - 60_000, NU)).toBe(true);
        expect(isNewAccount(NU - 7 * DAG, NU)).toBe(true);
    });
    it('äldre än 7 dagar eller okänd skapandetid ger inga stjärnor', () => {
        expect(isNewAccount(NU - 7 * DAG - 1, NU)).toBe(false);
        expect(isNewAccount(null, NU)).toBe(false);
        expect(isNewAccount(Number.NaN, NU)).toBe(false);
    });
});

describe('planFriendInvite', () => {
    it('nytt konto: vänner + en stjärna var', () => {
        expect(planFriendInvite(NY_VÄN)).toEqual({
            ok: true, befriend: true, rewardFriend: true, rewardInviter: true, noReward: null,
        });
    });

    it('inbjudaren har nått taket: vännen får sin stjärna, inbjudaren inte', () => {
        const plan = planFriendInvite({ ...NY_VÄN, inviterRewarded: INVITER_REWARD_CAP });
        expect(plan.rewardFriend).toBe(true);
        expect(plan.rewardInviter).toBe(false);
        expect(planFriendInvite({ ...NY_VÄN, inviterRewarded: INVITER_REWARD_CAP - 1 }).rewardInviter).toBe(true);
    });

    it('gammalt konto: vänner men inga stjärnor', () => {
        const plan = planFriendInvite({ ...NY_VÄN, callerIsNew: false });
        expect(plan).toMatchObject({ ok: true, befriend: true, rewardFriend: false, rewardInviter: false, noReward: 'old-account' });
    });

    it('ett konto kan bara värvas en gång', () => {
        const plan = planFriendInvite({ ...NY_VÄN, alreadyRecruited: true });
        expect(plan).toMatchObject({ rewardFriend: false, rewardInviter: false, noReward: 'already-recruited' });
    });

    it('redan vänner: inga nya rader, men ett nytt konto får ändå stjärnorna', () => {
        const plan = planFriendInvite({ ...NY_VÄN, callerRow: 'accepted', inviterRow: 'accepted' });
        expect(plan.befriend).toBe(false);
        expect(plan.rewardFriend).toBe(true);
        // En väntande förfrågan blir accepterad.
        expect(planFriendInvite({ ...NY_VÄN, callerRow: 'incoming', inviterRow: 'outgoing' }).befriend).toBe(true);
    });

    it('blockerad: ingen vänskap och inga stjärnor', () => {
        expect(planFriendInvite({ ...NY_VÄN, blocked: true })).toEqual({
            ok: false, befriend: false, rewardFriend: false, rewardInviter: false, noReward: null,
        });
    });
});

describe('friendRowFields', () => {
    it('kapar namnet och tar bara https-bilder', () => {
        expect(friendRowFields({ displayName: '  Josef  ', photoURL: 'https://x.se/a.jpg' }))
            .toEqual({ name: 'Josef', photoURL: 'https://x.se/a.jpg' });
        expect(friendRowFields({ displayName: 'a'.repeat(100), photoURL: 'http://x.se/a.jpg' }))
            .toEqual({ name: 'a'.repeat(80) });
        expect(friendRowFields(null)).toEqual({});
    });
});

describe('inviteMessage', () => {
    it('berättar vad som hände', () => {
        expect(inviteMessage(planFriendInvite(NY_VÄN), 'Josef')).toContain('Ni fick en stjärna var');
        expect(inviteMessage(planFriendInvite({ ...NY_VÄN, inviterRewarded: 9 }), 'Josef')).toContain('Du fick en stjärna');
        expect(inviteMessage(planFriendInvite({ ...NY_VÄN, callerIsNew: false }), null)).toContain('Stjärnorna gäller nya konton');
        expect(inviteMessage(planFriendInvite({ ...NY_VÄN, blocked: true }), 'Josef')).toBe('Inbjudan går inte att använda.');
    });
});
