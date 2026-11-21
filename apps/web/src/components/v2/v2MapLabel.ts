// ── Brick-etiketter: texten under eventmarkörerna ──────────────────────────
// Ren, React-fri modul (samma kontrakt som v2MapBricka). Bakgrund: verklig
// användarfeedback — emoji + kategorifärg räcker inte för att förstå vad en
// bricka är. Etiketterna ritas av ett eget GL-textlager ('plain-events-labels')
// som visar kategorinamn vid mellanzoom och (kapad) eventtitel vid hög zoom.
//
// Lagret läser en liten SPEGELKÄLLA med bara de TÄNDA, ej passerade grupperna
// (labelFeaturesFrom) i stället för text-fält på huvudkällan. Skälet är hårt:
// MapLibres textkollision kan inte läsa feature-state, så osynliga etiketter
// (tusentals features, ~50 tända) skulle ändå skriva in sig i kollisions-
// indexet och tränga undan baskartans ortsnamn. Spegeln gör kollisionen
// korrekt OCH billig (≤ ~100 features).
//
// ALLT här måste vara deterministiskt: labelCat/labelTitle ingår i
// samePlainFeatures-jämförelsen, och en helper som ger olika svar för samma
// input skulle få varje no-op-push att se "ny" ut och döda våg-streamen.

import { bySideExpression, TITLE_PLACEMENTS, type TitleAnchor, type TitlePlacement } from '@vadkul/kontrakt';
import { EVENT_CATEGORIES, EventCategoryType } from '../../utils/categories';
import {
    BRICKA_CENTER_ABOVE_COORD, BRICKA_IMG_PAD, BRICKA_IMG_S,
    COUNT_BADGE_CORNER_X, COUNT_BADGE_CORNER_Y, COUNT_BADGE_D, DOM_BRICKA_BODY_PX, GL_ICON_SIZE_STOPS, GL_ICON_SIZE_TOP,
    SELECTED_MARKER_SCALE,
} from './v2MapBricka';

// ── Var titeln får stå (#196, #204) ─────────────────────────────────────────
// Josef 13/11 (#196): "sen kan vi även sätta titel åt vänster, höger och över".
// Samma dag (#204): "texten blir dåligt placerad om det är en öppen eventbricka
// nedanför, för det täcker ju texten. så placera på sidor eller över ... så att
// vi ser så många texter synligt som möjligt". MapLibre provar lägena i den här
// ordningen och tar det första som är fritt - fritt från andra etiketter OCH
// (sedan #204) från de tända brickornas krockytor nedan. Offset i em av
// textstorleken; MapLibre lägger själv på baslinjeskiftet (7/24 em) för top-
// och bottom-ankarna, det räknar labelTextBox med.
// Lägena bor i @vadkul/kontrakt (mapTitles) sedan #262 - appen ställer
// titlarna på SAMMA platser. Där finns också ordningen per sida av bilden:
// i kanterna växer titeln inåt (titleAnchorOffsetsBySide nedan).
export type LabelAnchor = TitleAnchor;
export const LABEL_TITLE_PLACEMENTS: readonly TitlePlacement[] = TITLE_PLACEMENTS;
// Kategorireserven står bara under brickan (7/10-regeln, se V2Map).
export const LABEL_CAT_PLACEMENT: readonly [LabelAnchor, readonly [number, number]] = ['top', [0, 0.35]];
// MapLibres layoutvärde för text-variable-anchor-offset (den vanliga ordningen).
export function titleAnchorOffsets(): ['literal', (LabelAnchor | [number, number])[]] {
    return anchorOffsetsLiteral(LABEL_TITLE_PLACEMENTS);
}
function anchorOffsetsLiteral(placements: readonly TitlePlacement[]): ['literal', (LabelAnchor | [number, number])[]] {
    return ['literal', placements.flatMap(([a, [x, y]]) => [a, [x, y] as [number, number]])];
}
// TITLARNA VÄXER MOT MITTEN (#262, Josef 19/11: "prioritera så att titlarna
// visas mot mitten av skärmen. så att inte 50% av alla titlar är utanför
// kanten"): samma lägen, men ordningen väljs per bricka på dess `side`
// (kontraktets titleSide, satt av V2Map när spegeln synkas). Vänstra delen
// provar lägena åt höger först, högra delen åt vänster.
export function titleAnchorOffsetsBySide(): unknown[] {
    return bySideExpression(anchorOffsetsLiteral);
}

