#!/usr/bin/env ts-node
/**
 * ENGÅNGS: ~28 beskrivningar med BORTFALLNA å/ä/ö ("H stmarknad") —
 * legacy-skador från tiden då cleanDescription ersatte entiteter med
 * mellanslag (fixat 2026-07-09, men raderna skrapades innan och läks inte:
 * looksStripped-heuristiken missar hål utan ordgräns och legacy-spåren
 * saknar refresh). Beskrivnings-svepet 2026-09-11.
 *
 *  - hembygd.se-rader: sanningen refetchas ur plattforms-API:t
 *    (/api/<site>/activities, samma fältkedja som motorn: preamble →
 *    textContent → description) och körs genom dagens cleanDescription.
 *  - Rotary/ClubRunner + Röda Korset: API-refetch är inte värt motorbygget
 *    för 13 rader — texterna är HANDRESTAURERADE (bortfallen bokstav är
 *    entydig i kontext; källans egna stavfel är medvetet kvar).
 *
 * Skriver SQLite + Firestore via stamped(). Dry-run default; --apply skriver.
 *
 * Kör:  npx ts-node src/scripts/oneoff-repair-stripped-aao-2026-09-11.ts [--apply]
 */

import path from 'path';
import Database from 'better-sqlite3';
import { db } from '../config/firebase';
import { stamped } from '../utils/firestoreStamp';
import { cleanDescription } from '../utils/text';

const APPLY = process.argv.includes('--apply');
const UA = 'Mozilla/5.0 (Macintosh) Chrome/124.0.0.0 Safari/537.36';

