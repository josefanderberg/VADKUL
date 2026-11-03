/**
 * dagsinlagg.ts - ett inlägg om dagen på Facebook-sidan och Instagram.
 *
 * Planen och reglerna: docs/social/dagsinlagg.md. Temahjulet, texterna,
 * urvalet, granskaren, bild- och videobygget är ren logik i
 * utils/dagsinlagg/ (testad). Det här är I/O-lagret och kommandot.
 *
 * Lägen (ett i taget):
 *   --kör        Hela morgonen: följ upp gårdagen, planera dagens inlägg,
 *                förhandsvisa i Telegram, vänta på klartecken till 09:00
 *                (tyst godkännande), publicera. Det launchd kör 07:00.
 *   --planera    Bygg dagens inlägg och förhandsvisa, publicera inte
 *                (sparas som 'planerad'; --publicera skickar ut det).
 *   --provkör    Som --planera men utan Telegram och utan uppladdning:
 *                filerna hamnar i dagsinlagg/utkast/<datum>/ för granskning.
 *   --publicera  Publicera dagens planerade inlägg nu.
 *   --följ-upp   Spelvinnare/quizsvar som kommentar, insikter efter 48 h.
 *   --rapport    Veckorapporten till Telegram (och förslag på vikter).
 *   --kolla      Behörigheter, Storage, Telegram, ffmpeg, inkorg, aggregat.
 *
 * Val: --tema=<siffra|video|gissa|helg|quiz|budskap>  --datum=YYYY-MM-DD
 *      --inkorg=<mapp>  --nu (publicera direkt i --kör, utan vetofönster)
 *      --granskare=<claude|ollama>
 *
 * Telegram-svar under vetofönstret: "nej"/"stopp" stoppar dagens inlägg,
 * "ja" publicerar direkt, "byt" bygger om med nästa kandidat, "text: ..."
 * byter texten (kontrollen gäller fortfarande). Klipp som skickas under
 * tiden hamnar i inkorgen.
 */

import fs from 'fs';
import path from 'path';
import { eventKey } from '../utils/eventKey';
import { eventShareSlug } from '../utils/eventShareSlug';
import { cityPoints, citySlugFor } from '../utils/cityLookup';
import {
    commentOnFacebookPost, commentOnInstagramMedia, fetchFacebookPostInsights, fetchInstagramMediaInsights,
    getFacebookPostPermalink, getTokenScopes, isFacebookConfigured, isInstagramConfigured, loadSocialSecrets,
    postReelToInstagram, postToFacebook, postToInstagram, postVideoToFacebook,
} from '../utils/socialPublish';
import { isTelegramConfigured, sendMessage, sendPhoto, sendVideo, flushPendingUpdates, waitForMessage } from '../utils/telegram';
import type { CardEvent, DestEvent, Inlagg, Klipp, KlippTema, Logg, Tema } from '../utils/dagsinlagg/typer';
import { TEMAN } from '../utils/dagsinlagg/typer';
import { dagarMellan, plusDagar, stockholmDatum, stockholmTid, stockholmVeckodag } from '../utils/dagsinlagg/tid';
import { helgKlipp, KLIPP_PRIORITET, valjTema, veckodagFor, type TemaVal } from '../utils/dagsinlagg/teman';
import {
    laddaLogg, ledigaKlipp, markeraMilstolpe, oanvandMilstolpe, oavslutadUppfoljning, patchaInlagg, patchaKlipp,
    registreraKlipp, rensaForsvunnaKlipp, sparaLogg, stadSlug, staderAnvanda, uppsertInlagg, utanInsikter,
} from '../utils/dagsinlagg/logg';
import { INKORG_PATH, listaInkorg, sparaInkommetKlipp } from '../utils/dagsinlagg/inkorg';
import {
    avgorVinnare, gissaData, gissaKandidater, helgStad, quizForStad, quizKommentar, siffror, stadssidor, vinnarKommentar,
    type GissaKandidat,
} from '../utils/dagsinlagg/urval';
import { byggText, kontrollera, kontrolleraTextrad, talMedPlus, textraderFor, type TextData } from '../utils/dagsinlagg/text';
import { molnIkon, renderaKort, renderaTextOverlay } from '../utils/dagsinlagg/bildRender';
import { bildrutor, kontrolleraKlipp, probe, renderaVideo, standardTider, RUBRIK_PX, UNDERRAD_PX, TEXT_Y, FARG_LJUSBLA } from '../utils/dagsinlagg/video';
import { beskrivOmdome, granskningsprompt, tolkaOmdome, valjBasta, type Granskad } from '../utils/dagsinlagg/granskare';
import { fragaGranskaren, valdProvider, type Provider } from '../utils/dagsinlagg/granskareProvider';
import { harStorage, laddaUppBild, laddaUppVideo, lasMatvarden } from '../utils/dagsinlagg/lager';
import { perTema, tolkaFbInsikter, tolkaIgInsikter, veckorapport, viktaTeman } from '../utils/dagsinlagg/insikter';

// --- Argument ----------------------------------------------------------------

const argv = process.argv.slice(2);
const flagga = (namn: string): boolean => argv.includes(`--${namn}`);
const varde = (namn: string): string | undefined => argv.find(a => a.startsWith(`--${namn}=`))?.slice(namn.length + 3);

