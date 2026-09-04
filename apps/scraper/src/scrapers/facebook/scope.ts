/**
 * Stad-scope för riktade Facebook-körningar.
 *
 * `npm run scrape-fb -- --city=Piteå` kör bara stadssöken för Piteå plus
 * sidbevakningarna med city 'Piteå' — minuter i stället för nattkedjans
 * timmar. Utan scope matchar allt (nattkedjans beteende är oförändrat).
 */

export function matchesCityScope(city: string | null | undefined, onlyCity: string | null | undefined): boolean {
    const scope = (onlyCity ?? '').trim().toLocaleLowerCase('sv');
    if (!scope) return true;
    return (city ?? '').trim().toLocaleLowerCase('sv') === scope;
}

/** `--city=Piteå` ur argv (tomt värde = inget scope). */
export function parseCityArg(argv: readonly string[]): string | undefined {
    const arg = argv.find((a) => a.startsWith('--city='));
    const value = arg?.slice('--city='.length).trim();
    return value || undefined;
}
