import { normalizePriceLabel } from './priceLabel';

/**
 * Metadata för en rad i multievent-listan (EventCardGroupList, #227): efter
 * klockslaget står ARRANGÖREN, och priset när eventet har ett (Josef 13/11:
 * "lägga till arrangör direkt efter tiden. samt pris"). Värden kommer med
 * kortlagret; innan det landat (tom hostName) står kategorin där i stället,
 * så raden aldrig är tom och inte visar källans domän som arrangör.
 */
export function groupRowMeta(
    ev: { hostName?: string | null; price?: number | string | null },
    categoryLabel: string,
): { who: string; price: string | null } {
    const host = (ev.hostName ?? '').replace(/\s+/g, ' ').trim();
    return { who: host || categoryLabel, price: normalizePriceLabel(ev.price) };
}
