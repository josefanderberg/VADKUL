import { describe, it, expect } from 'vitest';
import {
    detectInstallPlatform,
    installGuide,
    shouldOfferInstall,
    INSTALL_SNOOZE_MS,
    type InstallPlatform,
} from './installPrompt';

// Fel plattform = fel (eller ingen) install-väg: en iPhone-användare som får
// Chromium-vägen ser aldrig något, och en Android-användare som får
// Safari-stegen letar efter en delningsknapp som inte finns.

const UA = {
    iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1',
    iphoneFirefox: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/127.0 Mobile/15E148 Safari/605.1.15',
    iphoneEdge: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) EdgiOS/126.0.2592.56 Version/17.0 Mobile/15E148 Safari/604.1',
    iphoneWebview: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 334.0.0.27.94',
    macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    androidSamsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
    androidFirefox: 'Mozilla/5.0 (Android 14; Mobile; rv:127.0) Gecko/127.0 Firefox/127.0',
    desktopChrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};

describe('detectInstallPlatform', () => {
    it('skiljer iOS-webbläsarna åt på deras egna märken', () => {
        expect(detectInstallPlatform(UA.iphoneSafari)).toBe('ios-safari');
        expect(detectInstallPlatform(UA.iphoneChrome)).toBe('ios-chrome');
        expect(detectInstallPlatform(UA.iphoneFirefox)).toBe('ios-firefox');
        expect(detectInstallPlatform(UA.iphoneEdge)).toBe('ios-edge');
    });

    it('in-app-webview utan Safari-märke blir ios-other', () => {
        expect(detectInstallPlatform(UA.iphoneWebview)).toBe('ios-other');
    });

    it('iPad i desktop-läge (Mac-UA + touch) är iOS — en riktig Mac är desktop', () => {
        expect(detectInstallPlatform(UA.macSafari, 5)).toBe('ios-safari');
        expect(detectInstallPlatform(UA.macSafari, 0)).toBe('desktop');
    });

    it('Android: Chromium-familjen blir android, Firefox sin egen väg', () => {
        expect(detectInstallPlatform(UA.androidChrome)).toBe('android');
        expect(detectInstallPlatform(UA.androidSamsung)).toBe('android');
        expect(detectInstallPlatform(UA.androidFirefox)).toBe('android-firefox');
    });

    it('desktop Chrome är desktop', () => {
        expect(detectInstallPlatform(UA.desktopChrome)).toBe('desktop');
    });
});

describe('installGuide', () => {
    it('Chromium-plattformarna får ingen manuell guide — de har en-tapps-vägen', () => {
        expect(installGuide('android')).toBeNull();
        expect(installGuide('desktop')).toBeNull();
    });

    it('alla iOS-varianter och Android-Firefox får en guide med steg', () => {
        const manual: InstallPlatform[] = [
            'ios-safari', 'ios-chrome', 'ios-firefox', 'ios-edge', 'ios-other', 'android-firefox',
        ];
        for (const platform of manual) {
            const guide = installGuide(platform);
            expect(guide, platform).not.toBeNull();
            expect(guide!.steps.length, platform).toBeGreaterThanOrEqual(2);
            expect(guide!.browser.length, platform).toBeGreaterThan(0);
        }
    });

    it('Safari-guiden pekar på delningsknappen och hemskärmen', () => {
        const guide = installGuide('ios-safari')!;
        expect(guide.icon).toBe('share');
        expect(guide.steps.join(' ')).toContain('hemskärmen');
    });

    it('Firefox på Android går via menyn och startskärmen', () => {
        const guide = installGuide('android-firefox')!;
        expect(guide.icon).toBe('menu');
        expect(guide.steps.join(' ')).toContain('startskärmen');
    });
});

describe('shouldOfferInstall', () => {
    const NOW = 1_758_240_000_000;
    const open = { dismissedForever: false, snoozedUntil: null, visits: 3, standalone: false };

    it('visas från andra besöket, aldrig första', () => {
        expect(shouldOfferInstall({ ...open, visits: 1 }, NOW)).toBe(false);
        expect(shouldOfferInstall({ ...open, visits: 2 }, NOW)).toBe(true);
    });

    it('aldrig i appläge eller efter kryss', () => {
        expect(shouldOfferInstall({ ...open, standalone: true }, NOW)).toBe(false);
        expect(shouldOfferInstall({ ...open, dismissedForever: true }, NOW)).toBe(false);
    });

    it('"Senare" tystar under snoozen men inte för alltid', () => {
        expect(shouldOfferInstall({ ...open, snoozedUntil: NOW + 1000 }, NOW)).toBe(false);
        expect(shouldOfferInstall({ ...open, snoozedUntil: NOW - 1000 }, NOW)).toBe(true);
        expect(shouldOfferInstall({ ...open, snoozedUntil: NOW - INSTALL_SNOOZE_MS }, NOW)).toBe(true);
    });
});
