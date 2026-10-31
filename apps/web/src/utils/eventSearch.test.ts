import { describe, expect, it } from 'vitest';
import { EVENT_CATEGORIES, type EventCategoryType } from './categories';
import { CATEGORY_SEARCH_WORDS } from './eventSearch';

// Söket bor i @vadkul/kontrakt (testerna där). Kategoriernas sökord är en
// fast lista i kontraktet, medan etiketterna är webbens presentation - byts
// en etikett ("Sport & träning") ska sökorden följa med.
describe('CATEGORY_SEARCH_WORDS', () => {
    it('är orden i webbens kategorietiketter (utom Övrigt)', () => {
        const fromLabels = Object.fromEntries(
            (Object.keys(EVENT_CATEGORIES) as EventCategoryType[])
                .filter(key => key !== 'other')
                .map(key => [key, EVENT_CATEGORIES[key].label.toLowerCase().split(/[^a-zåäöéü]+/).filter(w => w.length >= 3)]),
        );
        expect(CATEGORY_SEARCH_WORDS).toEqual(fromLabels);
    });
});
