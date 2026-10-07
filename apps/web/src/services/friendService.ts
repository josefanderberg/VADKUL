// src/services/friendService.ts
import {
    collection, doc, getDoc, getDocs, limit as qLimit,
    query, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    friendAcceptWrites, friendRemoveWrites, friendRequestWrites, parseFriendRow,
    type FriendDocStatus, type FriendPerson, type FriendRow, type FriendWrite,
} from '../utils/friendStatus';
import { friendRsvpVisible, pickFriendEventIds, type FriendRsvpPick } from '../utils/friendEvents';

/**
 * Vänner (spår 3, 7/10 kväll). Datamodell + övergångar bor i utils/
 * friendStatus (REN, testad) - här är bara Firestore-rören. Varje åtgärd
 * skriver BÅDA sidornas dokument i EN writeBatch så relationen aldrig blir
 * halv; firestore.rules (friends-undersamlingen) låser samma övergångar på
 * serversidan, så en skrivning som utils-logiken vägrar nekas även där.
 *
 * Kräver riktigt konto (anonyma sessioner stoppas redan i UI:t - `user` ur
 * AuthContext är null för dem - och av !isAnonymous() i reglerna).
 */

function rowRef(owner: string, friend: string) {
    return doc(db, 'users', owner, 'friends', friend);
}

async function commitWrites(writes: FriendWrite[]): Promise<void> {
    if (writes.length === 0) throw new Error('Ogiltig vänåtgärd');
    const batch = writeBatch(db);
    for (const w of writes) {
        const ref = rowRef(w.owner, w.friend);
        if (w.data === null) {
            batch.delete(ref);
        } else if (w.data.status === 'accepted') {
            // Acceptera är en UPPDATERING av befintliga rader - reglerna
            // släpper bara diffen ['status'].
            batch.update(ref, { status: 'accepted' });
        } else {
            batch.set(ref, { ...w.data, createdAt: serverTimestamp() });
        }
    }
    await batch.commit();
}

// Sessionscache för andras namn/bild (users är publikt läsbar) - en läsning
// per person och besök. Delas av inbjudningsbannern och vänförfrågan.
export interface UserLite {
    uid: string;
    name: string | null;
    photoURL: string | null;
}
const userLiteCache = new Map<string, Promise<UserLite>>();

export function fetchUserLite(uid: string): Promise<UserLite> {
    let p = userLiteCache.get(uid);
    if (!p) {
        p = getDoc(doc(db, 'users', uid))
            .then(snap => {
                const d = snap.exists() ? snap.data() as { displayName?: unknown; photoURL?: unknown } : null;
                return {
                    uid,
                    name: typeof d?.displayName === 'string' && d.displayName.trim() ? d.displayName.trim() : null,
                    photoURL: typeof d?.photoURL === 'string' && d.photoURL ? d.photoURL : null,
                } satisfies UserLite;
            })
            .catch(() => ({ uid, name: null, photoURL: null }));
        userLiteCache.set(uid, p);
    }
    return p;
}

/** Skicka vänförfrågan. Motpartens namn/bild slås upp (cachat) så bådas
 *  rader blir läsbara utan extra uppslag sen. Kastar vid fel. */
export async function sendFriendRequest(me: FriendPerson, otherUid: string): Promise<void> {
    const other = await fetchUserLite(otherUid);
    await commitWrites(friendRequestWrites(me, other));
}

/** Acceptera en förfrågan - myCurrent är MIN rads status (måste vara
 *  'incoming', annars kastar vi innan Firestore ens tillfrågas). */
export async function acceptFriendRequest(
    myUid: string,
    otherUid: string,
    myCurrent: FriendDocStatus | null,
): Promise<void> {
    await commitWrites(friendAcceptWrites(myUid, otherUid, myCurrent));
}

/** Avböj förfrågan, ångra skickad eller ta bort vän - raderar båda raderna. */
export async function removeFriend(myUid: string, otherUid: string): Promise<void> {
    await commitWrites(friendRemoveWrites(myUid, otherUid));
}

/** MIN vänlista - en engångsläsning när sektionen fälls ut (ingen stående
 *  lyssnare: reads-budgeten, se CLAUDE.md). Fel → tom lista (sektionen visar
 *  tomläget i stället för att krascha panelen). */
export async function fetchMyFriends(uid: string): Promise<FriendRow[]> {
    try {
        const snap = await getDocs(query(collection(db, 'users', uid, 'friends'), qLimit(200)));
        return snap.docs
            .map(d => parseFriendRow(d.id, d.data()))
            .filter((r): r is FriendRow => r !== null);
    } catch {
        return [];
    }
}

/** MIN rad för en enskild person (inbjudningsbannern: är vi redan vänner?).
 *  null = ingen relation. */
export async function fetchMyFriendship(myUid: string, otherUid: string): Promise<FriendRow | null> {
    try {
        const snap = await getDoc(rowRef(myUid, otherUid));
        return snap.exists() ? parseFriendRow(snap.id, snap.data()) : null;
    } catch {
        return null;
    }
}

/** Vännens profilunderlag: namn/bild + eventurvalet (om hen visar det).
 *  EN users-läsning - eventen slås upp av anroparen (laddade datan eller
 *  /api/event, aldrig Firestore per event). */
export interface FriendProfileData {
    name: string | null;
    photoURL: string | null;
    /** false = vännen har stängt av synligheten (integritetsgrinden). */
    visible: boolean;
    picks: FriendRsvpPick[];
}

export async function fetchFriendProfile(uid: string): Promise<FriendProfileData> {
    try {
        const snap = await getDoc(doc(db, 'users', uid));
        const d = snap.exists() ? snap.data() as Record<string, unknown> : null;
        const visible = friendRsvpVisible(d);
        return {
            name: typeof d?.displayName === 'string' && (d.displayName as string).trim() ? (d.displayName as string).trim() : null,
            photoURL: typeof d?.photoURL === 'string' && d.photoURL ? d.photoURL as string : null,
            visible,
            picks: visible ? pickFriendEventIds(d?.goingEventIds, d?.interestedEventIds) : [],
        };
    } catch {
        return { name: null, photoURL: null, visible: false, picks: [] };
    }
}