// DEN VALDA BRICKANS TITEL STÅR BARA UNDER SPETSEN (#270): den valda brickan
// är dubbelt så stor (SELECTED_MARKER_SCALE) och växer uppåt från spetsen, så
// lägena vid sidan och över - kalibrerade mot en vanlig bricka - hade hamnat
// bakom kroppen. Under, och under utdragen åt vardera hållet, ligger fria.
export function selectedTitleAnchorOffsetsBySide(): unknown[] {
    return bySideExpression(o => anchorOffsetsLiteral(o.filter(([a]) => a.startsWith('top'))));
}
// KROCKRUTAN UNDER DEN VALDA (#270): DOM-markören är lika stor på alla zoomar
// (den följer inte GL-brickans icon-size), så rutan över kroppen får en fast
// icon-size som täcker den förstorade kroppen - grannarnas titlar viker undan
// i stället för att försvinna bakom den.
export const SELECTED_OBSTACLE_ICON_SIZE = SELECTED_MARKER_SCALE * DOM_BRICKA_BODY_PX / BRICKA_IMG_S;
// Krocklagrets icon-size: zoomstegen som brickan, men den valda (sortKey ≥ 1e6,
// samma gräns som -top-lagret) får den fasta storleken. Zoom-interpolationen
// måste ligga ytterst i ett layout-uttryck, därför case per steg.
export function obstacleIconSizeExpr(): unknown[] {
    const vald = ['>=', ['coalesce', ['get', 'sortKey'], 0], 1_000_000];
    return ['interpolate', ['linear'], ['zoom'],
        ...GL_ICON_SIZE_STOPS.flatMap(([z, v]) => [z, ['case', vald, SELECTED_OBSTACLE_ICON_SIZE, v]])];
}

// Etiketternas textstorlek per zoom (px) - samma steg som lagrens text-size.
export const LABEL_TEXT_SIZE_STOPS: ReadonlyArray<readonly [number, number]> = [[9, 11], [13, 12.5], [16, 13.5]];

