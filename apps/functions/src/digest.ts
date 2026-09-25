/** Veckans helgtips (push, torsdagar 16:30): weeklyWeekendDigest. */
import * as admin from "firebase-admin";
import { db, region } from './shared';
import { sendPushToUser } from './utils/push';
import { weekendRange, isoWeekId, pickWeekendDigest, digestPushText, DigestEvent } from './utils/weekendDigest';
import { DIGEST_CITY_BY_SLUG } from './utils/digestCities';

// VECKANS HELGTIPS (push, torsdagar 16:30)
// ==============================

/**
 * Retention-loopen: "Vad händer i helgen i din stad" — EN push per vecka till
 * alla konton som valt en stad (users.citySlug, profilpanelen/registreringen)
 * och inte stängt av helgtipset (users.weeklyDigest === false; på/av-raden
 * bor i profilpanelen). Enhetens notis-avstängning respekteras gratis:
 * sendPushToUser skickar bara till tokens som finns kvar i fcmTokens.
 *
 * EVENTDATAN LÄSES INTE UR FIRESTORE (järnregeln): helgens utbud kommer ur
 * det publika events-destinations-aggregatet på hostingen — exakt fälten
 * urvalet behöver (titel/tid/position/kategori/pop), noll reads, och samma
 * data som kartan visar. Urvalet (radie 10 km, tröskel, rankning, texten)
 * ligger rent i utils/weekendDigest.ts med tester.
 *
 * Dedupe: weeklyDigestSends/{isoVecka}_{uid} claimas med create() före varje
 * utskick — samma exakt-en-gång-mönster som eventReminderSends. Collectionen
 * är stängd för klienter (default-deny i rules).
 */
export const weeklyWeekendDigest = region
    .runWith({ memory: '512MB', timeoutSeconds: 300 })
    .pubsub.schedule('30 16 * * 4')
    .timeZone('Europe/Stockholm')
    .onRun(async () => {
        // 1) Mottagarna, grupperade per stad. select() = fältmask (egress).
        const usersSnap = await db.collection('users').select('citySlug', 'weeklyDigest').get();
        const byCity = new Map<string, string[]>();
        usersSnap.docs.forEach(d => {
            const slug = d.get('citySlug');
            if (typeof slug !== 'string' || !slug) return;
            if (d.get('weeklyDigest') === false) return;
            const arr = byCity.get(slug);
            if (arr) arr.push(d.id); else byCity.set(slug, [d.id]);
        });
        if (byCity.size === 0) {
            console.log('[digest] Inga mottagare med vald stad — inget att skicka.');
            return null;
        }

        // 2) Helgens utbud ur det publika aggregatet. Cache-buster så ingen
        //    mellanlagring serverar torsdagens push gårdagens data.
        const res = await fetch(`https://vadkul.se/events-destinations.json?digest=${Date.now()}`);
        if (!res.ok) throw new Error(`events-destinations.json svarade ${res.status}`);
        const data = await res.json() as { events?: DigestEvent[] };
        const events = Array.isArray(data.events) ? data.events : [];
        if (events.length === 0) {
            console.warn('[digest] Aggregatet var tomt — avbryter hellre än att pusha nonsens.');
            return null;
        }

        const range = weekendRange(new Date());
        const week = isoWeekId(range.start);
        let citiesSent = 0;
        let delivered = 0;

        for (const [slug, uids] of byCity) {
            const city = DIGEST_CITY_BY_SLUG.get(slug);
            if (!city) continue; // okänd/gammal slug — tyst vidare
            const digest = pickWeekendDigest(events, city, range);
            if (!digest) continue; // för tunn helg → hellre tyst än "2 event"
            const { title, body } = digestPushText(city, digest.count, digest.picks);
            // Stadssidan listar helgen dag för dag — bättre landning för en
            // översiktsnotis än kartans nu-läge.
            const url = `/evenemang/${slug}`;

            for (const uid of uids) {
                try {
                    await db.collection('weeklyDigestSends')
                        .doc(`${week}_${uid}`)
                        .create({ uid, citySlug: slug, week, sentAt: admin.firestore.Timestamp.now() });
                } catch {
                    continue; // redan skickad denna vecka
                }
                try {
                    delivered += await sendPushToUser(uid, { title, body, url, type: 'weeklyDigest' }, { ttlSeconds: 24 * 3600 });
                } catch (err) {
                    console.error(`[digest] Push till ${uid} (${slug}) misslyckades:`, err);
                }
            }
            citiesSent++;
        }
        console.log(`[digest] Helgtips ${week}: ${citiesSent} städer, ${delivered} leveranser.`);
        return null;
    });
