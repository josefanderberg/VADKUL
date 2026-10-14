import { describe, it, expect } from 'vitest';
import { isApiBot, isBotRefusal, BOT_REFUSAL_HEADER } from './apiBot';

describe('isApiBot', () => {
    it('känner igen botarna ur SSR-loggen 14/10', () => {
        for (const ua of [
            'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Reflectionbot/1.0; +https://reflection.ai/bot) Chrome/151.0.0.0 Safari/537.36',
            'Mozilla/5.0 (compatible; Baiduspider-render/2.0; +http://www.baidu.com/search/spider.html)',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot',
            'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.52 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
            'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
            'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
        ]) {
            expect(isApiBot(ua)).toBe(true);
        }
    });

    it('släpper igenom riktiga webbläsare, CUBOT-telefoner och headless-verktyg', () => {
        for (const ua of [
            'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
            'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/122.0.6261.128 Safari/537.36',
            'Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; Trident/6.0)',
        ]) {
            expect(isApiBot(ua)).toBe(false);
        }
    });

    it('tom eller saknad user-agent är ingen bot', () => {
        expect(isApiBot('')).toBe(false);
        expect(isApiBot(null)).toBe(false);
        expect(isApiBot(undefined)).toBe(false);
    });

    it('bot-spärren känns igen på 403 + rubriken, inte på vilken 403 som helst', () => {
        const withHeader = new Headers({ [BOT_REFUSAL_HEADER]: '1' });
        expect(isBotRefusal({ status: 403, headers: withHeader })).toBe(true);
        // Cloud Run-behörighet som fallit bort ger också 403 - då ska
        // klientens statiska reservfiler fortfarande rädda kartan.
        expect(isBotRefusal({ status: 403, headers: new Headers() })).toBe(false);
        expect(isBotRefusal({ status: 404, headers: withHeader })).toBe(false);
        // Teststubbar och gamla svar utan headers.
        expect(isBotRefusal({ status: 403 })).toBe(false);
    });
});
