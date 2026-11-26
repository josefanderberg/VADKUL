import { describe, expect, it } from 'vitest';
import { searchEditOpensList } from './cardSearchView';

describe('searchEditOpensList (kortsöket, 26/11)', () => {
    it('första tecknet i ett tomt fält öppnar listan, som förut', () => {
        expect(searchEditOpensList('', 'j', 'info')).toBe(true);
        expect(searchEditOpensList('', 'j', 'chat')).toBe(true);
    });

    it('ny sökning medan ett valt event visas öppnar listan (termen låg kvar)', () => {
        // Valt ur träfflistan på "jazz" - kortet står i infovyn med termen kvar.
        expect(searchEditOpensList('jazz', 'jaz', 'info')).toBe(true);
        expect(searchEditOpensList('jazz', 'teater', 'info')).toBe(true);
    });

    it('står listan redan framme händer inget', () => {
        expect(searchEditOpensList('jazz', 'jazz g', 'nearby')).toBe(false);
        expect(searchEditOpensList('', 'j', 'nearby')).toBe(false);
    });

    it('ett tömt fält öppnar ingen lista', () => {
        expect(searchEditOpensList('jazz', '', 'info')).toBe(false);
        expect(searchEditOpensList('jazz', '   ', 'info')).toBe(false);
    });

    it('mellanslag i kanten är ingen ny sökning', () => {
        expect(searchEditOpensList('jazz', 'jazz ', 'info')).toBe(false);
        expect(searchEditOpensList('jazz', ' jazz', 'info')).toBe(false);
    });
});
