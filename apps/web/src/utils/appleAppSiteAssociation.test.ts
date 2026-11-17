/**
 * Låser vilka vadkul.se-adresser som öppnar iOS-appen (universella länkar).
 *
 * Filen i public/.well-known/ läses av iOS via Apples CDN. Varje komponent
 * prövas i ordning och den FÖRSTA som matchar avgör: `exclude: true` betyder
 * att adressen stannar i webbläsaren. Matchningen nedan följer Apples regler
 * för `components` (`*` = noll eller fler tecken, `?` = ett tecken, och varje
 * nyckel i "?"-objektet måste finnas i adressens query).
 *
 * #254: Stripes retur efter ett boostköp (?boost_session=cs_…) måste stanna
 * i webbläsaren. confirmBoost körs bara av webbsidan, och appen kan inte
 * applicera boosten - öppnas appen uteblir boosten trots betalningen.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

type Komponent = { '/'?: string; '?'?: Record<string, string>; exclude?: boolean };

const WEB = join(__dirname, '..', '..');
const aasa = JSON.parse(readFileSync(join(WEB, 'public/.well-known/apple-app-site-association'), 'utf8'));
const detaljer = aasa.applinks.details as { appIDs: string[]; components: Komponent[] }[];

function mönster(p: string): RegExp {
    const kropp = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${kropp}$`);
}

/** true = appen öppnas, false = adressen stannar i webbläsaren. */
function öppnarAppen(adress: string): boolean {
    const url = new URL(adress);
    for (const k of detaljer[0].components) {
        if (k['/'] !== undefined && !mönster(k['/']).test(url.pathname)) continue;
        if (k['?'] && !Object.entries(k['?']).every(([nyckel, värde]) => url.searchParams.has(nyckel) && mönster(värde).test(url.searchParams.get(nyckel) ?? ''))) continue;
        return !k.exclude;
    }
    return false;
}

describe('apple-app-site-association', () => {
    it('gäller VADKUL-appen', () => {
        expect(detaljer).toHaveLength(1);
        expect(detaljer[0].appIDs).toEqual(['66D54NKWK7.se.vadkul.app']);
    });

    it('vanliga sidor och delade event öppnar appen', () => {
        expect(öppnarAppen('https://vadkul.se/')).toBe(true);
        expect(öppnarAppen('https://vadkul.se/e/abc123')).toBe(true);
        expect(öppnarAppen('https://vadkul.se/evenemang/goteborg')).toBe(true);
        expect(öppnarAppen('https://vadkul.se/?event=xyz&van=uid1')).toBe(true);
    });

    it('Stripes retur efter boostköp stannar i webbläsaren, på alla sidor (#254)', () => {
        expect(öppnarAppen('https://vadkul.se/?boost_session=cs_live_a1b2c3')).toBe(false);
        expect(öppnarAppen('https://vadkul.se/?event=xyz&boost_session=cs_live_a1b2c3')).toBe(false);
        expect(öppnarAppen('https://vadkul.se/evenemang/goteborg?boost_session=cs_live_a1b2c3')).toBe(false);
    });

    it('undantaget använder samma parameternamn som success_url i boost.ts', () => {
        const boost = readFileSync(join(WEB, '..', 'functions', 'src', 'boost.ts'), 'utf8');
        const namn = boost.match(/([a-z_]+)=\{CHECKOUT_SESSION_ID\}/)?.[1];
        expect(namn).toBe('boost_session');
        const undantag = detaljer[0].components.filter(k => k.exclude && k['?']);
        expect(undantag.some(k => namn! in k['?']!)).toBe(true);
    });

    it("Firebase Auths länkar och Hostings reserverade sökvägar öppnar inte appen", () => {
        expect(öppnarAppen('https://vadkul.se/__/auth/action?mode=resetPassword&oobCode=x')).toBe(false);
        expect(öppnarAppen('https://vadkul.se/__/auth/handler?apiKey=x')).toBe(false);
        expect(öppnarAppen('https://vadkul.se/_/x')).toBe(false);
    });
});
