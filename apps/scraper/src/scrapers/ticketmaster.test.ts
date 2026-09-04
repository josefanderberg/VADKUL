import { describe, it, expect } from 'vitest';
import { buildTmDescription, pickTmHost, isThinDescription, enrichmentPatch, categoryLine, TmEvent } from './ticketmaster';

// Nedskalade svar ur Discovery-API:t 2026-09-04 (DK/NO/SE).
const base = (over: Partial<TmEvent>): TmEvent => ({
    id: 'x', name: 'Megan Moroney', url: 'https://www.ticketmaster.no/event/megan-moroney-tickets/295799078',
    dates: { start: { localDate: '2026-09-13', localTime: '19:00:00' } },
    classifications: [{ segment: { name: 'Music' }, genre: { name: 'Country' } }],
    ...over,
});

describe('pickTmHost', () => {
    it('tar promoter-namnet', () => {
        expect(pickTmHost({ promoter: { id: '7', name: 'Auditorium AS (Rockefeller / John Dee / Sentrum Scene)' } }))
            .toBe('Auditorium AS (Rockefeller / John Dee / Sentrum Scene)');
    });
    it('faller på promoters[] och sist på TicketMaster', () => {
        expect(pickTmHost({ promoters: [{ name: '' }, { name: 'Det Ny Teater' }] })).toBe('Det Ny Teater');
        expect(pickTmHost({})).toBe('TicketMaster');
        expect(pickTmHost({ promoter: { name: '  ' } })).toBe('TicketMaster');
    });
});

describe('buildTmDescription', () => {
    it('arrangörens info-text vinner, HTML/whitespace städas', () => {
        const d = buildTmDescription(base({ info: 'SIMPLY THE BEST!  TINA -- The Tina Turner Musical<br>for første gang i Danmark!' }));
        expect(d).toBe('SIMPLY THE BEST! TINA -- The Tina Turner Musical\nfor første gang i Danmark!');
    });
    it('pleaseNote läggs till som eget stycke, dubblett av info hoppas över', () => {
        const d = buildTmDescription(base({ info: 'Dørene åbner kl. 18.', pleaseNote: 'Dørene åbner kl. 18.' }));
        expect(d).toBe('Dørene åbner kl. 18.');
        const d2 = buildTmDescription(base({ info: 'Konsert.', pleaseNote: '18 år.' }));
        expect(d2).toBe('Konsert.\n\n18 år.');
    });
    it('utan text: medverkande — men inte arenan/arrangören som TM lägger som attractions', () => {
        const d = buildTmDescription(base({
            promoter: { name: 'Auditorium AS' },
            _embedded: {
                venues: [{ name: 'Sentrum Scene' }],
                attractions: [{ name: 'Megan Moroney' }, { name: 'Sentrum Scene' }, { name: 'Auditorium AS' }, { name: 'Chandler Walters' }],
            },
        }));
        // Titeln själv räknas inte som "medverkande".
        expect(d).toBe('Medverkande: Chandler Walters');
    });
    it('arrangörens kortnamn och titeln i annan stavning räknas inte som medverkande', () => {
        // The Sheepdogs (NO): attractions = artisten + "Auditorium" (⊂ promoter)
        expect(buildTmDescription(base({
            name: 'The Sheepdogs',
            promoter: { name: 'Auditorium AS (Rockefeller / John Dee / Sentrum Scene)' },
            classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
            _embedded: { venues: [{ name: 'Sentrum Scene' }], attractions: [{ name: 'The Sheepdogs' }, { name: 'Auditorium' }] },
        }))).toBe('Musik · Rock');
        // HIT MED 80ERNE (DK): attraction "Hit med 80-erne" = titeln med annan interpunktion
        expect(buildTmDescription(base({
            name: 'HIT MED 80ERNE',
            _embedded: { attractions: [{ name: 'Hit med 80-erne' }] },
        }))).toBe('Musik · Country');
        // Comic Con: båda ryms i titeln men ingen ÄR titeln — båda är medverkande
        expect(buildTmDescription(base({
            name: 'Tom McKay | Comic Con Denmark - 8. november',
            _embedded: { attractions: [{ name: 'Tom McKay' }, { name: 'Comic Con Denmark' }] },
        }))).toBe('Medverkande: Tom McKay, Comic Con Denmark');
    });
    it('sista reserven är en svensk kategorirad, inte "Music Country"', () => {
        expect(buildTmDescription(base({}))).toBe('Musik · Country');
        expect(categoryLine({ classifications: [{ segment: { name: 'Arts & Theatre' }, genre: { name: 'Musical' } }] })).toBe('Scen & teater · Musical');
        expect(categoryLine({ classifications: [{ segment: { name: 'Music' }, genre: { name: 'Undefined' } }] })).toBe('Musik');
        expect(categoryLine({})).toBe('');
    });
});