const LAGE = (['kör', 'planera', 'provkör', 'publicera', 'följ-upp', 'rapport', 'kolla'] as const)
    .find(l => flagga(l) || flagga(l.replace('ö', 'o').replace('ö', 'o')));
const TVINGA = varde('tema') as Tema | undefined;
const DATUM = varde('datum') ?? stockholmDatum(Date.now());
/** 'Nu' för urvalet: klockan 07:00 det valda datumet när --datum ges (provkörning av andra dagar), annars riktig tid. */
const NU = varde('datum') ? stockholmTid(DATUM, '07:00').getTime() : Date.now();
const INKORG = varde('inkorg') ? path.resolve(varde('inkorg')!) : INKORG_PATH;
const PUBLICERA_NU = flagga('nu');
const PROVISIONELL = LAGE === 'provkör';
if (varde('granskare')) process.env.DAGSINLAGG_GRANSKARE = varde('granskare');

const ROT = path.resolve(__dirname, '../..');
const UTKAST = path.join(ROT, 'dagsinlagg', 'utkast', DATUM);
const WEB_PUBLIC = path.resolve(ROT, '../web/public');
const LOCK_FILE = '/tmp/vadkul-dagsinlagg.lock';
const PUBLICERINGSTID = '09:00';
const LANK_BAS = 'https://vadkul.se';

const SCOPES_KRAV = ['pages_manage_posts', 'publish_video', 'pages_manage_engagement', 'instagram_basic', 'instagram_content_publish', 'instagram_manage_comments'];

// --- Hjälpare --------------------------------------------------------------------

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const log = (s: string): void => console.log(`[dagsinlägg] ${s}`);

interface Kontext {
    events: DestEvent[];
    cards: Map<string, CardEvent>;
    orter: { name: string; lat: number; lng: number }[];
    stadssidor: { name: string; lat: number; lng: number }[];
    aggregatAlder: number;
}

function laddaAggregat(): Kontext {
    const dest = JSON.parse(fs.readFileSync(path.join(WEB_PUBLIC, 'events-destinations.json'), 'utf-8')) as { updatedAt: string; events: DestEvent[] };
    const cardsRaw = JSON.parse(fs.readFileSync(path.join(WEB_PUBLIC, 'events-cards.json'), 'utf-8')) as { events: CardEvent[] };
    const cards = new Map<string, CardEvent>();
    for (const c of cardsRaw.events) cards.set(c.h, c);
    const orter = cityPoints();
    return {
        events: dest.events, cards, orter,
        stadssidor: stadssidor(orter, namn => citySlugFor(namn) !== null),
        aggregatAlder: Date.now() - new Date(dest.updatedAt).getTime(),
    };
}

function kortFor(e: DestEvent, ctx: Kontext): CardEvent | undefined {
    return ctx.cards.get(eventKey(e.id));
}

function skrivUtkast(namn: string, innehall: string | Buffer): string {
    fs.mkdirSync(UTKAST, { recursive: true });
    const fil = path.join(UTKAST, namn);
    fs.writeFileSync(fil, innehall);
    return fil;
}

function kontrolleraBada(text: { fb: string; ig: string }, data: TextData): string[] {
    return [...kontrollera(text.fb, data, 'fb').map(b => `fb: ${b}`), ...kontrollera(text.ig, data, 'ig').map(b => `ig: ${b}`)];
}

// --- Utkastet --------------------------------------------------------------------

interface Utkast {
    inlagg: Inlagg;
    /** Lokal fil (png eller mp4). */
    media: string;
    kandidater?: GissaKandidat[];
    klipp?: Klipp;
}

let slutkortCache: string | null = null;
async function slutkort(): Promise<string> {
    if (slutkortCache) return slutkortCache;
    slutkortCache = await renderaKort('slutkort', { ikonDataUri: molnIkon() }, path.join(ROT, 'dagsinlagg', 'slutkort.png'));
    return slutkortCache;
}

function nyttInlagg(val: TemaVal, text: { fb: string; ig: string }, data: TextData, media: { typ: 'bild' | 'video'; fil: string }, extra: Partial<Inlagg> = {}): Inlagg {
    return {
        id: DATUM, tema: val.tema, variant: val.variant, form: media.typ,
        status: PROVISIONELL ? 'provkörd' : 'planerad',
        skapad: Date.now(), publiceraEfter: stockholmTid(DATUM, PUBLICERINGSTID).getTime(),
        text, data, media, ...extra,
    };
}

async function byggVideo(klipp: Klipp, textrader: [string, string], data: TextData): Promise<string> {
    const kalla = path.join(INKORG, klipp.fil);
    const info = probe(kalla);
    const tider = standardTider(info.langd);
    const ut = path.join(UTKAST, 'video.mp4');
    fs.mkdirSync(UTKAST, { recursive: true });
    const t0 = await renderaTextOverlay({ text: textrader[0], storlek: RUBRIK_PX, y: TEXT_Y }, path.join(UTKAST, 'texter', 'text-0.png'));
    const t1 = await renderaTextOverlay({ text: textrader[1], storlek: UNDERRAD_PX, farg: FARG_LJUSBLA, y: 640 }, path.join(UTKAST, 'texter', 'text-1.png'));
    renderaVideo({
        klipp: kalla, slutkort: await slutkort(), ut, harLjud: info.harLjud, langd: info.langd,
        texter: [{ fil: t0, ...tider[0] }, { fil: t1, ...tider[1] }],
    });
    void data;
    return ut;
}

