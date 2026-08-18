/**
 * eventReminderService.ts — på/av för event-påminnelser (notisklockan på kortet).
 *
 * Kontrakt mot notis-pipelinen i backend (ÄNDRA INTE utan att synka den):
 *  - Collection `eventReminderPrefs`, dokument-id `${slug}_${uid}` där slug =
 *    eventShareSlug(eventId) — samma stabila hash som /e/[slug]-delningen och
 *    eventStats använder (rå-id:t för skrapade event är en URL och därmed
 *    ogiltigt som doc-id).
 *  - Fält: { uid, eventId, slug, times, eventStart, createdAt } där `times`
 *    är de påminnelsefönster som ÄNNU INTE passerat vid klicket — backend
 *    skickar en notis per fönster (8 h/3 h/1 h före samt vid start).
 *  - Klockan är en ren på/av-toggle: på = setDoc (skriver om hela dokumentet),
 *    av = deleteDoc. Klienten läser/lyssnar BARA på sitt eget dokument.
 */
import { doc, setDoc, deleteDoc, onSnapshot, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { eventShareSlug } from '../utils/eventShareSlug';

/** Påminnelsefönstren backend känner till — hur långt före start notisen går ut. */
export type ReminderTime = '8h' | '3h' | '1h' | 'start';

// Fönstren i utskicksordning (tidigast först). msBefore = avstånd till start.
const REMINDER_WINDOWS: { key: ReminderTime; msBefore: number }[] = [
    { key: '8h', msBefore: 8 * 60 * 60 * 1000 },
    { key: '3h', msBefore: 3 * 60 * 60 * 1000 },
    { key: '1h', msBefore: 1 * 60 * 60 * 1000 },
    { key: 'start', msBefore: 0 },
];

/**
 * Fönstren som fortfarande hinns med: klickar man 5 h före start är 8h-fönstret
 * redan passerat → ['3h','1h','start']. Efter start är listan tom (klockan ska
 * då vara inaktiverad i UI:t).
 */
export function remainingReminderTimes(eventStart: Date, nowMs: number): ReminderTime[] {
    return REMINDER_WINDOWS
        .filter(w => nowMs < eventStart.getTime() - w.msBefore)
        .map(w => w.key);
}

const reminderDocRef = (eventId: string, uid: string) =>
    doc(db, 'eventReminderPrefs', `${eventShareSlug(eventId)}_${uid}`);

/**
 * Lyssna på om användaren har påminnelser PÅ för eventet (dokumentet finns).
 * Fel (t.ex. rules ännu ej deployade) rapporteras som "av" — klockan får
 * aldrig fälla kortet.
 */
export function subscribeEventReminder(
    eventId: string,
    uid: string,
    cb: (on: boolean) => void,
): () => void {
    return onSnapshot(
        reminderDocRef(eventId, uid),
        snap => cb(snap.exists()),
        () => cb(false),
    );
}

/**
 * Slå PÅ påminnelser: skriver dokumentet med de fönster som ännu hinns med.
 * Returnerar fönstren (för bekräftelsetoasten). Tom lista ⇒ inget skrivs —
 * eventet har redan börjat och det finns inget att påminna om.
 */
export async function enableEventReminder(
    evt: { id: string; time: Date },
    uid: string,
): Promise<ReminderTime[]> {
    const times = remainingReminderTimes(evt.time, Date.now());
    if (times.length === 0) return times;
    await setDoc(reminderDocRef(evt.id, uid), {
        uid,
        eventId: evt.id,
        slug: eventShareSlug(evt.id),
        times,
        eventStart: Timestamp.fromDate(evt.time),
        createdAt: serverTimestamp(),
    });
    return times;
}

/** Slå AV påminnelser: raderar dokumentet. */
export async function disableEventReminder(eventId: string, uid: string): Promise<void> {
    await deleteDoc(reminderDocRef(eventId, uid));
}
