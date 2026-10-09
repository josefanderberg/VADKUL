/**
 * Vänskapens tillståndsmaskin (spår 3, 7/10 kväll - "man kan gå in på sina
 * vänners profiler"). REN logik så Firestore-skrivningarna aldrig kan glida
 * isär mellan ytorna (inbjudningsbannern i kartkortets footer och
 * profilpanelens vänlista skriver exakt samma dokumentpar).
 *
 * Datamodellen är den BEFINTLIGA undersamlingen users/{uid}/friends/{vänUid}
 * (fanns redan i firestore.rules sedan v1) - ett dokument PER SIDA av
 * relationen, med status sedd från ÄGARENS håll:
 *
 *   users/A/friends/B  status 'outgoing'  = A har frågat B
 *   users/B/friends/A  status 'incoming'  = B har en förfrågan från A
 *   båda               status 'accepted'  = vänner
 *
 * Övergångarna skriver alltid BÅDA dokumenten (atomiskt via writeBatch i
 * friendService) så ingen sida kan bli ensam kvar:
 *
 *   förfrågan: (saknas, saknas) → (outgoing hos mig, incoming hos dig)
 *   acceptera: (incoming hos mig, outgoing hos dig) → (accepted, accepted)
 *   avböj/ångra/ta bort vän: → (raderad, raderad)
 *
 * Namn + bild denormaliseras in i raden när förfrågan skapas, så vänlistan
 * kan visas med EN query i stället för en users-läsning per vän (CLAUDE.md:
 * Firestore-reads/egress är största driftkostnaden).
 */

export type FriendDocStatus = 'incoming' | 'outgoing' | 'accepted';

/** En rad i MIN friends-undersamling - uid är den andra personens. */
export interface FriendRow {
    uid: string;
    name: string | null;
    photoURL: string | null;
    status: FriendDocStatus;
}

/** Den som står bakom en skrivning - namn/bild denormaliseras in i raden. */
export interface FriendPerson {
    uid: string;
    name?: string | null;
    photoURL?: string | null;
}

/** En dokumentskrivning: users/{owner}/friends/{friend}. data null = radera. */
export interface FriendWrite {
    owner: string;
    friend: string;
    data: { status: FriendDocStatus; name?: string; photoURL?: string } | null;
}

/** Namn klipps till reglernas tak (80) och tomma strängar blir utelämnade. */
function personFields(p: FriendPerson): { name?: string; photoURL?: string } {
    const name = typeof p.name === 'string' ? p.name.trim().slice(0, 80) : '';
    const photo = typeof p.photoURL === 'string' && /^https:\/\//.test(p.photoURL)
        ? p.photoURL.slice(0, 500) : '';
    return { ...(name ? { name } : {}), ...(photo ? { photoURL: photo } : {}) };
}

/** Tolka ett Firestore-dokument defensivt (som parseRsvpLocal). */
export function parseFriendRow(id: string, data: unknown): FriendRow | null {
    if (!id || !data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (d.status !== 'incoming' && d.status !== 'outgoing' && d.status !== 'accepted') return null;
    return {
        uid: id,
        name: typeof d.name === 'string' && d.name.trim() ? d.name.trim() : null,
        photoURL: typeof d.photoURL === 'string' && d.photoURL ? d.photoURL : null,
        status: d.status,
    };
}

/** Skicka vänförfrågan: min 'outgoing'-rad (med DIN profil i) + din
 *  'incoming'-rad (med MIN profil i). Tom lista = ogiltig (sig själv). */
export function friendRequestWrites(me: FriendPerson, other: FriendPerson): FriendWrite[] {
    if (!me.uid || !other.uid || me.uid === other.uid) return [];
    return [
        { owner: me.uid, friend: other.uid, data: { status: 'outgoing', ...personFields(other) } },
        { owner: other.uid, friend: me.uid, data: { status: 'incoming', ...personFields(me) } },
    ];
}

/** Acceptera: BARA från en faktisk 'incoming' hos mig - båda raderna blir
 *  'accepted'. (Reglerna låser samma övergång på serversidan.) */
export function friendAcceptWrites(
    myUid: string,
    otherUid: string,
    myCurrent: FriendDocStatus | null,
): FriendWrite[] {
    if (!myUid || !otherUid || myUid === otherUid || myCurrent !== 'incoming') return [];
    return [
        { owner: myUid, friend: otherUid, data: { status: 'accepted' } },
        { owner: otherUid, friend: myUid, data: { status: 'accepted' } },
    ];
}

/** Avböj förfrågan, ångra skickad eller ta bort vän - samma sak i datat:
 *  båda raderna raderas. */
export function friendRemoveWrites(myUid: string, otherUid: string): FriendWrite[] {
    if (!myUid || !otherUid || myUid === otherUid) return [];
    return [
        { owner: myUid, friend: otherUid, data: null },
        { owner: otherUid, friend: myUid, data: null },
    ];
}

export interface FriendBuckets {
    /** Förfrågningar TILL mig - överst i panelen, de kräver ett svar. */
    incoming: FriendRow[];
    accepted: FriendRow[];
    /** Skickade, obesvarade - visas dämpat med ångra. */
    outgoing: FriendRow[];
}

/** Dela upp och sortera vänlistan för panelen: namnordning (sv), namnlösa
 *  sist. Muterar inte indata. */
export function bucketFriendRows(rows: FriendRow[]): FriendBuckets {
    const byName = (a: FriendRow, b: FriendRow) => {
        if (a.name === null && b.name === null) return a.uid < b.uid ? -1 : 1;
        if (a.name === null) return 1;
        if (b.name === null) return -1;
        return a.name.localeCompare(b.name, 'sv');
    };
    const pick = (s: FriendDocStatus) => rows.filter(r => r.status === s).sort(byName);
    return { incoming: pick('incoming'), accepted: pick('accepted'), outgoing: pick('outgoing') };
}