/** Granska lediga klipp i prioritetsordning (högst fyra), uppdatera loggen, välj bästa. */
async function granskaKlipp(logg: Logg, prioritet: KlippTema[], uteslut: string[], provider: Provider): Promise<{ logg: Logg; val: Granskad | null }> {
    const lediga = ledigaKlipp(logg).filter(k => !uteslut.includes(k.fil));
    const ordnade = [...lediga].sort((a, b) => {
        const ia = prioritet.indexOf(a.tema), ib = prioritet.indexOf(b.tema);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.mottaget - b.mottaget;
    }).slice(0, 4);
    const granskade: Granskad[] = [];
    for (const k of ordnade) {
        const fil = path.join(INKORG, k.fil);
        if (!fs.existsSync(fil)) continue;
        if (k.betyg !== undefined && k.status === 'godkänd') {
            granskade.push({ fil: k.fil, omdome: { betyg: k.betyg, tema: k.tema, brott: [], textrader: k.textrader ?? [], motivering: k.motivering ?? '' } });
            continue;
        }
        try {
            const info = probe(fil);
            const brott = kontrolleraKlipp(info);
            if (brott.length) {
                logg = patchaKlipp(logg, k.fil, { status: 'avvisad', betyg: 0, motivering: brott.join(', ') });
                log(`${k.fil}: avvisat (${brott.join(', ')})`);
                continue;
            }
            const rutor = bildrutor(fil, path.join(ROT, 'dagsinlagg', 'rutor', k.fil.replace(/\.[^.]+$/, '')), info.langd);
            const svar = await fragaGranskaren(rutor, granskningsprompt(prioritet), provider);
            const omdome = tolkaOmdome(svar);
            if (!omdome) {
                log(`${k.fil}: granskaren svarade obegripligt, hoppar över i dag`);
                continue;
            }
            const g = { fil: k.fil, omdome };
            granskade.push(g);
            const godk = valjBasta([g], prioritet) !== null;
            logg = patchaKlipp(logg, k.fil, {
                status: godk ? 'godkänd' : 'avvisad', betyg: omdome.betyg, motivering: omdome.motivering || omdome.brott.join(', '),
                textrader: omdome.textrader, tema: k.tema === 'okant' ? omdome.tema : k.tema,
            });
            log(beskrivOmdome(g));
        } catch (e) {
            log(`${k.fil}: granskningen föll: ${(e as Error).message}`);
        }
    }
    return { logg, val: valjBasta(granskade, prioritet) };
}

interface ByggVal {
    uteslutKlipp: string[];
    uteslutEvent: string[];
    omgang: number;
    /** Satt när dagens tema inte gick att bygga: reserven tar över (aldrig samma tema igen). */
    reservTema?: Tema;
}

