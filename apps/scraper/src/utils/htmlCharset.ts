/**
 * htmlCharset.ts — sidans bytes → text med RÄTT teckenuppsättning.
 *
 * `res.text()` antar UTF-8. Små sajter (krogar, föreningar, bussbolag) ligger
 * ofta kvar på ISO-8859-1/Windows-1252, och då blir å/ä/ö "�" i titlar och
 * beskrivningar (larssonsresor.se 15/11 2026: "Musikalen Mrs. Doubtfire p�
 * �stg�tateatern"). Ordningen är webbens egen: HTTP-huvudet, sedan sidans
 * <meta charset>, annars UTF-8. Blir en UTF-8-tolkning ändå trasig provas
 * Windows-1252 — en sida som ljuger om sin kodning är vanligare än en som
 * verkligen innehåller ersättningstecken.
 */

/** Teckenuppsättningen enligt Content-Type-huvudet eller sidans meta-tagg, gemener. */
export function declaredCharset(contentType: string | null | undefined, head: string): string | null {
    const fromHeader = contentType?.match(/charset\s*=\s*["']?([\w.:-]+)/i)?.[1];
    const fromMeta = head.match(/<meta[^>]+charset\s*=\s*["']?([\w.:-]+)/i)?.[1];
    return (fromHeader ?? fromMeta ?? null)?.toLowerCase() ?? null;
}

function tryDecode(bytes: Uint8Array, charset: string): string | null {
    try { return new TextDecoder(charset).decode(bytes); } catch { return null; }
}

export function decodeHtmlBytes(bytes: Uint8Array, contentType?: string | null): string {
    // Meta-taggen står i klartext oavsett kodning: läs sidhuvudet byte för byte.
    const head = Buffer.from(bytes.subarray(0, 4096)).toString('latin1');
    const charset = declaredCharset(contentType, head) ?? 'utf-8';
    const text = tryDecode(bytes, charset) ?? tryDecode(bytes, 'utf-8') ?? '';
    if (/^utf-?8$/.test(charset) && text.includes('�')) {
        const latin = tryDecode(bytes, 'windows-1252');
        if (latin) return latin;
    }
    return text;
}
