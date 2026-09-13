/**
 * eveningLanding — kvällslandningens dagval (13/9): landar man på kartan sent
 * på kvällen, när dagens ALLA event har varit, ska kartan öppna på IMORGON i
 * stället för att visa en död dag. Ren funktion — sidans landningseffekt
 * (page.tsx) avgör NÄR den får tillämpas (en gång, aldrig vid djuplänk,
 * aldrig efter att användaren rört dag/period); kameran rörs aldrig.
 *
 * Gränsen för "har varit" är den delade `isEventPast` (v2MapBricka) — samma
 * regel som markördämpning, kortet och stadssidorna, inklusive kl 20-klippet
 * för event utan klockslag. Uppfinn ingen egen gräns.
 *
 * En dag HELT utan event byter INTE dag — det är tom-promptens jobb
 * (stadsrutans mått), och ett automatiskt hopp där hade maskerat att staden
 * faktiskt saknar utbud i dag.
 */
import type { LinkEvent } from '@/types';
import { isEventPast } from '@/components/v2/v2MapBricka';

function isSameLocalDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/** True när dagens eventlista är icke-tom och samtliga har varit. */
export function shouldLandOnTomorrow(events: LinkEvent[], now: Date): boolean {
    let sawToday = false;
    for (const e of events) {
        if (!e.time || !isSameLocalDay(e.time, now)) continue;
        sawToday = true;
        if (!isEventPast(e, now.getTime())) return false;
    }
    return sawToday;
}