/** Dagens inlägg som filer + Inlagg-objekt. Returnerar uppdaterad logg. */
async function byggUtkast(logg: Logg, ctx: Kontext, val: ByggVal): Promise<{ logg: Logg; utkast: Utkast }> {
    const nu = NU;
    const fro = `${DATUM}#${val.omgang}`;
    const provider = valdProvider();
    const lediga = ledigaKlipp(logg).filter(k => !val.uteslutKlipp.includes(k.fil));
    let temaVal = valjTema(DATUM, {
        klipp: lediga, tidigare: logg.inlagg, tvinga: val.reservTema ?? TVINGA, vikter: logg.vikter, milstolpe: !!oanvandMilstolpe(logg),
    });
    if (val.reservTema) temaVal = { ...temaVal, reserv: true, motivering: `reserv: ${temaVal.motivering}` };
    log(`tema: ${temaVal.tema}${temaVal.variant ? `/${temaVal.variant}` : ''} (${temaVal.form}) - ${temaVal.motivering}`);
    /** Dagens tema gick inte att bygga: siffra går alltid. */
    const reserv = (varfor: string): Promise<{ logg: Logg; utkast: Utkast }> => {
        if (val.reservTema === 'siffra') throw new Error(`inte ens reserven gick: ${varfor}`);
        log(`${varfor}, bygger reserv (siffra)`);
        return byggUtkast(logg, ctx, { ...val, omgang: val.omgang + 1, reservTema: 'siffra' });
    };

    // Video: granskaren väljer klipp. Inget godkänt -> reserv via hjulet utan klipp.
    if (temaVal.form === 'video') {
        const prioritet = temaVal.tema === 'video'
            ? (KLIPP_PRIORITET[veckodagFor(DATUM)] ?? KLIPP_PRIORITET[2])
            : [temaVal.klipp!.tema];
        const r = await granskaKlipp(logg, prioritet, val.uteslutKlipp, provider);
        logg = r.logg;
        if (!r.val) {
            log('inget godkänt klipp, bygger reserv');
            temaVal = valjTema(DATUM, { klipp: [], tidigare: logg.inlagg, tvinga: TVINGA === 'video' ? undefined : TVINGA, vikter: logg.vikter, milstolpe: !!oanvandMilstolpe(logg) });
            if (temaVal.form === 'video') temaVal = { ...temaVal, form: 'bild', klipp: undefined };
        } else {
            const klipp = logg.klipp.find(k => k.fil === r.val!.fil)!;
            const klippTema: KlippTema = temaVal.tema === 'video' ? r.val.omdome.tema : klipp.tema;
            const data: TextData = {};
            const text = byggText({ tema: temaVal.tema, variant: temaVal.tema === 'video' ? klippTema : temaVal.variant, data, fro });
            const brott = kontrolleraBada(text, data);
            if (brott.length) throw new Error(`videotexten bryter mot reglerna: ${brott.join('; ')}`);
            const foreslagna = r.val.omdome.textrader.filter(t => kontrolleraTextrad(t, data).length === 0);
            const textrader: [string, string] = foreslagna.length === 2 ? [foreslagna[0], foreslagna[1]] : textraderFor(klippTema, data);
            const media = await byggVideo(klipp, textrader, data);
            const inlagg = nyttInlagg({ ...temaVal, variant: temaVal.tema === 'video' ? klippTema : temaVal.variant }, text, data,
                { typ: 'video', fil: media }, { media: { typ: 'video', fil: media, kandidater: [{ fil: klipp.fil, betyg: r.val.omdome.betyg, motivering: r.val.omdome.motivering }] } });
            skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
            return { logg, utkast: { inlagg, media, klipp } };
        }
    }

    // Bildteman.
    switch (temaVal.tema) {
        case 'siffra': {
            const s = siffror(ctx.events, nu, ctx.orter);
            const variant = temaVal.variant === 'helg' && s.toppStad ? 'helg' : 'vecka';
            const text = byggText({ tema: 'siffra', variant, data: s.data, fro });
            const brott = kontrolleraBada(text, s.data); if (brott.length) throw new Error(brott.join('; '));
            const media = variant === 'helg'
                ? await renderaKort('siffra', { tal: String(s.data.helgGolv), rad: 'event i helgen, i hela Sverige', under: `Flest i ${s.toppStad}` }, path.join(UTKAST, 'bild.png'))
                : await renderaKort('siffra', { tal: String(s.data.veckaGolv), rad: 'event i Sverige den här veckan', under: `${s.data.idagGolv} bara i dag` }, path.join(UTKAST, 'bild.png'));
            skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
            return { logg, utkast: { inlagg: nyttInlagg({ ...temaVal, variant }, text, s.data, { typ: 'bild', fil: media }), media } };
        }
        case 'gissa': {
            const k = gissaKandidater(ctx.events, ctx.orter, nu, val.uteslutEvent);
            if (k.length < 3) return reserv('för få kandidater till spelet');
            const data = { ...gissaData(k), k1Id: k[0].id, k2Id: k[1].id, k3Id: k[2].id };
            const text = byggText({ tema: 'gissa', data, fro });
            const brott = kontrolleraBada(text, data); if (brott.length) throw new Error(brott.join('; '));
            const media = await renderaKort('brickor', {
                rubrik: 'Vilket öppnar flest i dag?',
                brickor: k.map((x, i) => ({ nr: String(i + 1), emoji: x.emoji, titel: x.titel, under: x.stad })),
                fot: 'Gissa i kommentarerna, svaret i morgon',
            }, path.join(UTKAST, 'bild.png'));
            skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
            return { logg, utkast: { inlagg: nyttInlagg(temaVal, text, data, { typ: 'bild', fil: media }), media, kandidater: k } };
        }
        case 'helg': {
            const h = helgStad(ctx.events, ctx.stadssidor, nu, staderAnvanda(logg, 'helg', 28, DATUM));
            if (!h) {
                log('ingen stad med nog helgevent, bygger reserv (siffra helg)');
                const s = siffror(ctx.events, nu, ctx.orter);
                const text = byggText({ tema: 'siffra', variant: 'helg', data: s.data, fro });
                const brott = kontrolleraBada(text, s.data); if (brott.length) throw new Error(brott.join('; '));
                const media = await renderaKort('siffra', { tal: String(s.data.helgGolv), rad: 'event i helgen, i hela Sverige' }, path.join(UTKAST, 'bild.png'));
                skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
                return { logg, utkast: { inlagg: nyttInlagg({ ...temaVal, tema: 'siffra', variant: 'helg', reserv: true }, text, s.data, { typ: 'bild', fil: media }), media } };
            }
            const slug = citySlugFor(h.stad);
            const lank = slug ? `${LANK_BAS}/evenemang/${slug}` : LANK_BAS;
            const klipp = helgKlipp(ledigaKlipp(logg).filter(k => !val.uteslutKlipp.includes(k.fil)), stadSlug(h.stad));
            if (klipp) {
                const text = byggText({ tema: 'video', variant: 'helg', data: h.data, fro, stad: h.stad, lank });
                const brott = kontrolleraBada(text, h.data); if (brott.length) throw new Error(brott.join('; '));
                const media = await byggVideo(klipp, textraderFor('helg', h.data), h.data);
                skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
                return { logg, utkast: { inlagg: nyttInlagg({ ...temaVal, form: 'video' }, text, h.data, { typ: 'video', fil: media }, { stad: h.stad }), media, klipp } };
            }
            const text = byggText({ tema: 'helg', data: h.data, fro, stad: h.stad, lank });
            const brott = kontrolleraBada(text, h.data); if (brott.length) throw new Error(brott.join('; '));
            const media = await renderaKort('rubrik', {
                tal: talMedPlus(h.antal), rubrik: `event i ${h.stad} i helgen`,
                under: h.topp.map(t => `${t.emoji} ${t.titel}`).join('  ·  '),
            }, path.join(UTKAST, 'bild.png'));
            skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
            return { logg, utkast: { inlagg: nyttInlagg(temaVal, text, h.data, { typ: 'bild', fil: media }, { stad: h.stad }), media } };
        }
        case 'quiz': {
            const q = quizForStad(ctx.events, ctx.stadssidor, ctx.orter, nu, staderAnvanda(logg, 'quiz', 56, DATUM));
            if (!q) return reserv('ingen stad gav ett tydligt quiz');
            const text = byggText({ tema: 'quiz', data: q.data, fro, stad: q.stad });
            const brott = kontrolleraBada(text, q.data); if (brott.length) throw new Error(brott.join('; '));
            const media = await renderaKort('brickor', {
                rubrik: q.fraga,
                brickor: q.alternativ.map((a, i) => ({ nr: String(i + 1), emoji: ['🌙', '☀️', '🎉'][i], titel: a })),
                fot: 'Svaret kommer i morgon',
            }, path.join(UTKAST, 'bild.png'));
            skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
            return { logg, utkast: { inlagg: nyttInlagg(temaVal, text, q.data, { typ: 'bild', fil: media }, { stad: q.stad, uppfoljning: { svar: quizKommentar(q) } }), media } };
        }
        default: {
            // budskap (bild)
            const variant = temaVal.variant ?? 'skapa-eget';
            const data: TextData = {};
            let kort: { etikett: string; rubrik: string; under: string };
            const m = variant === 'milstolpe' ? oanvandMilstolpe(logg) : undefined;
            if (variant === 'milstolpe' && !m) return reserv('ingen oanvänd milstolpe');
            if (m) {
                data.milstolpe = m.text;
                kort = { etikett: 'Milstolpe', rubrik: m.text, under: 'Tack till alla som använder kartan och tipsar om event.' };
            } else if (variant === 'appen') {
                kort = { etikett: 'Appen', rubrik: 'VADKUL finns som app', under: 'Allt som händer nära dig, i fickan. iPhone i App Store, Android i sluten test.' };
            } else if (variant === 'bjud-med') {
                kort = { etikett: 'Bjud med', rubrik: 'Vem bjuder du med?', under: 'Hitta något i helgen och skicka det till en vän.' };
            } else {
                kort = { etikett: 'Lägg upp ditt eget', rubrik: 'Har du ett event på gång?', under: 'Lägg upp det själv på kartan. Gratis, tar en minut.' };
            }
            const lank = variant === 'appen' ? `${LANK_BAS}/about` : LANK_BAS;
            const text = byggText({ tema: 'budskap', variant, data, fro, lank });
            const brott = kontrolleraBada(text, data); if (brott.length) throw new Error(brott.join('; '));
            const media = await renderaKort('rubrik', kort, path.join(UTKAST, 'bild.png'));
            skrivUtkast('text-fb.txt', text.fb); skrivUtkast('text-ig.txt', text.ig);
            return { logg, utkast: { inlagg: nyttInlagg({ ...temaVal, variant }, text, data, { typ: 'bild', fil: media }), media } };
        }
    }
}

