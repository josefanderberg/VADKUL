// ── Brick-utseende: färger, emoji och GL-bildbakning för eventmarkörerna ────
// Ren, React-fri modul. Här bor allt som avgör HUR en eventbricka ser ut:
//   • eventEmoji/groupKeyOf — gemensamma uppslag som V2Map använder överallt
//     (samma logik i GL-lagret, DOM-synken och multi-event-listan).
//   • brickaBodyHex/brickaBodyBg — kroppens kategori-/källfärg.
//   • makeBrickaImageData — bakar brickan som ImageData till GL-symbol-lagret.
//
// Tusentals event som DOM-element gör att MapLibre måste skriva om transform på
// varje element varje frame → kartan laggar. Lösning: rendera de VANLIGA eventen
// som ETT GPU symbol-lager. Varje markör är en bild (nål-bricka + emoji) bakad en
// gång per unik emoji. DOM-brickor används bara för de få "speciella" (valt/
// sparat/eget/guld/grupp/inom-timme), som behöver rik interaktion/animation.
//
// Brickan är en enkel nål-droppe: en rundad kvadrat med tre runda hörn + en spets
// (roterad 45° så spetsen pekar rakt nedåt mot koordinaten). Mörk gradient + tunn
// ljus kant, med emojin centrerad i kroppen. Ingen separat nål/streck under —
// spetsen ÄR nålen. icon-anchor:'bottom' sätter spetsen ~pad ovanför nederkanten,
// dvs. i praktiken på koordinaten.

import { isVadkulHostedEvent, LinkEvent } from '../../types';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';

export const ONE_HOUR_MS = 60 * 60 * 1000;

// ── Bakade brickans mått ───────────────────────────────────────────────────
// Kroppen (S) och luften runt den (pad, för kant + skugga). Bilden ankras
// 'bottom' i GL-lagret → BILDENS nederkant ligger på koordinaten och spetsen
// hamnar `pad` px ovanför den. Avståndet från koordinaten upp till kroppens
// MITT är därför pad + halva diagonalen. DOM-brickan (som ritas ovanpå GL-
// brickan för den valda gruppen) måste räkna med samma tal för att hamna exakt
// över — annars sticker GL-brickan upp ovanför den. Multipliceras med lagrets
// icon-size.
export const BRICKA_IMG_S = 40;
export const BRICKA_IMG_PAD = 7;
// Emojins andel av kroppen. 0.68 (≈27 px) efter läsbarhetsfeedback (24/8:
// 72-årig testare såg inte vad brickorna var). Geometri: kroppen är en 45°-
// roterad kvadrat med tre hörnradier r=S/2 → i praktiken en cirkel med radie
// S/2; största oroterade kvadrat som ryms är S·√2/2 ≈ 28,3 px. Gå ALDRIG över
// 0.68 utan ny geometrikoll — breda VS16-glyfer (🍽️/🛍️) klipps annars.
export const BRICKA_EMOJI_SCALE = 0.68;
export const BRICKA_CENTER_ABOVE_COORD = BRICKA_IMG_PAD + (BRICKA_IMG_S * Math.SQRT2) / 2;

// En grupp "börjar inom 1 timme" om något event startar i framtiden men inom en
// timme. Samma villkor ger DOM-brickan dess orange ram och GL-pricken sin orange
// fyllning — dela helpern så de aldrig glider isär.
export function groupStartsWithinHour(group: LinkEvent[], nowMs: number): boolean {
    return group.some(e => e.time && e.time.getTime() > nowMs && e.time.getTime() - nowMs <= ONE_HOUR_MS);
}

// Event utan klockslag (hasSpecificTime false, tid 00:00) vet vi inte NÄR på
// dagen de är — de visas som "Idag" och räknas som aktuella fram till kl 20,
// sedan "har varit". Midnatt som gräns höll dem "levande" hela kvällen.
export const NO_TIME_PAST_HOUR = 20;

