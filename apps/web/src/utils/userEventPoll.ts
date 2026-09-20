/**
 * userEventPoll.ts — när kartans användarskapade event behöver hämtas på nytt.
 *
 * BAKGRUND (20/9): pollen i linkEventService hämtade ALLA userCreated-event var
 * 30:e sekund. En sådan runda kostar ett Firestore-read PER DOKUMENT, så
 * kostnaden växte linjärt med antalet tips: 53 event × 120 pollar/timme =
 * ~6 400 reads i timmen PER ÖPPEN FLIK — dygnet runt, eftersom det inte fanns
 * någon visibility-vakt. Uppmätt var det ~90 % av kontots ~400 000 reads/dygn,
 * och eftersom 50 av de 53 eventen skapades i september hade kostnaden per
 * flik blivit 17 gånger högre på en månad utan att en rad kod ändrats.
 *
 * I STÄLLET pollas en count()-aggregering, som kostar ETT read oavsett hur
 * många event som finns (Firestore debiterar ett read per påbörjade 1 000
 * indexposter). Hela hämtningen görs bara när ANTALET ändrats — alltså när
 * någon skapat eller tagit bort ett event, vilket är precis det som måste nå
 * kartan snabbt.
 *
 * Redigeringar och boostar ändrar inte antalet. De fångas av SÄKERHETSNÄTET:
 * en full hämtning görs ändå med jämna mellanrum. Nätet är dessutom det som
 * gör lösningen självgående — den kräver varken ny skrivdisciplin (jfr
 * stamped() i scrapern, som i praktiken har glömts bort) eller en rules-deploy,
 * eftersom linkEvents redan är öppen för läsning. Inget nytt kan alltså gå
 * sönder i tysthet; värsta utfallet är att en redigering syns en kvart senare.
 */

/**
 * Full hämtning görs minst så här ofta även om antalet står stilla — taket för
 * hur länge en redigering eller en nybetald boost kan vara osynlig.
 *
 * 15 minuter är vald mot kostnaden: full hämtning ≈ ett read per event, så
 * nätet kostar (antal event / 15) reads per minut och flik. Sänk den inte till
 * sekundnivå "för säkerhets skull" — då är hela besparingen borta.
 */
export const USER_EVENT_SAFETY_REFETCH_MS = 15 * 60 * 1000;

/** `full` = hämta alla event + boostar. `skip` = inget har ändrats, gör inget. */
export type UserEventPollDecision = 'full' | 'skip';

export interface UserEventPollInput {
    /** Klockan nu (Date.now()). */
    nowMs: number;
    /** När den senaste FULLA hämtningen gjordes, eller null om ingen gjorts än. */
    lastFullFetchMs: number | null;
    /** Antalet dokument den senaste fulla hämtningen såg, eller null. */
    lastCount: number | null;
    /**
     * Antalet count() nyss rapporterade — eller **null när probe:n misslyckades**
     * (nät, offline, kvotfel). Null betyder "vet inte", aldrig "noll event".
     */
    probedCount: number | null;
    /** Överstyr säkerhetsnätets intervall (tester). */
    safetyMs?: number;
}

/**
 * Avgör om pollen ska göra en full hämtning eller hoppa över varvet.
 *
 * Ordningen är medvetet fail-safe: varje tillstånd där vi INTE säkert vet att
 * datan är oförändrad ger `full`. En karta som visar gamla event är ett värre
 * fel än ett extra hämtvarv.
 */
export function decideUserEventPoll(input: UserEventPollInput): UserEventPollDecision {
    const { nowMs, lastFullFetchMs, lastCount, probedCount } = input;
    const safetyMs = input.safetyMs ?? USER_EVENT_SAFETY_REFETCH_MS;

    // Inget hämtat än → första hämtningen.
    if (lastFullFetchMs === null || lastCount === null) return 'full';

    // Probe:n misslyckades: vi vet inget om läget. Hellre en dyr runda än en
    // karta som tyst fryser i det tillstånd den råkade ha när nätet vek sig.
    if (probedCount === null) return 'full';

    // Antalet ändrat = event skapat eller borttaget → måste synas nu.
    if (probedCount !== lastCount) return 'full';

    // Antalet står stilla, men redigeringar/boostar syns inte i det. Nätet.
    // >= så att exakt utlupen tid räknas som utlupen (jfr testerna).
    if (nowMs - lastFullFetchMs >= safetyMs) return 'full';

    return 'skip';
}
