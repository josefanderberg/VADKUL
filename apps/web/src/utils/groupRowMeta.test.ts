import { describe, it, expect } from 'vitest';
import { groupRowMeta } from './groupRowMeta';

describe('groupRowMeta', () => {
    it('arrangören står efter tiden, priset normaliseras', () => {
        expect(groupRowMeta({ hostName: 'Falkenberg Kommun', price: '420 SEK' }, 'Musik'))
            .toEqual({ who: 'Falkenberg Kommun', price: '420 kr' });
    });

    it('utan pris visas inget prischip', () => {
        expect(groupRowMeta({ hostName: 'Debaser', price: '' }, 'Musik').price).toBeNull();
        expect(groupRowMeta({ hostName: 'Debaser' }, 'Musik').price).toBeNull();
    });

    it('gratis-varianter blir "Gratis"', () => {
        expect(groupRowMeta({ hostName: 'Stadsbiblioteket', price: 'Fri entré' }, 'Kultur').price).toBe('Gratis');
        expect(groupRowMeta({ hostName: 'Stadsbiblioteket', price: 0 }, 'Kultur').price).toBe('Gratis');
    });

    it('innan kortlagret landat (tom värd) står kategorin', () => {
        expect(groupRowMeta({ hostName: '' }, 'Musik').who).toBe('Musik');
        expect(groupRowMeta({ hostName: '   ' }, 'Musik').who).toBe('Musik');
        expect(groupRowMeta({}, 'Övrigt').who).toBe('Övrigt');
    });

    it('städar blanksteg i värdnamnet', () => {
        expect(groupRowMeta({ hostName: '  Borås   & Co ' }, 'Musik').who).toBe('Borås & Co');
    });
});