// --- Publicering -------------------------------------------------------------------

async function laddaUpp(utkast: Utkast): Promise<string> {
    if (utkast.inlagg.media.url) return utkast.inlagg.media.url;
    const url = utkast.inlagg.form === 'video'
        ? await laddaUppVideo(utkast.media)
        : await laddaUppBild(utkast.media, `${DATUM}-${utkast.inlagg.tema}`);
    utkast.inlagg.media.url = url;
    return url;
}

async function publicera(logg: Logg, utkast: Utkast): Promise<Logg> {
    const { inlagg } = utkast;
    const url = await laddaUpp(utkast);
    const meta: NonNullable<Inlagg['meta']> = {};
    const uppfoljning = { ...(inlagg.uppfoljning ?? {}) };

    if (inlagg.tema === 'gissa' && utkast.kandidater) {
        uppfoljning.baslinje = await lasMatvarden(utkast.kandidater.map(k => ({ id: k.id, slug: k.slug })));
    }

    if (isFacebookConfigured()) {
        meta.fbPostId = inlagg.form === 'video'
            ? await postVideoToFacebook(url, inlagg.text.fb, { title: `VADKUL ${DATUM}` })
            : await postToFacebook(inlagg.text.fb, [url], 1);
        meta.permalink = await getFacebookPostPermalink(meta.fbPostId).catch(() => undefined);
        log(`Facebook: ${meta.fbPostId}`);
    } else {
        log('Facebook ej konfigurerat, hoppar över');
    }
    if (isInstagramConfigured()) {
        try {
            meta.igMediaId = inlagg.form === 'video'
                ? await postReelToInstagram(inlagg.text.ig, url)
                : await postToInstagram(inlagg.text.ig, [url], 1);
            log(`Instagram: ${meta.igMediaId}`);
        } catch (e) {
            log(`Instagram föll: ${(e as Error).message}`);
            inlagg.fel = `ig: ${(e as Error).message}`;
        }
    }
    const publicerad = { ...inlagg, status: 'publicerad' as const, publicerad: Date.now(), meta, uppfoljning };
    logg = uppsertInlagg(logg, publicerad);
    if (utkast.klipp) logg = patchaKlipp(logg, utkast.klipp.fil, { status: 'använd', anvantI: DATUM });
    if (inlagg.variant === 'milstolpe' && typeof inlagg.data.milstolpe === 'string') logg = markeraMilstolpe(logg, inlagg.data.milstolpe);
    sparaLogg(logg);
    await sendMessage(`✅ Ute: ${esc(inlagg.tema)}${meta.permalink ? `\n${meta.permalink}` : ''}${meta.igMediaId ? '\nInstagram: publicerat' : ''}`);
    return logg;
}

