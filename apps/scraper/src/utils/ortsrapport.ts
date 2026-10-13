/**
 * ortsrapport.ts - underlaget till en kommun (docs/outreach/kommunstrategi.md).
 *
 * Två A4-sidor med VADKUL-loggan som kommunen kan skriva ut, lägga i diariet och
 * ta med till ett möte: ortsrapporten (vad som finns för orten på vadkul.se de
 * kommande 30 dagarna, och grannorterna bredvid), ett faktablad om vadkul.se och
 * tre förslag med kryssrutor. Gissningsfrågan överst ("vilken veckodag händer
 * minst?") får läsaren att vända blad, svaret står på sidan 2.
 *
 * Skriv för diariet: saklig ton och bara siffror som går att räkna fram ur
 * spegeln. Ren logik och HTML utan I/O, testas i ortsrapport.test.ts.
 * Skriptet scripts/ortsrapport.ts läser SQLite-spegeln och skriver HTML + PDF.
 */

import { arrangorTyp, ArrangorTyp } from './arrangorTyp';
import { belongsToTown, distanceKm, TownPoint } from './townBoundary';

export interface RapportEvent {
    url: string;
    title?: string | null;
    time: string;                 // ISO
    lat: number;
    lng: number;
    hostName?: string | null;
    category?: string | null;
    locationName?: string | null;
    extractedAddress?: string | null;
}

export interface Ort extends TownPoint {
    pop?: number;                 // kommunens folkmängd
}

export const KATEGORI_NAMN: Record<string, string> = {
    music: 'Musik', stage: 'Scen', art: 'Konst', sport: 'Sport & träning', food: 'Mat & dryck',
    market: 'Marknad', party: 'Fest & uteliv', social: 'Socialt & spel', course: 'Kurs & föreläsning',
    family: 'Familj & barn', other: 'Övrigt',
};

export const VECKODAGAR = ['måndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'lördag', 'söndag'];
const DAG_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
const VECKODAG_FMT = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Stockholm', weekday: 'short' });
const DATUM_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long' });
const DATUM_AR_FMT = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', day: 'numeric', month: 'long', year: 'numeric' });
const DAG_MS = 86_400_000;
/** Färre evenemang än så och arrangören namnges inte (kan vara en privatperson, t.ex. en artist). */
export const MIN_NAMNGIVEN = 3;

export function veckodag(d: Date): number {
    return DAG_INDEX[VECKODAG_FMT.format(d)];
}

/** "Visit Eskilstuna — Evenemangsguiden" -> "Visit Eskilstuna - Evenemangsguiden". */
export function visningsnamn(s: string): string {
    return s.replace(/\s*[—–]\s*/g, ' - ').replace(/\s+/g, ' ').trim();
}

export interface Antal { namn: string; antal: number }

export interface OrtStatistik {
    ort: string;
    pop?: number;
    fran: string;                 // ISO, början av perioden
    dagar: number;
    antal: number;
    per10k?: number;
    arrangorer: number;
    typer: Record<ArrangorTyp, number>;
    storstaLokala: Antal[];
    kategorier: Antal[];
    /** Snitt per dag för måndag..söndag i perioden. */
    perVeckodag: number[];
    kalender?: { doman: string; antal: number };
}

export interface RaknaVal {
    fran: Date;
    dagar?: number;
    /** Längre bort än så räknas aldrig, hur glest grannorterna än ligger. */
    maxKm?: number;
    /** Kommunens egen evenemangskalender, t.ex. visiteskilstuna.se. */
    kalenderDoman?: string;
}

function varden(m: Map<string, number>, n: number): Antal[] {
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'sv'))
        .slice(0, n).map(([namn, antal]) => ({ namn, antal }));
}