// Tidpunkten då eventet SLUTAR räknas som aktuellt: start + 1 h
// (standardlängden, samma som EventCard/SavedPanel), eller kl 20 sin dag för
// event utan klockslag (NO_TIME_PAST_HOUR ovan). null = passerar aldrig (event
// helt utan tid). Egen funktion för att gränsen ska gå att FÖRUTSE och inte
// bara utvärderas mot ett "nu" — se latestPastAt nedan.
export function eventPastAt(e: LinkEvent): number | null {
    if (!e.time) return null;
    if (e.hasSpecificTime === false) {
        const cutoff = new Date(e.time);
        cutoff.setHours(NO_TIME_PAST_HOUR, 0, 0, 0);
        return cutoff.getTime();
    }
    return e.time.getTime() + ONE_HOUR_MS;
}

// Ett event "har varit": dess gräns (eventPastAt) har passerat.
export function isEventPast(e: LinkEvent, nowMs: number): boolean {
    const at = eventPastAt(e);
    return at !== null && at <= nowMs;
}

// Tidpunkten då HELA listan har varit — när det SISTA eventet slocknar.
// Infinity för tom lista eller om något event aldrig passerar (utan tid), så
// att `now >= latestPastAt(list)` aldrig blir sant av misstag (samma
// length > 0-vakt som groupIsPast).
//
// Skalären gör "allt har redan varit" mätbart med en klocka i stället för en
// omräkning av hela listan varje sekund: räkna om bara när LISTAN ändras,
// jämför sedan nu mot talet.
export function latestPastAt(events: LinkEvent[]): number {
    if (events.length === 0) return Infinity;
    let last = 0;
    for (const e of events) {
        const at = eventPastAt(e);
        if (at === null) return Infinity;
        if (at > last) last = at;
    }
    return last;
}

// Gruppens markör dämpas (50 % opacity) först när ALLA event i gruppen har varit.
export function groupIsPast(group: LinkEvent[], nowMs: number): boolean {
    return group.length > 0 && group.every(e => isEventPast(e, nowMs));
}

