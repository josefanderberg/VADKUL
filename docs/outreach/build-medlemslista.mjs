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

const [{ users = [] }, cityByUid] = await Promise.all([
    readFile(src, 'utf8').then(JSON.parse),
    fetchCityByUid(),
]);

const seen = new Set();
const rows = [];
for (const u of users) {
    const email = (u.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    rows.push({
        email,
        firstName: firstNameOf(u.displayName),
        city: cityByUid.get(u.localId) ?? '',
    });
}
rows.sort((a, b) => a.email.localeCompare(b.email));

const date = new Date().toISOString().slice(0, 10);
const out = `medlemmar-${date}.csv`;
await writeFile(out, 'email,firstname,city\n'
    + rows.map((r) => `${csvCell(r.email)},${csvCell(r.firstName)},${csvCell(r.city)}\n`).join(''));

const named = rows.filter((r) => r.firstName).length;
const withCity = rows.filter((r) => r.city).length;
console.log(`${out}: ${rows.length} adresser, ${named} med förnamn, ${withCity} med stad (${rows.length - withCity} utan → nationella utskicket)`);
// firebase-admin håller gRPC-anslutningar öppna — avsluta explicit.
process.exit(0);
