/**
 * Engångs-omklassning av category='other' — utökad svensk regelpass.
 *
 * Bakgrund 2026-07-28: 10 671 framtida publicerade event låg i 'other' (47%!)
 * eftersom classify.ts-vokabulären är smal och K4-auditens 500/natt inte
 * hinner ikapp inflödet (300–1400 nya/dag). Detta skript tar de vanligaste
 * mönstren (kyrkans caféer/böner, PRO-aktiviteter, sommarmusik, guidade
 * visningar m.m.) direkt till kanoniska kategorier.
 *
 *   npx ts-node src/scripts/oneoff-reclassify-other.ts             # dry-run
 *   npx ts-node src/scripts/oneoff-reclassify-other.ts --apply     # skriv
 *
 * Skriver BARA om event som idag är 'other' — nedgraderar aldrig en riktig
 * kategori. Firestore i batchar + SQLite. K4-auditen får förfina senare.
 */

import { db } from '../config/firebase';
import { sqlite } from '../utils/sqliteHelper';

const APPLY = process.argv.includes('--apply');

// Ordningen avgör — specifika mönster före generella. Kanoniska kategorier.
// Titeln provas FÖRST för alla regler; beskrivningen bara om titeln var tyst
// (beskrivningar nämner ofta mat/fest i förbifarten → falska träffar).
const RULES: [string, RegExp][] = [
    // quiz/bingo/spel — före stage så "SOMMARQUIZ PÅ TEATERVALLEN" inte blir teater
    ['social', /\bquiz\b|\bbingo\b|brädspel|sällskapsspel|tipspromenad/i],
    // familj & barn — före stage/food så barnföreställningar inte fastnar på "pannkak"
    ['family', /\bbarn|sagostund|\bpyssel|familje|sommarlov|höstlov|sportlov|lekplats|nallesjukhus|junior\b|\bungdom|minior|skattjakt|ponnyridning|ansiktsmålning|pettson|findus|\bbamse\b|\bpippi\b|alfons|mamma\s*mu|babblarna/i],
    // musik — bred svensk vokabulär som classify.ts saknar
    ['music', /musik|konsert|visafton|sång|\bkör(en|er)?\b|orgel|trubadur|spelmän|spelman|allsång|karaoke|jazz|blues|country|hip[\s-]?hop|dansband|\bduo\b|kvartett|kvintett|\blive\b|sommarlive|lunchmusik|aftonmusik|kyrkokonsert|julkonsert/i],
    // scen — teater/film/show (\bteater\b + explicita sammansättningar, inte "Teatervallen")
    ['stage', /\bteater(n|s)?\b|sommarteater|barnteater|friluftsteater|teaterförest|föreställning|musikal|\bopera\b|balett|\brevy|standup|stand[\s-]?up|komedi|comedy|cirkus|\bshow\b|filmvisning|\bbio\b|sommarbio|utomhusbio|drive[\s-]?in[\s-]?bio|dansuppvisning|magiker|trolleri/i],
    // konst/kultur — museer, visningar, vandringar
    ['art', /vernissage|utställning|\bkonst|galleri|guidad|guidning|visning|stadsvandring|kulturvandring|museivisning|\bmuseum\b|museet\b|fotoutställning|skulptur|keramik|akvarell|slöjd/i],
    // marknad — OBS 'mässa' undviks (krockar med kyrkans mässa); specifika sammansättningar
    ['market', /loppis|loppmarknad|marknad\b|marknaden\b|auktion|julmarknad|hantverksmässa|antikmässa|bokbord|bakluckeloppis|skördemarknad|torgdag/i],
    // sport & motion — före food så "sommaryoga med frukost" blir sport
    ['sport', /\bboule\b|\bmatch(er)?\b|turnering|\blopp(et)?\b|cykling|cykeltur|simskola|simning|\bgympa\b|yoga|qigong|zumba|linedance|längdskid|orientering|\bgolf\b|padel|vattengympa|sittgympa|motionsdans|vandring|promenad|stavgång|klättring|klättercent/i],
    // mat & dryck
    ['food', /grill|kräftskiva|surströmming|hyttsill|räkafton|räkfrossa|\bmiddag\b|\blunch\b|brunch|frukost|matfest|provning|ölprovning|vinprovning|afternoon\s+tea|våffl|pannkak|fikastund|matmarknad|tårtkalas|kakbuffé|\bpasta\b|pizzakväll/i],
    // kurs & lärande
    ['course', /föreläsning|föredrag|\bkurs\b|workshop|seminarium|studiecirkel|bokcirkel|språkcafé|läxhjälp|introduktion|utbildning|digital\s+hjälp|it-hjälp|släktforskning/i],
    // fest
    ['party', /\bfest\b|festkväll|\bkalas\b|\bparty\b|\bgala\b|\bbal\b|jubileum|firande|invigning|nationaldags|midsommarfirande|valborg|kick[\s-]?off/i],
    // socialt — kyrkans och föreningslivets vardagsrum (bred, därför sist)
    ['social', /gudstjänst|\bmässa\b|högmässa|\bbön\b|middagsbön|morgonbön|aftonbön|andakt|diakoni|\bcafé\b|\bcafe\b|sommarcafé|\bfika\b|kyrkkaffe|träffpunkt|mötesplats|öppen\s+(verksamhet|kyrka|förskola|gemenskap)|öppet\s+hus|gemenskapsträff|syförening|stickcafé|handarbet|vävning|pubafton|pubkväll|afterwork|mingel|samtal(sgrupp)?|drop[\s-]?in|väntjänst|dagledig|herrlunch|sopplunch|tisdagsfika|torsdagsträff|månadsmöte|årsmöte|medlemsmöte|bussresa|dagsresa|utflykt/i],
];