function urlDoman(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

/** Eventen som hör till orten (närmast den, eller orten i adressen) i perioden. */
export function ortensEvent(events: RapportEvent[], ort: Ort, orter: TownPoint[], val: RaknaVal): RapportEvent[] {
    const fran = val.fran.getTime();
    const till = fran + (val.dagar ?? 30) * DAG_MS;
    const maxKm = val.maxKm ?? 40;
    return events.filter((e) => {
        const t = Date.parse(e.time);
        if (!(t >= fran && t < till)) return false;
        if (distanceKm(e.lat, e.lng, ort.lat, ort.lng) > maxKm) return false;
        return belongsToTown(e, ort, orter);
    });
}

export function raknaOrt(events: RapportEvent[], ort: Ort, orter: TownPoint[], val: RaknaVal): OrtStatistik {
    const dagar = val.dagar ?? 30;
    const egna = ortensEvent(events, ort, orter, val);
    const typer: Record<ArrangorTyp, number> = { lokal: 0, riks: 0, plattform: 0 };
    const arrangorer = new Set<string>();
    const lokala = new Map<string, number>();
    const kategorier = new Map<string, number>();
    const perDag = [0, 0, 0, 0, 0, 0, 0];
    let kalender = 0;
    const doman = val.kalenderDoman?.toLowerCase().replace(/^www\./, '');

    for (const e of egna) {
        const typ = arrangorTyp(e.hostName, { bibliotekLokala: true });
        typer[typ]++;
        const host = visningsnamn(e.hostName ?? '');
        if (host) arrangorer.add(host.toLowerCase());
        if (typ === 'lokal' && host) lokala.set(host, (lokala.get(host) ?? 0) + 1);
        const kat = KATEGORI_NAMN[e.category ?? ''] ?? null;
        if (kat && kat !== 'Övrigt') kategorier.set(kat, (kategorier.get(kat) ?? 0) + 1);
        perDag[veckodag(new Date(e.time))]++;
        if (doman) {
            const d = urlDoman(e.url);
            if (d === doman || d.endsWith(`.${doman}`)) kalender++;
        }
    }

    // Hur många måndagar, tisdagar ... perioden har, så att snittet blir rättvist.
    const forekomster = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < dagar; i++) forekomster[veckodag(new Date(val.fran.getTime() + i * DAG_MS + DAG_MS / 2))]++;

    return {
        ort: ort.name,
        pop: ort.pop,
        fran: val.fran.toISOString(),
        dagar,
        antal: egna.length,
        per10k: ort.pop ? Math.round((egna.length / (ort.pop / 10_000)) * 10) / 10 : undefined,
        arrangorer: arrangorer.size,
        typer,
        storstaLokala: varden(lokala, 6).filter((r) => r.antal >= MIN_NAMNGIVEN),
        kategorier: varden(kategorier, 6),
        perVeckodag: perDag.map((n, i) => (forekomster[i] ? Math.round((n / forekomster[i]) * 10) / 10 : 0)),
        kalender: doman ? { doman, antal: kalender } : undefined,
    };
}

export interface Granne { ort: string; antal: number; per10k?: number; avstandKm: number }

/** De närmaste orterna med känd folkmängd, räknade på samma sätt som orten själv. */
export function grannar(events: RapportEvent[], ort: Ort, kandidater: Ort[], orter: TownPoint[],
                        val: RaknaVal, antal = 5, maxAvstandKm = 150): Granne[] {
    return kandidater
        .filter((k) => k.name.toLowerCase() !== ort.name.toLowerCase() && k.pop)
        .map((k) => ({ k, km: distanceKm(ort.lat, ort.lng, k.lat, k.lng) }))
        .filter(({ km }) => km <= maxAvstandKm)
        .sort((a, b) => a.km - b.km)
        .slice(0, antal)
        .map(({ k, km }) => {
            const n = ortensEvent(events, k, orter, val).length;
            return { ort: k.name, antal: n, per10k: Math.round((n / (k.pop! / 10_000)) * 10) / 10,
                     avstandKm: Math.round(km) };
        });
}

export interface Gissning { fraga: string; alternativ: string[]; ratt: number; dag: number }

/**
 * Gissningsfrågan: vilken veckodag händer minst? Tre alternativ i veckoordning:
 * den lugnaste dagen, den livligaste och en dag mitt emellan.
 */
export function gissning(s: OrtStatistik): Gissning {
    const ordning = s.perVeckodag.map((n, i) => ({ n, i })).sort((a, b) => a.n - b.n || a.i - b.i);
    const lugnast = ordning[0].i;
    const dagar = [lugnast, ordning[6].i, ordning[3].i].sort((a, b) => a - b);
    return {
        fraga: `Vilken veckodag händer det minst i ${s.ort}?`,
        alternativ: dagar.map((d) => VECKODAGAR[d]),
        ratt: dagar.indexOf(lugnast),
        dag: lugnast,
    };
}

// --- HTML ----------------------------------------------------------------------------

export function esc(s: unknown): string {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const tal = (n: number) => n.toLocaleString('sv-SE').replace(/ /g, ' ');
const decimal = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });
const BOKSTAVER = ['A', 'B', 'C'];

export interface Dokument {
    statistik: OrtStatistik;
    grannar: Granne[];
    /** Till vem, t.ex. "Kultur- och fritidsförvaltningen, Eskilstuna kommun". */
    mottagare: string;
    datum: Date;
    logga: string;                // data-URI
}