// ── Krockytorna (#204) ──────────────────────────────────────────────────────
// Brickorna ritas med icon-ignore-placement (alla syns alltid, även släckta
// med opacitet 0), så textkollisionen ser dem inte - en titel kunde hamna rakt
// under en grannbricka. V2Map lägger därför ett osynligt krocklager per tänd
// bricka ur etikettspegeln (bara tända, ej passerade): en ruta över kroppen och,
// för grupper, en över "+N"-pillen. Lagren placeras före etiketterna, så titlar
// och kategorier viker undan till nästa fria läge.
// Rutorna i px relativt koordinaten vid icon-size 1 (y nedåt). Kroppen: från
// spetsen (BRICKA_IMG_PAD ovanför koordinaten) till cirkelns topp, en hel
// kroppsbredd. Rutan slutar vid spetsen och inte vid koordinaten - titeln under
// ligger bara ~1 px under koordinaten och skulle annars krocka med sin egen bricka.
export interface LabelBox { x0: number; y0: number; x1: number; y1: number }
export const LABEL_BODY_BOX: LabelBox = {
    x0: -BRICKA_IMG_S / 2,
    x1: BRICKA_IMG_S / 2,
    y0: -(BRICKA_CENTER_ABOVE_COORD + BRICKA_IMG_S / 2),
    y1: -BRICKA_IMG_PAD,
};
// Pillen bakas kompenserad (÷GL_ICON_SIZE_TOP) runt hörnpunkten; rutan har
// pillens minsta mått (1-2 siffror). "99+" sticker ut lite åt höger.
const BADGE_D_IMG = COUNT_BADGE_D / GL_ICON_SIZE_TOP;
export const LABEL_BADGE_BOX: LabelBox = {
    x0: COUNT_BADGE_CORNER_X - BADGE_D_IMG / 2,
    x1: COUNT_BADGE_CORNER_X + BADGE_D_IMG / 2,
    y0: -COUNT_BADGE_CORNER_Y - BADGE_D_IMG / 2,
    y1: -COUNT_BADGE_CORNER_Y + BADGE_D_IMG / 2,
};
// Krocklagrets bild + placering för en ruta: en genomskinlig bild i rutans
// storlek (heltal, avrundad uppåt) med övre vänstra hörnet i rutans hörn
// (icon-anchor 'top-left' + icon-offset, som MapLibre skalar med icon-size).
export function obstacleIcon(box: LabelBox): { width: number; height: number; offset: [number, number] } {
    return {
        width: Math.ceil(box.x1 - box.x0),
        height: Math.ceil(box.y1 - box.y0),
        offset: [box.x0, box.y0],
    };
}
// Rutan som MapLibre faktiskt krockar mot vid en viss icon-size (icon-padding 0).
export function obstacleBoxAt(box: LabelBox, iconSize: number): LabelBox {
    const { width, height, offset } = obstacleIcon(box);
    return {
        x0: offset[0] * iconSize,
        y0: offset[1] * iconSize,
        x1: (offset[0] + width) * iconSize,
        y1: (offset[1] + height) * iconSize,
    };
}

// MapLibres krockruta för en enradig etikett vid ett visst läge: rutan är en
// radhöjd (text-line-height 1,2) hög, flyttas så ankarsidan står på punkten,
// plus offseten och baslinjeskiftet, plus text-padding (2 px) runt om.
export const LABEL_TEXT_PADDING_PX = 2;
const LABEL_LINE_HEIGHT_EM = 1.2;
const LABEL_BASELINE_EM = 7 / 24;
// `lines` = 2 för en titel med tidsrad (#270): rutan växer nedåt för top-
// ankarna, uppåt för bottom-ankarna och åt båda håll för sidolägena. Tidsraden
// räknas i full radhöjd (den är 0,85 em) - rutan blir aldrig för liten.
export function labelTextBox(anchor: LabelAnchor, offsetEm: readonly [number, number], textPx: number, widthPx: number, lines = 1): LabelBox {
    const h = LABEL_LINE_HEIGHT_EM * textPx * lines;
    const ha = anchor.endsWith('left') ? 0 : anchor.endsWith('right') ? 1 : 0.5;
    const va = anchor.startsWith('top') ? 0 : anchor.startsWith('bottom') ? 1 : 0.5;
    const baseline = anchor.startsWith('top') ? -LABEL_BASELINE_EM : anchor.startsWith('bottom') ? LABEL_BASELINE_EM : 0;
    const x0 = -ha * widthPx + offsetEm[0] * textPx;
    const y0 = -va * h + (offsetEm[1] + baseline) * textPx;
    const p = LABEL_TEXT_PADDING_PX;
    return { x0: x0 - p, y0: y0 - p, x1: x0 + widthPx + p, y1: y0 + h + p };
}

