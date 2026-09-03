import { db } from '../config/firebase';
import { upsertEvent, sqliteEventExists, getSqliteEvent, getSqlitePath, setEventTime, setEventCoords, setEventLocationName, setEventEndDate, setEventContent, setEventHost, getSyncMeta } from './sqliteHelper';
import { sanitizeEndDate } from './eventEnd';
import { normalizeDateOnlyTime } from './swedishDate';
import { stamped } from './firestoreStamp';

/**
 * SQLite-spegeln delas av alla DB_TARGETs men innehåller PROD-data
 * (firestoreId:n pekar på prod-dokument). Mot emulatorn (DB_TARGET 2/3) får
 * spegeln därför inte kortsluta dubblettkollen — då skulle prod-id:n "bevisa"
 * att dokument finns i en emulator som är tom.
 */
const TRUST_MIRROR = (process.env.DB_TARGET || '1').trim() === '1';

/**
 * Läsningsräknare: hur många dubblett-/existenskollar som besvarades gratis av
 * SQLite-spegeln vs kostade en Firestore-query. Summeras vid processlut så
 * varje körning visar vad spegeln sparade.
 */
export const readStats = { sqliteHits: 0, firestoreQueries: 0 };

process.on('exit', () => {
    const total = readStats.sqliteHits + readStats.firestoreQueries;
    if (total === 0) return;
    console.log(
        `♻️  Dubblett-/existenskollar: ${total} st — ${readStats.sqliteHits} ur SQLite-spegeln (gratis), `
        + `${readStats.firestoreQueries} Firestore-queries.`,
    );
});

/**
 * "Bara datum"-event (hasSpecificTime=false) lagras annars som lokal midnatt,
 * vilket serialiseras till 22:00/23:00Z föregående dag. Pinna en neutral
 * eftermiddag (12:00Z ≈ 14:00 lokal) på rätt kalenderdag i stället. Returnerar
 * Date oförändrad om tiden saknas eller redan är specifik.
 */
function afternoonForDateOnly(time: unknown, hasSpecificTime: unknown): Date | unknown {
    if (hasSpecificTime !== false || !time) return time;
    const d = time instanceof Date ? time : new Date(time as string);
    if (isNaN(d.getTime())) return time;
    return normalizeDateOnlyTime(d);
}

console.log(`🗃️  SQLite-spegel: ${getSqlitePath()}`);

/**
 * Är spegeln auktoritativ? Ja när en (inkrementell) sync lyckats de senaste
 * 36 h — då finns varje stamped()-skrivet dokument lokalt och en miss i
 * spegeln betyder "finns inte". Utan färsk cursor dubbelkollas mot Firestore
 * som förut. Läses en gång per process. Sparade ~10 000 reads/natt (2026-08-23:
 * 28 535 spegelträffar men 10 339 onödiga Firestore-queries på missar).
 */
let mirrorFresh: boolean | null = null;
function isMirrorFresh(): boolean {
    if (mirrorFresh !== null) return mirrorFresh;
    const last = getSyncMeta('linkEvents.lastSyncAt');
    const ageH = last ? (Date.now() - new Date(last).getTime()) / 3_600_000 : Infinity;
    mirrorFresh = TRUST_MIRROR && ageH < 36;
    if (mirrorFresh) console.log(`🗃️  Spegeln auktoritativ (sync ${ageH.toFixed(1)} h sedan) — missar dubbelkollas inte mot Firestore`);
    return mirrorFresh;
}

export async function eventExistsInDb(url: string): Promise<boolean> {
    // Snabb lokal check först — undviker Firestore-läsning om vi redan har eventet.
    if (sqliteEventExists(url)) { readStats.sqliteHits++; return true; }
    if (!db) return false;
    if (isMirrorFresh()) { readStats.sqliteHits++; return false; }
    readStats.firestoreQueries++;
    const snapshot = await db.collection('linkEvents').where('url', '==', url).limit(1).get();
    return !snapshot.empty;
}

export async function getEventFromDb(url: string): Promise<any | null> {
    // SQLite-spegeln först: FB-skrapern anropar detta för VARJE watchlist-URL
    // varje natt — Firestore-först kostade en läsning per URL och natt.
    // Spegeln hålls färsk av nattkedjans inkrementella sync; okända URL:er
    // dubbelkollas fortfarande mot Firestore (täcker ofullständig spegel).
    if (TRUST_MIRROR) {
        const local = getSqliteEvent(url);
        if (local) { readStats.sqliteHits++; return local; }
    }
    if (db) {
        readStats.firestoreQueries++;
        const snapshot = await db.collection('linkEvents').where('url', '==', url).limit(1).get();
        if (!snapshot.empty) return snapshot.docs[0].data();
    }
    return TRUST_MIRROR ? null : getSqliteEvent(url);
}

