import { describe, it, expect } from 'vitest';
import { canonicalFbEventUrl, tippedFbEventUrls } from './tipGuard';

const CANON = 'https://www.facebook.com/events/2956206891377881/';

describe('tipGuard', () => {
    it('FB:s delningsform /events/s/<slug>/<id>/ → kanonisk URL', () => {
        expect(canonicalFbEventUrl('https://facebook.com/events/s/mikaeliskolan-fafangans-hostma/2956206891377881/')).toBe(CANON);
    });

    it('kanonisk, mobil och query-försedd länk ger samma nyckel', () => {
        expect(canonicalFbEventUrl(CANON)).toBe(CANON);
        expect(canonicalFbEventUrl('https://m.facebook.com/events/2956206891377881?ref=share')).toBe(CANON);
        expect(canonicalFbEventUrl('https://web.facebook.com/events/2956206891377881/')).toBe(CANON);
    });

    it('icke-FB-länkar, tomma och trasiga värden → null', () => {
        expect(canonicalFbEventUrl('https://visitsormland.se/evenemang/hostmarknad')).toBeNull();
        expect(canonicalFbEventUrl('https://www.facebook.com/mikaeliskolan/')).toBeNull();
        expect(canonicalFbEventUrl('')).toBeNull();
        expect(canonicalFbEventUrl(undefined)).toBeNull();
        expect(canonicalFbEventUrl(null)).toBeNull();
    });

    it('mängden innehåller bara FB-event, dedupade', () => {
        const set = tippedFbEventUrls([
            'https://facebook.com/events/s/mikaeliskolan-fafangans-hostma/2956206891377881/',
            CANON,
            'https://example.se/evenemang/1',
            '',
            undefined,
        ]);
        expect([...set]).toEqual([CANON]);
    });
});
