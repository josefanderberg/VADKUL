// Bakar public/events-today.json — dagens slice av events-destinations.json
// som REN statisk CDN-fil (ingen funktion, ingen Firestore). Kartans boot-
// script hämtar den parallellt med API-slicen: på en kallstartande funktion
// (~40 s första träffen) ritas dagens prickar ändå på ~300 ms härifrån.
//
// Körs som prebuild (npm run build) och som eget steg i deploy.yml (efter
// curl-uppdateringen av eventdatat). "Idag" = svensk tid — samma dagsdefinition
// som stadssidorna; klienten validerar `day`-fältet och slänger en förlegad
// fil (besökare före morgondeployen). Saknas källfilen skrivs inget, men
// bygget failar INTE — klienten faller tillbaka på API-slicen.
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const pub = (f) => path.join(process.cwd(), 'public', f);
const dayFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' }); // → 'YYYY-MM-DD'

try {
    const raw = await readFile(pub('events-destinations.json'), 'utf8');
    const { updatedAt, events } = JSON.parse(raw);
    const today = dayFmt.format(new Date());
    const slice = (events ?? []).filter((e) => {
        const t = Date.parse(e.time);
        return Number.isFinite(t) && dayFmt.format(new Date(t)) === today;
    });
    await writeFile(
        pub('events-today.json'),
        JSON.stringify({ updatedAt: updatedAt ?? new Date().toISOString(), day: today, events: slice }),
    );
    console.log(`events-today.json: ${slice.length} event för ${today}`);
} catch (err) {
    console.warn(`events-today.json: hoppar över (${err?.code ?? err?.message ?? err}) — klienten använder API-slicen`);
}
