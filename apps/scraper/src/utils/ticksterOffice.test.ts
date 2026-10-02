import { describe, it, expect } from 'vitest';
import { cityFromOfficeQuery, venueQueries, TICKSTER_OFFICE } from './ticksterOffice';

describe('cityFromOfficeQuery', () => {
    it('orten ur den förgiftade frågan', () => {
        expect(cityFromOfficeQuery('Magasinsgatan 8, Växjö')).toBe('Växjö');
        expect(cityFromOfficeQuery('Magasinsgatan 8, Bagarmossen')).toBe('Bagarmossen');
        expect(cityFromOfficeQuery('Magasinsgatan 8, 411 18 Göteborg')).toBe('Göteborg');
    });
    it('andra frågor ger null', () => {
        expect(cityFromOfficeQuery('Växjö Teater, Växjö')).toBeNull();
        expect(cityFromOfficeQuery('källans egna koordinater')).toBeNull();
        expect(cityFromOfficeQuery(null)).toBeNull();
    });
});

describe('venueQueries', () => {
    it('venue + ort; orten läggs inte till två gånger', () => {
        expect(venueQueries('Agora', 'Linköping')).toEqual(['Agora, Linköping']);
        expect(venueQueries('Växjö Teater', 'Växjö')).toEqual(['Växjö Teater']);
    });
    it('salong → byggnaden först (runnerns ordning)', () => {
        expect(venueQueries('Saga - Bio 3:an', 'Piteå')).toEqual(['Bio 3:an, Piteå', 'Saga - Bio 3:an, Piteå']);
    });
    it('kontorsadress och ren ort ger inga kandidater', () => {
        expect(venueQueries('Växjö Teater, Magasinsgatan 8, Växjö', 'Växjö')).toEqual(['Växjö Teater']);
        expect(venueQueries('Växjö', 'Växjö')).toEqual([]);
        expect(venueQueries('', 'Växjö')).toEqual([]);
        expect(venueQueries(null, 'Växjö')).toEqual([]);
    });
    it('kontorsmönstret', () => {
        expect(TICKSTER_OFFICE.test('Magasinsgatan 8')).toBe(true);
        expect(TICKSTER_OFFICE.test('Magasinsgatan 18')).toBe(false);
    });
});
