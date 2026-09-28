import { describe, it, expect } from 'vitest';
import { groupDayDuplicates, groupListDuplicates, dupKey } from './groupDups';

const ev = (title: string, coverImage?: string) => ({ title, coverImage });

describe('dupKey', () => {
    it('normaliserar som cityDatas normTitle', () => {
        expect(dupKey('Sagostund!')).toBe(dupKey('sagostund'));
        expect(dupKey('  Barnens   gosedjursval ')).toBe('barnens gosedjursval');
        // Längre titel är ett ANNAT event — ingen fuzzy-matchning.
        expect(dupKey('Sagostund på Sigtuna bibliotek')).not.toBe(dupKey('Sagostund'));
    });
});

describe('groupDayDuplicates', () => {
    it('slår ihop samma titel och bevarar ordningen inom gruppen', () => {
        const a1 = ev('Sagostund'), a2 = ev('sagostund!'), b = ev('Bokfika'), a3 = ev('Sagostund');
        const groups = groupDayDuplicates([a1, a2, b, a3]);
        expect(groups).toHaveLength(2);
        expect(groups[0].rep).toBe(a1);
        expect(groups[0].dups).toEqual([a2, a3]);
        expect(groups[1]).toEqual({ rep: b, dups: [] });
    });

    it('grupperna kommer i första förekomstens ordning', () => {
        const groups = groupDayDuplicates([ev('B'), ev('A'), ev('B')]);
        expect(groups.map(g => g.rep.title)).toEqual(['B', 'A']);
    });

    it('representanten är första eventet MED bild', () => {
        const utan = ev('Sagostund'), med = ev('Sagostund', 'https://a.se/b.jpg'), utan2 = ev('Sagostund');
        const groups = groupDayDuplicates([utan, med, utan2]);
        expect(groups[0].rep).toBe(med);
        // Övriga behåller tidsordningen sinsemellan.
        expect(groups[0].dups).toEqual([utan, utan2]);
    });

    it('helt bildlös grupp tar första eventet', () => {
        const first = ev('Stickcafé');
        expect(groupDayDuplicates([first, ev('Stickcafé')])[0].rep).toBe(first);
    });

    it('tom lista ger tom gruppning', () => {
        expect(groupDayDuplicates([])).toEqual([]);
    });

    it('samma bild med olika titel grupperas (Förtidsröstning-fallet)', () => {
        const img = 'https://storage.googleapis.com/x/shared/abc.jpg';
        const stan = ev('Förtidsröstning i stan', img);
        const tenhult = ev('Förtidsröstning Tenhult', img);
        const annan = ev('Konsert', 'https://storage.googleapis.com/x/shared/def.jpg');
        const groups = groupDayDuplicates([stan, tenhult, annan]);
        expect(groups).toHaveLength(2);
        expect(groups[0].rep).toBe(stan);
        expect(groups[0].dups).toEqual([tenhult]);
    });

    it('bilden kedjar ihop titelgrupper (union, inte parvis)', () => {
        const img = 'https://a.se/kampanj.jpg';
        const a1 = ev('Röstning City'), a2 = ev('Röstning City', img), b = ev('Röstning Öster', img);
        const groups = groupDayDuplicates([a1, a2, b]);
        expect(groups).toHaveLength(1);
        expect(groups[0].rep).toBe(a2); // första MED bild
        expect(groups[0].dups).toEqual([a1, b]);
    });

    it('bildlösa event grupperas aldrig på bild', () => {
        const groups = groupDayDuplicates([ev('A'), ev('B')]);
        expect(groups).toHaveLength(2);
    });

    // TREDJE regeln: samma plats + samma starttid + titelinneslutning
    // ("När bok blir bio"-paret 28/9: två källor, olika titellängd, olika
    // bild-URL:er).
    describe('plats + starttid + titelinneslutning', () => {
        const pt = (title: string, locationName: string, time: string) => ({ title, locationName, time });

        it('samma plats och tid, ena titeln ingår i den andra → EN rad', () => {
            const kort = pt('När bok blir bio', 'Rydaholms bibliotek', '2026-09-30T18:00:00');
            const lang = pt('Föreläsning: När bok blir bio - några nedslag i filmhistorien', 'Rydaholms bibliotek', '2026-09-30T18:00:00');
            const groups = groupDayDuplicates([lang, kort]);
            expect(groups).toHaveLength(1);
            expect(groups[0].dups).toHaveLength(1);
        });

        it('olika platser grupperas inte (Julmarknad ≠ Julmarknad i Tenhult på annan ort)', () => {
            const a = pt('Julmarknad', 'Hembygdsparken', '2026-12-05T11:00:00');
            const b = pt('Julmarknad i Tenhult', 'Tenhults station', '2026-12-05T11:00:00');
            expect(groupDayDuplicates([a, b])).toHaveLength(2);
        });

        it('olika starttider grupperas inte (två program i samma hus)', () => {
            const a = pt('Yoga', 'Folkets hus', '2026-09-30T10:00:00');
            const b = pt('Yoga för seniorer', 'Folkets hus', '2026-09-30T14:00:00');
            expect(groupDayDuplicates([a, b])).toHaveLength(2);
        });

        it('orelaterade titlar på samma plats och tid grupperas inte', () => {
            const a = pt('Schackklubben', 'Biblioteket', '2026-09-30T18:00:00');
            const b = pt('Bokcirkel', 'Biblioteket', '2026-09-30T18:00:00');
            expect(groupDayDuplicates([a, b])).toHaveLength(2);
        });

        it('för kort inneslutning räknas inte ("Bio" i "Utomhusbio")', () => {
            const a = pt('Bio', 'Parken', '2026-09-30T21:00:00');
            const b = pt('Utomhusbio med filmquiz', 'Parken', '2026-09-30T21:00:00');
            expect(groupDayDuplicates([a, b])).toHaveLength(2);
        });

        it('inneslutningen gäller hela ord, inte delsträngar', () => {
            // "loppis i parken" är ingen ordsekvens i "sommarloppis i parkens hörn".
            const a = pt('Loppis i parken', 'Parken', '2026-09-30T10:00:00');
            const b = pt('Sommarloppis i parkens hörn', 'Parken', '2026-09-30T10:00:00');
            expect(groupDayDuplicates([a, b])).toHaveLength(2);
        });

        it('utan plats eller tid gäller bara titel/bild som förut', () => {
            const a = { title: 'När bok blir bio' };
            const b = { title: 'Föreläsning: När bok blir bio - några nedslag i filmhistorien' };
            expect(groupDayDuplicates([a, b])).toHaveLength(2);
        });
    });
});

