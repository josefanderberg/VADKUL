import { describe, it, expect } from 'vitest';
import { kraschText, jobbNamn } from './kraschlarm';

describe('kraschText', () => {
    it('tar med jobbet, felkoden och de första raderna', () => {
        const fel = Object.assign(new Error("The module 'better_sqlite3.node'\nwas compiled against a different Node.js version\nusing NODE_MODULE_VERSION 137.\nThis version requires 147."), { code: 'ERR_DLOPEN_FAILED' });
        const t = kraschText('dagsinlagg', fel);
        expect(t.startsWith('❌ dagsinlagg kraschade')).toBe(true);
        expect(t).toContain('(ERR_DLOPEN_FAILED)');
        expect(t).toContain('different Node.js version');
        expect(t).not.toContain('147');
    });

    it('kapar långa meddelanden och klarar fel som inte är Error', () => {
        expect(kraschText('x', 'a'.repeat(1000)).length).toBeLessThan(500);
        expect(kraschText('x', undefined)).toContain('okänt fel');
        expect(kraschText('x', { message: 'bara text' })).toContain('bara text');
    });
});

describe('jobbNamn', () => {
    it('läser skriptnamnet ur argv, även bakom ts-node', () => {
        expect(jobbNamn(['/usr/local/bin/node', '/x/node_modules/ts-node/dist/bin.js', 'src/scripts/dagsinlagg.ts', '--kör'])).toBe('dagsinlagg');
        expect(jobbNamn(['/usr/local/bin/node', '/Users/ai/Repos/VADKUL/apps/scraper/src/scripts/publish-ig-queue.ts', '--publicera'])).toBe('publish-ig-queue');
        expect(jobbNamn(['node'])).toBe('skript');
    });
});
