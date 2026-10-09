// src/services/forturService.ts
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { clearPendingFortur, forturPost, readPendingFortur, type ForturTyp } from '../utils/forturInbjudan';

/**
 * Bokför förturen (8/10) när den inbjudna skapar konto ('konto') eller
 * svarar Kommer/Intresserad ('svar') - se utils/forturInbjudan. Best-effort:
 * kontot och svaret är huvudsaken och får aldrig fällas av bokföringen.
 *
 * Den väntande inbjudan töms först när skrivningen gått igenom, så ett
 * misslyckat 'svar' (offline, reglerna inte ute än) provas igen vid nästa
 * svar. Finns posten redan för paret nekar reglerna (bara create är
 * tillåtet) - inbjudaren är då redan bokförd.
 */
export async function recordForturInvite(inbjuden: string, typ: ForturTyp, eventSlug?: string): Promise<void> {
    const pending = readPendingFortur();
    if (!pending) return;
    // Egen länk (man testade sin inbjudan) - inget att bokföra, och den ska
    // inte ligga kvar och skugga en riktig inbjudan.
    if (pending.fran === inbjuden) {
        clearPendingFortur();
        return;
    }
    const post = forturPost(pending, inbjuden, typ, eventSlug);
    if (!post) return;
    try {
        await setDoc(doc(db, 'forturInbjudningar', post.id), { ...post.data, tid: serverTimestamp() });
        clearPendingFortur();
    } catch (err) {
        console.warn('Kunde inte bokföra förturen:', err);
    }
}