// --- Uppföljning ------------------------------------------------------------------------

async function foljUpp(logg: Logg, ctx: Kontext): Promise<Logg> {
    const nu = Date.now();
    for (const i of oavslutadUppfoljning(logg)) {
        if (!i.publicerad || nu - i.publicerad < 18 * 3_600_000) continue;
        let kommentar: string | undefined;
        if (i.tema === 'gissa') {
            const ids = ['k1Id', 'k2Id', 'k3Id'].map(n => String(i.data[n] ?? ''));
            const kand = ids.map((id, n) => {
                const e = ctx.events.find(x => x.id === id);
                return { id, titel: String(i.data[`k${n + 1}Titel`] ?? ''), stad: String(i.data[`k${n + 1}Stad`] ?? ''), ps: e?.ps ?? 0, slug: '' };
            });
            const nuPoang = await lasMatvarden(kand.map(k => ({ id: k.id, slug: eventShareSlug(k.id) })));
            kommentar = vinnarKommentar(avgorVinnare(kand, i.uppfoljning?.baslinje ?? {}, nuPoang));
        } else if (i.tema === 'quiz') {
            kommentar = i.uppfoljning?.svar;
        }
        if (!kommentar) { logg = patchaInlagg(logg, i.id, { uppfoljning: { ...i.uppfoljning, klar: true } }); continue; }
        const upp = { ...(i.uppfoljning ?? {}), svar: kommentar, klar: true };
        try {
            if (i.meta?.fbPostId) upp.fbKommentarId = await commentOnFacebookPost(i.meta.fbPostId, kommentar);
            if (i.meta?.igMediaId) upp.igKommentarId = await commentOnInstagramMedia(i.meta.igMediaId, kommentar);
            log(`uppföljning ${i.id}: ${kommentar}`);
        } catch (e) {
            log(`uppföljning ${i.id} föll: ${(e as Error).message}`);
            upp.klar = false;
        }
        logg = patchaInlagg(logg, i.id, { uppfoljning: upp });
    }
    for (const i of utanInsikter(logg, nu)) {
        try {
            const ins: NonNullable<Inlagg['insikter']> = { hamtad: nu };
            if (i.meta?.fbPostId) ins.fb = tolkaFbInsikter(await fetchFacebookPostInsights(i.meta.fbPostId));
            if (i.meta?.igMediaId) ins.ig = tolkaIgInsikter(await fetchInstagramMediaInsights(i.meta.igMediaId, i.form));
            logg = patchaInlagg(logg, i.id, { insikter: ins });
            log(`insikter ${i.id}: fb ${ins.fb?.rackvidd ?? '-'} nådda, ig ${ins.ig?.rackvidd ?? '-'} nådda`);
        } catch (e) {
            log(`insikter ${i.id} föll: ${(e as Error).message}`);
        }
    }
    sparaLogg(logg);
    return logg;
}

async function rapport(logg: Logg): Promise<Logg> {
    const veckodag = stockholmVeckodag(Date.now());
    const sondag = veckodag === 0 ? DATUM : plusDagar(DATUM, -veckodag);
    const mandag = plusDagar(sondag, -6);
    const forslag = viktaTeman(perTema(logg.inlagg));
    const text = veckorapport(logg.inlagg, mandag, sondag)
        + (Object.keys(forslag).length ? `\n\nFöreslagna vikter (sätts för hand i loggen): ${Object.entries(forslag).map(([t, v]) => `${t} ${v}`).join(', ')}` : '')
        + `\n\nInkorgen: ${ledigaKlipp(logg).length} lediga klipp.`;
    await sendMessage(text);
    console.log(text);
    return logg;
}

// --- Vetofönstret -------------------------------------------------------------------------

function taLas(): void {
    if (fs.existsSync(LOCK_FILE)) {
        const pid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
        try { process.kill(pid, 0); throw new Error(`dagsinlägget kör redan (PID ${pid})`); } catch (e) {
            if ((e as Error).message.startsWith('dagsinlägget')) throw e;
        }
    }
    fs.writeFileSync(LOCK_FILE, String(process.pid));
}
function slappLas(): void { try { fs.unlinkSync(LOCK_FILE); } catch { /* redan borta */ } }

async function forhandsvisa(utkast: Utkast, publiceraEfter: number): Promise<void> {
    const i = utkast.inlagg;
    const rubrik = `<b>Dagsinlägget ${DATUM}: ${esc(i.tema)}${i.variant ? `/${esc(i.variant)}` : ''}${i.stad ? ` (${esc(i.stad)})` : ''}</b>`;
    const klock = new Date(publiceraEfter).toLocaleTimeString('sv-SE', { timeZone: 'Europe/Stockholm', hour: '2-digit', minute: '2-digit' });
    const fot = `<i>Publiceras ${klock}. Svara nej (stoppa), ja (nu), byt (nästa), text: ... (egen text)</i>`;
    const text = `${rubrik}\n\n${esc(i.text.fb)}\n\n${fot}`;
    const url = await laddaUpp(utkast);
    if (i.form === 'video') await sendVideo(url, text); else await sendPhoto(url, text);
    if (i.text.ig !== i.text.fb) await sendMessage(`Instagram-texten:\n\n${esc(i.text.ig)}`);
}

