import { describe, expect, it } from 'vitest';
import { byggPushMeddelanden, ärAppToken, ärDödToken } from './pushMessages';

const payload = { title: 'Helgtips', body: '12 event i Växjö', url: '/evenemang/vaxjo', type: 'weeklyDigest' };
const NU = Date.UTC(2026, 10, 5, 15, 30);

describe('byggPushMeddelanden', () => {
    it('webbens tokens (inget platform) får data-only med webpush-TTL', () => {
        const [m] = byggPushMeddelanden([{ token: 'w1' }], payload, 3600, NU) as any[];
        expect(m.token).toBe('w1');
        expect(m.notification).toBeUndefined();
        expect(m.apns).toBeUndefined();
        expect(m.data).toEqual({ ...payload, eventId: '' });
        expect(m.webpush.headers).toEqual({ TTL: '3600', Urgency: 'high' });
    });

    it('appens tokens får en riktig notis med data, apns och android', () => {
        const [ios, android] = byggPushMeddelanden(
            [{ token: 'i1', platform: 'ios' }, { token: 'a1', platform: 'android' }],
            { ...payload, eventId: 'abc' },
            24 * 3600,
            NU,
        ) as any[];
        for (const m of [ios, android]) {
            expect(m.notification).toEqual({ title: 'Helgtips', body: '12 event i Växjö' });
            expect(m.data.url).toBe('/evenemang/vaxjo');
            expect(m.data.eventId).toBe('abc');
            expect(m.webpush).toBeUndefined();
            expect(m.apns.headers['apns-expiration']).toBe(String(NU / 1000 + 24 * 3600));
            expect(m.apns.payload.aps.sound).toBe('default');
            expect(m.android.ttl).toBe(24 * 3600 * 1000);
            expect(m.android.priority).toBe('high');
        }
    });

    it('blandar plattformar i samma ordning som tokens', () => {
        const ms = byggPushMeddelanden(
            [{ token: 'a', platform: 'ios' }, { token: 'b' }, { token: 'c', platform: 'web' }],
            payload,
            60,
            NU,
        ) as any[];
        expect(ms.map(m => m.token)).toEqual(['a', 'b', 'c']);
        expect(ms.map(m => m.notification != null)).toEqual([true, false, false]);
    });

    it('alla data-värden är strängar', () => {
        const [m] = byggPushMeddelanden([{ token: 'i', platform: 'ios' }], payload, 60, NU) as any[];
        for (const v of Object.values(m.data)) expect(typeof v).toBe('string');
    });
});

describe('ärAppToken / ärDödToken', () => {
    it('känner igen appens plattformar', () => {
        expect(ärAppToken('ios')).toBe(true);
        expect(ärAppToken('android')).toBe(true);
        expect(ärAppToken(undefined)).toBe(false);
        expect(ärAppToken('web')).toBe(false);
    });

    it('raderar bara vid fel som betyder död token', () => {
        expect(ärDödToken('messaging/registration-token-not-registered')).toBe(true);
        expect(ärDödToken('messaging/invalid-registration-token')).toBe(true);
        expect(ärDödToken('messaging/internal-error')).toBe(false);
        expect(ärDödToken('messaging/third-party-auth-error')).toBe(false);
        expect(ärDödToken(undefined)).toBe(false);
    });
});
