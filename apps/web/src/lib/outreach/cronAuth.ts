// lib/outreach/cronAuth.ts
//
// Maskinvägen in i outreach-API:t: en delad hemlighet i stället för en
// Firebase-ID-token, eftersom en cron inte kan logga in som en användare.
// Samma nyckel öppnar bara /plan (skapa dagens utkast) och /ready (läsa dem) —
// aldrig något som ändrar utfall eller kontakter.

import { timingSafeEqual } from 'crypto';

// Kort nyckel = ingen nyckel: en gissningsbar hemlighet vore en öppen
// utkastgenerator som kostar Claude-anrop. 32 tecken är kravet, och en
// saknad eller för kort env stänger cron-vägen helt (då gäller requireAdmin).
const MIN_SECRET_LENGTH = 32;

/** Jämför i konstant tid — en tidsläckande jämförelse ger bort nyckeln. */
export function isCronCall(request: Request): boolean {
    const secret = process.env.OUTREACH_CRON_SECRET ?? '';
    if (secret.length < MIN_SECRET_LENGTH) return false;

    const header = request.headers.get('authorization') ?? '';
    if (!header.startsWith('Bearer ')) return false;

    const given = Buffer.from(header.slice(7).trim());
    const want = Buffer.from(secret);
    return given.length === want.length && timingSafeEqual(given, want);
}
