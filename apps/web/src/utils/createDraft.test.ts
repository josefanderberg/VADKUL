import { describe, it, expect } from 'vitest';
import { parseCreateDraft, draftHasContent, draftTimeStillValid, type CreateDraft } from './createDraft';

const base: CreateDraft = {
    v: 1,
    kind: 'event',
    role: 'tip',
    title: '',
    time: '',
    category: 'other',
    place: '',
    price: '',
    description: '',
    url: '',
    host: '',
    repeats: false,
    repeatInterval: 1,
    repeatTimes: null,
    showMoreDetails: false,
};

describe('parseCreateDraft', () => {
    it('läser tillbaka ett sparat utkast oförändrat', () => {
        const d: CreateDraft = { ...base, kind: 'wish', role: 'host', title: 'Loppis', time: '2026-10-10T18:00', category: 'music' as CreateDraft['category'], repeats: true, repeatInterval: 'daily', repeatTimes: 3, showMoreDetails: true };
        expect(parseCreateDraft(JSON.stringify(d))).toEqual(d);
    });

    it('avvisar trasig eller främmande data', () => {
        expect(parseCreateDraft('inte json')).toBeNull();
        expect(parseCreateDraft('null')).toBeNull();
        expect(parseCreateDraft(JSON.stringify({ ...base, v: 2 }))).toBeNull();
    });

    it('faller tillbaka på förval för fält med fel typ', () => {
        const d = parseCreateDraft(JSON.stringify({ v: 1, kind: 'x', role: 7, title: 5, repeatInterval: 3, repeatTimes: -2 }));
        expect(d).toEqual(base);
    });
});

describe('draftHasContent', () => {
    it('är falskt för bara flik/tid — tiden förifylls ju automatiskt', () => {
        expect(draftHasContent({ ...base, kind: 'wish', time: '2026-10-10T18:00' })).toBe(false);
        expect(draftHasContent({ ...base, title: '   ' })).toBe(false);
    });

    it('är sant så fort något fält har text', () => {
        expect(draftHasContent({ ...base, title: 'Quiz' })).toBe(true);
        expect(draftHasContent({ ...base, url: 'https://example.se' })).toBe(true);
    });
});

describe('draftTimeStillValid', () => {
    const now = new Date('2026-10-08T12:00').getTime();
    it('behåller en kommande tid', () => {
        expect(draftTimeStillValid('2026-10-08T19:00', now)).toBe(true);
    });
    it('släpper en passerad, tom eller trasig tid', () => {
        expect(draftTimeStillValid('2026-10-07T19:00', now)).toBe(false);
        expect(draftTimeStillValid('', now)).toBe(false);
        expect(draftTimeStillValid('nonsens', now)).toBe(false);
    });
});
