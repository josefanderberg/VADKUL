/**
 * Symbolerna på platsskyltarna (#225): svarta piktogram i vägmärkenas stil.
 * Josef 13/11: "designen på skyltarna ska vara exakt som sådan info vägskyltar.
 * samma design." Skylten är därför ett lokaliseringsmärke för serviceanläggning:
 * blå platta, vitt fält, svart symbol - inga emojier.
 *
 * Varje symbol är vektordata i en ruta om 24 x 24 (SVG-banor), så den går att
 * rita i vilken storlek som helst. Badplats, golfbana och sevärdhet (museum)
 * följer vägmärkenas motiv; bibliotek, lekplats, bollplan och park har inget
 * eget vägmärke och är ritade i samma stil.
 *
 * Ren modul: bara data. Ritas av components/v2/v2MapPoiSignImages.
 */
import type { PoiSignKey } from './mapPoiSigns';

/** Rutan symbolerna är ritade i. */
export const PICTOGRAM_BOX = 24;

export interface PictogramShape {
    /** SVG-bana i rutan 0-24. */
    d: string;
    /** Linjebredd i rutans enheter. Utelämnad = fylld yta. */
    stroke?: number;
}

/** Cirkel som SVG-bana. */
function circle(cx: number, cy: number, r: number): string {
    return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0Z`;
}

export const POI_SIGN_PICTOGRAMS: Readonly<Record<PoiSignKey, readonly PictogramShape[]>> = {
    // Badplats: simmare över två vågor.
    bad: [
        { d: circle(17, 7.5, 2.4) },
        { d: 'M4.5 13 L10.5 8 L15 12.5', stroke: 2.4 },
        { d: 'M3 17 q2.25 -2.6 4.5 0 t4.5 0 t4.5 0 t4.5 0', stroke: 1.8 },
        { d: 'M3 21 q2.25 -2.6 4.5 0 t4.5 0 t4.5 0 t4.5 0', stroke: 1.8 },
    ],
    // Sevärdhet: slingan (S:t Hans kors), vägmärkenas tecken för sevärdheter.
    museum: [
        { d: 'M9 6.5 V17.5 M15 6.5 V17.5 M6.5 9 H17.5 M6.5 15 H17.5', stroke: 2 },
        { d: circle(6.5, 6.5, 2.5), stroke: 2 },
        { d: circle(17.5, 6.5, 2.5), stroke: 2 },
        { d: circle(6.5, 17.5, 2.5), stroke: 2 },
        { d: circle(17.5, 17.5, 2.5), stroke: 2 },
    ],
    // Bibliotek: uppslagen bok.
    bibliotek: [
        { d: 'M12 7.5 C9.5 5.5 5.5 5.5 3 6.5 V18.5 C5.5 17.5 9.5 17.5 12 19.5 C14.5 17.5 18.5 17.5 21 18.5 V6.5 C18.5 5.5 14.5 5.5 12 7.5 Z', stroke: 1.8 },
        { d: 'M12 7.5 V19.5', stroke: 1.8 },
    ],
    // Naturreservat: gran.
    naturreservat: [
        { d: 'M12 2.5 L16.5 9 H14.5 L18.5 14.5 H16 L20 19.5 H4 L8 14.5 H5.5 L9.5 9 H7.5 Z' },
        { d: 'M10.8 19.5 H13.2 V22.5 H10.8 Z' },
    ],
    // Golfbana: golfspelare med klubban lyft.
    golf: [
        { d: circle(10, 5, 2.1) },
        { d: 'M10 8 L11 14.5 L8 21.5 M11 14.5 L14.5 21.5', stroke: 2.2 },
        { d: 'M10 9.5 L15 11.5', stroke: 2 },
        { d: 'M15 11.5 L19.5 3.5 L21 4.5', stroke: 1.4 },
    ],
    // Lekplats: gunga.
    lekplats: [
        { d: 'M3.5 21.5 L7 4 H17 L20.5 21.5', stroke: 2 },
        { d: 'M10 4 V14.5 M14 4 V14.5', stroke: 1.2 },
        { d: 'M9 15 H15', stroke: 2.4 },
    ],
    // Bollplan: fotboll.
    bollplan: [
        { d: circle(12, 12, 8.5), stroke: 1.8 },
        { d: 'M12 8 L15.8 10.8 L14.4 15.2 H9.6 L8.2 10.8 Z' },
        { d: 'M12 8 V3.5 M15.8 10.8 L20 9.4 M14.4 15.2 L17 18.8 M9.6 15.2 L7 18.8 M8.2 10.8 L4 9.4', stroke: 1.4 },
    ],
    // Park: lövträd.
    park: [
        { d: circle(12, 9.5, 6.5) },
        { d: 'M10.9 15 H13.1 V22 H10.9 Z' },
    ],
};