/**
 * Uppdatera tiden för ett KÄNT event (full-refresh-körningar i runnern).
 * Skriver SQLite + Firestore. Returnerar true om något faktiskt ändrades.
 *
 * Skyddsregler:
 *  - <1 min skillnad → ingen ändring (ISO-brus).
 *  - Nedgradera aldrig: ett riktigt klockslag ersätts inte av en ren
 *    datum-rad (midnatt) på samma lokala dag — det betyder bara att källan
 *    visade serie-/listvyn denna gång. Flyttas DAGEN uppdaterar vi dock,
 *    även om nya tiden saknar klockslag.
 */
export async function refreshEventTime(
    url: string,
    newTime: Date,
    newHasSpecificTime: boolean,
): Promise<boolean> {
    const row = getSqliteEvent(url);
    if (!row?.time) return false;

    // Date-only → neutral eftermiddag (samma som addEventToDb) innan jämförelse.
    if (!newHasSpecificTime) newTime = afternoonForDateOnly(newTime, false) as Date;

    const stored = new Date(row.time);
    if (isNaN(stored.getTime())) return false;
    if (Math.abs(stored.getTime() - newTime.getTime()) < 60_000) return false;

    const sameLocalDay = stored.toLocaleDateString('sv-SE') === newTime.toLocaleDateString('sv-SE');
    const storedHasTime = row.hasSpecificTime === 1
        || (row.hasSpecificTime == null
            && !(stored.getHours() === 0 && stored.getMinutes() === 0)
            && !(stored.getUTCHours() === 0 && stored.getUTCMinutes() === 0));
    if (sameLocalDay && storedHasTime && !newHasSpecificTime) return false;

    try {
        setEventTime(url, newTime.toISOString(), newHasSpecificTime);
    } catch (err) {
        console.error('refreshEventTime: SQLite-uppdatering misslyckades:', err);
        return false;
    }
    if (db && row.firestoreId) {
        try {
            await db.collection('linkEvents').doc(row.firestoreId).update(stamped({ time: newTime }));
        } catch (err: any) {
            // NOT_FOUND (kod 5) = dokumentet rensat ur Firestore — SQLite räcker.
            if (err?.code !== 5) console.error('refreshEventTime: Firestore-uppdatering misslyckades:', err?.message);
        }
    }
    return true;
}

/**
 * Refresh-körning: källan levererar ett (validerat) SLUTDATUM för ett känt
 * event som saknar eller har ett annat — fyll på (SQLite + Firestore).
 * Valideringen (slut > start, max 30 dygn — utils/eventEnd) görs av anroparen.
 * Returnerar true om något ändrades.
 */
export async function refreshEventEndDate(url: string, endIso: string): Promise<boolean> {
    const row = getSqliteEvent(url);
    if (!row) return false;
    if ((row.endDate ?? null) === endIso) return false;
    try {
        setEventEndDate(url, endIso);
    } catch (err) {
        console.error('refreshEventEndDate: SQLite-uppdatering misslyckades:', err);
        return false;
    }
    if (db && row.firestoreId) {
        try {
            await db.collection('linkEvents').doc(row.firestoreId).update(stamped({ endDate: new Date(endIso) }));
        } catch (err: any) {
            if (err?.code !== 5) console.error('refreshEventEndDate: Firestore-uppdatering misslyckades:', err?.message);
        }
    }
    return true;
}

/**
 * Refresh-körning: källan levererar nu en riktig venue för ett känt event
 * vars sparade plats bara var stads-fallbacken. Uppdaterar locationName +
 * koordinater (SQLite + Firestore). Returnerar true om något ändrades.
 */
