import { describe, expect, it } from 'vitest';
import {
    categoryLabel, eventLabels, labelFeaturesFrom, truncateLabel, wishLabels, LABEL_MAX_CHARS,
    LABEL_BADGE_BOX, LABEL_BODY_BOX, LABEL_CAT_PLACEMENT, LABEL_TEXT_SIZE_STOPS, LABEL_TITLE_PLACEMENTS,
    boxesOverlap, labelSlotBox, labelTextBox, obstacleBoxAt, obstacleIcon, titleAnchorOffsets,
    type LabelAnchor, type LabelBox,
} from './v2MapLabel';
import { GL_ICON_SIZE_STOPS, interpolateZoomStops } from './v2MapBricka';

describe('truncateLabel', () => {
    it('lämnar korta titlar orörda', () => {
        expect(truncateLabel('Loppis i parken')).toBe('Loppis i parken');
    });

    it('lämnar exakt maxlängd orörd', () => {
        const s = 'a'.repeat(LABEL_MAX_CHARS);
        expect(truncateLabel(s)).toBe(s);
    });

    it('kapar långa titlar med …', () => {
        expect(truncateLabel('Allsång på slottsvallen med gäster')).toBe('Allsång på slottsv…');
        expect(Array.from(truncateLabel('x'.repeat(50))).length).toBe(LABEL_MAX_CHARS + 1);
    });

    it('klyver aldrig surrogatpar/emoji', () => {
        const s = '🎸'.repeat(LABEL_MAX_CHARS + 5);
        const out = truncateLabel(s);
        expect(out).toBe('🎸'.repeat(LABEL_MAX_CHARS) + '…');
    });

    it('trimmar blanksteg före ellipsen', () => {
        // Tecken 18 är ett mellanslag → "Titel …" vore fult.
        expect(truncateLabel('Sommarkväll i     Åhus hamn')).toBe('Sommarkväll i…');
    });
});

describe('categoryLabel', () => {
    it('slår upp kända kategorier', () => {
        expect(categoryLabel('music')).toBe('Musik');
    });

    it('faller tillbaka på Övrigt för okänd/saknad', () => {
        expect(categoryLabel('nonsense')).toBe('Övrigt');
        expect(categoryLabel(undefined)).toBe('Övrigt');
    });
});

describe('eventLabels', () => {
    it('kategori + kapad titel för eventet brickan visar', () => {
        expect(eventLabels('Yoga i det fria vid stranden', 'sport'))
            .toEqual({ labelCat: 'Sport', labelTitle: 'Yoga i det fria vi…' });
    });

    it('okänd kategori faller tillbaka på Övrigt', () => {
        expect(eventLabels('Kvällskonsert', undefined).labelCat).toBe('Övrigt');
    });

    it('är deterministisk: samma input två gånger ger identisk output', () => {
        expect(eventLabels('Marknad på torget i Alvesta', 'market'))
            .toEqual(eventLabels('Marknad på torget i Alvesta', 'market'));
    });
});

describe('wishLabels', () => {
    it('markerar önskan på båda zoomnivåerna', () => {
        expect(wishLabels('Foodtruck-festival')).toEqual({ labelCat: 'Önskan', labelTitle: 'Önskas: Foodtruck-…' });
    });
});

describe('labelFeaturesFrom', () => {
    const feat = (key: string, past = false) => ({ properties: { key, past } });

    it('släpper bara igenom tända (op > 0.5), ej passerade', () => {
        const lit = new Map([['a', 1], ['b', 0.3], ['c', 1], ['d', 0.51]]);
        const out = labelFeaturesFrom([feat('a'), feat('b'), feat('c', true), feat('d'), feat('e')], lit);
        expect(out.map(f => f.properties.key)).toEqual(['a', 'd']);
    });

    it('tom lit-map ger tom spegel', () => {
        expect(labelFeaturesFrom([feat('a')], new Map())).toEqual([]);
    });
});