function rutor(s: OrtStatistik): string {
    const r: [string, string][] = [
        [tal(s.antal), `evenemang de kommande ${s.dagar} dagarna`],
        [tal(s.arrangorer), 'olika arrangörer'],
    ];
    if (s.per10k !== undefined) r.push([decimal(s.per10k), 'evenemang per 10 000 invånare']);
    if (s.kalender) r.push([tal(s.kalender.antal), `från kommunens kalender (${s.kalender.doman})`]);
    return r.map(([v, t]) => `<div class="ruta"><b>${esc(v)}</b><span>${esc(t)}</span></div>`).join('');
}

function sammansattning(s: OrtStatistik): string {
    const delar: [ArrangorTyp, string, string][] = [
        ['lokal', 'Lokala arrangörer', 'scener, föreningar, museer, bibliotek och kommunens övriga verksamheter'],
        ['riks', 'Riksorganisationer', 'församlingar, studieförbund, PRO, Korpen m.fl.'],
        ['plattform', 'Biljettplattformar', 'Tickster, Ticketmaster m.fl., där arrangören inte syns'],
    ];
    const pct = (n: number) => (s.antal ? Math.round((n / s.antal) * 100) : 0);
    const stapel = delar.filter(([k]) => s.typer[k] > 0)
        .map(([k]) => `<i class="t-${k}" style="width:${(s.typer[k] / Math.max(s.antal, 1)) * 100}%"></i>`).join('');
    const rader = delar.map(([k, namn, forklaring]) =>
        `<li><i class="t-${k}"></i><b>${esc(namn)}: ${tal(s.typer[k])} (${pct(s.typer[k])} %)</b> <span>${esc(forklaring)}</span></li>`).join('');
    return `<div class="stapel">${stapel}</div><ul class="forklaring">${rader}</ul>`;
}

function lista(rader: Antal[], tom: string): string {
    if (!rader.length) return `<p class="dim">${esc(tom)}</p>`;
    return `<ol class="lista">${rader.map((r) => `<li><span>${esc(r.namn)}</span><b>${tal(r.antal)}</b></li>`).join('')}</ol>`;
}

function veckan(s: OrtStatistik, g: Gissning): string {
    const max = Math.max(...s.perVeckodag, 1);
    return `<div class="veckan">${s.perVeckodag.map((n, i) => `
        <div class="dag${i === g.dag ? ' lugnast' : ''}"><span class="v">${decimal(n)}</span>
          <i style="height:${Math.max(4, (n / max) * 100)}%"></i><span>${VECKODAGAR[i].slice(0, 3)}</span></div>`).join('')}
    </div>`;
}

function grannTabell(s: OrtStatistik, gr: Granne[]): string {
    const rader = [{ ort: s.ort, antal: s.antal, per10k: s.per10k, avstandKm: 0, egen: true },
                   ...gr.map((g) => ({ ...g, egen: false }))]
        .sort((a, b) => (b.per10k ?? 0) - (a.per10k ?? 0));
    return `<table class="grannar"><thead><tr><th>Ort</th><th>Evenemang</th><th>Per 10 000 inv.</th></tr></thead><tbody>
        ${rader.map((r) => `<tr${r.egen ? ' class="egen"' : ''}><td>${esc(r.ort)}${r.egen ? '' : ` <span class="dim">${r.avstandKm} km</span>`}</td>
          <td>${tal(r.antal)}</td><td>${r.per10k !== undefined ? decimal(r.per10k) : '-'}</td></tr>`).join('')}
      </tbody></table>`;
}

const FORSLAG = [
    ['En kontaktperson för evenemangskalendern', 'så att vi kan höra av oss när något ser fel ut, i stället för att gissa.', true],
    ['Föreningarna får veta att de syns gratis', 'till exempel en rad i kommunens föreningsinformation, bredvid andra kanaler.', false],
    ['Kalendern som öppna data', 'så att vi läser evenemangen direkt från er källa i stället för från webbsidan.', false],
] as const;