// SPÄRREN UNDER SPETSEN (#196): titellagret bär en osynlig 2x2-ikon på samma
// plats som kategorireserven skulle stå (centrum LABEL_SLOT_OFFSET_PX under
// koordinaten, icon-size 1, icon-padding 2). Står titeln vid sidan eller över
// ligger spärren kvar under brickan, så kategorin för SAMMA bricka krockar och
// visas inte. Ikonen är valfri (icon-optional): är platsen under spetsen redan
// tagen får titeln flytta utan spärren - då är kategorins enda plats ändå
// blockerad av samma sak.
export const LABEL_SLOT_SIZE_PX = 2;
export const LABEL_SLOT_OFFSET_PX = 10;
export function labelSlotBox(): LabelBox {
    const r = LABEL_SLOT_SIZE_PX / 2 + 2;
    return { x0: -r, x1: r, y0: LABEL_SLOT_OFFSET_PX - r, y1: LABEL_SLOT_OFFSET_PX + r };
}

export function boxesOverlap(a: LabelBox, b: LabelBox): boolean {
    return a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
}

// Maxlängd (i tecken, Array.from-räknade så emoji/surrogatpar inte klyvs)
// innan titeln kapas med "…". En rad under en 40 px-bricka — längre läses inte.
export const LABEL_MAX_CHARS = 18;

// Kartetikettens kategorinamn: ETT ord (ägarbeslut 25/8) — "Sport", inte
// "Sport & träning". Kategorikolumnen och övriga UI:t behåller de fulla
// EVENT_CATEGORIES-etiketterna; det här är bara kartans kortform.
// Okänd/saknad kategori → "Övrigt" (samma fallback som eventEmoji/brickaBodyHex).
const SHORT_CATEGORY_LABEL: Record<EventCategoryType, string> = {
    music: 'Musik',
    stage: 'Scen',
    art: 'Konst',
    sport: 'Sport',
    food: 'Mat',
    market: 'Marknad',
    party: 'Fest',
    social: 'Socialt',
    course: 'Kurs',
    family: 'Familj',
    other: 'Övrigt',
};
export function categoryLabel(category: string | undefined): string {
    const key: EventCategoryType = category && category in EVENT_CATEGORIES
        ? (category as EventCategoryType)
        : 'other';
    return SHORT_CATEGORY_LABEL[key] ?? 'Övrigt';
}

// Kapa en etikettext till LABEL_MAX_CHARS tecken + "…". Array.from så att
// surrogatpar (emoji i titlar) aldrig klyvs mitt itu; avslutande blanksteg
// trimmas så det inte blir "Titel …".
export function truncateLabel(text: string, max = LABEL_MAX_CHARS): string {
    const chars = Array.from(text.trim());
    if (chars.length <= max) return chars.join('');
    return chars.slice(0, max).join('').trimEnd() + '…';
}

// ── Tid kvar under titeln (#270) ───────────────────────────────────────────
// Josef 22/11: "alla event som vi visar ... visa hur lång tid om det är inom
// 5h" och "om det är inom 2 timmar så ska det även synas ... så man får veta
// essentiell info direkt". Tända brickor som börjar inom LABEL_TIME_HORIZON_MS
// får en mindre rad under titeln; inom LABEL_TIME_SOON_MS står den i minuter
// och i varm färg (labelSoon), och ett event som har börjat men inte "har
// varit" (start + 1 h, samma gräns som eventPastAt) visar "pågår".
// Event utan klockslag får ingen rad - vi vet inte när på dagen de är.
// TEXTEN GÅR I STEG (5 min / hela timmar): den ingår i etikettsignaturen, och
// en text som ändrades varje sekund hade skrivit om spegelkällan i onödan.
export const LABEL_TIME_HORIZON_MS = 5 * 60 * 60_000;
export const LABEL_TIME_SOON_MS = 2 * 60 * 60_000;
const LABEL_TIME_ONGOING_MS = 60 * 60_000;
export interface LabelTime { text: string; soon: boolean }
export function labelTimeLeft(
    ev: { time?: Date | null; hasSpecificTime?: boolean },
    nowMs: number,
): LabelTime | null {
    if (!ev.time || ev.hasSpecificTime === false) return null;
    const start = ev.time.getTime();
    if (!Number.isFinite(start)) return null;
    const left = start - nowMs;
    if (left <= 0) return nowMs < start + LABEL_TIME_ONGOING_MS ? { text: 'pågår', soon: true } : null;
    if (left > LABEL_TIME_HORIZON_MS) return null;
    if (left > LABEL_TIME_SOON_MS) return { text: `om ${Math.floor(left / 3_600_000)} h`, soon: false };
    // Fem minuters steg, avrundat nedåt: "om 45 min" stämmer tills 40 återstår.
    const min = Math.floor(left / 60_000 / 5) * 5;
    if (min < 5) return { text: 'nu', soon: true };
    if (min < 60) return { text: `om ${min} min`, soon: true };
    const rest = min % 60;
    return { text: rest ? `om ${Math.floor(min / 60)} h ${rest}` : `om ${Math.floor(min / 60)} h`, soon: true };
}

