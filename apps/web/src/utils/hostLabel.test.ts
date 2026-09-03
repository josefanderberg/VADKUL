import { describe, it, expect } from 'vitest';
import { hostLabelFor } from './hostLabel';

describe('hostLabelFor', () => {
    it('värdnamn vinner', () => {
        expect(hostLabelFor('Uppsala pastorat', 'https://www.svenskakyrkan.se/kalender?event=1')).toBe('Uppsala pastorat');
    });
    it('tom värd → källans domän utan www', () => {
        expect(hostLabelFor('', 'https://www.svenskakyrkan.se/kalender?event=1')).toBe('svenskakyrkan.se');
        expect(hostLabelFor(undefined, 'https://bibliotek.haninge.se/evenemang#abc')).toBe('bibliotek.haninge.se');
        expect(hostLabelFor('  ', 'https://www.facebook.com/events/123/')).toBe('Facebook');
    });
    it('"Okänd" bara utan länk', () => {
        expect(hostLabelFor('', '')).toBe('Okänd');
        expect(hostLabelFor('', 'inte en url')).toBe('Okänd');
    });
});
