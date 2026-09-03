import { describe, it, expect } from 'vitest';
import { normalizeTitle, normalizeDescription, normalizeLocation, normalizeRawEvent, sanitizePriceField } from './normalizeEvent';

describe('normalizeTitle', () => {
    it('avkodar entiteter och kollapsar whitespace', () => {
        expect(normalizeTitle('Olof Holmgren &#038; Anna   Lindmark')).toBe('Olof Holmgren & Anna Lindmark');
        expect(normalizeTitle('&quot;Det politiska läget&quot; P-M Nilsson')).toBe('"Det politiska läget" P-M Nilsson');
    });
    it('strippar arrangörens datumprefix (Tickster-vanan)', () => {
        expect(normalizeTitle('11/9 SHREK RAVE')).toBe('SHREK RAVE');
        expect(normalizeTitle('3/10 - Konsert')).toBe('Konsert');
    });
    it('strippar " | VENUE"-suffix bara när suffixet är venue/stad/värd', () => {
        expect(normalizeTitle('SHREK RAVE | DEBASER KLUBBEN', { venueName: 'Debaser' })).toBe('SHREK RAVE');
        expect(normalizeTitle('Atomic Swing x Popsicle | Lund', { city: 'Lund' })).toBe('Atomic Swing x Popsicle');
        // Okänt suffix lämnas — kan vara del av titeln
        expect(normalizeTitle('Babybokprat | 0–10 månader', { city: 'Malmö' })).toBe('Babybokprat | 0–10 månader');
    });
    it('rör inte vanliga titlar', () => {
        expect(normalizeTitle('Söndagsateljé: Skapa med Mika Liffner')).toBe('Söndagsateljé: Skapa med Mika Liffner');
        expect(normalizeTitle('2:an från Grupp 2 - 2:an från Grupp 1')).toBe('2:an från Grupp 2 - 2:an från Grupp 1');
    });
});

describe('normalizeDescription', () => {
    it('tömmer Facebook-sidfoten', () => {
        expect(normalizeDescription('Integritet\n \n · Användarvillkor\n \n · Annonsering')).toBe('');
    });
    it('strippar taggar och avkodar', () => {
        expect(normalizeDescription('<p>Konsert &amp; dans</p><p>Fri entré</p>')).toBe('Konsert & dans\nFri entré');
    });
    it('behåller långa beskrivningar (ingen 500-trunkering)', () => {
        expect(normalizeDescription('x'.repeat(3000)).length).toBe(3000);
    });
});

describe('normalizeLocation', () => {
    it('första raden = venue, resten → address', () => {
        const r = normalizeLocation('Jokkmokks IP (idrottplatsen)\n\t\t\tAvfart från väg 97 vid Kyrkogatan 4\n\t\t\t96231 Jokkmokk', undefined);
        expect(r.venueName).toBe('Jokkmokks IP (idrottplatsen)');
        expect(r.address).toBe('Avfart från väg 97 vid Kyrkogatan 4, 96231 Jokkmokk');
    });
    it('filtrerar telefon/mejl ur adressresten och rör inte befintlig address', () => {
        const r = normalizeLocation('Nybyvägen 2\n070-679 10 80\ninfo@x.se', 'Befintlig 1');
        expect(r.venueName).toBe('Nybyvägen 2');
        expect(r.address).toBe('Befintlig 1');
    });
    it('kapar överlånga namn vid kommatecken', () => {
        const long = 'Lokalen, ' + 'Gatan '.repeat(40);
        expect(normalizeLocation(long, undefined).venueName!.length).toBeLessThanOrEqual(120);
    });
});

describe('sanitizePriceField', () => {
    it('behåller riktiga priser och gratis-ord', () => {
        expect(sanitizePriceField('150 kr')).toBe('150 kr');
        expect(sanitizePriceField('Fri entré')).toBe('Fri entré');
        expect(sanitizePriceField('Det kostar inget att delta')).toBe('Det kostar inget att delta');
        expect(sanitizePriceField('Kollekt')).toBe('Kollekt');
        expect(sanitizePriceField('60:- för vuxna och 30:- för barn.')).toBe('60:- för vuxna och 30:- för barn.');
    });
    it('tömmer skräp utan siffra och utan gratis-ord', () => {
        for (const junk of ['P', 'ordi', 'Avgift', 'kronor', 'Deltagaravgift', 'Halva priset!', 'Var och en betalar för sig']) {
            expect(sanitizePriceField(junk)).toBeUndefined();
        }
        expect(sanitizePriceField('')).toBeUndefined();
        expect(sanitizePriceField(null)).toBeUndefined();
    });
    it('lång pristext → intervall, annars ordgräns-klipp', () => {
        expect(sanitizePriceField('Pris: 100 kr, Ungdom 12-18 år: 80 kr, barn upp till 11 år: 60 kr. Biljetter via bio.se/frolundabion eller biljettkassan: 031-3662725.'))
            .toBe('60–100 kr');
        const long = sanitizePriceField('Fri entré för alla som bor i kommunen och deras vänner och bekanta som vill komma med')!;
        expect(long.length).toBeLessThanOrEqual(60);
    });
});

describe('normalizeRawEvent', () => {
    it('sanerar källans prisfält och faller tillbaka på texten när det var skräp', () => {
        const e: any = { title: 'Dans', startDate: new Date(), url: 'u', description: 'Entré 80 kr.', price: 'P' };
        normalizeRawEvent(e);
        expect(e.price).toBe('80 kr');
    });
    it('plockar pris ur beskrivningen när källan inte gav något — men skriver aldrig över källans', () => {
        const a: any = { title: 'Dans', startDate: new Date(), url: 'u', description: 'Kom och dansa. Pris: 80 kr per person.' };
        normalizeRawEvent(a);
        expect(a.price).toBe('80 kr');
        const b: any = { title: 'Dans', startDate: new Date(), url: 'u', description: 'Pris: 80 kr', price: '100 kr' };
        normalizeRawEvent(b);
        expect(b.price).toBe('100 kr');
        const c: any = { title: 'Dans', startDate: new Date(), url: 'u', description: 'Vi samlade in 500 kr.' };
        normalizeRawEvent(c);
        expect(c.price).toBeUndefined();
    });
    it('kör allt och behåller övriga fält', () => {
        const e: any = { title: 'A &amp; B | Lund', startDate: new Date(), url: 'u', city: 'Lund', description: '<b>x</b>', venueName: 'V\nadr 1' };
        normalizeRawEvent(e, 'Host');
        expect(e.title).toBe('A & B');
        expect(e.description).toBe('x');
        expect(e.venueName).toBe('V');
        expect(e.address).toBe('adr 1');
        expect(e.url).toBe('u');
    });
});
