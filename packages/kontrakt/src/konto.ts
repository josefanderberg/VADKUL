/**
 * Kontrakt för kontots API-yta (/v1/me, plattformsplanens fas 3): vad klienten
 * får skicka och vad servern svarar med. Valideringen är REN och delas - API:t
 * kör den på varje inkommande kropp, appen kan köra den före anropet, så
 * felmeddelandet är detsamma på båda sidor.
 *
 * Fälten är webbens registreringsfält (AuthContext.register): namn, ålder,
 * kön, stad och "har barn" - samma users/{uid}-dokument, så ett konto skapat
 * i appen är samma konto på webben. Servergivna fält (stjärnor, verifiering,
 * betyg) kan aldrig skickas hit - de finns inte i indatatypen och valideringen
 * släpper bara igenom kända nycklar (API3: excessive data åt andra hållet).
 */
import { CITIES } from './cities';

export const KÖN = ['kvinna', 'man', 'annat', 'vill_ej_ange'] as const;
export type Kön = (typeof KÖN)[number];

/** Det klienten får skicka i PUT /v1/me. Allt valfritt - PUT slår ihop. */
export interface MeProfilIn {
    displayName?: string;
    age?: number;
    gender?: Kön;
    /** Slug ur CITIES; null rensar staden. */
    citySlug?: string | null;
    hasChildren?: boolean;
}

/** Profilen GET/PUT /v1/me svarar med. */
export interface MeProfil {
    uid: string;
    email: string | null;
    displayName: string | null;
    age: number | null;
    gender: Kön | null;
    city: string | null;
    citySlug: string | null;
    hasChildren: boolean | null;
}

export const NAMN_MAX = 60;
export const ÅLDER_MIN = 13;
export const ÅLDER_MAX = 120;

export type Validering<T> = { ok: true; värde: T } | { ok: false; fel: string };

const TILLÅTNA = new Set<keyof MeProfilIn>(['displayName', 'age', 'gender', 'citySlug', 'hasChildren']);

/**
 * Validera en inkommande profilkropp. Okända nycklar är ett FEL (inte tyst
 * bortplockade) - en klient som skickar fält vi inte känner är trasig eller
 * elak, och båda ska få veta det.
 */
export function valideraMeProfilIn(raw: unknown): Validering<MeProfilIn> {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, fel: 'Kroppen måste vara ett objekt.' };
    const obj = raw as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
        if (!TILLÅTNA.has(k as keyof MeProfilIn)) return { ok: false, fel: `Okänt fält: ${k}` };
    }
    const ut: MeProfilIn = {};
    if ('displayName' in obj) {
        const n = obj.displayName;
        if (typeof n !== 'string') return { ok: false, fel: 'Namnet måste vara text.' };
        const t = n.trim().replace(/\s+/g, ' ');
        if (!t) return { ok: false, fel: 'Skriv ditt namn.' };
        if (t.length > NAMN_MAX) return { ok: false, fel: `Namnet får vara högst ${NAMN_MAX} tecken.` };
        ut.displayName = t;
    }
    if ('age' in obj) {
        const a = obj.age;
        if (typeof a !== 'number' || !Number.isInteger(a) || a < ÅLDER_MIN || a > ÅLDER_MAX) {
            return { ok: false, fel: `Åldern måste vara ett heltal mellan ${ÅLDER_MIN} och ${ÅLDER_MAX}.` };
        }
        ut.age = a;
    }
    if ('gender' in obj) {
        if (!(KÖN as readonly unknown[]).includes(obj.gender)) return { ok: false, fel: 'Okänt värde för kön.' };
        ut.gender = obj.gender as Kön;
    }
    if ('citySlug' in obj) {
        const s = obj.citySlug;
        if (s !== null && (typeof s !== 'string' || !CITIES.some(c => c.slug === s))) {
            return { ok: false, fel: 'Okänd stad.' };
        }
        ut.citySlug = s as string | null;
    }
    if ('hasChildren' in obj) {
        if (typeof obj.hasChildren !== 'boolean') return { ok: false, fel: 'hasChildren måste vara sant eller falskt.' };
        ut.hasChildren = obj.hasChildren;
    }
    return { ok: true, värde: ut };
}
