import { describe, it, expect } from 'vitest';
import { parseSvPage, parseSvCatalogPage } from './sv';

// Nedtrimmat äkta kort från sv.se/kurser-och-evenemang?g_EventType=culture (2026-07-02).
const card = (over: { href?: string; title?: string; date?: string; time?: string; loc?: string; price?: string; occasions?: number | null } = {}) => `
<article itemscope itemtype="http://schema.org/Product" class="event-list__event-item">
    <figure class="event-list__figure">
        <a href="${over.href ?? '/kurser-och-evenemang/dans/lindy-hop-socialdans-med-livemusik-62924'}" itemprop="url" class="event-list__image-link" tabindex="-1">
            <img alt="" class="event-list__image" src="/storage/0F46C869/420-210-1-jpg.Jpeg/media/7c2e3fdd/dans.jpeg" width="420" />
        </a>
    </figure>
    <div class="event-list__info-wrap">
        <meta itemprop="description" />
        <div class="event-list__text-info">
            <a href="${over.href ?? '/kurser-och-evenemang/dans/lindy-hop-socialdans-med-livemusik-62924'}" title="" tabindex="-1">
                <h2 itemprop="name" class="event-list__title small-text">${over.title ?? 'Lindy hop: Socialdans med livemusik'}</h2>
            </a>
            <div class="event-list__price-seats" itemprop="offers" itemscope itemtype="http://schema.org/Offer">
                <div class="event-list__price x-small-text">
                    ${over.price ?? 'Kostnadsfri'}
                    <link itemprop="url" href="${over.href ?? '/kurser-och-evenemang/dans/lindy-hop-socialdans-med-livemusik-62924'}" />
                </div>
            </div>
        </div>
        <div class="event-list__meta-info">
            <span class="event-list__location" aria-label="Ort: ">
                ${over.loc ?? 'Arvika'}
            </span>
            <span class="event-list__date" aria-label="Datum: ">
                ${over.date ?? 'tis 2026-08-18'}
            </span>
            <span class="event-list__time" aria-label="Tid: ">
                ${over.time ?? '19:00'}
            </span>
            ${over.occasions === null ? '' : `<span class="event-list__occasions" aria-label="${over.occasions ?? 1} Tillf&#xE4;llen">${over.occasions ?? 1} Tillf&#xE4;llen</span>`}
        </div>
    </div>
</article>`;

const page = (...cards: string[]) => `<html><body><ul class="event-list__list">${cards.map(c => `<li class="event-list__list-item">${c}</li>`).join('')}</ul></body></html>`;

describe('parseSvPage', () => {
    it('mappar komplett kort', () => {
        const [e] = parseSvPage(page(card()));
        expect(e.title).toBe('Lindy hop: Socialdans med livemusik');
        expect(e.url).toBe('https://www.sv.se/kurser-och-evenemang/dans/lindy-hop-socialdans-med-livemusik-62924');
        expect(e.externalId).toBe('62924');
        expect(e.city).toBe('Arvika');
        expect(e.startDate.getFullYear()).toBe(2026);
        expect(e.startDate.getMonth()).toBe(7);
        expect(e.startDate.getHours()).toBe(19);
        expect(e.hasSpecificTime).toBe(true);
        expect(e.price).toBe('Kostnadsfri');
        expect(e.imageUrl).toBe('https://www.sv.se/storage/0F46C869/420-210-1-jpg.Jpeg/media/7c2e3fdd/dans.jpeg');
        expect(e.hostName).toBe('Studieförbundet Vuxenskolan');
    });

    it('HTML-entiteter i titel/ort avkodas', () => {
        const [e] = parseSvPage(page(card({ title: 'Guidad visning i H&#xE4;lleviksstrand', loc: 'H&#xE4;lleviksstrand' })));
        expect(e.title).toBe('Guidad visning i Hälleviksstrand');
        expect(e.city).toBe('Hälleviksstrand');
    });

    it('utan klockslag → midnatt + hasSpecificTime=false', () => {
        const [e] = parseSvPage(page(card({ time: '' })));
        expect(e.startDate.getHours()).toBe(0);
        expect(e.hasSpecificTime).toBe(false);
    });

    it('kort utan datum skippas, resten behålls', () => {
        const events = parseSvPage(page(card({ date: 'preliminärt' }), card()));
        expect(events).toHaveLength(1);
        expect(events[0].externalId).toBe('62924');
    });

    it('tom sida → []', () => {
        expect(parseSvPage('<html><body><div>Inga träffar</div></body></html>')).toEqual([]);
    });
});

describe('parseSvCatalogPage — hela katalogens engångsarrangemang (15/11)', () => {
    it('ett tillfälle = ett arrangemang; studiecirklar med flera träffar hoppas', () => {
        const evs = parseSvCatalogPage(page(
            card({ href: '/kurser-och-evenemang/data-it/ai-for-foreningsarbete-umea-(kvall)-80154', title: 'AI - För föreningsarbete, Umeå (kväll)', loc: 'Umeå', date: 'ons 2026-11-18', time: '18:15', occasions: 1 }),
            card({ href: '/kurser-och-evenemang/sprak/spanska-1-12345', title: 'Spanska 1', occasions: 10 }),
            card({ href: '/kurser-och-evenemang/x/utan-tillfallen-1', title: 'Okänt antal', occasions: null }),
        ));
        expect(evs.map((e) => e.title)).toEqual(['AI - För föreningsarbete, Umeå (kväll)']);
        expect(evs[0]).toMatchObject({ city: 'Umeå', price: 'Kostnadsfri', hasSpecificTime: true, url: 'https://www.sv.se/kurser-och-evenemang/data-it/ai-for-foreningsarbete-umea-(kvall)-80154' });
        expect(evs[0].description).toBe('Arrangemang med Studieförbundet Vuxenskolan i Umeå.');
    });

    it('kulturlistan behåller sina kort oavsett antal tillfällen', () => {
        expect(parseSvPage(page(card({ occasions: null }), card({ href: '/a-2', occasions: 3 })))).toHaveLength(2);
    });
});

describe('distansarrangemang har ingen plats på kartan (15/11)', () => {
    it('kort med ort "Distans" eller "Online" hoppas', () => {
        const evs = parseSvCatalogPage(page(
            card({ href: '/a-1', title: 'Webbinarium: Individuell plan', loc: 'Distans' }),
            card({ href: '/a-2', title: 'Mullbänk och torpargrund - Online', loc: 'Online' }),
            card({ href: '/a-3', title: 'Silversmide - Heldag', loc: 'Växjö' }),
        ));
        expect(evs.map((e) => e.title)).toEqual(['Silversmide - Heldag']);
    });
});