/** Handrestaurerade texter (källans egna stavfel bevarade). */
const RESTORED: Record<string, string> = {
    'https://portal.clubrunner.ca/15055/Event/latest-news-from-rotary-doctors-in-kenya':
        'Dr Åsa Lundberg, specialist in Infectious disease and tropical medicine at Kristianstad Hospital, has served as a Rotary Doctor in Kenya four times now and will take us on a journey to the country, the healthcare, the challenges and the hope for the future. Welcome!',
    'https://portal.clubrunner.ca/14964/Event/bengt-carlsson--stadsarkitekt-jönköpings-kommun':
        'Bengt Mattias Carlsson. Bild: Jönköpings kommun',
    'https://portal.clubrunner.ca/15694/Event/ticket-resebyrå--emma-friberg':
        'Resesäljare Emma Friberg på Ticket i Ängelholm ger oss tips om vad som kan bokas o ger oss även olika förslag på resor.',
    'https://portal.clubrunner.ca/14731/Event/axis--företagsbesök':
        'Företagsbesök hos AXIS. Vi återkommer om plats.',
    'https://portal.clubrunner.ca/17598/Event/opm-offshore-i-göteborg':
        'OPM Offshore i Göteborg. Nils Mårtensson.',
    'https://www.rodakorset.se/ort/varmland/arvika-kommun/kalendarium/julklappslotteri-vid-julmarknaden-pa-skutboudden.-':
        'Brunskogs Röda korsgrupp anordnar julklappslotteri.',
    'https://portal.clubrunner.ca/15694/Event/mats-olofsson':
        'Mats Olofsson är medlem av Kungliga Krigsvetenskapsakademien och tidigare forskningschef vid Försvarsmakten. Kommer att berätta om den senaste utvecklingen inom drönartekninken och inte minst hur utvecklingen drivs av kriget mellan Ukraina o Ryssland.',
    'https://portal.clubrunner.ca/17598/Event/klubbsamråd-1':
        'Klubbsamråd.',
    'https://portal.clubrunner.ca/16263/Event/patrik-källström--liseberg-del-2':
        'Patrik Källström. Liseberg del 2.',
    'https://portal.clubrunner.ca/15694/Event/louise-nordahl-o-hanna-angenius':
        'Louise, skådespelare, komiker o ambassadör i Ängelholm och Hanna, teaterpedagog. Båda arbetar på Teater på tapeten som är en ideell amatörteaterförening i Ängelholm.',
    'https://portal.clubrunner.ca/17598/Event/årsmöte-med-mingel':
        'Årsmöte med mingel',
    'https://portal.clubrunner.ca/15694/Event/hanna-wendelbo-hansson--designer-o-formgivare':
        'En av årets ambassadör i Ängelholm som har ett passionerat förhållande till blommor.',
    'https://portal.clubrunner.ca/15194/Event/jullunch-på-ellinge-slott':
        'Vi avslutar året med en stämningsfull jullunch på vackar Ellinge Slott. Mer info kommer under hösten. // Klubbtjänst',
    'https://www.rodakorset.se/ort/skane/lomma-kommun/kalendarium/kurs-i-forsta-hjalpen--hlr-bebis-och-barn-till-18-ar2/':
        'Välkommen att anmäla dig till kursen i Första hjälpen / HLR enligt affischen nedan!',
    'https://portal.clubrunner.ca/15596/Event/min-praktik-i-riksdagen---milton-lord':
        'Milton Lord är en ung samhällsengagerad entreprenör som nu har haft turen att göra praktik i Riksdagen, han äger och driver även äventyrsgolfen, som ligger vid hotell Eskilstuna',
    'https://portal.clubrunner.ca/17590/Event/valdagen-är-över---hur-blir-det-nu':
        'Jonas Hinnfors, professor i statsvetenskap vid Göteborgs universitet ger oss sina reflektionen av valutgången efter årets riksdagsval.',
    'https://portal.clubrunner.ca/15306/Event/arildkolonin':
        'Arildkolonin, Magnus Hellstrand, ordförande i Föreningen Arildkonstnärernas vänner Mer information kommer.',
    'https://www.rodakorset.se/ort/skane/landskrona-stad/kalendarium/forsta-hjalpenhlr-barn-1-18-ar---fysisk-kurs/':
        'Innehåll Kunna kontrollera livstecken och skapa en öppen luftväg Kunna placera ett medvetslöst barn i stabilt sidoläge Kunna larma Känna till 1177 Vårdguiden Kunna utföra hjärt-lungräddning på barn (1-18 år) Känna till hur en hjärtstartare används i kombination med hjärt-lungräddning Kunna hjälpa till att få bort ett föremål vid luftvägsstopp (1-18 år) Kunna stoppa en blödning med ett direkt tryck Kunna förebygga cirkulationssvikt Känna till hur barnolycksfall kan förebyggas Känna till vikten av att',
    'https://portal.clubrunner.ca/14731/Event/lund-ideon-rk´s-årsmöte':
        'Lund-Ideon RK´s årsmöte.',
    'https://portal.clubrunner.ca/15989/Event/per-wiström----en-bi-entusiast':
        'Vår föredragshållare Per Wiström är f.d. ekonomichef och numera en bi-entusiast!',
    'https://portal.clubrunner.ca/16422/Event/veckomöte-24-10-2026--orgel':
        'Veckomöte 24/10 2026 kommer Mattias Wennberg och Emma . Att berätta resan med att montera ner en orgel i England och sätta upp den i Frändefors kyrka.',
    'https://www.rodakorset.se/ort/varmland/arvika-kommun/kalendarium/achvalskaffe-med-bingo/':
        'Brunskogs Rödakorsgrupp bjuder på eftermiddagskaffe med Bingo.',
    'https://portal.clubrunner.ca/15017/Event/göran-rosenberg-journalist-och-författare':
        'Göran Jakob Rosenberg, född 11 oktober 1948 i Södertälje församling, Stockholms län, är en svensk författare och journalist. Han har varit reporter och programledare inom både radio och TV samt verkat som krönikör i svensk dagspress. 1990 grundade han tidningen Moderna Tider. Hans senaste bok heter I lögnens tid .',
    'https://portal.clubrunner.ca/15596/Event/ny-kvinnohälsa-på-smedhälsan':
        'Caroline Wiik, VD och Anna Bröms, barnmorska presenterar deras nya satsning inom kvinnohälsa',
    'https://portal.clubrunner.ca/14964/Event/sandra-jonsson':
        'Sandra Jonsson kommer berätta om kommunens trafikstrateigi och trafikplan',
    'https://portal.clubrunner.ca/17598/Event/omvärldsfrågor-adam-cwejman--gp':
        'Omvärldsfrågor. Adam Cwejman, GP',
    'https://portal.clubrunner.ca/15017/Event/samrådsmöte':
        'Samrådsmöte i klubben.',
    'https://www.rodakorset.se/ort/varmland/arvika-kommun/kalendarium/kaffeservering-i-forsamlingshemmet-vid-allhelgona/':
        'Brunskogs Rödakorsgrupp bjuder på kaffe i samband med gravsmyckningen vid Allhelgonahelgen.',
};

