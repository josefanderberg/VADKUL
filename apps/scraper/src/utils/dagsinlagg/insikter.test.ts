import { describe, it, expect } from 'vitest';
import { engagemang, perTema, tolkaFbInsikter, tolkaIgInsikter, tolkaInsightsLista, veckorapport, viktaTeman } from './insikter';
import type { Inlagg } from './typer';

const inlagg = (over: Partial<Inlagg>): Inlagg => ({
    id: '2026-11-03', tema: 'siffra', form: 'bild', status: 'publicerad', skapad: 1, publiceraEfter: 2,
    text: { fb: '', ig: '' }, data: {}, media: { typ: 'bild', fil: 'a.png' }, ...over,
});

describe('tolkning av Metas svar', () => {
    it('insights-listan, inklusive objektvärden som summeras', () => {
        const raw = { data: [
            { name: 'post_impressions_unique', values: [{ value: 420 }] },
            { name: 'post_clicks', values: [{ value: '7' }] },
            { name: 'reactions_by_type', values: [{ value: { like: 3, love: 2 } }] },
        ] };
        expect(tolkaInsightsLista(raw)).toEqual({ post_impressions_unique: 420, post_clicks: 7, reactions_by_type: 5 });
        expect(tolkaInsightsLista({ error: { message: 'x' } })).toEqual({});
    });

    it('facebook: räckvidd ur insights, reaktioner ur fälten', () => {
        const ut = tolkaFbInsikter({
            insights: { data: [{ name: 'post_impressions_unique', values: [{ value: 420 }] }, { name: 'post_impressions', values: [{ value: 500 }] }] },
            fields: { reactions: { summary: { total_count: 12 } }, comments: { summary: { total_count: 4 } }, shares: { count: 1 } },
        });
        expect(ut).toEqual({ rackvidd: 420, visningar: 500, klick: 0, reaktioner: 12, kommentarer: 4, delningar: 1 });
    });

    it('instagram: svenska nycklar, spelningar bara för video', () => {
        const raw = { data: [
            { name: 'reach', values: [{ value: 300 }] }, { name: 'likes', values: [{ value: 20 }] },
            { name: 'comments', values: [{ value: 2 }] }, { name: 'saved', values: [{ value: 5 }] },
            { name: 'shares', values: [{ value: 1 }] }, { name: 'plays', values: [{ value: 900 }] },
        ] };
        expect(tolkaIgInsikter(raw)).toEqual({ rackvidd: 300, gillningar: 20, kommentarer: 2, sparningar: 5, delningar: 1, spelningar: 900 });
        expect(tolkaIgInsikter({ data: [{ name: 'reach', values: [{ value: 10 }] }] })).toEqual({ rackvidd: 10, gillningar: 0, kommentarer: 0, sparningar: 0, delningar: 0 });
    });
});

describe('engagemang, perTema, viktaTeman', () => {
    const lista = [
        inlagg({ id: '2026-10-05', tema: 'gissa', insikter: { hamtad: 1, fb: { rackvidd: 1000, reaktioner: 10, kommentarer: 10 }, ig: { rackvidd: 500, gillningar: 20 } } }),
        inlagg({ id: '2026-10-12', tema: 'gissa', insikter: { hamtad: 1, fb: { rackvidd: 800, reaktioner: 8, kommentarer: 6 } } }),
        inlagg({ id: '2026-10-19', tema: 'gissa', insikter: { hamtad: 1, fb: { rackvidd: 600, reaktioner: 6, kommentarer: 4 } } }),
        inlagg({ id: '2026-10-06', tema: 'siffra', insikter: { hamtad: 1, fb: { rackvidd: 200, reaktioner: 1 } } }),
        inlagg({ id: '2026-10-13', tema: 'siffra', insikter: { hamtad: 1, fb: { rackvidd: 100, reaktioner: 0 } } }),
        inlagg({ id: '2026-10-20', tema: 'siffra', insikter: { hamtad: 1, fb: { rackvidd: 150, reaktioner: 1 } } }),
        inlagg({ id: '2026-10-07', tema: 'quiz', insikter: { hamtad: 1, fb: { rackvidd: 400, reaktioner: 4, kommentarer: 2 } } }),
        inlagg({ id: '2026-10-08', tema: 'video' }),
    ];

    it('engagemang väger kommentarer och delningar tyngst', () => {
        expect(engagemang({ hamtad: 1, fb: { rackvidd: 100, reaktioner: 2, kommentarer: 1, delningar: 1 } })).toBe(1 + 2 + 3 + 2);
        expect(engagemang(undefined)).toBe(0);
    });

    it('perTema sorterar på snitt och hoppar över omätta', () => {
        const r = perTema(lista);
        expect(r.map(x => x.tema)).toEqual(['gissa', 'quiz', 'siffra']);
        expect(r[0].antal).toBe(3);
        expect(r.find(x => x.tema === 'video')).toBeUndefined();
    });

    it('viktaTeman: bara teman med minst tre mätta, klampat 0,5-2', () => {
        const v = viktaTeman(perTema(lista));
        expect(v.quiz).toBeUndefined();
        expect(v.gissa).toBeGreaterThan(1);
        expect(v.gissa).toBeLessThanOrEqual(2);
        expect(v.siffra).toBeGreaterThanOrEqual(0.5);
        expect(v.siffra).toBeLessThan(1);
        expect(viktaTeman([])).toEqual({});
    });

    it('veckorapporten listar veckans inlägg och snitt per tema', () => {
        const r = veckorapport(lista, '2026-10-05', '2026-10-11');
        expect(r).toContain('Veckans inlägg 10-05 till 10-11');
        expect(r).toContain('10-05 gissa: FB 1000 nådda, 10 reaktioner, 10 kommentarer · IG 500 nådda, 20 gilla, 0 kommentarer');
        expect(r).toContain('10-08 video: insikter hämtas efter 48 h');
        expect(r).toContain('Snitt per tema');
        expect(r).not.toMatch(/[–—]/);
    });
});
