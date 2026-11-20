import { describe, it, expect } from 'vitest';
import { placeHeroTitles, heroTitleWidth, HERO_TITLE_LINE_PX } from './heroTitles';
import type { HeroLiveEvent, HeroMarker } from './heroMarkers';

let n = 0;
const marker = (dx: number, dy: number, title = 'Quizkväll', count = 1): HeroMarker => ({
    e: {
        id: `e${n++}`, href: '/?event=x', dx, dy, lat: 57, lng: 14, emoji: '🎵', hex: null,
        t: 0, hour: 17, day: '2026-11-20', category: 'music', title,
    } as HeroLiveEvent,
    count,
});

// Heron i sitt största läge: 630 x 318.
const FULL = { halfW: 315, halfH: 159 };

type Box = { x0: number; y0: number; x1: number; y1: number };
const boxOf = (m: HeroMarker, t: { x: number; y: number; w: number }): Box => ({
    x0: m.e.dx + t.x, y0: m.e.dy + t.y, x1: m.e.dx + t.x + t.w, y1: m.e.dy + t.y + HERO_TITLE_LINE_PX,
});
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

describe('heroTitleWidth', () => {
    it('längre text är bredare, versaler bredare än gemener', () => {
        expect(heroTitleWidth('Quizkväll på puben')).toBeGreaterThan(heroTitleWidth('Quiz'));
        expect(heroTitleWidth('QUIZ')).toBeGreaterThan(heroTitleWidth('quiz'));
    });
});

describe('placeHeroTitles', () => {
    it('en ensam bricka får titeln under sig', () => {
        const [t] = placeHeroTitles([marker(0, 0)], FULL);
        expect(t?.side).toBe('under');
        expect(t?.text).toBe('Quizkväll');
        // Under brickans kropp, centrerad kring ankaret.
        expect(t!.y).toBeGreaterThan(0);
        expect(t!.x).toBeCloseTo(-t!.w / 2);
    });

    it('en bricka rakt under knuffar titeln åt sidan', () => {
        const ms = [marker(0, 0), marker(0, 40)];
        const [t] = placeHeroTitles(ms, FULL);
        expect(t?.side).toBe('right');
    });

    it('placerade titlar krockar aldrig med varandra eller med andras brickor', () => {
        // Ett tätt rutnät: alla kan inte få titel, men de som får det ska stå fritt.
        const ms: HeroMarker[] = [];
        for (let x = -120; x <= 120; x += 60) for (let y = -80; y <= 80; y += 40) ms.push(marker(x, y, 'Julmarknad i parken'));
        const ts = placeHeroTitles(ms, FULL);
        const boxes = ts.flatMap((t, i) => (t ? [{ i, box: boxOf(ms[i], t) }] : []));
        expect(boxes.length).toBeGreaterThan(0);
        expect(boxes.length).toBeLessThan(ms.length);
        for (const a of boxes) {
            for (const b of boxes) if (a.i < b.i) expect(overlaps(a.box, b.box)).toBe(false);
            ms.forEach((m, j) => {
                if (j === a.i) return;
                const body = { x0: m.e.dx - 17, y0: m.e.dy - 30, x1: m.e.dx + 17, y1: m.e.dy + 10 };
                expect(overlaps(a.box, body)).toBe(false);
            });
        }
    });

    it('det tidigaste eventet väljer läge först', () => {
        // Två brickor bredvid varandra: den första tar platsen under sig,
        // den andra får vika (dess titel under skulle krocka med den första).
        const ms = [marker(0, 0, 'Julmarknad i parken'), marker(50, 0, 'Julmarknad i parken')];
        const [a, b] = placeHeroTitles(ms, FULL);
        expect(a?.side).toBe('under');
        expect(b?.side).not.toBe('under');
    });

    it('titeln hålls innanför kartrutan', () => {
        // Brickan vid högerkanten: under och höger sticker ut, vänster ryms.
        const [t] = placeHeroTitles([marker(300, 0, 'Julmarknad i parken')], FULL);
        expect(t?.side).toBe('left');
        // Vid nederkanten ryms den inte under.
        const [u] = placeHeroTitles([marker(0, 150)], FULL);
        expect(u?.side).not.toBe('under');
    });

    it('brickor utanför en smal ruta får ingen titel', () => {
        // Telefon: rutan är ~335 px bred, bilden beskärs i sidled.
        const [t] = placeHeroTitles([marker(250, 0)], { halfW: 167, halfH: 143 });
        expect(t).toBeNull();
    });

    it('remsan med periodchipsen hålls fri', () => {
        const m = marker(0, -110);
        expect(placeHeroTitles([m], FULL)[0]?.side).toBe('under');
        // Med 150 px reserverat i överkant ligger hela brickan i remsan.
        expect(placeHeroTitles([m], { ...FULL, topReserve: 150 })[0]).toBeNull();
    });

    it('över en bricka med antalsbubbla hamnar titeln ovanför bubblan', () => {
        // Hinder under, till höger och till vänster: bara över återstår.
        const ms = [marker(0, 0, 'Quiz', 3), marker(0, 40), marker(40, -10), marker(-40, -10)];
        const [t] = placeHeroTitles(ms, FULL);
        expect(t?.side).toBe('over');
        expect(t!.y + HERO_TITLE_LINE_PX).toBeLessThanOrEqual(-40);
    });

    it('event utan titel får ingen etikett', () => {
        expect(placeHeroTitles([marker(0, 0, '')], FULL)).toEqual([null]);
    });
});
