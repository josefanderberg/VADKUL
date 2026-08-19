/**
 * Etikett för hur länge en boost syns: "27 aug." — med årtal bara när
 * slutdatumet ligger i ett annat år än idag (en boost är max 90 dagar, så
 * det händer bara runt årsskiftet). Visas i eventkortet bredvid
 * Förläng boost-knappen, så köparen ser hur länge eventet lyfts fram.
 */
export function boostedUntilLabel(until: Date, now: Date = new Date()): string {
    const sameYear = until.getFullYear() === now.getFullYear();
    return until.toLocaleDateString('sv-SE', {
        day: 'numeric',
        month: 'short',
        ...(sameYear ? {} : { year: 'numeric' }),
    });
}