// Host-fallback när titel+beskrivning inte träffar: föreningsliv = socialt.
const HOST_SOCIAL = /församling|pastorat|kyrk|\bPRO\b|hembygds|bygdegård|rotary|röda\s*korset|lions\b|odd\s+fellow|väntjänst/i;

function classifyExtended(title: string, desc: string, host: string): string | null {
    for (const [cat, re] of RULES) if (re.test(title)) return cat;
    for (const [cat, re] of RULES) if (re.test(desc)) return cat;
    if (HOST_SOCIAL.test(host)) return 'social';
    return null;
}

async function main() {
    const rows = sqlite.prepare(`
        SELECT url, firestoreId, title, COALESCE(description,'') AS description,
               COALESCE(hostName,'') AS hostName
        FROM link_events
        WHERE category = 'other' AND hidden = 0 AND status = 'published'
          AND time >= datetime('now')
    `).all() as any[];

    console.log(`Kandidater (framtida 'other'): ${rows.length}`);

    const changes: { url: string; firestoreId?: string; cat: string }[] = [];
    const dist = new Map<string, number>();
    const samples = new Map<string, string[]>();
    for (const r of rows) {
        const cat = classifyExtended(r.title || '', r.description.slice(0, 400), r.hostName);
        if (!cat) continue;
        changes.push({ url: r.url, firestoreId: r.firestoreId, cat });
        dist.set(cat, (dist.get(cat) ?? 0) + 1);
        const s = samples.get(cat) ?? [];
        if (s.length < 5) { s.push(r.title); samples.set(cat, s); }
    }

    console.log(`Träffade: ${changes.length} (${Math.round(100 * changes.length / rows.length)}%) — kvar i other: ${rows.length - changes.length}`);
    for (const [cat, n] of [...dist.entries()].sort((a, b) => b[1] - a[1])) {
        console.log(`  ${cat.padEnd(8)} ${String(n).padStart(5)}   ex: ${(samples.get(cat) ?? []).join(' | ').slice(0, 140)}`);
    }

    if (!APPLY) { console.log('\nDry-run — kör med --apply för att skriva.'); return; }
    if (!db) throw new Error('Firestore ej initialiserat');

    // SQLite direkt-update
    const upd = sqlite.prepare('UPDATE link_events SET category = ? WHERE url = ?');
    for (const c of changes) upd.run(c.cat, c.url);

    // Firestore i batchar om 450
    let written = 0;
    for (let i = 0; i < changes.length; i += 450) {
        const batch = db.batch();
        for (const c of changes.slice(i, i + 450)) {
            if (!c.firestoreId) continue;
            batch.update(db.collection('linkEvents').doc(c.firestoreId), { category: c.cat });
        }
        await batch.commit();
        written += Math.min(450, changes.length - i);
        console.log(`  Firestore: ${written}/${changes.length}`);
    }
    console.log('✅ Klart.');
    process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
