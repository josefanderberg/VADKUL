import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * Universella länkar (vadkul.se/e/<slug> m.fl. öppnar appen). Apple hämtar
 * apple-app-site-association när appen installeras - en trasig JSON eller fel
 * app-id stänger av länkarna tyst, utan fel någonstans. Firebase Hostings
 * appAssociation måste stå på NONE, annars serverar Hosting sin egen tomma
 * fil i stället för vår.
 */
const webRot = path.resolve(__dirname, '../..');
const aasa = JSON.parse(readFileSync(path.join(webRot, 'public/.well-known/apple-app-site-association'), 'utf8'));
const firebase = JSON.parse(readFileSync(path.join(webRot, '../../firebase.json'), 'utf8'));

describe('apple-app-site-association', () => {
    const details = aasa.applinks.details;

    it('pekar på appens bundle-id', () => {
        expect(details).toHaveLength(1);
        expect(details[0].appIDs.length).toBeGreaterThan(0);
        for (const id of details[0].appIDs) expect(id).toMatch(/^[A-Z0-9_]+\.se\.vadkul\.app$/);
    });

    it('täcker vägarna appen tar emot (samma som Androids intentFilters + ?event=)', () => {
        const vägar = details[0].components.map((c: { '/': string }) => c['/']);
        expect(vägar).toEqual(expect.arrayContaining(['/e/*', '/evenemang/*', '/arrangor/*']));
        expect(details[0].components).toContainEqual(expect.objectContaining({ '/': '/', '?': { event: '?*' } }));
    });
});

describe('firebase.json hosting', () => {
    it('låter vår egen fil gälla och serverar den som JSON', () => {
        expect(firebase.hosting.appAssociation).toBe('NONE');
        const regel = firebase.hosting.headers.find((h: { source: string }) => h.source === '/.well-known/apple-app-site-association');
        expect(regel?.headers).toContainEqual({ key: 'Content-Type', value: 'application/json' });
    });
});
