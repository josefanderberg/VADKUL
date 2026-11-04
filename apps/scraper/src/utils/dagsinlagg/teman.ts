/**
 * teman.ts - temahjulet. REN logik: vilket tema dagen får, om det blir bild
 * eller video, och vilket klipp ur inkorgen som passar. Ingen I/O.
 *
 * Hjulet (ägarbeslut 3/11 2026, docs/social/dagsinlagg.md):
 *   mån siffra, tis video (tidlös), ons gissa, tor helg, fre video
 *   (stämning), lör quiz, sön budskap.
 * Regler: aldrig samma tema två dagar i rad, "helg" bara tor/fre, ett klipp
 * används en gång, saknas klipp blir videodagen en bild i stället (dagen
 * får aldrig stå tom). Vikter låter rapporten (fas 5) stänga av ett tema
 * (vikt 0) utan kodändring.
 */

import type { Form, Inlagg, Klipp, KlippTema, Tema } from './typer';
import { plusDagar, stockholmMidnatt, stockholmVeckodag } from './tid';

/** Veckodag (0 = söndag) -> tema. */
export const VECKOHJUL: Record<number, Tema> = {
    1: 'siffra', 2: 'video', 3: 'gissa', 4: 'helg', 5: 'video', 6: 'quiz', 0: 'budskap',
};

/** Klipp-teman i den ordning en videodag helst tar dem. Tisdag tidlöst,
 *  fredag stämning. Okända klipp (utan tema) sist - granskaren får avgöra. */
export const KLIPP_PRIORITET: Record<number, KlippTema[]> = {
    2: ['ikvall', 'allt', 'hitta-pa', 'skapa-eget', 'bjud-med', 'regnig', 'budskap', 'fredag', 'okant'],
    5: ['fredag', 'bjud-med', 'ikvall', 'regnig', 'hitta-pa', 'allt', 'skapa-eget', 'budskap', 'okant'],
};
const ALLA_KLIPP_TEMAN: KlippTema[] = KLIPP_PRIORITET[2];

/** Vad en videodag blir när inkorgen är tom. Tisdagens budskap följer
 *  rotationen (ingen fast variant), annars blev söndag och tisdag samma
 *  "lägg upp ditt eget" två gånger på tre dagar. */
export const VIDEO_RESERV: Record<number, { tema: Tema; variant?: string }> = {
    2: { tema: 'budskap' },
    5: { tema: 'siffra', variant: 'helg' },
};

/** Budskapsvarianterna i rotationsordning. */
export const BUDSKAP_VARIANTER = ['skapa-eget', 'appen', 'bjud-med'] as const;
/** Budskapsvariant -> klipp-tema som kan bära den som video. */
const BUDSKAP_KLIPP: Record<string, KlippTema> = { 'skapa-eget': 'skapa-eget', 'bjud-med': 'bjud-med' };

/** Reservordningen när hjulets tema inte går (samma som i går, vikt 0). */
const RESERV_ORDNING: Tema[] = ['siffra', 'budskap', 'quiz', 'gissa', 'video'];

export interface TemaVal {
    tema: Tema;
    form: Form;
    variant?: string;
    /** Klippet som bär inlägget (form video). */
    klipp?: Klipp;
    /** true när hjulets tema byttes ut (tomt klipp, samma som i går, vikt 0). */
    reserv?: boolean;
    motivering: string;
}

export interface TemaVillkor {
    /** Inkorgen - alla kända klipp, status avgör vad som är ledigt. */
    klipp: Klipp[];
    /** Loggens inlägg (minst id, tema, variant, status). */
    tidigare: Pick<Inlagg, 'id' | 'tema' | 'variant' | 'status'>[];
    /** Manuellt val (--tema=) - hjulets regler kringgås. */
    tvinga?: Tema;
    /** 0 stänger av temat; annars rangordning i reservvalet (högre först). */
    vikter?: Partial<Record<Tema, number>>;
    /** En oanvänd milstolpe finns - budskapet blir den. */
    milstolpe?: boolean;
}

const ledigt = (k: Klipp): boolean => k.status === 'ny' || k.status === 'godkänd';

/** Veckodag (0 = sön) för ett svenskt väggdatum. */
export function veckodagFor(datum: string): number {
    return stockholmVeckodag(stockholmMidnatt(datum).getTime() + 12 * 3_600_000);
}

/**
 * Bästa lediga klipp för en prioritetslista: första tema i listan som har ett
 * ledigt klipp vinner; inom temat godkända med högst betyg först, sedan
 * äldst mottaget (det som väntat längst går ut först).
 */
export function valjKlipp(klipp: Klipp[], prioritet: KlippTema[] = ALLA_KLIPP_TEMAN, stad?: string): Klipp | null {
    for (const tema of prioritet) {
        const kandidater = klipp
            .filter(k => ledigt(k) && k.tema === tema && (stad === undefined || k.stad === stad))
            .sort((a, b) => {
                const ga = a.status === 'godkänd' ? 1 : 0, gb = b.status === 'godkänd' ? 1 : 0;
                if (ga !== gb) return gb - ga;
                if ((b.betyg ?? 0) !== (a.betyg ?? 0)) return (b.betyg ?? 0) - (a.betyg ?? 0);
                return a.mottaget - b.mottaget;
            });
        if (kandidater.length > 0) return kandidater[0];
    }
    return null;
}

