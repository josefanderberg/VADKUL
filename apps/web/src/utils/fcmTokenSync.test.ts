import { describe, expect, it } from 'vitest';
import {
    planTokenSync,
    parseSavedTokenRecord,
    tokenToForgetOnLogout,
    shouldCheckOnResume,
    TOKEN_RESAVE_MS,
    RESUME_CHECK_MIN_MS,
    SavedTokenRecord,
} from './fcmTokenSync';

const NOW = Date.parse('2026-09-21T12:00:00Z');
const rec = (over: Partial<SavedTokenRecord> = {}): SavedTokenRecord => ({
    uid: 'u1', token: 'fid:A', savedAt: NOW - 60_000, ...over,
});

describe('planTokenSync', () => {
    it('inget sparat på enheten → spara som ny, inget att radera', () => {
        expect(planTokenSync(null, 'u1', 'fid:A', NOW)).toEqual({ save: true, isNew: true, deleteToken: null });
    });

    it('samma konto, samma token, nyss sparad → ingen skrivning', () => {
        expect(planTokenSync(rec(), 'u1', 'fid:A', NOW)).toEqual({ save: false, isNew: false, deleteToken: null });
    });

    it('samma token men sparningen är ett dygn gammal → skriv om (lastSeenAt), inte som ny', () => {
        const plan = planTokenSync(rec({ savedAt: NOW - TOKEN_RESAVE_MS }), 'u1', 'fid:A', NOW);
        expect(plan).toEqual({ save: true, isNew: false, deleteToken: null });
    });

    it('klockan har hoppat bakåt → skriv om hellre än att fastna', () => {
        expect(planTokenSync(rec({ savedAt: NOW + 3_600_000 }), 'u1', 'fid:A', NOW).save).toBe(true);
    });

    it('roterad token på samma konto → spara nya OCH radera förra dokumentet', () => {
        // Kedjan från 17/9: samma installation, ny prenumeration, gamla
        // tokenen blev "NotRegistered" men låg kvar i fcmTokens.
        expect(planTokenSync(rec(), 'u1', 'fid:B', NOW)).toEqual({ save: true, isNew: true, deleteToken: 'fid:A' });
    });

    it('rotation raderar även när förra sparningen är färsk', () => {
        expect(planTokenSync(rec({ savedAt: NOW }), 'u1', 'fid:B', NOW).deleteToken).toBe('fid:A');
    });

    it('annat konto på samma enhet → spara, men rör inte förra kontots dokument', () => {
        // Reglerna låter bara ägaren radera; utloggningen städar i stället.
        expect(planTokenSync(rec(), 'u2', 'fid:A', NOW)).toEqual({ save: true, isNew: true, deleteToken: null });
        expect(planTokenSync(rec(), 'u2', 'fid:B', NOW).deleteToken).toBeNull();
    });
});

describe('parseSavedTokenRecord', () => {
    it('läser tillbaka det som sparats', () => {
        const r = rec();
        expect(parseSavedTokenRecord(JSON.stringify(r))).toEqual(r);
    });

    it('null, skräp och ofullständiga poster → null', () => {
        expect(parseSavedTokenRecord(null)).toBeNull();
        expect(parseSavedTokenRecord('')).toBeNull();
        expect(parseSavedTokenRecord('{inte json')).toBeNull();
        expect(parseSavedTokenRecord('null')).toBeNull();
        expect(parseSavedTokenRecord('"fid:A"')).toBeNull();
        expect(parseSavedTokenRecord(JSON.stringify({ uid: 'u1', token: 'fid:A' }))).toBeNull();
        expect(parseSavedTokenRecord(JSON.stringify({ uid: '', token: 'fid:A', savedAt: NOW }))).toBeNull();
        expect(parseSavedTokenRecord(JSON.stringify({ uid: 'u1', token: 7, savedAt: NOW }))).toBeNull();
    });

    it('extra fält följer inte med', () => {
        const parsed = parseSavedTokenRecord(JSON.stringify({ ...rec(), extra: 1 }));
        expect(parsed).toEqual(rec());
    });
});

describe('tokenToForgetOnLogout', () => {
    it('enhetens token på kontot som loggar ut ska bort', () => {
        expect(tokenToForgetOnLogout(rec(), 'u1')).toBe('fid:A');
    });

    it('inget sparat, eller sparat på ett annat konto → inget att radera', () => {
        expect(tokenToForgetOnLogout(null, 'u1')).toBeNull();
        expect(tokenToForgetOnLogout(rec({ uid: 'u2' }), 'u1')).toBeNull();
    });
});

describe('shouldCheckOnResume', () => {
    it('första återkomsten kollar alltid', () => {
        expect(shouldCheckOnResume(null, NOW)).toBe(true);
    });

    it('snabba flikbyten kollar inte om och om igen', () => {
        expect(shouldCheckOnResume(NOW - 30_000, NOW)).toBe(false);
        expect(shouldCheckOnResume(NOW - RESUME_CHECK_MIN_MS + 1, NOW)).toBe(false);
    });

    it('efter spärrtiden, eller om klockan hoppat bakåt → kolla', () => {
        expect(shouldCheckOnResume(NOW - RESUME_CHECK_MIN_MS, NOW)).toBe(true);
        expect(shouldCheckOnResume(NOW + 60_000, NOW)).toBe(true);
    });
});