export async function refreshEventPlace(
    url: string,
    locationName: string,
    lat: number,
    lng: number,
    geocodedQuery: string,
    verified = true,
    geoPrecision: string | null = null,
): Promise<boolean> {
    const row = getSqliteEvent(url);
    if (!row) return false;
    if ((row.locationName ?? '') === locationName && Math.abs((row.lat ?? 0) - lat) < 1e-6) return false;
    try {
        setEventCoords(url, lat, lng, geocodedQuery, geoPrecision);
        setEventLocationName(url, locationName);
    } catch (err) {
        console.error('refreshEventPlace: SQLite-uppdatering misslyckades:', err);
        return false;
    }
    if (db && row.firestoreId) {
        try {
            await db.collection('linkEvents').doc(row.firestoreId).update(stamped({
                locationName, lat, lng, isLocationVerified: verified,
                ...(geoPrecision ? { geoPrecision } : {}),
            }));
        } catch (err: any) {
            if (err?.code !== 5) console.error('refreshEventPlace: Firestore-uppdatering misslyckades:', err?.message);
        }
    }
    return true;
}

/**
 * Refresh-körning: källan levererar nu en BÄTTRE beskrivning (hel i stället
 * för kapad vid gammalt tak, med å/ä/ö, utan �) och/eller ett pris där det
 * saknades. Vad som räknas som bättre avgörs av utils/contentRefresh — här
 * skrivs bara det som faktiskt skiljer sig (SQLite + Firestore via stamped()).
 * Returnerar true om något ändrades.
 */
export async function refreshEventContent(
    url: string,
    patch: { description?: string; price?: string },
): Promise<boolean> {
    const row = getSqliteEvent(url);
    if (!row) return false;
    const changes: { description?: string; price?: string } = {};
    if (patch.description !== undefined && patch.description !== (row.description ?? '')) changes.description = patch.description;
    if (patch.price !== undefined && patch.price !== (row.price ?? '')) changes.price = patch.price;
    if (Object.keys(changes).length === 0) return false;
    try {
        setEventContent(url, changes);
    } catch (err) {
        console.error('refreshEventContent: SQLite-uppdatering misslyckades:', err);
        return false;
    }
    if (db && row.firestoreId) {
        try {
            await db.collection('linkEvents').doc(row.firestoreId).update(stamped(changes));
        } catch (err: any) {
            if (err?.code !== 5) console.error('refreshEventContent: Firestore-uppdatering misslyckades:', err?.message);
        }
    }
    return true;
}

/**
 * Känt event fick en RIKTIG värd (FB-omskrapning: hostFallback hittade namnet
 * som DOM-instrumentet missade). Skriver SQLite + Firestore via stamped() —
 * addEventToDb rör inte redan kända Firestore-dokument. Returnerar true om
 * något ändrades.
 */
export async function refreshEventHost(url: string, hostName: string): Promise<boolean> {
    const row = getSqliteEvent(url);
    if (!row) return false;
    const h = hostName.trim();
    if (!h || h === (row.hostName ?? '')) return false;
    try {
        setEventHost(url, h);
    } catch (err) {
        console.error('refreshEventHost: SQLite-uppdatering misslyckades:', err);
        return false;
    }
    if (db && row.firestoreId) {
        try {
            await db.collection('linkEvents').doc(row.firestoreId).update(stamped({ hostName: h }));
        } catch (err: any) {
            if (err?.code !== 5) console.error('refreshEventHost: Firestore-uppdatering misslyckades:', err?.message);
        }
    }
    return true;
}

export async function addEventToDb(eventData: any) {
    // 0. Normalisera date-only-tid (annars lokal midnatt → 22:00/23:00Z). Görs
    //    här så BÅDE SQLite och Firestore (som läser eventData.time) får samma.
    eventData.time = afternoonForDateOnly(eventData.time, eventData.hasSpecificTime);
    // Slutdatum saneras CENTRALT (validEventEnd-reglerna: slut > start, max
    // 30 dygn) — legacy-scrapers får skicka källans råa värde; ogiltigt/
    // saknat fält skrivs inte alls.
    const cleanEnd = sanitizeEndDate(eventData.time, eventData.endDate);
    if (cleanEnd) eventData.endDate = cleanEnd; else delete eventData.endDate;

    // 1. Skriv ALLTID till lokal SQLite först — snabbt, offline-säkert.
    try {
        upsertEvent(eventData);
    } catch (err) {
        console.error('Failed to write event to local SQLite:', err);
    }

    // 2. Skriv till Firestore om initialiserat.
    if (!db) {
        console.warn(`Firebase not initialized. Sparat endast lokalt: ${eventData.title}`);
        return;
    }

    try {
        // Spegeln avgör dubblettkollen: upserten ovan bevarar firestoreId
        // (COALESCE), så finns id:t vet vi att dokumentet redan ligger i
        // Firestore — ingen query behövs. Bara rader UTAN id (nya event, eller
        // id tappat) dubbelkollas mot Firestore.
        if (TRUST_MIRROR && getSqliteEvent(eventData.url)?.firestoreId) {
            readStats.sqliteHits++;
            console.log(`Event already in Firestore: ${eventData.title}`);
            return;
        }

        readStats.firestoreQueries++;
        const existing = await db.collection('linkEvents').where('url', '==', eventData.url).limit(1).get();
        if (!existing.empty) {
            console.log(`Event already in Firestore: ${eventData.title}`);
            // Backfill firestoreId i SQLite om vi inte har den
            const firestoreId = existing.docs[0].id;
            upsertEvent({ ...eventData, firestoreId });
            return;
        }

        const ref = await db.collection('linkEvents').add(stamped(eventData));
        // Spara firestoreId tillbaka i SQLite så vi kan korsa referenser
        upsertEvent({ ...eventData, firestoreId: ref.id });
        console.log(`✅ Saved: ${eventData.title}`);
    } catch (error) {
        console.error('Failed to add event to Firestore (SQLite-versionen är sparad):', error);
    }
}

