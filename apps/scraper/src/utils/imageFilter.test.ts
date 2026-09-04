import { describe, it, expect } from 'vitest';
import { isLikelyLogoOrPlaceholderImage, normalizeImagePort } from './imageFilter';

describe('isLikelyLogoOrPlaceholderImage', () => {
    it('fäller kommunloggor och logotyper', () => {
        // De faktiska syndarna ur storage-analysen 2026-08-30
        expect(isLikelyLogoOrPlaceholderImage(
            'https://www.sodertalje.se/contentassets/0b5102886f0e47eb94bc318e72bbaddf/sodertaljelogo.png')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage(
            'http://www.svedala.se/content/images/Logo_Svedala2.jpg')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage(
            'https://www.engelholm.se/images/18.2dd38c4218cedba15276fdb/1713789375989/ny_logo_2019.png')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage(
            'https://example.com/webdav/images/logotype.png')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/assets/logotyp-webb.png')).toBe(true);
    });

    it('fäller platshållare och sajtvida delningsbilder', () => {
        expect(isLikelyLogoOrPlaceholderImage(
            'https://www.molndal.se/images/18.7f99e36a199c8b093d66f3d/1761049978364/LazyloadWhitePx_comp.png')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage(
            'https://www.datocms-assets.com/108519/1706010715-shareimage-1200x630.jpg?auto=format&fit=max&w=1200')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/img/placeholder.jpg')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/img/spacer.gif')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/static/1x1.png')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/tracking/pixel.gif')).toBe(true);
    });

    it('fäller svg, favicon och ikoner', () => {
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/assets/hero.svg')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/favicon-32x32.png')).toBe(true);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/apple-touch-icon.png')).toBe(true);
    });

    it('släpper igenom riktiga eventbilder', () => {
        expect(isLikelyLogoOrPlaceholderImage(
            'https://static.tickster.com/cdn-cgi/image/format=auto,width=960/e4/cc396d6aca37.jpg')).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage(
            'https://cdn.naturskyddsforeningen.se/uploads/2024/04/Blasippa_landscape_140329.jpg')).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage(
            'https://visit.norrkoping.se/images/200.2cc7f27a19c27129255a0f/1770453450540/Geoff%20Tate.jpg')).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage('https://api.axiell.com/assets/api/assets/6a8e9ec532f6376a996781c3')).toBe(false);
    });

    it('fäller inte ord som råkar innehålla logo/icon', () => {
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/events/resa-till-bologna.jpg')).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/kurs/logoped-forelasning.jpg')).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/iconic-festival-2026.jpg')).toBe(false);
    });

    it('query-parametrar triggar inte', () => {
        expect(isLikelyLogoOrPlaceholderImage('https://x.se/bild/konsert.jpg?ref=logo&w=100')).toBe(false);
    });

    it('tål null/undefined/skräp', () => {
        expect(isLikelyLogoOrPlaceholderImage(null)).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage(undefined)).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage('')).toBe(false);
        expect(isLikelyLogoOrPlaceholderImage('inte-en-url-logo.png')).toBe(true);
    });
});

describe('normalizeImagePort', () => {
    it('släpper https://…:80 (Axiell-fallet) och http://…:443', () => {
        expect(normalizeImagePort('https://bibliotekuppsala.se:80/documents/a%20b.jpg?t=1'))
            .toBe('https://bibliotekuppsala.se/documents/a%20b.jpg?t=1');
        expect(normalizeImagePort('http://a.se:443/b.jpg')).toBe('http://a.se/b.jpg');
    });
    it('rör inte avsiktliga portar eller vanliga URL:er', () => {
        expect(normalizeImagePort('https://a.se:8443/b.jpg')).toBe('https://a.se:8443/b.jpg');
        expect(normalizeImagePort('https://a.se/b.jpg')).toBe('https://a.se/b.jpg');
    });
    it('lämnar ogiltiga strängar orörda', () => {
        expect(normalizeImagePort('/images/b.jpg')).toBe('/images/b.jpg');
    });
});