async function korMorgonen(logg: Logg, ctx: Kontext): Promise<Logg> {
    taLas();
    let vetad = false;
    const stopp = (): void => { vetad = true; };
    process.on('SIGTERM', stopp);
    try {
        logg = await foljUpp(logg, ctx);
        const befintligt = logg.inlagg.find(i => i.id === DATUM);
        if (befintligt?.status === 'publicerad') { log('dagens inlägg är redan publicerat'); return logg; }

        const val: ByggVal = { uteslutKlipp: [], uteslutEvent: [], omgang: 0 };
        let byggt = await byggUtkast(logg, ctx, val);
        logg = uppsertInlagg(byggt.logg, byggt.utkast.inlagg);
        sparaLogg(logg);

        const nu = Date.now();
        const publiceraEfter = PUBLICERA_NU ? nu : Math.max(stockholmTid(DATUM, PUBLICERINGSTID).getTime(), nu + 15 * 60_000);
        await flushPendingUpdates();
        await forhandsvisa(byggt.utkast, publiceraEfter);
        logg = patchaInlagg(logg, DATUM, { status: 'väntar', publiceraEfter, media: byggt.utkast.inlagg.media });
        sparaLogg(logg);

        let publiceraNu = PUBLICERA_NU;
        while (!vetad && !publiceraNu && Date.now() < publiceraEfter) {
            const m = await waitForMessage(Math.min(publiceraEfter - Date.now(), 60_000));
            if (vetad) break;
            if (!m) continue;
            if (m.media) {
                try {
                    const k = await sparaInkommetKlipp(m.media, INKORG);
                    await sendMessage(`🎬 Klipp mottaget: <code>${esc(k.fil)}</code> (tema: ${k.tema}). Granskas nästa morgon.`);
                } catch (e) { await sendMessage(`⚠️ Kunde inte spara klippet: ${esc((e as Error).message)}`); }
                continue;
            }
            const svar = (m.text ?? '').trim();
            const lagt = svar.toLowerCase().replace(/^\//, '');
            if (['nej', 'stopp', 'stop', 'vänta', 'avbryt', 'cancel'].includes(lagt)) { vetad = true; break; }
            if (['ja', 'ok', 'kör', 'nu', 'publicera'].includes(lagt)) { publiceraNu = true; break; }
            if (lagt === 'byt') {
                if (byggt.utkast.klipp) val.uteslutKlipp.push(byggt.utkast.klipp.fil);
                if (byggt.utkast.kandidater) val.uteslutEvent.push(...byggt.utkast.kandidater.map(k => k.id));
                val.omgang++;
                try {
                    byggt = await byggUtkast(logg, ctx, val);
                    logg = uppsertInlagg(byggt.logg, { ...byggt.utkast.inlagg, status: 'väntar', publiceraEfter });
                    sparaLogg(logg);
                    await forhandsvisa(byggt.utkast, publiceraEfter);
                } catch (e) { await sendMessage(`⚠️ Kunde inte bygga om: ${esc((e as Error).message)}`); }
                continue;
            }
            if (/^text\s*:/i.test(svar)) {
                const ny = svar.replace(/^text\s*:\s*/i, '');
                const igNy = byggt.utkast.inlagg.text.ig.includes('\n\n#') ? `${ny.replace(/https?:\/\/\S+|vadkul\.se\S*/gi, 'Länk i bion ☁️')}\n\n${byggt.utkast.inlagg.text.ig.split('\n\n#').pop()!.replace(/^/, '#')}` : ny;
                const text = { fb: ny, ig: igNy };
                const brott = kontrolleraBada(text, byggt.utkast.inlagg.data);
                if (brott.length) { await sendMessage(`⚠️ Texten bryter mot reglerna: ${esc(brott.join('; '))}. Behåller den gamla.`); continue; }
                byggt.utkast.inlagg.text = text;
                logg = patchaInlagg(logg, DATUM, { text }); sparaLogg(logg);
                await sendMessage('✍️ Ny text sparad.');
                continue;
            }
            await sendMessage('Dagsinlägget väntar. Svara <code>nej</code>, <code>ja</code>, <code>byt</code> eller <code>text: ...</code>.');
        }

        if (vetad) {
            logg = patchaInlagg(logg, DATUM, { status: 'vetad' }); sparaLogg(logg);
            await sendMessage('🛑 Dagens inlägg stoppat.');
            return logg;
        }
        logg = await publicera(logg, byggt.utkast);
        if (stockholmVeckodag(Date.now()) === 0) logg = await rapport(logg);
        return logg;
    } finally {
        process.off('SIGTERM', stopp);
        slappLas();
    }
}

// --- Kolla ------------------------------------------------------------------------------

async function kolla(ctx: Kontext): Promise<void> {
    const rad = (ok: boolean, s: string): void => console.log(`${ok ? '✅' : '❌'} ${s}`);
    rad(ctx.aggregatAlder < 36 * 3_600_000, `aggregatet är ${(ctx.aggregatAlder / 3_600_000).toFixed(1)} h gammalt (${ctx.events.length} event, ${ctx.stadssidor.length} städer med stadssida)`);
    rad(isFacebookConfigured(), 'Facebook: FB_PAGE_ID + FB_PAGE_TOKEN');
    rad(isInstagramConfigured(), 'Instagram: IG_USER_ID');
    if (isFacebookConfigured()) {
        try {
            const t = await getTokenScopes();
            rad(t.valid, `sidtoken giltig${t.expiresAt ? `, går ut ${new Date(t.expiresAt).toISOString().slice(0, 10)}` : ', går aldrig ut'}`);
            for (const s of SCOPES_KRAV) rad(t.scopes.includes(s), `scope ${s}`);
        } catch (e) { rad(false, `debug_token: ${(e as Error).message}`); }
    }
    rad(harStorage(), 'Storage-bucket (service-account.json)');
    rad(isTelegramConfigured(), 'Telegram: TG_BOT_TOKEN + TG_CHAT_ID');
    const provider = valdProvider();
    rad(provider === 'claude' ? !!process.env.ANTHROPIC_API_KEY : true, `granskare: ${provider}${provider === 'ollama' ? ' (sätt ANTHROPIC_API_KEY för Claude)' : ''}`);
    try { const { execFileSync } = await import('child_process'); execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); rad(true, 'ffmpeg'); } catch { rad(false, 'ffmpeg saknas i PATH'); }
    rad(fs.existsSync(path.join(ROT, 'assets', 'fonts', 'Fredoka-Bold.ttf')), 'Fredoka i assets/fonts');
    const klipp = listaInkorg(INKORG);
    rad(true, `inkorgen ${INKORG}: ${klipp.length} klipp`);
    try { await slutkort(); rad(true, 'slutkortet renderat'); } catch (e) { rad(false, `slutkortet: ${(e as Error).message}`); }
}

