import { describe, it, expect } from 'vitest';
import { parseVastboEvents } from './vastbosportdans';

// Utdrag ur /kurser-evenemang 2026-09-28 (one.com-markup, attribut bantade).
const IMG = 'https://impro.usercontent.one/appid/oneComWsb/domain/vastbosportdansklubb.se/media/vastbosportdansklubb.se/onewebmedia/Dansband%20Socialdans';
const HTML = `
<h2><span>Evenemang 2026</span></h2>
<p><a href="/socialdans">Här hittar ni information om våra kommande evenemang</a></p>
<h3><span>lördag 9 maj</span></h3><h3><span>Dans till Sannex</span></h3>
<p>Socialdans i Bugg, FOX till live dansbandsmusik. <br>Plats: Torghuset Smålandsstenar<br></p>
<p>kl. 19:00-23:00</p><p><br></p>
<p><a href="https://dans.se/shop/?org=156&amp;new">Läs mer här &amp; anmäl dig</a></p>
<img src="${IMG}/Sannex_2024-annonsbild.jpg?resize=542%2B402">
<img src="${IMG}/Donnez24.jpg?etag=%22da536d%22&amp;resize=517%2B378">
<h3><span>fredag 20 nov</span></h3><h3><span>Dans till Donnez</span></h3>
<p>Socialdans i Bugg &amp; FOX till dansbandsmusik<br>Plats: Östbosalen Värnamo</p>
<p>kl. 19:00-23:00</p>
<h3><span>fredag 2 oktober</span></h3><h3><span>Dans till PHs</span></h3>
<p>Socialdans i Bugg, FOX till live dansbandsmusik. <br>Plats: Torghuset Smålandsstenar<br></p>
<p>kl. 19:00-23:00</p>
<img src="${IMG}/PHs-press_logga_1500x1000.png?etag=%22152ed9%22">
<p><span>Allmänna villkor</span></p><p><span>Betalning</span></p>
`;

describe('parseVastboEvents', () => {
    const now = new Date('2026-09-28T12:00:00');

    it('tar kommande kvällar och släpper passerade (veckodagen avgör året)', () => {
        const events = parseVastboEvents(HTML, now);
        expect(events.map(e => e.title).sort()).toEqual(['Dans till Donnez', 'Dans till PHs']);
    });

    it('läser tid, plats och url per datum', () => {
        const phs = parseVastboEvents(HTML, now).find(e => e.title === 'Dans till PHs')!;
        expect(phs.startDate.getFullYear()).toBe(2026);
        expect(phs.startDate.getMonth()).toBe(9);
        expect(phs.startDate.getDate()).toBe(2);
        expect(phs.startDate.getHours()).toBe(19);
        expect(phs.endDate!.getHours()).toBe(23);
        expect(phs.venueName).toBe('Torghuset');
        expect(phs.city).toBe('Smålandsstenar');
        expect(phs.url).toBe('https://vastbosportdansklubb.se/socialdans#2026-10-02');
        expect(phs.hasSpecificTime).toBe(true);
    });

    it('stoppar beskrivningen vid klockslaget så köpvillkoren inte läcker in', () => {
        const phs = parseVastboEvents(HTML, now).find(e => e.title === 'Dans till PHs')!;
        expect(phs.description).toBe('Socialdans i Bugg, FOX till live dansbandsmusik.');
    });

    it('matchar bandets bild på filnamnet och tar originalet utan query', () => {
        const events = parseVastboEvents(HTML, now);
        expect(events.find(e => e.title === 'Dans till Donnez')!.imageUrl).toBe(`${IMG}/Donnez24.jpg`);
        expect(events.find(e => e.title === 'Dans till PHs')!.imageUrl).toBe(`${IMG}/PHs-press_logga_1500x1000.png`);
    });

    it('tar med vårens kväll när den ligger framåt i tiden', () => {
        const events = parseVastboEvents(HTML, new Date('2026-04-01T12:00:00'));
        const sannex = events.find(e => e.title === 'Dans till Sannex')!;
        expect(sannex.startDate.getFullYear()).toBe(2026);
        expect(sannex.startDate.getDay()).toBe(6);   // lördag
    });

    it('returnerar tomt för en sida utan datumrubriker', () => {
        expect(parseVastboEvents('<h2>Evenemang</h2><p>Kommer snart</p>', now)).toEqual([]);
    });
});
