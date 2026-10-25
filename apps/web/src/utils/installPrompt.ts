// Vägen ner till hemskärmen, per webbläsare. Helt automatisk installation
// finns inte — alla webbläsare kräver en användargest (annars hade varje sajt
// lagt sig själv på hemskärmen). Det närmaste vi kommer:
//   - Chromium (Chrome/Edge/Samsung på Android + desktop): beforeinstallprompt
//     fångas i komponenten → EN tapp på "Installera" öppnar systemrutan.
//   - iOS: Apple ger inget API alls. Bästa möjliga = rätt steg för exakt den
//     webbläsare användaren står i — delningsknappen sitter på olika ställen
//     i Safari, Chrome, Firefox och Edge.
//   - Firefox på Android: inget beforeinstallprompt — menyvägen visas i stället.
// Den här modulen är React-fri så detekteringen och grinden kan testas.

export type InstallPlatform =
    | 'ios-safari'
    | 'ios-chrome'
    | 'ios-firefox'
    | 'ios-edge'
    | 'ios-other'
    | 'android-firefox'
    | 'android'
    | 'desktop';

/**
 * Vilken webbläsare/plattform står användaren i? iPadOS i "desktop-läge"
 * skickar Mac-UA — avslöjas av maxTouchPoints (samma knep som fcm.ts).
 */
export function detectInstallPlatform(ua: string, maxTouchPoints = 0): InstallPlatform {
    const isIos = /iPad|iPhone|iPod/.test(ua)
        || (ua.includes('Macintosh') && maxTouchPoints > 1);

    if (isIos) {
        // Alla iOS-webbläsare är WebKit — de skiljs bara på sina egna märken.
        // Märkena måste kollas FÖRE Safari: Cri/Fx/EdgiOS bär också "Safari/…".
        if (ua.includes('CriOS')) return 'ios-chrome';
        if (ua.includes('FxiOS')) return 'ios-firefox';
        if (ua.includes('EdgiOS')) return 'ios-edge';
        if (ua.includes('Safari')) return 'ios-safari';
        return 'ios-other'; // in-app-webview (Instagram/Facebook) saknar Safari-märket
    }

    if (/Android/.test(ua)) {
        return ua.includes('Firefox/') ? 'android-firefox' : 'android';
    }

    return 'desktop';
}

// ── Nativa appen i butikerna ───────────────────────────────────────────────
// Butikslänkarna sätts NÄR APPEN SLÄPPS i respektive butik - null = inte
// släppt där än, och då visas ingen butiksbanner på den plattformen (PWA-
// erbjudandet gäller som förut). Finns länken tar butiksbannern över: en
// riktig app slår "lägg till på hemskärmen".
//   iOS:     släppt i App Store 22/10 2026 (verifierat via itunes.apple.com/
//            lookup?bundleId=se.vadkul.app) - länken ifylld nedan.
//   Android: 'https://play.google.com/store/apps/details?id=se.vadkul.app'
//            när appen släpps på Play - fyll aldrig i före det (död butikssida).
export const APP_STORE_URL: string | null = 'https://apps.apple.com/se/app/id6820135961';
export const PLAY_STORE_URL: string | null = null;

export interface StoreLinks {
    ios: string | null;
    android: string | null;
}

/** Butiksnamnet för knappen, per plattform. */
export function storeNameFor(platform: InstallPlatform): 'App Store' | 'Google Play' | null {
    if (platform.startsWith('ios')) return 'App Store';
    if (platform.startsWith('android')) return 'Google Play';
    return null;
}

/**
 * Butikslänken för plattformen - null = ingen butik (desktop, eller appen
 * inte släppt där än). In-app-webbvyer (ios-other/Instagram) får länken
 * också: butikslänkar öppnar App Store/Play från alla webbvyer.
 */
export function appStoreLinkFor(
    platform: InstallPlatform,
    links: StoreLinks = { ios: APP_STORE_URL, android: PLAY_STORE_URL },
): string | null {
    if (platform.startsWith('ios')) return links.ios;
    if (platform.startsWith('android')) return links.android;
    return null;
}

export interface InstallGuide {
    /** Webbläsarnamnet guiden gäller — visas i rubriken. */
    browser: string;
    /** Symbolen första steget pekar på — styr ikonen i guiden. */
    icon: 'share' | 'menu';
    steps: string[];
}

/**
 * Steg-för-steg-guiden för webbläsare utan install-API. null = webbläsaren
 * har (eller kan få) den riktiga en-tapps-vägen via beforeinstallprompt,
 * så inga manuella steg ska visas.
 */
export function installGuide(platform: InstallPlatform): InstallGuide | null {
    switch (platform) {
        case 'ios-safari':
            return {
                browser: 'Safari',
                icon: 'share',
                steps: [
                    'Tryck på delningsknappen i menyraden längst ner.',
                    'Skrolla ner i listan och välj ”Lägg till på hemskärmen”.',
                    'Tryck på ”Lägg till” uppe till höger — klart!',
                ],
            };
        case 'ios-chrome':
            return {
                browser: 'Chrome',
                icon: 'share',
                steps: [
                    'Tryck på delningsknappen uppe till höger.',
                    'Välj ”Lägg till på hemskärmen”.',
                    'Tryck på ”Lägg till” — klart!',
                ],
            };
        case 'ios-firefox':
            return {
                browser: 'Firefox',
                icon: 'menu',
                steps: [
                    'Öppna menyn längst ner till höger.',
                    'Välj ”Dela” och sedan ”Lägg till på hemskärmen”.',
                    'Tryck på ”Lägg till” — klart!',
                ],
            };
        case 'ios-edge':
            return {
                browser: 'Edge',
                icon: 'menu',
                steps: [
                    'Öppna menyn längst ner i mitten.',
                    'Välj ”Dela” och sedan ”Lägg till på hemskärmen”.',
                    'Tryck på ”Lägg till” — klart!',
                ],
            };
        case 'ios-other':
            return {
                browser: 'din webbläsare',
                icon: 'share',
                steps: [
                    'Öppna webbläsarens delningsmeny.',
                    'Välj ”Lägg till på hemskärmen”.',
                    'Tryck på ”Lägg till” — klart!',
                ],
            };
        case 'android-firefox':
            return {
                browser: 'Firefox',
                icon: 'menu',
                steps: [
                    'Öppna menyn uppe till höger.',
                    'Välj ”Lägg till på startskärmen”.',
                    'Tryck på ”Lägg till” — klart!',
                ],
            };
        case 'android':
        case 'desktop':
            return null;
    }
}

/** "Senare" tystar banderollen så här länge — inte för alltid. */
export const INSTALL_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;

export interface InstallGateInput {
    /** Krysset eller ett genomfört install → aldrig mer. */
    dismissedForever: boolean;
    /** ms-epoch från "Senare", null = aldrig snoozad. */
    snoozedUntil: number | null;
    /** Besöksräknaren (vadkul_visits) EFTER att dagens besök räknats in. */
    visits: number;
    /** Körs sidan redan som app från hemskärmen? */
    standalone: boolean;
}

/**
 * Ska install-erbjudandet visas alls det här besöket? Förstagångsbesökare
 * har välkomstkortet och inget skäl att installera än — från andra besöket.
 */
export function shouldOfferInstall(gate: InstallGateInput, now: number): boolean {
    if (gate.standalone || gate.dismissedForever) return false;
    if (gate.visits < 2) return false;
    if (gate.snoozedUntil !== null && now < gate.snoozedUntil) return false;
    return true;
}