describe('isThinDescription', () => {
    it('kategorihinten och tomt är tunt, riktig text är det inte', () => {
        expect(isThinDescription('Music Pop')).toBe(true);
        expect(isThinDescription('Arts & Theatre Theatre')).toBe(true);
        expect(isThinDescription('')).toBe(true);
        expect(isThinDescription(null)).toBe(true);
        expect(isThinDescription('Musik · Pop')).toBe(false);
        expect(isThinDescription('Music Pop är en konsertserie på Fållan.')).toBe(false);
    });
});

describe('enrichmentPatch — kända event byter bara tunna fält', () => {
    const rich = base({ info: 'Support act -- Chandler Walters.', promoter: { name: 'Live Nation Norway AS' } });

    it('rad från före 2026-09-04 får beskrivning + värd', () => {
        expect(enrichmentPatch({ description: 'Music Country', hostName: 'TicketMaster', price: '' }, rich))
            .toEqual({ description: 'Support act -- Chandler Walters.', hostName: 'Live Nation Norway AS' });
    });
    it('rör inte en rad som redan har riktigt innehåll', () => {
        expect(enrichmentPatch({ description: 'Egen text.', hostName: 'Rockefeller', price: '250 NOK' }, rich)).toBeNull();
    });
    it('tunn rad + tunt API-svar → den engelska hinten byts mot den svenska kategoriraden, och bara en gång', () => {
        expect(enrichmentPatch({ description: 'Music Country', hostName: 'TicketMaster', price: '' }, base({})))
            .toEqual({ description: 'Musik · Country' });
        // Nästa körning: raden bär redan kategoriraden → inget mer att skriva.
        expect(enrichmentPatch({ description: 'Musik · Country', hostName: 'TicketMaster', price: '' }, base({}))).toBeNull();
    });
    it('härledd beskrivning räknas om när härledningen ändrats — riktig text rörs aldrig', () => {
        const sheepdogs = base({
            name: 'The Sheepdogs',
            promoter: { name: 'Auditorium AS (Rockefeller / John Dee / Sentrum Scene)' },
            classifications: [{ segment: { name: 'Music' }, genre: { name: 'Rock' } }],
            _embedded: { venues: [{ name: 'Sentrum Scene' }], attractions: [{ name: 'The Sheepdogs' }, { name: 'Auditorium' }] },
        });
        // Första berikningen (2026-09-04) skrev "Medverkande: Auditorium" — filtret var för snällt.
        expect(enrichmentPatch({ description: 'Medverkande: Auditorium', hostName: 'Auditorium AS (Rockefeller / John Dee / Sentrum Scene)', price: '' }, sheepdogs))
            .toEqual({ description: 'Musik · Rock' });
        // Konvergerar: nästa körning ger samma härledning → inget skrivs.
        expect(enrichmentPatch({ description: 'Musik · Rock', hostName: 'Auditorium AS (Rockefeller / John Dee / Sentrum Scene)', price: '' }, sheepdogs)).toBeNull();
        // Arrangörens egen text får aldrig skrivas över av en härledning.
        expect(enrichmentPatch({ description: 'Kanadensisk rock på Sentrum Scene.', hostName: 'X', price: '' }, sheepdogs)).toBeNull();
    });
    it('pris fylls bara när API:t faktiskt har ett', () => {
        expect(enrichmentPatch({ description: 'Egen text.', hostName: 'Rockefeller', price: '' },
            base({ priceRanges: [{ min: 395, max: 695, currency: 'NOK' }] })))
            .toEqual({ price: '395–695 NOK' });
    });
});
