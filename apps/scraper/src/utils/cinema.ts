/**
 * cinema.ts — känn igen BIOVISNINGAR så de får filmsymbol.
 *
 * Community-kritik 2026-09-04: biovisningar från Tickster ("The Invite —
 * Röda Kvarn - Bio 3:an") fick 🎭 eller 🎉 av LLM-auditen, så folk tog dem
 * för teater/fest. Av 473 biovisningar i aggregatet hade bara 99 🎬.
 *
 * Signalerna är platsen (bio/biograf/filmhus/kino/Filmstaden) eller titeln
 * ("(Sv. tal)", "(Tal: Engelska)", "Biopremiär", "Filmvisning", "Dokumentär:").
 * Ren modul, testad i cinema.test.ts.
 */

export const CINEMA_EMOJI = '🎬';

const CINEMA_VENUE_RE = /(?<!\p{L})(?:bio|biograf(?:en)?|biocaf[ée]|filmhus(?:et)?|filmstaden|kino|cinema|folkets bio|sf bio)(?!\p{L})/iu;
const CINEMA_TITLE_RE = /\((?:sv\.?|svenskt|eng\.?|engelskt)\s*tal\)|\((?:tal|text):\s*[^)]*\)|(?<!\p{L})(?:biopremiär|filmvisning|filmpremiär|dokumentär:|film:|bio:)(?!\p{L})|(?<!\p{L})på bio(?!\p{L})/iu;

/** Ser eventet ut som en biovisning? */
export function looksLikeCinema(title: string | null | undefined, venueName: string | null | undefined): boolean {
    if (CINEMA_TITLE_RE.test(title ?? '')) return true;
    return CINEMA_VENUE_RE.test(venueName ?? '');
}

/** Biovisning → 🎬 oavsett vad LLM:en/kategoridefaulten valde; annars orörd. */
export function withCinemaEmoji(emoji: string | null | undefined, title: string | null | undefined, venueName: string | null | undefined): string | null | undefined {
    return looksLikeCinema(title, venueName) ? CINEMA_EMOJI : emoji;
}
