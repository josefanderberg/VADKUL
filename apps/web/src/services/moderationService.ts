/**
 * Moderering i eventchatten - Firestore-rören för anmälan och blockering.
 * Port av appens vadkul-app/src/data/moderering.ts: SAMMA dokument
 * (reports/{auto-id} och users/{uid}/blocked/{blockeradUid}) så en
 * blockering på webben gäller i appen och tvärtom. Formerna och filtret är
 * REN logik i utils/chatModeration (testad); här bor skrivningarna och en
 * liten delad butik så chatten i eventkortet och Vänner i profilpanelen ser
 * samma blockeringslista utan att läsa den två gånger.
 *
 * REGLERNA (firestore.rules): reports §6 formlåst mot chatReportDoc,
 * users/{uid}/blocked bara för ägaren. Tills blocked-regeln är deployad
 * nekas läsning och blockering - listan blir tom och UI:t säger "kunde inte
 * blockera" i stället för att låtsas.
 *
 * Läsningar: blockeringslistan hämtas EN gång per inloggat konto och besök
 * (getDocs, ingen stående lyssnare - reads-budgeten), först när en chatt
 * eller Vänner-mappen faktiskt visas.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
    addDoc, collection, deleteDoc, doc, getDocs, limit as qLimit,
    query, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
    addHidden, blockWrites, parseBlockRow, parseHiddenList, unblockWrite,
    type BlockRow, type ChatReportDoc,
} from '../utils/chatModeration';

/** Anmälda meddelanden - dolda för en själv i den här webbläsaren. */
const HIDDEN_KEY = 'vadkul_dolda_chattmeddelanden';

interface State {
    /** Kontot listan gäller - byts kontot börjar butiken om. */
    uid: string | null;
    rows: BlockRow[];
    blocked: ReadonlySet<string>;
    hidden: ReadonlySet<string>;
    loaded: boolean;
}

const EMPTY: ReadonlySet<string> = new Set();
const INITIAL: State = { uid: null, rows: [], blocked: EMPTY, hidden: EMPTY, loaded: false };
let state: State = INITIAL;
const listeners = new Set<() => void>();

function setState(next: Partial<State>) {
    state = { ...state, ...next };
    if (next.rows) state.blocked = new Set(next.rows.map(r => r.uid));
    listeners.forEach(l => l());
}

function subscribe(l: () => void) {
    listeners.add(l);
    return () => { listeners.delete(l); };
}

// ── DÖLJLISTAN (anmälda meddelanden) ──────────────────────────────────────

let hiddenList: string[] = [];
let hiddenLoaded = false;

function loadHidden() {
    if (hiddenLoaded || typeof window === 'undefined') return;
    hiddenLoaded = true;
    let saved: string[] = [];
    try { saved = parseHiddenList(window.localStorage.getItem(HIDDEN_KEY)); } catch { /* privat läge */ }
    // Hann man anmäla något innan listan lästes vinner båda.
    hiddenList = hiddenList.reduce((acc, id) => addHidden(acc, id), saved);
    setState({ hidden: new Set(hiddenList) });
}

/** Göm ett meddelande för mig (efter anmälan) - direkt och i webbläsaren. */
export function hideMessage(id: string) {
    hiddenList = addHidden(hiddenList, id);
    setState({ hidden: new Set(hiddenList) });
    try { window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenList)); } catch { /* privat läge */ }
}

// ── BLOCKERINGSLISTAN ─────────────────────────────────────────────────────

let pending: { uid: string; p: Promise<void> } | null = null;

function loadBlocked(uid: string): Promise<void> {
    if (state.uid === uid && state.loaded) return Promise.resolve();
    if (pending?.uid === uid) return pending.p;
    if (state.uid !== uid) setState({ uid, rows: [], loaded: false });
    const p = getDocs(query(collection(db, 'users', uid, 'blocked'), qLimit(500)))
        .then(snap => snap.docs
            .map(d => parseBlockRow(d.id, d.data()))
            .filter((r): r is BlockRow => r !== null))
        // Nekat (reglerna ej deployade) eller nätfel: tom lista - chatten
        // visas som vanligt, och blockera säger själv till om den nekas.
        .catch(() => [] as BlockRow[])
        .then(loadedRows => {
            if (state.uid !== uid) return;
            // Blockerade man någon medan listan hämtades ska raden inte tappas.
            const known = new Set(loadedRows.map(r => r.uid));
            setState({ rows: [...loadedRows, ...state.rows.filter(r => !known.has(r.uid))], loaded: true });
        })
        .finally(() => { if (pending?.uid === uid) pending = null; });
    pending = { uid, p };
    return p;
}

export interface ModerationView {
    rows: BlockRow[];
    blocked: ReadonlySet<string>;
    hidden: ReadonlySet<string>;
    loaded: boolean;
}

const NO_ROWS: BlockRow[] = [];

/**
 * Blockeringslistan + döljlistan för det inloggade kontot. uid null =
 * inget hämtas (utloggad, eller Vänner-mappen hopfälld) - döljlistan gäller
 * ändå.
 */
export function useModeration(uid: string | null): ModerationView {
    const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
    useEffect(() => {
        loadHidden();
        if (uid) void loadBlocked(uid);
    }, [uid]);
    if (!uid || s.uid !== uid) {
        return { rows: NO_ROWS, blocked: EMPTY, hidden: s.hidden, loaded: false };
    }
    return s;
}

/** Blockera: min blocked-rad + båda vänraderna raderade i EN batch (en halv
 *  blockering där vänskapen överlevde vore värre än ingen). Kastar vid fel. */
export async function blockUser(myUid: string, other: { uid: string; name?: string | null }): Promise<void> {
    const w = blockWrites(myUid, other);
    if (!w) throw new Error('Ogiltig blockering');
    const batch = writeBatch(db);
    batch.set(doc(db, 'users', w.block.owner, 'blocked', w.block.blocked), {
        ...w.block.data,
        createdAt: serverTimestamp(),
    });
    for (const f of w.friends) batch.delete(doc(db, 'users', f.owner, 'friends', f.friend));
    await batch.commit();
    if (state.uid === myUid) {
        const row: BlockRow = { uid: other.uid, name: w.block.data?.name ?? null };
        setState({ rows: [...state.rows.filter(r => r.uid !== other.uid), row] });
    }
}

/** Häv blockering - bara min rad; vänskapen kommer inte tillbaka. */
export async function unblockUser(myUid: string, otherUid: string): Promise<void> {
    const w = unblockWrite(myUid, otherUid);
    if (!w) throw new Error('Ogiltig avblockering');
    await deleteDoc(doc(db, 'users', w.owner, 'blocked', w.blocked));
    if (state.uid === myUid) setState({ rows: state.rows.filter(r => r.uid !== otherUid) });
}

/** Skicka anmälan till reports och göm meddelandet för mig. Kastar vid fel -
 *  anroparen erbjuder mejlet (chatReportMailto) som reserv. */
export async function reportChatMessage(d: ChatReportDoc): Promise<void> {
    await addDoc(collection(db, 'reports'), { ...d, createdAt: serverTimestamp() });
    hideMessage(d.messageId);
}