export function dokumentHtml(d: Dokument): string {
    const s = d.statistik;
    const g = gissning(s);
    const fran = new Date(s.fran);
    const till = new Date(fran.getTime() + (s.dagar - 1) * DAG_MS);
    const period = `${DATUM_FMT.format(fran)} - ${DATUM_AR_FMT.format(till)}`;
    const lugnast = VECKODAGAR[g.dag];
    const livligast = VECKODAGAR[s.perVeckodag.indexOf(Math.max(...s.perVeckodag))];

    return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<title>${esc(`Underlag: ${s.ort} på vadkul.se`)}</title>
<style>
  @page { size: A4; margin: 14mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  .sida { page-break-after: always; }
  .sida:last-child { page-break-after: auto; }
  header { display: flex; align-items: center; gap: 10px; border-bottom: 3px solid #006AA7; padding-bottom: 8px; margin-bottom: 14px; }
  header img { width: 38px; height: 38px; }
  header .namn { font-weight: 900; font-size: 17pt; color: #006AA7; letter-spacing: .5px; }
  header .till { margin-left: auto; text-align: right; font-size: 9pt; color: #475569; }
  h1 { font-size: 19pt; line-height: 1.2; margin: 0 0 6px; color: #0f172a; }
  h2 { font-size: 12pt; margin: 16px 0 6px; color: #006AA7; }
  p { margin: 0 0 8px; }
  .dim { color: #64748b; }
  .ingress { font-size: 11pt; }
  .gissa { border: 2px dashed #006AA7; border-radius: 10px; padding: 9px 12px; margin: 12px 0; background: #f0f7fc; }
  .gissa b { color: #006AA7; }
  .gissa .alt { display: flex; gap: 18px; margin-top: 4px; font-weight: 700; }
  .gissa .alt span::before { content: ""; display: inline-block; width: 11px; height: 11px; border: 1.5px solid #1e293b; border-radius: 3px; margin-right: 6px; vertical-align: -1px; }
  .rutor { display: flex; gap: 8px; margin: 10px 0 4px; }
  .ruta { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px; }
  .ruta b { display: block; font-size: 18pt; color: #006AA7; line-height: 1.1; }
  .ruta span { font-size: 8.5pt; color: #475569; }
  .stapel { display: flex; height: 14px; border-radius: 7px; overflow: hidden; margin: 6px 0 6px; }
  .stapel i { display: block; height: 100%; }
  .t-lokal { background: #006AA7; } .t-riks { background: #7fb3d5; } .t-plattform { background: #cbd5e1; }
  .forklaring { list-style: none; padding: 0; margin: 0; font-size: 9.5pt; }
  .forklaring li { margin: 2px 0; }
  .forklaring i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 6px; vertical-align: -1px; }
  .forklaring span { color: #64748b; }
  .tva { display: flex; gap: 22px; }
  .tva > div { flex: 1; }
  .lista { padding: 0; margin: 0; list-style: none; counter-reset: n; }
  .lista li { display: flex; justify-content: space-between; gap: 8px; border-bottom: 1px solid #e2e8f0; padding: 3px 0; font-size: 9.5pt; }
  .veckan { display: flex; align-items: flex-end; gap: 8px; height: 100px; margin: 8px 0 4px; }
  .dag { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; font-size: 8.5pt; }
  .dag i { display: block; width: 100%; background: #7fb3d5; border-radius: 4px 4px 0 0; }
  .dag.lugnast i { background: #FECC02; }
  .dag .v { color: #475569; margin-bottom: 2px; }
  .svar { background: #fff8d6; border-radius: 8px; padding: 7px 11px; margin: 6px 0 0; }
  table.grannar { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  .grannar th { text-align: left; color: #475569; font-weight: 600; border-bottom: 1.5px solid #cbd5e1; padding: 3px 4px; }
  .grannar td { border-bottom: 1px solid #e2e8f0; padding: 3px 4px; }
  .grannar tr.egen td { font-weight: 700; background: #f0f7fc; }
  .fakta { columns: 2; column-gap: 20px; font-size: 9.5pt; }
  .fakta p { break-inside: avoid; }
  .fakta b { color: #0f172a; }
  .forslag { list-style: none; padding: 0; margin: 6px 0 0; }
  .forslag li { display: flex; gap: 10px; margin: 0 0 7px; }
  .forslag .kryss { flex: none; width: 15px; height: 15px; border: 1.8px solid #1e293b; border-radius: 3px; margin-top: 1px; }
  .forslag .linje { display: inline-block; width: 190px; border-bottom: 1px solid #1e293b; margin-left: 6px; }
  footer { margin-top: 12px; border-top: 1px solid #cbd5e1; padding-top: 6px; font-size: 8pt; color: #64748b; }
</style></head>
<body>
<section class="sida">
  <header><img src="${d.logga}" alt=""><span class="namn">VADKUL</span>
    <span class="till">Underlag till ${esc(d.mottagare)}<br>${esc(DATUM_AR_FMT.format(d.datum))}</span></header>
  <h1>Det som händer i ${esc(s.ort)}, samlat på en karta</h1>
  <p class="ingress">vadkul.se samlar evenemang från föreningar, församlingar, scener, biblioteken och kommunens
  egna kalendrar på en karta, gratis för invånarna. Här är vad som finns för ${esc(s.ort)} under perioden
  ${esc(period)}, och hur det står sig mot grannorterna.</p>
  <div class="gissa"><b>Gissa först:</b> ${esc(g.fraga)}
    <div class="alt">${g.alternativ.map((a, i) => `<span>${BOKSTAVER[i]}. ${esc(a)}</span>`).join('')}</div>
    <span class="dim">Svaret står på sidan 2.</span></div>
  <div class="rutor">${rutor(s)}</div>
  <h2>Vem som arrangerar</h2>
  ${sammansattning(s)}
  <div class="tva">
    <div><h2>Flest evenemang, lokala arrangörer</h2>${lista(s.storstaLokala, `Ingen lokal arrangör har ${MIN_NAMNGIVEN} evenemang eller fler i perioden.`)}</div>
    <div><h2>Vanligaste kategorierna</h2>${lista(s.kategorier, 'Inga kategoriserade evenemang i perioden.')}</div>
  </div>
  <h2>Grannorterna, räknat på samma sätt</h2>
  ${grannTabell(s, d.grannar)}
  <footer>Så är det räknat: evenemang på vadkul.se ${esc(period)} som hör till ${esc(s.ort)} snarare än en grannort
  (orten står i adressen, eller ${esc(s.ort)} är närmaste ort). Dolda evenemang är borträknade.
  ${s.pop ? `Invånare: ${tal(s.pop)} (SCB 2024, avrundat).` : ''} Allt bygger på publicerade evenemang, inga uppgifter om besökare.</footer>
</section>

<section class="sida">
  <header><img src="${d.logga}" alt=""><span class="namn">VADKUL</span>
    <span class="till">${esc(s.ort)} på vadkul.se<br>sida 2</span></header>
  <h2>Veckan i ${esc(s.ort)}</h2>
  <p class="dim">Evenemang per dag i snitt, ${esc(period)}.</p>
  ${veckan(s, g)}
  <p class="svar"><b>Svaret på gissningen: ${BOKSTAVER[g.ratt]}, ${esc(lugnast)}.</b> Mest händer på ${esc(livligast)}ar.
  En förening som vill nå fler kan välja en ${esc(lugnast)}, då är konkurrensen om besökarna minst.</p>
  <h2>Om vadkul.se</h2>
  <div class="fakta">
    <p><b>Vad det är.</b> En karta över allt som händer i Sverige: konserter, föreläsningar, loppisar, idrott,
    föreningsträffar och kyrkans aktiviteter. Gratis att använda, med eller utan konto.</p>
    <p><b>Var evenemangen kommer ifrån.</b> De hämtas varje natt från öppna källor: arrangörernas egna
    webbplatser, kommunernas evenemangskalendrar, föreningskalendrar och biljettplattformar. Varje evenemang
    länkar tillbaka till källan. Arrangörer och besökare kan också lägga in evenemang själva.</p>
    <p><b>Samma villkor för alla.</b> Alla evenemang visas gratis, oavsett arrangörens storlek. vadkul.se
    finansieras av att arrangörer kan betala för att lyfta fram ett eget evenemang, och av provision på vissa
    biljettlänkar, som då är märkta som annons.</p>
    <p><b>Rättelser.</b> Ser något fel ut, eller vill en arrangör att ett evenemang tas bort, räcker ett mejl
    till josef@vadkul.se eller knappen Rapportera event på evenemanget.</p>
    <p><b>Personuppgifter.</b> Den som använder kartan utan konto lämnar inga personuppgifter
    (vadkul.se/integritet). Siffrorna här är antal publicerade evenemang, inga uppgifter om besökare.</p>
  </div>
  <h2>Tre saker vi gärna gör tillsammans med er</h2>
  <ul class="forslag">
    ${FORSLAG.map(([rubrik, text, namn]) => `<li><span class="kryss"></span><span><b>${esc(rubrik)}</b>, ${esc(text)}${namn ? '<br>Namn:<span class="linje"></span>' : ''}</span></li>`).join('')}
  </ul>
  <p class="dim">Ta gärna med sidan till ett möte och kryssa i det ni tycker. Ett foto av sidan eller ett kort mejl räcker som svar.</p>
  <footer><b>Josef Anderberg</b>, grundare av VADKUL · josef@vadkul.se · vadkul.se</footer>
</section>
</body></html>`;
}
