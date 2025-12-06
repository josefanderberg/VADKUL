import { useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '../components/layout/Layout';

export default function MigrationTool() {
  const [status, setStatus] = useState<string>('Redo att köra.');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  const runMigration = async () => {
    setStatus('Kör migrering... (Stäng inte fönstret)');
    setLog([]);
    addLog("Startar...");

    try {
      // 1. Hämta alla användare för att kunna matcha Email -> UID
      addLog("Hämtar användare...");
      const userSnap = await getDocs(collection(db, 'users'));
      const emailToUidMap: Record<string, string> = {};
      
      userSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.email) {
          emailToUidMap[data.email] = doc.id;
        }
      });
      addLog(`Hittade ${Object.keys(emailToUidMap).length} användare i databasen.`);

      // 2. Hämta alla events
      addLog("Hämtar events...");
      const eventsSnap = await getDocs(collection(db, 'events'));
      addLog(`Hittade ${eventsSnap.size} events.`);

      let fixedCount = 0;

      // 3. Loopa och fixa
      for (const eventDoc of eventsSnap.docs) {
        const data = eventDoc.data();
        const eventId = eventDoc.id;
        let needsUpdate = false;
        
        // --- FIXA HOST ---
        const host = data.host || {};
        // Om host saknar UID, försök hitta det via email
        if (!host.uid) {
          const foundUid = emailToUidMap[host.email];
          if (foundUid) {
            host.uid = foundUid;
            needsUpdate = true;
            addLog(`✅ [${data.title}] Fixade Host UID: ${foundUid}`);
          } else {
            // Fallback om vi inte hittar användaren
            host.uid = 'legacy_user'; 
            needsUpdate = true;
            addLog(`⚠️ [${data.title}] Kunde inte hitta UID för host ${host.email}. Satte 'legacy_user'.`);
          }
        }

        // --- FIXA ATTENDEES ---
        let newAttendees: any[] = [];
        if (Array.isArray(data.attendees)) {
          // Kolla om listan innehåller strängar (Gammalt format)
          const hasStrings = data.attendees.some((a: any) => typeof a === 'string');
          
          if (hasStrings) {
            needsUpdate = true;
            newAttendees = data.attendees.map((attendee: any) => {
              if (typeof attendee === 'string') {
                // Det är en email-sträng -> Gör om till objekt
                const uid = emailToUidMap[attendee] || 'legacy_user';
                return {
                  uid: uid,
                  email: attendee,
                  displayName: attendee.split('@')[0] // Gissning på namn
                };
              }
              return attendee; // Redan objekt
            });
            addLog(`✅ [${data.title}] Konverterade ${newAttendees.length} deltagare till objekt.`);
          } else {
            newAttendees = data.attendees;
          }
        }

        // 4. Spara om det behövs
        if (needsUpdate) {
          await updateDoc(doc(db, 'events', eventId), {
            host: host,
            attendees: newAttendees
          });
          fixedCount++;
        }
      }

      setStatus('Klart!');
      addLog(`🏁 Migrering slutförd. Uppdaterade ${fixedCount} events.`);

    } catch (err) {
      console.error(err);
      setStatus('Fel uppstod! Kolla konsolen.');
      addLog(`❌ ERROR: ${err}`);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-2xl font-bold mb-4">Databas-migrering</h1>
        <p className="mb-6 text-slate-600">
          Detta verktyg uppdaterar gamla events till det nya dataformatet (lägger till UID på host och gör om deltagare till objekt).
        </p>
        
        <button 
          onClick={runMigration}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg"
        >
          KÖR FIX-SCRIPT NU
        </button>

        <div className="mt-8 bg-slate-900 text-green-400 p-4 rounded-xl font-mono text-sm h-64 overflow-y-auto">
            <p className="text-white border-b border-slate-700 pb-2 mb-2">Logg:</p>
            {log.map((l, i) => (
                <div key={i}>{l}</div>
            ))}
            <div className="text-white mt-2 font-bold">{status}</div>
        </div>
      </div>
    </Layout>
  );
}