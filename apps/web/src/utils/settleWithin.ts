/**
 * Vänta på ett löfte, men högst `ms` millisekunder - sedan går vi vidare
 * ändå (resultatet blir 'timeout'). Löftet fortsätter i bakgrunden.
 *
 * Varför (8/10, "Försökte skapa konto, kom bara till vänta"): Firestores
 * setDoc löser sig först när SERVERN kvitterat skrivningen. På ett segt eller
 * strypt nät (mobil, adblock som stör Firestores kanal) kan det dröja hur
 * länge som helst - och registreringen stod och sa "Vänta…" fast kontot redan
 * var skapat. SDK:n köar skrivningen och skickar den när nätet går igen, så
 * vi behöver inte vänta in kvittot för att släppa användaren vidare.
 */
export async function settleWithin<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), ms); });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer);
    }
}

/** Hur länge kontoskapandet väntar på profilspeglingen innan det går vidare. */
export const PROFILE_WRITE_WAIT_MS = 6000;