/** Firestore tillåter max 500 operationer per writeBatch — håll marginal. */
const FIRESTORE_BATCH_LIMIT = 450;

/** Dela upp en array i bitar om `size`. Exporterad för test. */
export function chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

/**
 * Batchad variant av addEventToDb — för runnern som annars gör N individuella
 * `.add()`-anrop (en Firestore-skrivning per event). Här:
 *   1. SQLite-upsert ALLTID först (snabbt, offline-säkert → ingen dataförlust
 *      även om Firestore-commit fallerar).
 *   2. Firestore-skrivningar samlas i writeBatch:ar (förgenererade doc-ID:n),
 *      committade i bitar om ≤450 ops.
 *
 * Dedup mot existerande event görs av ANROPAREN (runnern via eventExistsInDb)
 * innan event skickas hit — så denna funktion läser inte Firestore per event.
 * Inom samma batch dedupas dock på url så en källa som råkar lista samma url
 * två gånger inte skapar dubbletter.
 */
export async function addEventsBatch(
    events: any[],
): Promise<{ written: number; errors: string[] }> {
    const errors: string[] = [];
    if (events.length === 0) return { written: 0, errors };

    // Dedup på url inom batchen (sista vinner) + normalisera date-only-tid.
    // Slutdatum saneras centralt (samma regel som addEventToDb) — runnern
    // skickar redan validerat, men regeln ska gälla ALLA anropare.
    const byUrl = new Map<string, any>();
    for (const e of events) {
        const norm: any = { ...e, time: afternoonForDateOnly(e.time, e.hasSpecificTime) };
        const cleanEnd = sanitizeEndDate(norm.time, norm.endDate);
        if (cleanEnd) norm.endDate = cleanEnd; else delete norm.endDate;
        byUrl.set(e.url, norm);
    }
    const prepared = [...byUrl.values()];

    // 1. SQLite ALLTID — innan Firestore, så inget tappas vid commit-fel.
    for (const e of prepared) {
        try {
            upsertEvent(e);
        } catch (err) {
            console.error('Failed to write event to local SQLite:', err);
        }
    }

    if (!db) {
        console.warn(`Firebase not initialized. ${prepared.length} event sparade endast lokalt.`);
        return { written: 0, errors };
    }

    // 2. Firestore i batchar.
    let written = 0;
    for (const chunk of chunkArray(prepared, FIRESTORE_BATCH_LIMIT)) {
        const batch = db.batch();
        const refs: { id: string; e: any }[] = [];
        for (const e of chunk) {
            const ref = db.collection('linkEvents').doc(); // auto-ID, ingen nätverkstrafik
            batch.set(ref, stamped(e));
            refs.push({ id: ref.id, e });
        }
        try {
            await batch.commit();
            // Backfilla firestoreId i SQLite så korsreferenser funkar.
            for (const { id, e } of refs) {
                try {
                    upsertEvent({ ...e, firestoreId: id });
                } catch { /* SQLite redan skriven ovan — id-backfill är best effort */ }
            }
            written += refs.length;
        } catch (err) {
            errors.push(`batch-commit misslyckades (${refs.length} event): ${(err as Error).message}`);
            console.error('Firestore batch commit failed (SQLite-versionen är sparad):', err);
        }
    }
    return { written, errors };
}
