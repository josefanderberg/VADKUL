import { describe, it, expect } from 'vitest';
import { defaultSpecialCategories, specialDefaultsKey, SPECIAL_DEFAULT_KEYS, FAMILY_KEY } from './categoryDefaults';
import { SPECIAL_CATEGORY_KEYS } from './categories';

describe('nycklarna hänger ihop med SPECIAL_CATEGORIES', () => {
    // Utan den här kopplingen skulle ett omdöpt id i categories.ts göra
    // defaulten till en tyst nullitet: filtret slår bara på nycklar som
    // classifySource känner igen, så en felstavad nyckel visar ingenting.
    it('varje förvald nyckel finns som opt-in-källa', () => {
        for (const key of SPECIAL_DEFAULT_KEYS) {
            expect(SPECIAL_CATEGORY_KEYS.has(key)).toBe(true);
        }
    });

    it('ALLA opt-in-källor omfattas av 65+-defaulten — tillkommer en ny måste den tas ställning till', () => {
        expect([...SPECIAL_DEFAULT_KEYS].sort()).toEqual([...SPECIAL_CATEGORY_KEYS].sort());
    });
});

describe('defaultSpecialCategories', () => {
    it('utloggad besökare får INGA KÄLLOR förvalda (Josef 31/8) — men 🧸 är förvald sedan 1/9', () => {
        expect(defaultSpecialCategories({ loggedIn: false })).toEqual(['family']);
    });

    it('utloggad påverkas inte av en ålder som råkar följa med — 65+ gäller bara inloggade', () => {
        expect(defaultSpecialCategories({ loggedIn: false, age: 70 })).toEqual(['family']);
    });

    it('inloggad 65+ får båda källorna', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: 65 }).sort())
            .toEqual(['pro', 'svenskakyrkan']);
        expect(defaultSpecialCategories({ loggedIn: true, age: 82 }).sort())
            .toEqual(['pro', 'svenskakyrkan']);
    });

    it('inloggad under 65 får INGA — källorna förblir opt-in', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: 64 })).toEqual([]);
        expect(defaultSpecialCategories({ loggedIn: true, age: 18 })).toEqual([]);
    });

    it('inloggad utan ålder får inga KÄLLOR (gamla konton utan age-fält) — 🧸 kvar', () => {
        expect(defaultSpecialCategories({ loggedIn: true })).toEqual(['family']);
        expect(defaultSpecialCategories({ loggedIn: true, age: undefined })).toEqual(['family']);
        expect(defaultSpecialCategories({ loggedIn: true, age: null })).toEqual(['family']);
    });

    it('skräpvärden i age fäller inget — behandlas som saknad ålder', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: '70' })).toEqual(['family']);
        expect(defaultSpecialCategories({ loggedIn: true, age: NaN })).toEqual(['family']);
        expect(defaultSpecialCategories({ loggedIn: true, age: Infinity })).toEqual(['family']);
    });

    // ── 🧸 FAMILJ & BARN (Josef 1/9) ────────────────────────────────────────
    // Förvald för alla UTOM den 19/8-regeln pekar ut: inloggad vuxen (18+)
    // utan barn i profilen. Det är den enda gruppen som slipper familjeeventen.
    it('inloggad VUXEN UTAN BARN får INTE 🧸 förvald (19/8-regeln lever)', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: 30 })).toEqual([]);
        expect(defaultSpecialCategories({ loggedIn: true, age: 30, hasChildren: false })).toEqual([]);
        // ... och den gäller även 65+, som annars får båda källorna:
        expect(defaultSpecialCategories({ loggedIn: true, age: 70 }).sort())
            .toEqual(['pro', 'svenskakyrkan']);
    });

    it('förälder får 🧸 förvald oavsett ålder', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: 30, hasChildren: true })).toEqual(['family']);
        expect(defaultSpecialCategories({ loggedIn: true, age: 70, hasChildren: true }).sort())
            .toEqual(['family', 'pro', 'svenskakyrkan']);
    });

    it('under 18 får 🧸 förvald — ungdomsevent klassas ofta som family', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: 15 })).toEqual(['family']);
    });

    it('🧸 ligger i OPT-IN-hinken, aldrig i normal-valet — annars gömmer den allt annat', () => {
        // page.tsx räknar bort opt-in-nycklar ur selectedNormal. Skulle 'family'
        // räknas som en normal kategori vore ett ikryssat 🧸 = "bara familj",
        // vilket var precis fällan den borttagna 19/8-defaulten gick i.
        expect(defaultSpecialCategories({ loggedIn: false })).toContain(FAMILY_KEY);
        expect(SPECIAL_CATEGORY_KEYS.has(FAMILY_KEY)).toBe(false);
    });

    it('returnerar en NY array varje gång — anroparen sorterar/muterar fritt', () => {
        const a = defaultSpecialCategories({ loggedIn: true, age: 70 });
        a.sort().push('music');
        expect(defaultSpecialCategories({ loggedIn: true, age: 70 }).sort())
            .toEqual(['pro', 'svenskakyrkan']);
        expect([...SPECIAL_DEFAULT_KEYS].sort()).toEqual(['pro', 'svenskakyrkan']);
    });
});

describe('specialDefaultsKey', () => {
    it('ger samma sorterade nyckelformat som mapCategories-jämförelsen', () => {
        expect(specialDefaultsKey({ loggedIn: false })).toBe('family');
        expect(specialDefaultsKey({ loggedIn: true, age: 70 })).toBe('pro,svenskakyrkan');
        expect(specialDefaultsKey({ loggedIn: true, age: 40 })).toBe('');
        expect(specialDefaultsKey({ loggedIn: true, age: 40, hasChildren: true })).toBe('family');
    });

    it('matchar nyckeln som byggs ur ett Set på samma sätt som page.tsx', () => {
        const set = new Set(defaultSpecialCategories({ loggedIn: true, age: 70 }));
        expect([...set].sort().join(',')).toBe(specialDefaultsKey({ loggedIn: true, age: 70 }));
    });
});
