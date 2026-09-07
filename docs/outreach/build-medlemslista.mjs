// Bygger medlemslistan (mejl + förnamn + stad) för Zoho Campaigns ur en
// Firebase Auth-export. PII: både rådumpen och den färdiga CSV:n ska bort
// från disk efter importen — CSV:n är gitignorad (medlemmar-*.csv).
//
//   firebase auth:export /tmp/raw.json --format=json --project vadkul-f2cb2
//   node docs/outreach/build-medlemslista.mjs /tmp/raw.json
//   rm /tmp/raw.json
//
// Förnamnet härleds ur displayName: första ordet, avslutande siffror bort
// ("Malin81" → "Malin"), versal begynnelsebokstav. Det som inte går att lita
// på (mejladresser, initialer på 1–2 tecken, tomt) lämnas BLANKT — Zohos
// merge-tag får då falla tillbaka på hälsningen utan namn.
//
// Staden hämtas ur Firestore (users/{uid}.city — GPS-härledd via kartan eller
// vald i profilen/registreringen) med apps/scraper/service-account.json.
// Best-effort: utan service-account eller nät blir kolumnen tom och listan
// byggs ändå. Tom stad i Zoho = ge medlemmen nationella utskicket.
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const src = process.argv[2];
if (!src) {
    console.error('Ange sökvägen till auth-exporten: node build-medlemslista.mjs /tmp/raw.json');
    process.exit(1);
}

const firstNameOf = (displayName) => {
    const raw = (displayName ?? '').trim();
    if (!raw || raw.includes('@')) return '';
    const first = raw.split(/[\s._-]+/)[0].replace(/\d+$/, '').trim();
    if (first.length <= 2) return '';           // initialer (D, MP, Ag) → hellre ingen hälsning
    return first[0].toUpperCase() + first.slice(1);
};

const csvCell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// Stadsnamn → stadssideslug (sep-utskickets delningsbild i mejlet:
// vadkul.se/evenemang/<slug>/delningsbild.png). Fylls BARA i när orten har en
// stadssida — annars tom, så Zoho-fallbacken tar över i stället för att en
// trasig bild-URL renderas. Sluggarna läses ur webbens cityPages.ts så listan
// aldrig divergerar.
const slugifyCity = (name) => name.toLowerCase()
    .replaceAll('å', 'a').replaceAll('ä', 'a').replaceAll('ö', 'o')
    .replaceAll('é', 'e').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const loadCityPageSlugs = async () => {
    try {
        const src = await readFile(path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../apps/web/src/utils/cityPages.ts',
        ), 'utf8');
        return new Set([...src.matchAll(/slug:\s*'([a-z0-9-]+)'/g)].map((m) => m[1]));
    } catch {
        console.warn('⚠️  Kunde inte läsa cityPages.ts — cityslug-kolumnen blir tom.');
        return new Set();
    }
};

// uid → stad ur Firestore. select('city') = projektionsfråga, hämtar bara
// fältet (egress-snålt).
const fetchCityByUid = async () => {
    try {
        const { default: admin } = await import('firebase-admin');
        const saPath = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            '../../apps/scraper/service-account.json',
        );
        const serviceAccount = JSON.parse(await readFile(saPath, 'utf8'));
        if (!admin.apps.length) {
            admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        }
        const snap = await admin.firestore().collection('users').select('city').get();
        const map = new Map();
        for (const d of snap.docs) {
            const city = String(d.get('city') ?? '').trim();
            if (city) map.set(d.id, city);
        }
        return map;
    } catch (e) {
        console.warn(`⚠️  Kunde inte hämta städer ur Firestore (${e.message}) — city-kolumnen blir tom.`);
        return new Map();
    }
};

const [{ users = [] }, cityByUid, cityPageSlugs] = await Promise.all([
    readFile(src, 'utf8').then(JSON.parse),
    fetchCityByUid(),
    loadCityPageSlugs(),
]);

const seen = new Set();
const rows = [];
for (const u of users) {
    const email = (u.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    const city = cityByUid.get(u.localId) ?? '';
    const slug = city ? slugifyCity(city) : '';
    rows.push({
        email,
        firstName: firstNameOf(u.displayName),
        city,
        cityslug: cityPageSlugs.has(slug) ? slug : '',
    });
}
rows.sort((a, b) => a.email.localeCompare(b.email));

const date = new Date().toISOString().slice(0, 10);
const out = `medlemmar-${date}.csv`;
await writeFile(out, 'email,firstname,city,cityslug\n'
    + rows.map((r) => `${csvCell(r.email)},${csvCell(r.firstName)},${csvCell(r.city)},${csvCell(r.cityslug)}\n`).join(''));

const named = rows.filter((r) => r.firstName).length;
const withCity = rows.filter((r) => r.city).length;
const withSlug = rows.filter((r) => r.cityslug).length;
console.log(`${out}: ${rows.length} adresser, ${named} med förnamn, ${withCity} med stad (${rows.length - withCity} utan → nationella utskicket), ${withSlug} med stadssideslug`);
// firebase-admin håller gRPC-anslutningar öppna — avsluta explicit.
process.exit(0);
