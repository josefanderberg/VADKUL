/**
 * meetupDescription.ts — Meetup-eventens HELA beskrivning, som ren text.
 *
 * Bakgrund (2026-09-10): skrapan tog beskrivningen ur sidans JSON-LD, men där
 * lägger Meetup bara en förhandssnutt kapad vid 155 tecken — mitt i ett ord
 * ("…Om du vill öva sven"). Alla Meetup-event låg så. Hela texten finns i
 * samma sida, i Next.js-datan (`__NEXT_DATA__` → pageProps.event.description,
 * speglad i Apollo-cachen som `Event:<id>`). Den är skriven i markdown
 * (**fet**, [länk](url), rubriker) — stripMeetupMarkdown gör om den till
 * ren text innan den sparas. Ren modul, testad.
 */

/** Meetups JSON-LD-snutt är högst så här lång — längre sparade texter är hela. */
export const MEETUP_SNIPPET_MAX = 155;

/**
 * Hela (markdown-)beskrivningen ur sidans `__NEXT_DATA__`-JSON, eller null om
 * den saknas/inte går att läsa. `url` används för Apollo-reserven (event-id:t).
 */
export function meetupFullDescription(nextDataJson: string | null | undefined, url?: string): string | null {
    if (!nextDataJson) return null;
    let data: any;
    try { data = JSON.parse(nextDataJson); } catch { return null; }
    const pageProps = data?.props?.pageProps;
    let desc: unknown = pageProps?.event?.description;
    if (typeof desc !== 'string' || !desc.trim()) {
        const id = url?.match(/\/events\/(\d+)/)?.[1];
        desc = id ? pageProps?.__APOLLO_STATE__?.[`Event:${id}`]?.description : undefined;
    }
    return typeof desc === 'string' && desc.trim() ? desc.trim() : null;
}

/** Meetups markdown → ren text (länktext kvar, formatering bort, radbrytningar kvar). */
export function stripMeetupMarkdown(md: string): string {
    return md
        .replace(/[\u200B-\u200D\uFEFF]/g, '')               // nollbreddstecken ("17: 30" med U+200B)
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')                // bilder
        .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_m, text: string, href: string) => text.trim() || href.trim())
        .replace(/^\s{0,3}#{1,6}\s+/gm, '')                  // rubriker
        .replace(/^\s*[*+]\s+/gm, '- ')                      // punktlistor → "- "
        .replace(/(\*\*|__)(.+?)\1/g, '$2')                  // fetstil
        .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, '$1$2') // kursiv
        .replace(/\\([\\`*_{}[\]()#+\-.!>])/g, '$1')         // escapade tecken
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}
