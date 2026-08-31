import { describe, it, expect } from 'vitest';
import { defaultSpecialCategories, specialDefaultsKey, SPECIAL_DEFAULT_KEYS } from './categoryDefaults';
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
    it('utloggad besökare får INGA källorna förvalda (Josef 31/8, river 20/8-beslutet)', () => {
        expect(defaultSpecialCategories({ loggedIn: false })).toEqual([]);
    });

    it('utloggad påverkas inte av en ålder som råkar följa med — 65+ gäller bara inloggade', () => {
        expect(defaultSpecialCategories({ loggedIn: false, age: 70 })).toEqual([]);
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

    it('inloggad utan ålder får inga (gamla konton utan age-fält)', () => {
        expect(defaultSpecialCategories({ loggedIn: true })).toEqual([]);
        expect(defaultSpecialCategories({ loggedIn: true, age: undefined })).toEqual([]);
        expect(defaultSpecialCategories({ loggedIn: true, age: null })).toEqual([]);
    });

    it('skräpvärden i age fäller inget — behandlas som saknad ålder', () => {
        expect(defaultSpecialCategories({ loggedIn: true, age: '70' })).toEqual([]);
        expect(defaultSpecialCategories({ loggedIn: true, age: NaN })).toEqual([]);
        expect(defaultSpecialCategories({ loggedIn: true, age: Infinity })).toEqual([]);
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
        expect(specialDefaultsKey({ loggedIn: false })).toBe('');
        expect(specialDefaultsKey({ loggedIn: true, age: 70 })).toBe('pro,svenskakyrkan');
        expect(specialDefaultsKey({ loggedIn: true, age: 40 })).toBe('');
    });

    it('matchar nyckeln som byggs ur ett Set på samma sätt som page.tsx', () => {
        const set = new Set(defaultSpecialCategories({ loggedIn: true, age: 70 }));
        expect([...set].sort().join(',')).toBe(specialDefaultsKey({ loggedIn: true, age: 70 }));
    });
});
