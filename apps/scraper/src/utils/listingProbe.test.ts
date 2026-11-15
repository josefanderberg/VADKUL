import { describe, it, expect } from 'vitest';
import { robotsAllows, listingCandidates, detailLinkFamily } from './listingProbe';

describe('robotsAllows', () => {
    const robots = `# kommentar
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php
Disallow: /evenemang/privat/
Disallow: /*?event=
Disallow: /*.pdf$

User-agent: BadBot
Disallow: /
`;
    it('längsta matchande regel vinner, Allow vid lika', () => {
        expect(robotsAllows(robots, '/evenemang/')).toBe(true);
        expect(robotsAllows(robots, '/evenemang/privat/fest')).toBe(false);
        expect(robotsAllows(robots, '/wp-admin/x')).toBe(false);
        expect(robotsAllows(robots, '/wp-admin/admin-ajax.php')).toBe(true);
    });

    it('jokertecken och radslut', () => {
        expect(robotsAllows(robots, '/vad-hander?event=12')).toBe(false);
        expect(robotsAllows(robots, '/program/host.pdf')).toBe(false);
        expect(robotsAllows(robots, '/program/host.pdf.html')).toBe(true);
    });

    it('en annan robots grupp gäller inte oss; vår egen grupp slår stjärnan', () => {
        expect(robotsAllows(robots, '/program/')).toBe(true);
        expect(robotsAllows('User-agent: *\nDisallow: /\n', '/program/')).toBe(false);
        expect(robotsAllows('User-agent: *\nDisallow: /\n\nUser-agent: VadKul\nDisallow: /privat/\n', '/program/')).toBe(true);
        expect(robotsAllows('User-agent: *\nDisallow:\n', '/program/')).toBe(true);
    });

    it('tom eller oläslig fil = tillåtet', () => {
        expect(robotsAllows('', '/program/')).toBe(true);
        expect(robotsAllows('<html><body>404</body></html>', '/program/')).toBe(true);
    });
});

describe('listingCandidates', () => {
    it('menyns programlänk hittas på sökväg eller länktext (Växjö 14/11)', () => {
        const home = `<html><body><nav>
            <a href="https://www.palladiumvaxjo.se/">HEM</a>
            <a href="https://www.palladiumvaxjo.se/biljetter/">BILJETTER</a>
            <a href="https://www.palladiumvaxjo.se/manadens-program/">MÅNADENS PROGRAM</a>
            <a href="https://www.palladiumvaxjo.se/evenemang/">EVENEMANG</a>
            <a href="https://www.palladiumvaxjo.se/boka-evenemang/">EVENEMANG</a>
            <a href="https://www.palladiumvaxjo.se/mote-konferens/">MÖTE &amp; KONFERENS</a>
            <a href="https://www.palladiumvaxjo.se/kontakt/">KONTAKT</a>
            <a href="https://www.facebook.com/PalladiumVaxjo/events">Events</a>
            </nav></body></html>`;
        expect(listingCandidates(home, 'https://www.palladiumvaxjo.se/')).toEqual([
            'https://www.palladiumvaxjo.se/evenemang/',
            'https://www.palladiumvaxjo.se/manadens-program/',
        ]);
    });

    it('listan före ett enskilt event under den; länktexten räcker när sökvägen är anonym', () => {
        const home = `<html><body>
            <a href="/event/saltstank-turne/">Saltstänk</a>
            <a href="/event-nyheter/">Event &amp; Nyheter</a>
            <a href="/vad-hander-hos-oss/">Vad händer?</a>
            <a href="/sida-7/">På gång</a>
            <a href="/sida-8/">Boka event hos oss</a>
            <a href="/a/b/c/d/program/">för djupt</a>
            </body></html>`;
        expect(listingCandidates(home, 'https://chapterhouse.se')).toEqual([
            'https://chapterhouse.se/event-nyheter/',
            'https://chapterhouse.se/event/saltstank-turne/',
            'https://chapterhouse.se/vad-hander-hos-oss/',
            'https://chapterhouse.se/sida-7/',
        ]);
    });

    it('ett enskilt event är ingen listsida — katalogen ovanför provas i stället (ifsuede.com 15/11)', () => {
        const home = `<html><body>
            <a href="/events/concert-trinix-en-tournee/">Concert Trinix</a>
            <a href="/kalender/2026-11-21-julmarknad/">Julmarknad</a>
            <a href="/om-oss/">Om oss</a>
            </body></html>`;
        const got = listingCandidates(home, 'https://ifsuede.com');
        expect(got).toContain('https://ifsuede.com/events/');
        expect(got).toContain('https://ifsuede.com/kalender/');
        expect(got.some((u) => /trinix|julmarknad/.test(u))).toBe(false);
    });
});