describe('groupListDuplicates', () => {
    const at = (title: string, time: string, coverImage?: string) => ({ title, time, coverImage });

    it('grupperar bara inom samma dag', () => {
        const idag = at('Sagostund', '2026-09-02T10:00:00'), imorgon = at('Sagostund', '2026-09-03T10:00:00');
        expect(groupListDuplicates([idag, imorgon])).toHaveLength(2);
    });

    it('gruppen tar första medlemmens plats i en blandad lista', () => {
        const a = at('Sagostund', '2026-09-02T10:00:00');
        const b = at('Konsert', '2026-09-02T19:00:00');
        const a2 = at('Sagostund', '2026-09-02T13:00:00');
        const groups = groupListDuplicates([a, b, a2]);
        expect(groups.map(g => g.rep.title)).toEqual(['Sagostund', 'Konsert']);
        expect(groups[0].dups).toEqual([a2]);
    });

    it('samma bild samma dag grupperas trots olika titel', () => {
        const img = 'https://a.se/kampanj.jpg';
        const groups = groupListDuplicates([
            at('Förtidsröstning i stan', '2026-09-02T09:00:00', img),
            at('Förtidsröstning Tenhult', '2026-09-02T13:00:00', img),
        ]);
        expect(groups).toHaveLength(1);
        expect(groups[0].dups).toHaveLength(1);
    });
});
