// Delar ut FÖRTURSTROFÉN (🏆, typ fortur-2026) till dem som hade förtur när
// appen släpptes 23/10 2026: alla som bjudit in en vän som skapat konto eller
// tackat ja (forturInbjudningar, samma underlag som build-forturlista.mjs).
// Typen är BEGRÄNSAD - den delas ut en gång och aldrig igen. Modellen och
// reglerna: packages/kontrakt/src/trophies.ts.
//
//   npx vite-node docs/outreach/dela-ut-forturstrofeer.ts            (provkörning)
//   npx vite-node docs/outreach/dela-ut-forturstrofeer.ts -- --skarpt
//
// Skarpt skriver trophies/{id} + spegeln users/{uid}.trophies med admin-SDK:t.
// Kör INTE skarpt förrän rules-filen med trophies-spärren är deployad -
// annars kan vem som helst skriva in en egen trofé i sitt users-dokument.
// Skriptet vägrar om någon fortur-2026-trofé redan finns (en gång, inga
// omnumreringar). Läser bara forturInbjudningar (liten per konstruktion,
// count() först) och Auth för att se att kontona finns.
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';
import { planTrophyAwards } from '@vadkul/kontrakt';

const TYP = 'fortur-2026' as const;
const skarpt = process.argv.includes('--skarpt');

const saPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../apps/scraper/service-account.json');
let credential: admin.credential.Credential;
try {
    credential = admin.credential.cert(JSON.parse(await readFile(saPath, 'utf8')));
} catch {
    credential = admin.credential.applicationDefault();
}
admin.initializeApp({ credential });
const db = admin.firestore();

const redan = (await db.collection('trophies').where('type', '==', TYP).count().get()).data().count;
if (redan > 0) {
    console.log(`${redan} ${TYP}-troféer finns redan - typen är begränsad och delas inte ut igen.`);
    process.exit(0);
}

const inbjudningar = db.collection('forturInbjudningar');
const antal = (await inbjudningar.count().get()).data().count;
if (antal > 2000) throw new Error(`forturInbjudningar har ${antal} poster - större än väntat, kolla innan hela läses.`);
const snap = await inbjudningar.get();

// Tidigaste kvalningen per inbjudare.
const kandidater: { uid: string; qualifiedAt: number }[] = [];
for (const d of snap.docs) {
    const { fran, tid } = d.data() as { fran?: unknown; tid?: { toMillis?: () => number } };
    if (typeof fran !== 'string' || !fran) continue;
    kandidater.push({ uid: fran, qualifiedAt: tid?.toMillis?.() ?? Date.now() });
}

// Bara riktiga konton (finns i Auth, inte anonyma) har en profil att visa trofén i.
const uids = [...new Set(kandidater.map(k => k.uid))];
const riktiga = new Set<string>();
for (let i = 0; i < uids.length; i += 100) {
    const res = await admin.auth().getUsers(uids.slice(i, i + 100).map(uid => ({ uid })));
    for (const u of res.users) if (u.providerData.length > 0) riktiga.add(u.uid);
}
const bortfall = uids.filter(u => !riktiga.has(u)).length;

const nu = new Date().toISOString();
const plan = planTrophyAwards(TYP, kandidater.filter(k => riktiga.has(k.uid)), nu);

console.log(`${plan.length} troféer att dela ut (${bortfall} inbjudare utan riktigt konto hoppas över):`);
for (const p of plan) console.log(`  ${p.id}  nr ${p.doc.number} av ${p.doc.of}  ägare ${p.doc.owner.slice(0, 6)}…`);

if (!skarpt) {
    console.log('\nProvkörning - inget skrivet. Lägg till -- --skarpt för att dela ut.');
    process.exit(0);
}

const batch = db.batch();
for (const p of plan) {
    batch.create(db.collection('trophies').doc(p.id), p.doc);
    batch.set(db.collection('users').doc(p.doc.owner), {
        trophies: admin.firestore.FieldValue.arrayUnion(p.mirror),
    }, { merge: true });
}
await batch.commit();
console.log(`\nUtdelat: ${plan.length} troféer (trophies/ + users/{uid}.trophies).`);
process.exit(0);
