import { describe, expect, it } from 'vitest';
import {
    kommunStem, candidateUrls, isKommunCovered, uncoveredKommuner,
    customerIdFromUrl, isKnownCustomerId, formatTenantRow,
} from './axiellDiscovery';
import type { AxiellTenant } from '../scrapers/bibliotek';
import type { Kommun } from '../sources/data/kommuner';

const tenants: AxiellTenant[] = [
    { id: 'nykoping', customerId: '67bc4753296c3258c8eae737', eventsUrl: 'https://bibliotek.nykoping.se/evenemang', name: 'Nyköpings bibliotek', cityHint: 'Nyköping' },
    { id: 'uppsala', customerId: '5de8fb519cf47722f2bb9871', eventsUrl: 'https://bibliotekuppsala.se/evenemang', name: 'Bibliotek Uppsala', cityHint: 'Uppsala' },
    { id: 'gota', customerId: '62834578bbee2204026d7529', eventsUrl: 'https://www.gotabiblioteken.se/evenemang', name: 'Götabiblioteken', cities: ['Linköping', 'Motala'] },
];

const kommun = (name: string, domain: string): Kommun => ({ name, domain });

describe('kommunStem & candidateUrls', () => {
    it('bygger båda host-mönstren ur kommundomänen', () => {
        expect(candidateUrls(kommun('Eskilstuna', 'eskilstuna.se'))).toEqual([
            'https://bibliotek.eskilstuna.se/evenemang',
            'https://bibliotekeskilstuna.se/evenemang',
        ]);
        expect(kommunStem('strangnas.se')).toBe('strangnas');
    });
});

describe('isKommunCovered', () => {
    it('täcks via host-stammen', () => {
        expect(isKommunCovered(kommun('Nyköping', 'nykoping.se'), tenants)).toBe(true);
        expect(isKommunCovered(kommun('Uppsala', 'uppsala.se'), tenants)).toBe(true);
    });

    it('täcks via konsortiets stadslista', () => {
        expect(isKommunCovered(kommun('Motala', 'motala.se'), tenants)).toBe(true);
    });

    it('otäckt kommun hamnar i arbetslistan', () => {
        const alla = [kommun('Eskilstuna', 'eskilstuna.se'), kommun('Nyköping', 'nykoping.se')];
        expect(uncoveredKommuner(alla, tenants).map(k => k.name)).toEqual(['Eskilstuna']);
    });
});

describe('customerIdFromUrl', () => {
    it('plockar id ur ett riktigt API-anrop', () => {
        expect(customerIdFromUrl('https://api.axiell.com/event/api/customers/67bc4753296c3258c8eae737/search?queryString=*'))
            .toBe('67bc4753296c3258c8eae737');
    });

    it('nobbar andra adresser och trasiga id:n', () => {
        expect(customerIdFromUrl('https://api.axiell.com/event/api/customers/kort/search')).toBeNull();
        expect(customerIdFromUrl('https://example.com/customers/67bc4753296c3258c8eae737/search')).toBeNull();
    });
});

describe('isKnownCustomerId & formatTenantRow', () => {
    it('konsortie-dubbletter känns igen på customerId', () => {
        expect(isKnownCustomerId('62834578bbee2204026d7529', tenants)).toBe(true);
        expect(isKnownCustomerId('000000000000000000000000', tenants)).toBe(false);
    });

    it('raden är klistringsklar och följer listans format', () => {
        expect(formatTenantRow({ kommun: kommun('Eskilstuna', 'eskilstuna.se'), customerId: 'abcdefabcdefabcdefabcdef', eventsUrl: 'https://bibliotek.eskilstuna.se/evenemang/' }))
            .toBe("    { id: 'eskilstuna', customerId: 'abcdefabcdefabcdefabcdef', eventsUrl: 'https://bibliotek.eskilstuna.se/evenemang', name: 'Eskilstunas bibliotek', cityHint: 'Eskilstuna' },");
    });
});