/** Temat som gick ut (eller planerades) dagen innan `datum`, om något. */
export function gardagensTema(tidigare: TemaVillkor['tidigare'], datum: string): Tema | null {
    const igar = plusDagar(datum, -1);
    const rad = tidigare.find(i => i.id === igar && i.status !== 'vetad' && i.status !== 'misslyckad' && i.status !== 'förfallen');
    return rad ? rad.tema : null;
}

/** Nästa budskapsvariant i rotationen efter den senast publicerade. */
export function nastaBudskapsvariant(tidigare: TemaVillkor['tidigare']): string {
    const senaste = [...tidigare]
        .filter(i => i.tema === 'budskap' && i.status === 'publicerad' && i.variant && i.variant !== 'milstolpe')
        .sort((a, b) => (a.id < b.id ? 1 : -1))[0];
    if (!senaste) return BUDSKAP_VARIANTER[0];
    const i = (BUDSKAP_VARIANTER as readonly string[]).indexOf(senaste.variant!);
    return BUDSKAP_VARIANTER[(i + 1) % BUDSKAP_VARIANTER.length];
}

function vikt(v: TemaVillkor, tema: Tema): number {
    const w = v.vikter?.[tema];
    return w === undefined ? 1 : w;
}

/** Gör ett valt tema till ett konkret TemaVal (form, variant, klipp). */
function konkretisera(tema: Tema, datum: string, v: TemaVillkor, reserv: boolean, varfor: string, variant?: string): TemaVal {
    const veckodag = veckodagFor(datum);
    if (tema === 'budskap') {
        const vald = variant ?? (v.milstolpe ? 'milstolpe' : nastaBudskapsvariant(v.tidigare));
        const klippTema = BUDSKAP_KLIPP[vald];
        const klipp = klippTema ? valjKlipp(v.klipp, [klippTema]) : null;
        return klipp
            ? { tema, form: 'video', variant: vald, klipp, reserv, motivering: `${varfor}; budskap ${vald} som video (${klipp.fil})` }
            : { tema, form: 'bild', variant: vald, reserv, motivering: `${varfor}; budskap ${vald}` };
    }
    if (tema === 'siffra') {
        const vald = variant ?? (veckodag === 5 || veckodag === 6 ? 'helg' : 'vecka');
        return { tema, form: 'bild', variant: vald, reserv, motivering: varfor };
    }
    if (tema === 'video') {
        const klipp = valjKlipp(v.klipp, KLIPP_PRIORITET[veckodag] ?? ALLA_KLIPP_TEMAN);
        if (!klipp) throw new Error('konkretisera(video) utan klipp - valjTema ska ha tagit reserven');
        return { tema, form: 'video', variant: klipp.tema, klipp, reserv, motivering: `${varfor}; klipp ${klipp.fil}` };
    }
    // gissa, quiz, helg: bild här. Helg blir video i CLI:t när staden är vald (helgKlipp).
    return { tema, form: 'bild', variant, reserv, motivering: varfor };
}

/**
 * Dagens tema. `datum` är 'YYYY-MM-DD' i svensk tid.
 *   1. --tema= gäller rakt av (manuellt val, inga regler).
 *   2. Hjulets tema, om det inte är samma som i går och inte har vikt 0.
 *      En videodag utan klipp tar sin egen reserv (VIDEO_RESERV).
 *   3. Annars första i reservordningen (sorterad på vikt) som går.
 */
export function valjTema(datum: string, v: TemaVillkor): TemaVal {
    const veckodag = veckodagFor(datum);
    const harKlipp = !!valjKlipp(v.klipp, KLIPP_PRIORITET[veckodag] ?? ALLA_KLIPP_TEMAN);

    if (v.tvinga) {
        if (v.tvinga === 'video' && !harKlipp) {
            return konkretisera('budskap', datum, v, true, '--tema=video men inkorgen är tom, reserv budskap');
        }
        return konkretisera(v.tvinga, datum, v, false, `--tema=${v.tvinga}`);
    }

    const hjulet = VECKOHJUL[veckodag];
    const igar = gardagensTema(v.tidigare, datum);

    const gar = (t: Tema): boolean => {
        if (vikt(v, t) <= 0) return false;
        if (t === igar) return false;
        if (t === 'helg' && veckodag !== 4 && veckodag !== 5) return false;
        if (t === 'video' && !harKlipp) return false;
        return true;
    };

    if (gar(hjulet)) return konkretisera(hjulet, datum, v, false, `hjulet: ${hjulet}`);

    // Videodag utan klipp: den egna reserven, om den inte krockar med i går.
    if (hjulet === 'video' && vikt(v, 'video') > 0 && igar !== 'video') {
        const r = VIDEO_RESERV[veckodag];
        if (r && gar(r.tema)) {
            return konkretisera(r.tema, datum, v, true, `inkorgen tom, reserv ${r.tema}`, r.variant);
        }
    }

    const reserv = RESERV_ORDNING
        .filter(t => t !== hjulet && gar(t))
        .sort((a, b) => vikt(v, b) - vikt(v, a));
    const valt = reserv[0] ?? 'siffra';
    const varfor = igar === hjulet ? `${hjulet} gick i går` : `${hjulet} går inte i dag`;
    return konkretisera(valt, datum, v, true, `${varfor}, reserv ${valt}`);
}

/** Ett ledigt helg-klipp för en stad (jämförs på ASCII-slug, se logg.ts). */
export function helgKlipp(klipp: Klipp[], stadSlug: string): Klipp | null {
    return valjKlipp(klipp, ['helg'], stadSlug);
}