// --- Main --------------------------------------------------------------------------------

async function main(): Promise<void> {
    loadSocialSecrets();
    if (!LAGE) {
        console.log('Ange ett läge: --kör | --planera | --provkör | --publicera | --följ-upp | --rapport | --kolla  (se filhuvudet)');
        process.exit(1);
    }
    if (TVINGA && !TEMAN.includes(TVINGA)) throw new Error(`okänt tema: ${TVINGA} (${TEMAN.join(', ')})`);
    const ctx = laddaAggregat();
    if (ctx.aggregatAlder > 3 * 86_400_000) log(`⚠️ aggregatet är ${Math.round(ctx.aggregatAlder / 86_400_000)} dygn gammalt`);
    let logg = laddaLogg();
    const inkorgFiler = listaInkorg(INKORG);
    logg = rensaForsvunnaKlipp(registreraKlipp(logg, inkorgFiler, Date.now()), inkorgFiler);
    log(`${DATUM}, ${ledigaKlipp(logg).length} lediga klipp i inkorgen, ${logg.inlagg.length} inlägg i loggen`);

    switch (LAGE) {
        case 'kolla': await kolla(ctx); break;
        case 'följ-upp': await foljUpp(logg, ctx); break;
        case 'rapport': await rapport(logg); break;
        case 'provkör': {
            const { logg: l2, utkast } = await byggUtkast(logg, ctx, { uteslutKlipp: [], uteslutEvent: [], omgang: 0 });
            if (!PROVISIONELL) sparaLogg(uppsertInlagg(l2, utkast.inlagg));
            console.log(`\n${utkast.inlagg.text.fb}\n\n--- Instagram ---\n${utkast.inlagg.text.ig}\n\nMedia: ${utkast.media}\nData: ${JSON.stringify(utkast.inlagg.data)}`);
            break;
        }
        case 'planera': {
            const { logg: l2, utkast } = await byggUtkast(logg, ctx, { uteslutKlipp: [], uteslutEvent: [], omgang: 0 });
            logg = uppsertInlagg(l2, utkast.inlagg); sparaLogg(logg);
            await flushPendingUpdates();
            await forhandsvisa(utkast, stockholmTid(DATUM, PUBLICERINGSTID).getTime());
            logg = patchaInlagg(logg, DATUM, { media: utkast.inlagg.media }); sparaLogg(logg);
            console.log(`\n${utkast.inlagg.text.fb}\n\nPlanerat. Kör --publicera för att skicka ut det.`);
            break;
        }
        case 'publicera': {
            const i = logg.inlagg.find(x => x.id === DATUM);
            if (!i || i.status === 'publicerad') throw new Error(i ? 'dagens inlägg är redan publicerat' : 'inget planerat inlägg i dag (kör --planera först)');
            const kandidater = i.tema === 'gissa'
                ? gissaKandidater(ctx.events, ctx.orter, Date.now()).filter(k => [i.data.k1Id, i.data.k2Id, i.data.k3Id].includes(k.id))
                : undefined;
            const klipp = i.media.kandidater?.[0] ? logg.klipp.find(k => k.fil === i.media.kandidater![0].fil) : undefined;
            await publicera(logg, { inlagg: i, media: i.media.fil, kandidater, klipp });
            break;
        }
        case 'kör': await korMorgonen(logg, ctx); break;
    }
}

main().catch(e => {
    console.error(`[dagsinlägg] ❌ ${(e as Error).stack ?? e}`);
    sendMessage(`❌ Dagsinlägget föll: ${esc((e as Error).message)}`).finally(() => process.exit(1));
});
