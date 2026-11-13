/**
 * Den anonyma tips-identiteten, delad mellan samtidiga anrop (#164).
 *
 * Förut kollade ensureTipIdentity bara `auth.currentUser` och anropade sedan
 * signInAnonymously. Två tryck nära varandra (Kommer + Bjud med, eller ett
 * dubbeltryck) passerade båda kollen innan den första inloggningen var klar,
 * och då skapades två anonyma konton. Ungefär 7 % av de anonyma kontona kom
 * i par inom en sekund (mätt 31/10).
 *
 * Två skydd:
 * - Ett pågående anrop delas: alla som frågar medan inloggningen pågår får
 *   samma promise och samma uid. När den är klar (eller har kastat) börjar
 *   nästa anrop om.
 * - `ready` väntar tills Firebase har läst in en sparad session. Före det är
 *   currentUser null även för den som redan har ett konto på enheten, och då
 *   hade ett tidigt tryck skapat ett nytt konto i onödan.
 *
 * Ren logik utan firebase-import: AuthContext kopplar in auth-anropen.
 */
export interface AnonymousIdentityDeps {
    /** Löses när Firebase vet om det finns en sparad session (auth.authStateReady). */
    ready?: () => Promise<void>;
    /** uid för sessionen som är aktiv nu (inloggad eller anonym), annars null. */
    currentUid: () => string | null;
    /** Skapar en anonym session och ger dess uid. */
    signInAnonymously: () => Promise<string>;
}

export function sharedAnonymousIdentity(deps: AnonymousIdentityDeps): () => Promise<string> {
    let pending: Promise<string> | null = null;
    return () => {
        const uid = deps.currentUid();
        if (uid) return Promise.resolve(uid);
        if (!pending) {
            const p = (async () => {
                if (deps.ready) await deps.ready();
                return deps.currentUid() ?? await deps.signInAnonymously();
            })();
            pending = p;
            const clear = () => { if (pending === p) pending = null; };
            p.then(clear, clear);
        }
        return pending;
    };
}
