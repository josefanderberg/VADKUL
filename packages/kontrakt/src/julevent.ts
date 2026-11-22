/**
 * julevent.ts - är ett event ett JULEVENT? (#272, ägarbeslut 22/11 2026,
 * Josef: "vi måste ju ha en sök kategori som är jul").
 *
 * Avgörs på TITELN, ord för ord. Jul är ingen kategori i pipelinen - en
 * julmarknad är "marknad" och en julkonsert "musik" - så det tillfälliga
 * 🎄 Jul-chippet i kategoriraden läser titeln i stället. Ren funktion utan
 * beroenden, så webben och appen räknar lika.
 *
 * Räknas: allt som börjar på jul (julmarknad, julkonsert, julbord, julgran,
 * julpyssel, förjul ...), christmas/xmas, lucia, advent, tomte, glögg,
 * pepparkakor och lussekatter. Räknas INTE: nyår (egen högtid), och orden
 * som bara råkar börja på samma bokstäver - juli, Julia, Julius, Juliette,
 * hjul, adventure, tomter (mark) och Tomtebo (ortnamn).
 */

/** Ord som börjar på "jul" men inte är jul: månaden och namnen. */
const INTE_JUL = /^(?:juli|juli[aeou].*|julins?|july|jules|julle)$/;

/** Ett ord i taget, redan i gemener. */
const JULORD: readonly RegExp[] = [
    /^(?:för)?jul/,
    /^christmas/,
    /^xmas/,
    /^lucia/,
    /^lusse/,
    // advent, adventen, adventskonsert - men inte adventure/adventist.
    /^advent(?:en|s.*)?$/,
    // tomte, tomten, tomteverkstad, tomtar - men inte tomter (mark).
    /^tomte(?!r|bo)/,
    /^tomtar/,
    /^gl[öo]gg/,
    /^pepparkak/,
];

/** Titeln delad i ord: allt som inte är bokstav eller siffra skiljer. */
const ORDGRÄNS = /[^a-zåäöéèüø0-9]+/;

export function ärJulevent(titel: string | null | undefined): boolean {
    if (!titel) return false;
    for (const ord of titel.toLowerCase().split(ORDGRÄNS)) {
        if (ord.length < 3) continue;
        if (INTE_JUL.test(ord)) continue;
        if (JULORD.some(re => re.test(ord))) return true;
    }
    return false;
}
