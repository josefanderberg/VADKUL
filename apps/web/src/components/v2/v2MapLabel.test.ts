import { describe, expect, it } from 'vitest';
import { categoryLabel, eventLabels, labelFeaturesFrom, truncateLabel, wishLabels, LABEL_MAX_CHARS } from './v2MapLabel';

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
