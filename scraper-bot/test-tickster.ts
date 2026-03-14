import * as cheerio from 'cheerio';

async function testDeep() {
    const url = 'https://www.tickster.com/se/sv/events/z5jlzlgf6yu6xzx/2026-03-21/daniel-kane-impossible-magic';
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const bodyText = $('body').text().replace(/\s+/g, ' ');

    // Attempt to extract time, usually like "19:00" or "Insläpp: 18:30"
    const timeMatches = bodyText.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/g);
    console.log('Found time matches:', timeMatches);

    // Attempt to find location name
    // Could look for Växjö, Vida Arena, Fortnox Arena, etc.
    console.log('Contains Växjö?', bodyText.toLowerCase().includes('växjö'));
    console.log('Contains Vida Arena?', bodyText.toLowerCase().includes('vida arena'));
    console.log('Contains Fortnox?', bodyText.toLowerCase().includes('fortnox'));
    console.log('Contains Konserthus?', bodyText.toLowerCase().includes('konserthuset'));
}
testDeep();