// Etiketternas fält på en feature. labelTime är '' när ingen tidsrad ska stå
// (fälten finns alltid, så signaturen och samePlainFeatures har något att jämföra).
export interface EventLabelProps { labelCat: string; labelTitle: string; labelTime: string; labelSoon: boolean }

// Titellagrens text-field (MapLibres format-uttryck): titeln, och när
// labelTime finns en egen mindre rad under med tiden - varm gul inom två
// timmar, annars ljusgrå. Kategorilagret visar bara labelCat.
export const LABEL_TIME_FONT_SCALE = 0.85;
export const LABEL_TIME_SOON_COLOR = '#fde047';
export const LABEL_TIME_COLOR = '#e2e8f0';
export function titleTextField(): unknown[] {
    return [
        'format',
        ['get', 'labelTitle'], {},
        ['case', ['!=', ['coalesce', ['get', 'labelTime'], ''], ''], ['concat', '\n', ['get', 'labelTime']], ''],
        {
            'font-scale': LABEL_TIME_FONT_SCALE,
            'text-color': ['case', ['boolean', ['get', 'labelSoon'], false], LABEL_TIME_SOON_COLOR, LABEL_TIME_COLOR],
        },
    ];
}

// Etikettparet för DET EVENT brickan visar just nu. Regeln är enkel: texten
// följer alltid brickans synliga frame — en cyklande multibricka får sin
// etikett uppdaterad av cykel-pumpen i samma tick som emojin byter (aldrig en
// neutral "N evenemang"-text; "+N"-badgen bär redan antalet). plainData sätter
// representantens etikett som utgångsläge, spegelkällan skriver över med
// aktuell frame (se syncLabelSource i V2Map). `time` = labelTimeLeft för
// samma event (#270); utelämnad = ingen tidsrad.
export function eventLabels(title: string, category: string | undefined, time: LabelTime | null = null): EventLabelProps {
    return {
        labelCat: categoryLabel(category), labelTitle: truncateLabel(title),
        labelTime: time?.text ?? '', labelSoon: time?.soon ?? false,
    };
}

// Önske-brickornas etiketter ("wish:"-nycklar): kategorinivån säger bara att
// det är en önskan, titelnivån visar vad som önskas. Önskningar har ingen tid.
export function wishLabels(title: string): EventLabelProps {
    return { labelCat: 'Önskan', labelTitle: truncateLabel(`Önskas: ${title}`), labelTime: '', labelSoon: false };
}

// Spegelkällans innehåll: de features vars reveal-opacity passerat 0.5 och som
// inte är passerade ("har varit"-grupper står som prickar — text över en släckt
// bricka vore en svävande etikett). Ren funktion över vanliga strukturer så den
// kan testas utan Mapbox; V2Map matar in plainFeaturesRef ∩ revealWrittenRef.
export function labelFeaturesFrom<
    F extends { properties: { key: string; past: boolean } },
>(features: F[], litOps: Map<string, number>): F[] {
    return features.filter(f => (litOps.get(f.properties.key) ?? 0) > 0.5 && !f.properties.past);
}
