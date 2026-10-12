/**
 * arrangorTyp.ts - vilken sorts arrangör står bakom ett event?
 *
 *   riks      - församlingar, PRO, Korpen, studieförbund, hembygd, bibliotek m.fl.
 *               Riksomfattande källor som ger samma grundbrus i varje kommun.
 *   plattform - Tickster, Ticketmaster, Billetto, Facebook m.fl. Riktiga event,
 *               men arrangören syns inte.
 *   lokal     - ortens egna arrangörer och kalendrar.
 *
 * Delas av city-gaps (vilken stad ska maxas härnäst?) och ortsrapporten till
 * kommunerna. Ren logik, testas i ortsrapport.test.ts.
 */

export const RX_PARAPLY = /församling|pastorat|svenska kyrkan|domkyrko|\bkyrkan\b|\bPRO\b|Korpen|\bABF\b|Studieförbundet Vuxenskolan|Medborgarskolan|Bilda|\bNBV\b|Folkuniversitetet|Studiefrämjandet|Naturskyddsförening|Friluftsfrämjandet|Röda Korset|Rotary|Hembygdsförening|bibliotek|Riksteatern|Sensus|equmenia/i;
export const RX_AGG = /^(Tickster|TicketMaster|Ticketmaster|Billetto|Eventbrite|Nortic|Kulturbiljetter|RaceID|Facebook|Meetup|Eventim)$/i;

export type ArrangorTyp = 'lokal' | 'riks' | 'plattform';

export function arrangorTyp(hostName: string | null | undefined): ArrangorTyp {
    const host = (hostName ?? '').trim();
    if (RX_AGG.test(host)) return 'plattform';
    if (RX_PARAPLY.test(host)) return 'riks';
    return 'lokal';
}
