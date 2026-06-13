import { describe, it, expect } from 'vitest';
import { mapBildaArr } from './bilda';

const post = {
    id: 1299335,
    link: 'https://www.bilda.nu/arr/1299335/sa-blir-hela-livet-932216/',
    title: { rendered: 'Fallback-titel' },
    meta: {
        'arr-meta-data': JSON.stringify({
            namn: '"Så blir hela livet" med Alf B. Svensson',
            webbrubrik: 'Så blir hela livet',
            nummer: 932216,
            startdatum: '2026-09-02T00:00:00',
            starttid: '2026-09-02T15:00:00',
            sluttid: '2026-09-02T16:00:00',
            lokal: 'Missionskyrkan Lidköping',
            lokaladress: 'Esplanaden 3',
            lokalort: 'LIDKÖPING',
            lokalpostnr: '53150',
            deltagaravgift: 0,
            webbingress: 'En föreläsning om livet.',
        }),
    },
};

describe('mapBildaArr', () => {
    it('mappar komplett kulturprogram med adress och klockslag', () => {
        const e = mapBildaArr(post);
        expect(e?.title).toBe('Så blir hela livet');
        expect(e?.startDate.getHours()).toBe(15);
        expect(e?.hasSpecificTime).toBe(true);
        expect(e?.venueName).toBe('Missionskyrkan Lidköping');
        expect(e?.address).toBe('Esplanaden 3');
        expect(e?.city).toBe('Lidköping');
        expect(e?.price).toBe('Gratis');
        expect(e?.url).toContain('/arr/1299335/');
    });

    it('utan starttid används startdatum med hasSpecificTime=false', () => {
        const meta = JSON.parse(post.meta['arr-meta-data']);
        meta.starttid = null;
        const e = mapBildaArr({ ...post, meta: { 'arr-meta-data': JSON.stringify(meta) } });
        expect(e?.hasSpecificTime).toBe(false);
        expect(e?.startDate.toISOString()).toContain('2026-09-0');
    });

    it('avgift > 0 blir kr-sträng', () => {
        const meta = JSON.parse(post.meta['arr-meta-data']);
        meta.deltagaravgift = 150;
        const e = mapBildaArr({ ...post, meta: { 'arr-meta-data': JSON.stringify(meta) } });
        expect(e?.price).toBe('150 kr');
    });

    it('trasig meta → null', () => {
        expect(mapBildaArr({ meta: { 'arr-meta-data': '{trasig' } })).toBeNull();
        expect(mapBildaArr({ meta: {} })).toBeNull();
    });
});
