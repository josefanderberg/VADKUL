// Bygger medlemslistan (mejl + förnamn) för Zoho Campaigns ur en Firebase
// Auth-export. PII: både rådumpen och den färdiga CSV:n ska bort från disk
// efter importen — CSV:n är gitignorad (medlemmar-*.csv).
//
//   firebase auth:export /tmp/raw.json --format=json --project vadkul-f2cb2
//   node docs/outreach/build-medlemslista.mjs /tmp/raw.json
//   rm /tmp/raw.json
//
// Förnamnet härleds ur displayName: första ordet, avslutande siffror bort
// ("Malin81" → "Malin"), versal begynnelsebokstav. Det som inte går att lita
// på (mejladresser, initialer på 1–2 tecken, tomt) lämnas BLANKT — Zohos
// merge-tag får då falla tillbaka på hälsningen utan namn.
import { readFile, writeFile } from 'fs/promises';

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

const users = JSON.parse(await readFile(src, 'utf8')).users ?? [];
const seen = new Set();
const rows = [];
for (const u of users) {
    const email = (u.email ?? '').trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    rows.push({ email, firstName: firstNameOf(u.displayName) });
}
rows.sort((a, b) => a.email.localeCompare(b.email));

const date = new Date().toISOString().slice(0, 10);
const out = `medlemmar-${date}.csv`;
await writeFile(out, 'email,firstname\n' + rows.map((r) => `${csvCell(r.email)},${csvCell(r.firstName)}\n`).join(''));

const named = rows.filter((r) => r.firstName).length;
console.log(`${out}: ${rows.length} adresser, ${named} med förnamn, ${rows.length - named} utan (hälsning utan namn)`);