// Grupp-nyckel: event på (nästan) samma koordinat delar markör. 4 decimaler ≈ 11 m.
export function groupKeyOf(lat: number, lng: number): string {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

// Eventets visnings-emoji: egen vald emoji i första hand, annars kategorins
// standard-emoji (okänd kategori → 'other'), sist generisk biljett.
export function eventEmoji(ev: LinkEvent): string {
    const catKey = ev.category && EVENT_CATEGORIES[ev.category] ? ev.category : 'other';
    return ev.emoji || (EVENT_CATEGORIES[catKey as EventCategoryType]?.emoji ?? '🎫');
}

// Hex → [r,g,b]. Stödjer både #rgb och #rrggbb.
function parseHex(h: string): [number, number, number] {
    const s = h.replace('#', '');
    const n = s.length === 3 ? s.split('').map(c => c + c).join('') : s;
    return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
// Blanda två hex-färger (t = 0 → a, t = 1 → b) och returnera en rgb(a)-sträng.
function mixHex(a: string, b: string, t: number, alpha = 1): string {
    const pa = parseHex(a), pb = parseHex(b);
    const ch = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
    return alpha >= 1
        ? `rgb(${ch(0)},${ch(1)},${ch(2)})`
        : `rgba(${ch(0)},${ch(1)},${ch(2)},${alpha})`;
}
// En hex-färg med alfa som rgba()-sträng.
function withAlpha(hex: string, alpha: number): string {
    const [r, g, b] = parseHex(hex);
    return alpha >= 1 ? hex : `rgba(${r},${g},${b},${alpha})`;
}

// BRICK-KROPPENS GENOMSKINLIGHET (ägarbeslut 31/8): brickorna ska ligga lite
// "i" kartan i stället för att klistras ovanpå den.
//
// Gäller NORMALKROPPEN — kategorifärgad (sourceGradientCss) och mörk standard
// (BRICKA_DARK_BG). EMFAS-LÄGENA står kvar solida med flit: guld (boost/TM),
// sparat-vitt och valt ska INTE tunnas ut, de är brickor man ska lägga märke
// till. Önskebrickorna har sin egen, kraftigare alfa sedan tidigare.
// (DOM-brickans hårdkodade gröna gradient för VADKUL-värdade är också opak —
// skillnaden mot GL-bildens 0.9 är osynlig, och GL-vägen används knappt för
// dem: egna event är alltid DOM-brickor via isSpecialGroup.)
//
// Emojin ritas ALLTID opakt ovanpå: alfat sitter i plattans gradient, inte på
// hela bilden. Skruva ALDRIG på icon-opacity i stället — då tonas emojin med.
export const BRICKA_BODY_ALPHA = 0.9;

// En källfärgs brick-gradient (ljus → bas → mörk) som CSS-sträng för DOM-brickan.
// alpha lämnas 1 av ytor som INTE är brickor — filterkolumnens cirklar ska vara
// solida.
export function sourceGradientCss(color: string, alpha = 1): string {
    return `linear-gradient(145deg, ${mixHex(color, '#ffffff', 0.22, alpha)} 0%, ${withAlpha(color, alpha)} 55%, ${mixHex(color, '#000000', 0.32, alpha)} 100%)`;
}

// Standardbrickans mörka gradient (event utan kategorifärg / stora källor).
export const BRICKA_DARK_BG = `linear-gradient(145deg, ${withAlpha('#344256', BRICKA_BODY_ALPHA)} 0%, ${withAlpha('#1e293b', BRICKA_BODY_ALPHA)} 55%, ${withAlpha('#16202e', BRICKA_BODY_ALPHA)} 100%)`;

// Brick-kroppens kategori-/källfärg för ETT event i normaltillstånd → sin
// kategoris markerHex (okänd kategori → mörk standardbricka via null). Opt-in-
// källorna (PRO/Svenska kyrkan) följer samma regel som allt annat: när
// användaren aktiverat dem integreras de visuellt med sin vanliga kategorifärg
// (ingen egen mörk källbricka längre).
//
// (En vända 31/8 stängde AV kategorifärgerna här — alla brickor mörka, för
// läsbarhetens skull — men ägaren backade den samma kväll: "vi byter tillbaka
// till färgerna som de var innan". Föreslå den inte igen utan att bli ombedd.)
//
// Delas av GL-lagret, DOM-synken, slideshow-cyclern och vald-grupp-bläddringen
// så bakgrunden ALLTID matchar det event som faktiskt visas i en multi-event-
// bricka (förr frös färgen på gruppens FÖRSTA event). Smaragdgrön bas för
// användarskapade event (samma gröna som skapa-flödet och DOM-markörens
// gradient) — delad av GL- och DOM-brickan så eget-eventfärgen aldrig glider
// isär.
export const USER_EVENT_HEX = '#059669';
export function brickaBodyHex(ev: LinkEvent): string | null {
    // VADKUL-värdade event: alltid smaragdgröna, oavsett kategori — de lyfts
    // fram som sajtens kärna (samma emfas som deras alltid-synliga bricka).
    // TIPS (användarskapade MED länk) räknas INTE som värdade — de ska smälta
    // in bland länk-eventen, inte se ut som egna arrangemang.
    if (isVadkulHostedEvent(ev)) return USER_EVENT_HEX;
    const catKey = ev.category && EVENT_CATEGORIES[ev.category] ? ev.category : 'other';
    return (EVENT_CATEGORIES[catKey as EventCategoryType] as { markerHex?: string }).markerHex ?? null;
}
export function brickaBodyBg(ev: LinkEvent): string {
    const hex = brickaBodyHex(ev);
    return hex ? sourceGradientCss(hex, BRICKA_BODY_ALPHA) : BRICKA_DARK_BG;
}

// Nål-prickens färg för ÖNSKE-brickor (samma lila familj som wish-gradienten).
export const WISH_DOT_HEX = '#8b5cf6';

// WebKit ritar emoji som slutar på variation selector-16 (U+FE0F, t.ex. 🍽️/🛍️)
// ~en halv advance till HÖGER om textAlign:'center'-punkten i canvas-fillText —
// emojin satt urknuffad i GL-brickan tills klicket bytte till DOM-brickan (vars
// textmotor centrerar rätt). Vi mäter var glyfens synliga pixlar faktiskt hamnar
// och korrigerar ritpunkten. Avvikelser ≤ 2 px lämnas: det är glyfens egen
// optiska asymmetri, samma som DOM-brickan visar — att "rätta" den skulle i
// stället flytta emojin vid klick. Cachen är nyckel per emoji (fonten är
// konstant: storleken kommer ur BRICKA_IMG_S).
const inkOffsetCache = new Map<string, number>();
function emojiInkOffsetX(emoji: string, font: string): number {
    const hit = inkOffsetCache.get(emoji);
    if (hit !== undefined) return hit;
    let off = 0;
    const M = 96; // rymmer glyfen (~24 px) + även stora felplaceringar
    const c = document.createElement('canvas');
    c.width = M;
    c.height = M;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (ctx) {
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(emoji, M / 2, M / 2);
        const a = ctx.getImageData(0, 0, M, M).data;
        let minX = Infinity, maxX = -Infinity;
        for (let y = 0; y < M; y++) {
            for (let x = 0; x < M; x++) {
                if (a[(y * M + x) * 4 + 3] > 10) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                }
            }
        }
        if (maxX >= minX) {
            const d = (minX + maxX) / 2 - M / 2;
            if (Math.abs(d) > 2) off = d;
        }
    }
    inkOffsetCache.set(emoji, off);
    return off;
}

// "+N"-badgen bakas IN i brick-bilden (makeBrickaImageData nedan): vit pill
// med mörk siffra i brickans ÖVRE HÖGRA hörn (samma look som stadssidornas
// antal-bubbla i CityMapHeroCanvas och DOM-badgen .badge-count). Ett separat
// GL-lager (bakad cirkel + textlager) prövades och förkastades: MapLibre ritar
// lager i sin helhet — alla brickor, SEDAN alla siffror (och även inom ETT
// symbol-lager alla ikoner före all text) — så en skymd grannbrickas siffra
// målades ovanpå brickan framför och siffrorna hamnade i hög vid trängsel/
// utzoomat. Inbakad är bricka+siffra EN ikon som staplas atomiskt per
// symbol-sort-key.
export const COUNT_BADGE_D = 20;  // pillens höjd/min-bredd (matchar DOM-badgens 20 px)
// Badgens mittpunkt, relativt KOORDINATEN (spetsen), vid icon-size 1:
// brickkroppens övre högra hörn (kroppens mitt ligger BRICKA_CENTER_ABOVE_COORD
// ovanför, hörnet r·cos45° ut längs 45°-axeln — kroppen är i praktiken en
// cirkel med radie S/2) plus en liten knuff utåt/uppåt så pillen SITTER PÅ
// hörnet i stället för att hänga innanför det (ägarjustering 25/8).
const BADGE_NUDGE_X = 4;
const BADGE_NUDGE_Y = 5;
export const COUNT_BADGE_CORNER_X = (BRICKA_IMG_S / 2) * Math.SQRT1_2 + BADGE_NUDGE_X;
export const COUNT_BADGE_CORNER_Y = BRICKA_CENTER_ABOVE_COORD + (BRICKA_IMG_S / 2) * Math.SQRT1_2 + BADGE_NUDGE_Y;
// GL-brickornas icon-size vid stads-/gatuzoom (symbol-lagrets översta
// interpolate-steg). Bor HÄR för att badgen bakas kompenserad (÷ värdet) så
// pill och siffra blir exakt 20/13 px vid stadszoom — DOM-badgen är matchad
// 13 px just för att GL→DOM-bytet vid klick inte ska krympa siffran. Delas
// med V2Map (lagerdefinitionen + DOM-markörens offsetberäkning).
export const GL_ICON_SIZE_TOP = 0.98;
// Extra luft på canvasens SIDOR: badge-pillen sticker ut utanför brickhörnet
// (och blir bredare vid 2–3 siffror). Läggs symmetriskt på båda sidor så
// bottom-center-ankaret (spetsen) inte flyttas.
const BADGE_SIDE_PAD = 6;

// Baka en bricka som ImageData för GL-symbol-lagret. bodyColor = kategori-/käll-
// färg (utelämnad → mörk standard); selected → tydlig vit ram; saved → vit kropp
// + ljusblå ram (matchar DOM-markörens sparad-look); wish → "drömsk" önske-look:
// halvtransparent lila kropp, streckad vit kant + liten ✨ vid axeln; starred →
// stjärn-gåvans GULD-kropp + varm ljus kant + liten ⭐ vid axeln (guld vinner
// över sparad-vitt — stjärnan är den starkare statusen). Alla brickor bakas med
// SAMMA mått (S/pad/DPR) — det är kravet för map.updateImage i emoji-cykel-
// pumpen, och därför är wish/starred grenar HÄR i stället för egna bakfunktioner
// (måtten kan aldrig glida isär). count > 1 → "+N"-pillen bakas in i hörnet
// (se COUNT_BADGE-kommentaren ovan för varför den inte är ett eget lager).
// gold = GULD-kropp UTAN ⭐ (Ticketmaster, ägarbeslut 1/9: "som boost-eventen")
// — ⭐-badgen förblir boostens/stjärngåvans kvitto och följer bara starred.
export function makeBrickaImageData(emoji: string, bodyColor?: string, selected = false, saved = false, wish = false, starred = false, count = 0, gold = false): { data: ImageData; pixelRatio: number } | null {
    if (typeof document === 'undefined') return null;
    const DPR = 2.5;
    const S = BRICKA_IMG_S;      // brickans kropp (logiska px), nära DOM:ens 44
    const pad = BRICKA_IMG_PAD;  // luft för kant + skugga
    const diag = S * Math.SQRT2;
    const W = Math.round(diag + pad * 2) + BADGE_SIDE_PAD * 2;
    const H = Math.round(diag + pad * 2);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(DPR, DPR);
    const cx = W / 2;
    const cy = H - pad - diag / 2; // kroppens mitt; spetsen hamnar ~pad ovanför nederkant

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4); // 45° medurs → det spetsiga hörnet (br) pekar nedåt
    const r = S / 2;
    const anyCtx = ctx as CanvasRenderingContext2D & {
        roundRect?: (x: number, y: number, w: number, h: number, radii: number[]) => void;
    };
    ctx.beginPath();
    if (typeof anyCtx.roundRect === 'function') {
        anyCtx.roundRect(-S / 2, -S / 2, S, S, [r, r, 0, r]); // tl, tr, br(=spets), bl
    } else {
        ctx.rect(-S / 2, -S / 2, S, S);
    }
    const grad = ctx.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2);
    // Sparad (gillad) bricka = ljus/vit kropp (matchar DOM-markörens vita bakgrund);
    // önskan = halvtransparent lila "dröm" (kartan skiner igenom → skiljs direkt
    // från riktiga event); annars källans/kategorins färg eller mörk standard.
    const goldBody = starred || gold;
    const stops = wish
        ? ['rgba(221,190,254,0.80)', 'rgba(167,139,250,0.66)', 'rgba(109,40,217,0.58)']
        : goldBody
        ? ['#ffe9a3', '#f0b429', '#a8730a']
        : saved
        ? ['#ffffff', '#f3f6fa', '#e3e9f1']
        : bodyColor
        ? [mixHex(bodyColor, '#ffffff', 0.22, BRICKA_BODY_ALPHA), withAlpha(bodyColor, BRICKA_BODY_ALPHA), mixHex(bodyColor, '#000000', 0.32, BRICKA_BODY_ALPHA)]
        : [withAlpha('#344256', BRICKA_BODY_ALPHA), withAlpha('#1e293b', BRICKA_BODY_ALPHA), withAlpha('#16202e', BRICKA_BODY_ALPHA)];
    grad.addColorStop(0, stops[0]);
    grad.addColorStop(0.55, stops[1]);
    grad.addColorStop(1, stops[2]);
    ctx.fillStyle = grad;
    ctx.shadowColor = wish ? 'rgba(88,28,135,0.28)' : 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // Ram: vald = tydlig opak vit (markeringen man är "på"); stjärnmärkt = varm
    // ljusgul kant mot guldkroppen; sparad = ljusblå (#5BA3CC, samma som DOM);
    // önskan = STRECKAD vit (drömlinje); annars svag vit kant för djup.
    if (wish) ctx.setLineDash([5, 4]);
    ctx.lineWidth = selected ? 3.5 : goldBody || saved ? 2.5 : 2;
    ctx.strokeStyle = selected ? '#ffffff' : goldBody ? '#fff3c4' : saved ? '#5BA3CC' : wish ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.28)';
    ctx.stroke();
    ctx.restore();

    // Emoji centrerad i kroppen (oroterad), med ink-korrigering för WebKits
    // VS16-felplacering (se emojiInkOffsetX).
    const emojiFont = `${Math.round(S * BRICKA_EMOJI_SCALE)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
    ctx.font = emojiFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, cx - emojiInkOffsetX(emoji, emojiFont), cy);

    // Önskans ✨ — svävar strax UTANFÖR kroppens övre högra axel (ryms i
    // canvasens hörn-triangel: |dx|+|dy| ≈ 0,84·S > halva diagonalen ≈ 0,71·S,
    // men klart innanför kanten W/2 ≈ 0,88·S).
    if (wish) {
        ctx.font = `${Math.round(S * 0.34)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
        ctx.fillText('✨', cx + S * 0.42, cy - S * 0.42);
    }

    // Stjärn-gåvans ⭐ — samma axel-position som önskans ✨ (wish och starred
    // förekommer aldrig på samma bricka: önskningar är inte riktiga event).
    if (starred) {
        ctx.font = `${Math.round(S * 0.34)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif`;
        ctx.fillText('⭐', cx + S * 0.42, cy - S * 0.42);
    }

    // "+N"-pillen — vit med mörk siffra i övre högra hörnet. Ritas SIST så den
    // ligger ovanpå ⭐/✨, precis som det gamla badge-lagret gjorde. Måtten
    // kompenseras ÷GL_ICON_SIZE_TOP → exakt 20 px pill / 13 px siffra vid
    // stadszoom = pixelmatchad mot DOM-badgen (.badge-count) vid GL→DOM-bytet.
    // Pillen växer i bredd med sifferantalet (samma min-width+padding-beteende
    // som DOM:ens pill); ≥100 kapas till "99+" som DOM-badgen.
    if (count > 1) {
        const comp = 1 / GL_ICON_SIZE_TOP;
        const D = COUNT_BADGE_D * comp;
        const label = count > 99 ? '99+' : String(count);
        ctx.font = `900 ${13 * comp}px system-ui,-apple-system,"Segoe UI",sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const pillW = Math.max(D, ctx.measureText(label).width + 8 * comp);
        const bx = cx + COUNT_BADGE_CORNER_X;
        const by = H - COUNT_BADGE_CORNER_Y; // koordinaten = bildens nederkant
        ctx.beginPath();
        if (typeof anyCtx.roundRect === 'function') {
            anyCtx.roundRect(bx - pillW / 2, by - D / 2, pillW, D, [D / 2]);
        } else {
            ctx.rect(bx - pillW / 2, by - D / 2, pillW, D);
        }
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(label, bx, by);
    }

    return { data: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: DPR };
}
