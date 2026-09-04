import { describe, it, expect } from 'vitest';
import { mapProActivity, parseProDate, kommunFromUrl, dedupeSeries, foreningsNamn, kommunNameFromSlug } from './pro';

const FORENING_URL = 'https://pro.se/distrikt/skaraborg/kommun/falkoping/pro-falkoping/vara-aktiviteter';

/** Verklig form från activities-endpointen 2026-06-11. */
const baseActivity = {
    name: 'Boule',
    location: null,
    id: '214945',
    uri: '/distrikt/skaraborg/kommun/falkoping/pro-falkoping/vara-aktiviteter/aktivitet?id=214945',
    startDate: { time: '10:00', month: 'Juni', value: '2026-06-11', day: '11', weekDay: 'Torsdag' },
    endDate: { time: '12:00', month: 'Juni', value: '2026-06-11', day: '11', weekDay: 'Torsdag' },
};

describe('parseProDate', () => {
    it('bygger lokal Date av value + time', () => {
        const d = parseProDate({ value: '2026-06-11', time: '10:00' })!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(5);
        expect(d.getDate()).toBe(11);
        expect(d.getHours()).toBe(10);
    });

    it('saknad time blir midnatt, saknat value blir null', () => {
        expect(parseProDate({ value: '2026-07-01' })!.getHours()).toBe(0);
        expect(parseProDate({})).toBeNull();
        expect(parseProDate(undefined)).toBeNull();
    });
});

describe('foreningsNamn', () => {
    it('plockar riktiga namnet (med åäö) ur breadcrumben', () => {
        const html = '<li><a href="/distrikt/skaraborg/kommun/falkoping/pro-falkoping" class="env-link-secondary">PRO Falköping</a></li>';
        expect(foreningsNamn(html, FORENING_URL)).toBe('PRO Falköping');
    });

    it('faller tillbaka på "PRO" när breadcrumben saknas', () => {
        expect(foreningsNamn('<html></html>', FORENING_URL)).toBe('PRO');
    });
});

describe('kommunNameFromSlug', () => {
    it('ger riktigt kommunnamn med åäö ur ascii-sluggen', () => {
        expect(kommunNameFromSlug('eksjo')).toBe('Eksjö');
        expect(kommunNameFromSlug('falkoping')).toBe('Falköping');
        expect(kommunNameFromSlug('vasteras')).toBe('Västerås');
    });
    it('okänd slug → stor bokstav per ord', () => {
        expect(kommunNameFromSlug('nagonstans okand')).toBe('Nagonstans Okand');
        expect(kommunNameFromSlug('')).toBe('');
    });
});

describe('kommunFromUrl', () => {
    it('plockar kommun-slug ur föreningsvägen', () => {
        expect(kommunFromUrl(FORENING_URL)).toBe('falkoping');
        expect(kommunFromUrl('https://pro.se/distrikt/x/kommun/ostra-goinge/pro-y/vara-aktiviteter')).toBe('ostra goinge');
        expect(kommunFromUrl('https://pro.se/nagot-annat')).toBe('');
    });
});

describe('mapProActivity', () => {
    it('mappar en aktivitet med tid, värd och geocoding-kedja', () => {
        const e = mapProActivity(baseActivity, FORENING_URL, 'PRO Falköping')!;
        expect(e.title).toBe('Boule');
        expect(e.url).toBe('https://pro.se/distrikt/skaraborg/kommun/falkoping/pro-falkoping/vara-aktiviteter/aktivitet?id=214945');
        expect(e.externalId).toBe('214945');
        expect(e.startDate.getHours()).toBe(10);
        expect(e.endDate?.getHours()).toBe(12);
        expect(e.hasSpecificTime).toBe(true);
        expect(e.hostName).toBe('PRO Falköping');
        expect(e.venueName).toBe('PRO Falköping');          // location null → värden
        expect(e.geocodeCandidates).toEqual(['Falköping']); // kommun-fallback (kapitaliserad sedan 24/8)
        expect(e.city).toBe('Falköping');
    });

    it('location.name används som venue och första geocode-kandidat', () => {
        const e = mapProActivity({ ...baseActivity, location: { name: 'Folkets Hus' } }, FORENING_URL, 'PRO Falköping')!;
        expect(e.venueName).toBe('Folkets Hus');
        expect(e.geocodeCandidates).toEqual(['Folkets Hus, Falköping', 'Falköping']);
    });

    it('administrativa möten och samorganisationer filtreras', () => {
        expect(mapProActivity({ ...baseActivity, name: 'Hudiksvall Samorg - Styrelsemöte' }, FORENING_URL, 'PRO Falköping')).toBeNull();
        expect(mapProActivity({ ...baseActivity, name: 'Årsmöte 2026' }, FORENING_URL, 'PRO Falköping')).toBeNull();
        expect(mapProActivity(baseActivity, FORENING_URL, 'Samorganisation Hudiksvall')).toBeNull();
        expect(mapProActivity({ ...baseActivity, name: 'Sommarfest' }, FORENING_URL, 'PRO Falköping')).not.toBeNull();
    });

    it('aktivitet utan namn, uri eller datum hoppas över', () => {
        expect(mapProActivity({ ...baseActivity, name: ' ' }, FORENING_URL, 'PRO X')).toBeNull();
        expect(mapProActivity({ ...baseActivity, uri: undefined }, FORENING_URL, 'PRO X')).toBeNull();
        expect(mapProActivity({ ...baseActivity, startDate: {} }, FORENING_URL, 'PRO X')).toBeNull();
    });
});

describe('dedupeSeries', () => {
    it('behåller första kommande tillfället per förening+namn', () => {
        const mk = (title: string, day: number, host = 'PRO Falköping') =>
            mapProActivity(
                { ...baseActivity, name: title, id: `${day}`, uri: `/x?id=${day}`, startDate: { value: `2026-06-${String(day).padStart(2, '0')}`, time: '10:00' } },
                FORENING_URL, host,
            )!;
        const out = dedupeSeries([mk('Boule', 18), mk('Boule', 11), mk('Boule', 25), mk('Sommarfest', 13)]);
        expect(out).toHaveLength(2);
        expect(out.find((e) => e.title === 'Boule')!.startDate.getDate()).toBe(11);
    });

    it('samma aktivitetsnamn hos OLIKA föreningar dedupas inte', () => {
        const a = mapProActivity(baseActivity, FORENING_URL, 'PRO Falköping')!;
        const b = mapProActivity(baseActivity, FORENING_URL, 'PRO Skövde')!;
        expect(dedupeSeries([a, b])).toHaveLength(2);
    });
});