async function hembygdDesc(url: string): Promise<string | null> {
    const m = url.match(/hembygd\.se\/([^/?]+)\?a=(\d+)/);
    if (!m) return null;
    try {
        const r = await fetch(`https://www.hembygd.se/api/${m[1]}/activities`, {
            headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15_000),
        });
        if (!r.ok) return null;
        const list = await r.json();
        const a = (Array.isArray(list) ? list : []).find((x: any) => String(x?.id) === m[2]);
        if (!a) return null;
        const desc = cleanDescription(a.preamble || a.textContent || a.description);
        return desc || null;
    } catch {
        return null;
    }
}

async function main() {
    if (!db) { console.error('❌ Firestore ej initialiserat.'); process.exit(1); }
    const sqlite = new Database(path.join(__dirname, '..', '..', 'events.db'));
    const rows = sqlite.prepare(
        `SELECT url, description, firestoreId FROM link_events
         WHERE time >= datetime('now') AND description IS NOT NULL AND description != ''
           AND description NOT GLOB '*[åäöÅÄÖ]*'
           AND (url LIKE '%hembygd.se%' OR url LIKE '%clubrunner%' OR url LIKE '%rodakorset%')`,
    ).all() as Array<{ url: string; description: string; firestoreId: string | null }>;

    // Bara rader som faktiskt HAR hål (annars är "Mer info kommer." m.fl. med).
    const HOLE = /(?<!\p{L})\p{L} (?=\p{L})|\p{L} (?=st\b|nd\b|tt\b|te\b|r\b|n\b|s\b|ns\b|rs\b|ll\b|lp)/u;
    const damaged = rows.filter((r) => RESTORED[r.url] || HOLE.test(r.description));
    console.log(`${damaged.length} skadade rader (av ${rows.length} utan å/ä/ö i urvalet)`);

    let fixed = 0, missed = 0;
    for (const r of damaged) {
        const restored = RESTORED[r.url] ?? (r.url.includes('hembygd.se') ? await hembygdDesc(r.url) : null);
        if (!restored || restored === r.description) {
            missed++;
            console.log(`  ⏭  ingen lagning: ${r.url.slice(0, 70)} — ${JSON.stringify(r.description.slice(0, 50))}`);
            continue;
        }
        console.log(`  ✓ ${r.description.slice(0, 45)}  →  ${restored.slice(0, 60)}`);
        if (!APPLY) continue;
        sqlite.prepare('UPDATE link_events SET description = ? WHERE url = ?').run(restored, r.url);
        if (r.firestoreId) {
            try {
                await db.collection('linkEvents').doc(r.firestoreId).update(stamped({ description: restored }));
            } catch (err: any) {
                if (err?.code !== 5) console.error(`  ⚠️ Firestore-fel ${r.firestoreId}:`, err?.message);
            }
        }
        fixed++;
    }
    console.log(APPLY ? `✅ ${fixed} lagade, ${missed} olagade.` : `(dry-run: ${damaged.length - missed} skulle lagas, ${missed} saknar lagning — kör med --apply)`);
    process.exit(0);
}

main().catch((err) => { console.error('❌', err); process.exit(1); });