// ── Etikettplaceringen mot brickornas krockytor (#204) ──────────────────────
// MapLibre placerar titeln i första fria läge. Krocklagren lägger en ruta över
// varje tänd brickas kropp (och +N-pill), så ett läge som skär den EGNA
// brickans ruta skulle aldrig kunna väljas - och ett läge långt ifrån brickan
// ser inte ut att höra till den. Testerna räknar som MapLibre (labelTextBox)
// över hela zoomskalan och för korta som kapade (18 tecken) titlar.
describe('etikettlägena mot den egna brickan (#204)', () => {
    const ZOOMS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18];
    const WIDTHS = [24, 60, 130]; // "Mat" … en kapad titel i fet 13,5 px
    const at = (zoom: number) => ({
        icon: interpolateZoomStops(GL_ICON_SIZE_STOPS, zoom),
        text: interpolateZoomStops(LABEL_TEXT_SIZE_STOPS, zoom),
    });
    // Avstånd mellan två rutor (0 om de möts).
    const gap = (a: LabelBox, b: LabelBox) => Math.hypot(
        Math.max(0, a.x0 - b.x1, b.x0 - a.x1),
        Math.max(0, a.y0 - b.y1, b.y0 - a.y1),
    );
    const unpadded = (b: LabelBox): LabelBox => ({ x0: b.x0 + 2, y0: b.y0 + 2, x1: b.x1 - 2, y1: b.y1 - 2 });

    it('inget titelläge krockar med den egna brickans kropp, på någon zoom', () => {
        for (const zoom of ZOOMS) {
            const { icon, text } = at(zoom);
            const body = obstacleBoxAt(LABEL_BODY_BOX, icon);
            for (const [anchor, offset] of LABEL_TITLE_PLACEMENTS) {
                for (const w of WIDTHS) {
                    const box = labelTextBox(anchor, offset, text, w);
                    expect(boxesOverlap(box, body), `${anchor} z${zoom} w${w}`).toBe(false);
                }
            }
        }
    });

    it('kategorireserven krockar inte heller med sin egen bricka', () => {
        for (const zoom of ZOOMS) {
            const { icon, text } = at(zoom);
            const box = labelTextBox(LABEL_CAT_PLACEMENT[0], LABEL_CAT_PLACEMENT[1], text, 30);
            expect(boxesOverlap(box, obstacleBoxAt(LABEL_BODY_BOX, icon))).toBe(false);
        }
    });

    it('varje läge sitter tätt intill brickan (högst 14 px luft)', () => {
        for (const zoom of ZOOMS) {
            const { icon, text } = at(zoom);
            const body = obstacleBoxAt(LABEL_BODY_BOX, icon);
            for (const [anchor, offset] of LABEL_TITLE_PLACEMENTS) {
                const box = unpadded(labelTextBox(anchor, offset, text, 60));
                expect(gap(box, body), `${anchor} z${zoom}`).toBeLessThanOrEqual(14);
            }
        }
    });

    it('en grupps +N-pill lämnar under, båda sidorna och snett över till vänster fria', () => {
        const free: LabelAnchor[] = ['top', 'left', 'right', 'top-left', 'top-right', 'bottom-right'];
        for (const zoom of ZOOMS) {
            const { icon, text } = at(zoom);
            const badge = obstacleBoxAt(LABEL_BADGE_BOX, icon);
            for (const [anchor, offset] of LABEL_TITLE_PLACEMENTS) {
                if (!free.includes(anchor)) continue;
                for (const w of WIDTHS) {
                    expect(boxesOverlap(labelTextBox(anchor, offset, text, w), badge), `${anchor} z${zoom} w${w}`).toBe(false);
                }
            }
        }
    });

    it('rakt över en grupp täcks av pillen, så det läget hoppas över där', () => {
        const { icon, text } = at(13);
        const over = LABEL_TITLE_PLACEMENTS.find(([a]) => a === 'bottom')!;
        expect(boxesOverlap(labelTextBox('bottom', over[1], text, 60), obstacleBoxAt(LABEL_BADGE_BOX, icon))).toBe(true);
    });

    it('spärren under spetsen ligger inuti kategorins plats och fri från brickan', () => {
        const slot = labelSlotBox();
        for (const zoom of ZOOMS) {
            const { icon, text } = at(zoom);
            const cat = labelTextBox(LABEL_CAT_PLACEMENT[0], LABEL_CAT_PLACEMENT[1], text, 24);
            expect(cat.x0 <= slot.x0 && cat.x1 >= slot.x1 && cat.y0 <= slot.y0 && cat.y1 >= slot.y1, `z${zoom}`).toBe(true);
            expect(boxesOverlap(slot, obstacleBoxAt(LABEL_BODY_BOX, icon))).toBe(false);
        }
    });

    it('under brickan provas först, och varje ankare finns en gång', () => {
        expect(LABEL_TITLE_PLACEMENTS[0][0]).toBe('top');
        const anchors = LABEL_TITLE_PLACEMENTS.map(([a]) => a);
        expect(new Set(anchors).size).toBe(anchors.length);
        expect(anchors).toHaveLength(8);
    });

    it('titleAnchorOffsets ger MapLibres platta lista', () => {
        const [lit, values] = titleAnchorOffsets();
        expect(lit).toBe('literal');
        expect(values.slice(0, 4)).toEqual(['top', [0, 0.35], 'left', [2.4, -2.5]]);
        expect(values).toHaveLength(LABEL_TITLE_PLACEMENTS.length * 2);
    });
});

describe('obstacleIcon', () => {
    it('bilden täcker hela rutan och har heltalsmått', () => {
        for (const box of [LABEL_BODY_BOX, LABEL_BADGE_BOX]) {
            const { width, height, offset } = obstacleIcon(box);
            expect(Number.isInteger(width) && Number.isInteger(height)).toBe(true);
            expect(offset).toEqual([box.x0, box.y0]);
            expect(offset[0] + width).toBeGreaterThanOrEqual(box.x1);
            expect(offset[1] + height).toBeGreaterThanOrEqual(box.y1);
        }
    });

    it('kroppens ruta slutar vid spetsen, ovanför koordinaten', () => {
        const b = obstacleBoxAt(LABEL_BODY_BOX, 1);
        expect(b.y1).toBeLessThan(0);
        expect(b.x0).toBe(-b.x1);
    });
});