describe('detailLinkFamily', () => {
    const page = (links: string[], extra = '') => `<html><body>
        <header><nav><a href="/evenemang/">Evenemang</a><a href="/restaurang/meny/">Meny</a><a href="/restaurang/lunch/">Lunch</a><a href="/restaurang/boka/">Boka</a></nav></header>
        <main>${links.map((l) => `<a href="${l}">kort</a>`).join('')}${extra}</main>
        <footer><a href="/om/kontakt/">Kontakt</a><a href="/om/jobb/">Jobb</a><a href="/om/press/">Press</a></footer></body></html>`;

    it('kort som delar katalog är en familj; mönstret träffar bara den katalogen', () => {
        const fam = detailLinkFamily(page([
            '/event/saltstank-smuggelsprit-turne-kl-15-30/', '/event/saltstank-smuggelsprit-turne-kl-19-30/',
            'https://www.vaxjokonserthus.se/event/minnesluckor-2/', '/event/minnesluckor-2/#biljetter',
        ]), 'https://www.vaxjokonserthus.se/evenemang/')!;
        expect(fam.dir).toBe('/event');
        expect(fam.links).toHaveLength(3);
        const m = fam.pattern.match(/^\/(.*)\/([a-z]*)$/s)!;
        const re = new RegExp(m[1], m[2]);
        expect(re.test('https://www.vaxjokonserthus.se/event/minnesluckor-2/')).toBe(true);
        expect(re.test('https://vaxjokonserthus.se/event/minnesluckor-2')).toBe(true);
        expect(re.test('https://www.vaxjokonserthus.se/event/')).toBe(false);
        expect(re.test('https://www.vaxjokonserthus.se/event/a/b/')).toBe(false);
        expect(re.test('https://www.vaxjokonserthus.se/restaurang/meny/')).toBe(false);
    });

    it('meny och sidfot räknas inte, och två kort räcker inte', () => {
        expect(detailLinkFamily(page([]), 'https://x.se/evenemang/')).toBeNull();
        expect(detailLinkFamily(page(['/event/a/', '/event/b/']), 'https://x.se/evenemang/')).toBeNull();
    });

    it('länkar direkt under roten är ingen familj — event går inte att skilja från /meny/', () => {
        expect(detailLinkFamily(page(['/zatori-duo/', '/philip-valentin/', '/echoo/', '/aleece/']), 'https://keunjoo.se/evenemang/')).toBeNull();
    });

    it('arkiv, taggar, butik och nyheter är aldrig event', () => {
        expect(detailLinkFamily(page(['/category/event/a/', '/category/event/b/', '/category/event/c/']), 'https://x.se/')).toBeNull();
        expect(detailLinkFamily(page(['/nyheter/a/', '/nyheter/b/', '/nyheter/c/']), 'https://x.se/evenemang/')).toBeNull();
        expect(detailLinkFamily(page(['/produkt/a/', '/produkt/b/', '/produkt/c/']), 'https://x.se/program/')).toBeNull();
        expect(detailLinkFamily(page(['/kalender/utstallningar/a/', '/kalender/utstallningar/b/', '/kalender/utstallningar/c/']), 'https://x.se/kalender/')).toBeNull();
    });

    it('katalogen måste heta något med event — annars räcker det att listsidan gör det', () => {
        const links = ['/artister/a/', '/artister/b/', '/artister/c/'];
        expect(detailLinkFamily(page(links), 'https://x.se/om-oss/')).toBeNull();
        expect(detailLinkFamily(page(links), 'https://x.se/program/')?.dir).toBe('/artister');
        // Två familjer: den som själv heter event går före den större.
        const both = detailLinkFamily(page([...links, '/artister/d/', '/konserter/x/', '/konserter/y/', '/konserter/z/']), 'https://x.se/program/')!;
        expect(both.dir).toBe('/konserter');
    });
});
