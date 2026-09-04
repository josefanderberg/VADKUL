import { describe, it, expect } from 'vitest';
import { anchorScrollDelta, descriptionText, eventOutlink, hostFaviconUrl, isPlainClick, pickDescription, withRecoveredLineBreaks } from './eventExpand';

describe('withRecoveredLineBreaks', () => {
    it('lämnar text med riktiga radbrytningar orörd', () => {
        const t = 'Första stycket.\nAndra stycket.';
        expect(withRecoveredLineBreaks(t)).toBe(t);
    });
    it('bryter vid skiljetecken direkt följt av versal', () => {
        expect(withRecoveredLineBreaks('Hej.Nu börjar vi!Kom')).toBe('Hej.\nNu börjar vi!\nKom');
    });
    it('bryter vid siffra direkt följt av versal (klockslag)', () => {
        expect(withRecoveredLineBreaks('Start 11:30Klasserna')).toBe('Start 11:30\nKlasserna');
    });
    it('tom text är tom', () => {
        expect(withRecoveredLineBreaks('')).toBe('');
    });
});

describe('eventOutlink', () => {
    it('kortets url vinner över id:t (affiliate-redirecten för TM)', () => {
        expect(eventOutlink('https://www.ticketmaster.se/event/1', 'https://ticketmaster.evyy.net/c/x'))
            .toBe('https://ticketmaster.evyy.net/c/x');
    });
    it('faller tillbaka på id:t när url saknas — id ÄR url:en för skrapade event', () => {
        expect(eventOutlink('https://visitstockholm.com/event/abc', undefined)).toBe('https://visitstockholm.com/event/abc');
        expect(eventOutlink('https://visitstockholm.com/event/abc', null)).toBe('https://visitstockholm.com/event/abc');
    });
    it('ogiltig url hoppas över till förmån för id:t', () => {
        expect(eventOutlink('https://example.com/e', 'mailto:x@y.se')).toBe('https://example.com/e');
        expect(eventOutlink('https://example.com/e', 'inte en url')).toBe('https://example.com/e');
    });
    it('användarskapade id:n (inga url:er) ger null', () => {
        expect(eventOutlink('abc123DocId', undefined)).toBeNull();
        expect(eventOutlink('abc123DocId', '')).toBeNull();
    });
});

describe('pickDescription', () => {
    it('längsta texten vinner (API:ts hela före stadssidans kapade)', () => {
        expect(pickDescription('Kort…', 'Hela långa beskrivningen här')).toBe('Hela långa beskrivningen här');
        expect(pickDescription('Hela långa beskrivningen här', 'Kort…')).toBe('Hela långa beskrivningen här');
    });
    it('tomma/saknade kandidater ignoreras', () => {
        expect(pickDescription(undefined, null, '   ', 'x')).toBe('x');
        expect(pickDescription(undefined, null, '')).toBeNull();
    });
});

describe('descriptionText', () => {
    it('visar texten när den finns, med radbrytningar återställda', () => {
        expect(descriptionText('Hej.Du', true)).toBe('Hej.\nDu');
    });
    it('"hämtar" medan API-svaret väntas, annars "ingen beskrivning"', () => {
        expect(descriptionText(null, true)).toBe('Hämtar beskrivning…');
        expect(descriptionText(null, false)).toBe('Ingen beskrivning tillgänglig.');
    });
});

describe('isPlainClick', () => {
    it('vanligt vänsterklick är plain', () => {
        expect(isPlainClick({ button: 0 })).toBe(true);
        expect(isPlainClick({})).toBe(true);
    });
    it('modifierare (ny flik m.m.) släpps igenom till länken', () => {
        expect(isPlainClick({ button: 0, metaKey: true })).toBe(false);
        expect(isPlainClick({ button: 0, ctrlKey: true })).toBe(false);
        expect(isPlainClick({ button: 0, shiftKey: true })).toBe(false);
        expect(isPlainClick({ button: 0, altKey: true })).toBe(false);
    });
    it('andra musknappar är inte plain', () => {
        expect(isPlainClick({ button: 1 })).toBe(false);
        expect(isPlainClick({ button: 2 })).toBe(false);
    });
});

describe('anchorScrollDelta', () => {
    it('raden man klickade på hålls kvar på samma plats när panelen ovanför fälls ihop', () => {
        // B stod 500 px ner; A:s 2000 px-panel ovanför försvann → B står nu på -1500.
        expect(anchorScrollDelta(500, -1500, false)).toBe(-2000);
    });
    it('inget ovanför ändrades → ingen scroll', () => {
        expect(anchorScrollDelta(400, 400, false)).toBe(0);
        expect(anchorScrollDelta(400, 400.4, false)).toBe(0);
    });
    it('att stänga en rad man scrollat djupt ner i lyfter fram den under naven', () => {
        // Radens topp låg 1500 px ovanför fönstret både före och efter — scrolla
        // upp så den landar på 120 px.
        expect(anchorScrollDelta(-1500, -1500, true)).toBe(-1620);
    });
    it('att stänga en rad som syns håller den kvar där den är', () => {
        expect(anchorScrollDelta(300, 300, true)).toBe(0);
    });
    it('headerPx går att styra', () => {
        expect(anchorScrollDelta(-100, -100, true, 80)).toBe(-180);
    });
});

describe('hostFaviconUrl', () => {
    it('bygger DuckDuckGo-ikonen ur domänen', () => {
        expect(hostFaviconUrl('https://www.modernamuseet.se/sv/stockholm/program/x/')).toBe('https://icons.duckduckgo.com/ip3/www.modernamuseet.se.ico');
    });
    it('null för icke-url:er och tomt', () => {
        expect(hostFaviconUrl('abc123DocId')).toBeNull();
        expect(hostFaviconUrl('')).toBeNull();
        expect(hostFaviconUrl(undefined)).toBeNull();
    });
});
