// Listar FÖRTURSMEDLEMMARNA till appen: de som bjudit in en vän som skapat
// konto eller tackat ja (Kommer/Intresserad) - löftet i oktobermejlet och
// FB-inläggen 8/10. Bokföringen bor i forturInbjudningar/{inbjuden}_{fran}
// (apps/web/src/utils/forturInbjudan.ts, reglerna i infra/firebase/firestore.rules).
//
//   node docs/outreach/build-forturlista.mjs
//   rm fortur-*.csv   (efter importen - PII, gitignorad)
//
// Läser HELA forturInbjudningar, men den är liten per konstruktion (en post
// per inbjuden vän och inbjudare) - inga andra kollektioner läses. E-posten
// hämtas ur Firebase Auth (getUsers, 100 uid per anrop), inte ur users.
//
// Service-kontot: apps/scraper/service-account.json som i
// build-medlemslista.mjs, annars GOOGLE_APPLICATION_CREDENTIALS.
import { readFile, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const saPath = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../apps/scraper/service-account.json',
);
let credential;
try {
    credential = admin.credential.cert(JSON.parse(await readFile(saPath, 'utf8')));
} catch {
    credential = admin.credential.applicationDefault();
}
admin.initializeApp({ credential });

const snap = await admin.firestore().collection('forturInbjudningar').get();

// fran → { inbjudna, konto, svar, forst }. Dokument-id:t är unikt per par,
// så varje post är en egen inbjuden vän för sin inbjudare.
const byInviter = new Map();
for (const d of snap.docs) {
    const { fran, typ, tid } = d.data();
    if (typeof fran !== 'string' || !fran) continue;
    const row = byInviter.get(fran) ?? { inbjudna: 0, konto: 0, svar: 0, forst: null };
    row.inbjudna += 1;
    if (typ === 'konto') row.konto += 1;
    if (typ === 'svar') row.svar += 1;
    const t = tid?.toDate?.() ?? null;
    if (t && (!row.forst || t < row.forst)) row.forst = t;
    byInviter.set(fran, row);
}

const uids = [...byInviter.keys()];
const emailByUid = new Map();
for (let i = 0; i < uids.length; i += 100) {
    const res = await admin.auth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    for (const u of res.users) {
        const email = (u.email ?? '').trim().toLowerCase();
        if (email) emailByUid.set(u.uid, email);
    }
}

const csvCell = (s) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

// Samma e-post kan i teorin höra till två uid (raderat + nytt konto) - slå ihop.
const rows = new Map();
let utanEpost = 0;
for (const [uid, r] of byInviter) {
    const email = emailByUid.get(uid);
    if (!email) { utanEpost += 1; continue; }
    const prev = rows.get(email);
    if (!prev) { rows.set(email, { email, ...r }); continue; }
    prev.inbjudna += r.inbjudna;
    prev.konto += r.konto;
    prev.svar += r.svar;
    if (r.forst && (!prev.forst || r.forst < prev.forst)) prev.forst = r.forst;
}
const sorted = [...rows.values()].sort((a, b) => (a.forst ?? 0) - (b.forst ?? 0));

const date = new Date().toISOString().slice(0, 10);
const out = `fortur-${date}.csv`;
await writeFile(out, 'email,inbjudna,konto,svar,forst\n'
    + sorted.map((r) => [
        csvCell(r.email), r.inbjudna, r.konto, r.svar, r.forst ? r.forst.toISOString() : '',
    ].join(',') + '\n').join(''));

const kontoPosts = snap.docs.filter((d) => d.get('typ') === 'konto').length;
console.log(`${out}: ${sorted.length} förtursmedlemmar ur ${snap.size} poster (${kontoPosts} nya konton, ${snap.size - kontoPosts} svar)`);
if (utanEpost) console.log(`⚠️  ${utanEpost} inbjudare saknar e-post i Auth (raderade konton?) - utelämnade.`);
// firebase-admin håller gRPC-anslutningar öppna - avsluta explicit.
process.exit(0);
