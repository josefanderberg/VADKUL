// ── Auto-hoppet till Imorgon ─────────────────────────────────────────────────
// Kommer man till en stad sent på kvällen när allt redan varit ska kartan
// själv stå på Imorgon - ingen ska behöva klicka till nästa dag som det första
// man gör (Josef 24/9). Frågan ställs om KARTANS RUTA, inte om hela landet:
// den gamla regeln tittade på alla event i Sverige, och någon storstad har
// nästan alltid något på kvällen, så hoppet kom aldrig i Växjö.
//
// "Har varit" är kartans egen gräns (isEventPast / NO_TIME_PAST_HOUR) - ingen
// egen klocka här. Ersätter kvällslandningen (utils/eveningLanding, 13/9),
// som hade samma hela-landet-fel.

import type { LinkEvent } from '../types';
import { isEventPast } from '../components/v2/v2MapBricka';

/** Från den här timmen räknas heldagsposter utan klockslag inte som ett skäl
 *  att stanna på idag: "loppis hela dagen" kl 18 är inte kvällens utbud. */
export const AUTO_BUMP_EVENING_HOUR = 17;

/** Finns det inget kvar att gå på idag? En HELT tom dag räknas som slut först
 *  på kvällen - dagtid är det tom-promptens jobb ("testa veckan"), ett hopp
 *  där hade maskerat att orten faktiskt saknar utbud idag (13/9-regeln). */
export function todayIsSpent(today: LinkEvent[], nowMs: number): boolean {
    const evening = new Date(nowMs).getHours() >= AUTO_BUMP_EVENING_HOUR;
    if (today.length === 0) return evening;
    const live = today.filter(e => !isEventPast(e, nowMs));
    if (live.length === 0) return true;
    if (!evening) return false;
    return live.every(e => e.hasSpecificTime === false);
}

/** Hoppa till Imorgon: idag är slut OCH imorgon har något. Är imorgon också
 *  tom är hoppet meningslöst - då får tom-prompten ("testa veckan") svara. */
export function shouldAutoBumpDay(today: LinkEvent[], tomorrow: LinkEvent[], nowMs: number): boolean {
    return todayIsSpent(today, nowMs) && tomorrow.length > 0;
}
