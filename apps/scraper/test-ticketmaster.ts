import * as cheerio from 'cheerio';

async function fetchTicketmasterHtml() {
    try {
        const response = await fetch('https://www.ticketmaster.se/city/vaxjo/48201?awc=11202_1741695500_0185e91bd0bc2ce6da7e8d626bdc6c80');
        const textBody = await response.text();
        const $ = cheerio.load(textBody);

        console.log('Title:', $('title').text());

        let found = 0;
        $('li.event-list-item, div.event-listing-item, [class*="event-item"]').slice(0, 5).each((_, el) => {
            console.log($(el).text().replace(/\s+/g, ' ').trim());
            found++;
        });

        $('script[type="application/ld+json"]').each((_, el) => {
            const json = $(el).html();
            if (json && json.includes('Växjö')) {
                console.log('Found LD JSON for Växjö events!');
                found++;
            }
        });

        console.log(`Found ${found} items on Ticketmaster HTML.`);

    } catch (e) {
        console.error(e);
    }
}
fetchTicketmasterHtml();
