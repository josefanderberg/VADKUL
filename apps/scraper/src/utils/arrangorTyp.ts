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
 *
 * Biblioteken är grundbrus för city-gaps (Axiell-källorna finns i varje kommun),
 * men i underlaget till kommunen är de kommunens egen verksamhet - där räknas de
 * som lokala (bibliotekLokala). I Växjö 13/10 var biblioteken 121 av 511
 * evenemang och stadsbiblioteket ensamt 65, men saknades bland de lokala.
 */

export const RX_PARAPLY = /församling|pastorat|svenska kyrkan|domkyrko|\bkyrkan\b|\bPRO\b|Korpen|\bABF\b|Studieförbundet Vuxenskolan|Medborgarskolan|Bilda|\bNBV\b|Folkuniversitetet|Studiefrämjandet|Naturskyddsförening|Friluftsfrämjandet|Röda Korset|Rotary|Hembygdsförening|bibliotek|Riksteatern|Sensus|equmenia/i;
export const RX_BIBLIOTEK = /bibliotek/i;
export const RX_AGG = /^(Tickster|TicketMaster|Ticketmaster|Billetto|Eventbrite|Nortic|Kulturbiljetter|RaceID|Facebook|Meetup|Eventim)$/i;

export type ArrangorTyp = 'lokal' | 'riks' | 'plattform';

export function arrangorTyp(hostName: string | null | undefined, val: { bibliotekLokala?: boolean } = {}): ArrangorTyp {
    const host = (hostName ?? '').trim();
    if (RX_AGG.test(host)) return 'plattform';
    if (val.bibliotekLokala && RX_BIBLIOTEK.test(host)) return 'lokal';
    if (RX_PARAPLY.test(host)) return 'riks';
    return 'lokal';
}
