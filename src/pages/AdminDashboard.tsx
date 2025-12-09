import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Layout from '../components/layout/Layout';
import { CATEGORY_LIST, type EventCategoryType } from '../utils/categories';

// --- KONFIGURATION & KONSTANTER ---

const SWEDISH_CITIES = [
  { name: 'Växjö', lat: 56.87767, lng: 14.80906 },
  { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
  { name: 'Göteborg', lat: 57.7089, lng: 11.9746 },
  { name: 'Malmö', lat: 55.6050, lng: 13.0038 },
  { name: 'Uppsala', lat: 59.8586, lng: 17.6389 },
  { name: 'Lund', lat: 55.7047, lng: 13.1910 },
  { name: 'Umeå', lat: 63.8258, lng: 20.2630 },
  { name: 'Linköping', lat: 58.4109, lng: 15.6214 },
  { name: 'Örebro', lat: 59.2753, lng: 15.2134 },
  { name: 'Helsingborg', lat: 56.0465, lng: 12.6945 }
];

const RANDOM_TITLES = [
  "Morgonlöpning runt sjön", "Fika på stan", "Padel-match",
  "Programmerings-hackathon", "Kvällspromenad", "Utomhusbio",
  "Grillkväll", "Fotboll i parken", "Yoga i solen", "Lunchträff",
  "Stand-up kväll", "Loppis-runda", "Brädspelskväll", "Kajakpaddling"
];

// Hjälpfunktion för slumpad position i Sverige
const getRandomLocationInSweden = () => {
  const city = SWEDISH_CITIES[Math.floor(Math.random() * SWEDISH_CITIES.length)];
  const latOffset = (Math.random() - 0.5) * 0.15;
  const lngOffset = (Math.random() - 0.5) * 0.15;
  return {
    lat: city.lat + latOffset,
    lng: city.lng + lngOffset,
    cityName: city.name
  };
};

// NY HJÄLPFUNKTION: Slumpa en eventkategori
const getRandomCategory = (): EventCategoryType => {
  const randomIndex = Math.floor(Math.random() * CATEGORY_LIST.length);
  return CATEGORY_LIST[randomIndex].id;
}

// --- HUVUDKOMPONENT ---

export default function AdminDashboard() {
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // State för varningsmeddelande
  const [selectedUserId, setSelectedUserId] = useState('');
  const [warningMessage, setWarningMessage] = useState('');

  // Hämta användare vid start (för dropdown-listan)
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const userList = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        setUsers(userList);
        if (userList.length > 0) setSelectedUserId(userList[0].uid);
      } catch (e) {
        addLog("Kunde inte hämta användarlistan.");
      }
    };
    fetchUsers();
  }, []);

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // ---------------------------------------------------------
  // FUNKTION 1: SKAPA RANDOM EVENTS (SEED)
  // ---------------------------------------------------------

  // ---------------------------------------------------------
  // FUNKTION 1: SKAPA RANDOM EVENTS (SEED)
  // ---------------------------------------------------------
  const handleSeedEvents = async (count: number) => {
    if (!confirm(`Är du säker på att du vill skapa ${count} nya events?`)) return;

    setLoading(true);
    setLog([]); // Rensa logg
    addLog(`🚀 Startar generering av ${count} events...`);

    try {
      if (users.length === 0) throw new Error("Inga användare hittades att använda som hosts.");

      // Vi använder en batch om det är färre än 500, annars loop (Firestore limit)
      // För enkelhetens skull loopar vi här för att kunna logga framsteg
      let successCount = 0;

      for (let i = 0; i < count; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const randomTitle = RANDOM_TITLES[Math.floor(Math.random() * RANDOM_TITLES.length)];
        const location = getRandomLocationInSweden();
        const category = getRandomCategory(); // Hämta slumpmässig kategori

        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + Math.floor(Math.random() * 60)); // 0-60 dagar framåt
        futureDate.setHours(10 + Math.floor(Math.random() * 12), 0, 0);

        const minPart = 2; // Minst 2 deltagare
        const maxPart = 5 + Math.floor(Math.random() * 20); // Som tidigare

        const eventData = {
          title: `${randomTitle}`,
          description: `Detta är event #${i + 1} skapat av admin-verktyget.`,
          time: Timestamp.fromDate(futureDate),

          lat: location.lat,
          lng: location.lng,

          location: {
            name: `Genererad plats, ${location.cityName}`,
            distance: Math.floor(Math.random() * 5),
          },

          // Använd den slumpmässiga kategorin
          type: category, // 🔥 ÄNDRAD HÄR!
          price: Math.floor(Math.random() * 10) === 0 ? 0 : 50 + Math.floor(Math.random() * 150),
          minParticipants: minPart,
          maxParticipants: maxPart,
          minAge: 18,
          maxAge: 99,
          ageCategory: '18+',

          host: {
            uid: randomUser.uid,
            email: randomUser.email || 'unknown@test.com',
            displayName: randomUser.displayName || 'Anonym',
            name: randomUser.displayName || 'Anonym Testare',
            initials: randomUser.displayName ? randomUser.displayName.charAt(0).toUpperCase() : 'A',
            verified: Math.random() > 0.8,
            rating: 3 + Math.random() * 2,
            photoURL: null,
          },
          attendees: [],
          createdAt: Timestamp.now()
        };

        await addDoc(collection(db, 'events'), eventData);
        successCount++;
        if (successCount % 10 === 0) addLog(`...skapat ${successCount} av ${count}`);
      }

      addLog(`✅ Klart! ${successCount} events skapades.`);
    } catch (error: any) {
      addLog(`❌ Fel: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // FUNKTION 2: RENSA ALLA EVENTS
  // ---------------------------------------------------------
  const handleClearEvents = async () => {
    if (!confirm("⚠️ VARNING: Detta tar bort ALLA events i databasen permanent. Är du helt säker?")) return;

    setLoading(true);
    addLog("🗑️ Börjar rensa databasen...");

    try {
      const snap = await getDocs(collection(db, 'events'));
      const total = snap.size;

      if (total === 0) {
        addLog("Databasen är redan tom.");
        setLoading(false);
        return;
      }

      // Firestore batch delete
      const batch = writeBatch(db);
      snap.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      addLog(`✅ Raderade ${total} events.`);
    } catch (error: any) {
      addLog(`❌ Fel vid radering: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // FUNKTION 3: VARNA ANVÄNDARE
  // ---------------------------------------------------------
  const handleSendWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !warningMessage) return;

    setLoading(true);
    addLog(`📨 Skickar varning till användare ID: ${selectedUserId}...`);

    try {
      // Alternativ 1: Om du har en 'notifications' collection
      await addDoc(collection(db, 'notifications'), {
        userId: selectedUserId,
        message: warningMessage,
        type: 'warning',
        read: false,
        createdAt: Timestamp.now()
      });

      // Alternativ 2: Om du vill spara direkt på user-objektet (avkommentera om du föredrar det)
      /*
      const userRef = doc(db, 'users', selectedUserId);
      await updateDoc(userRef, {
         lastWarning: warningMessage,
         warningCount: increment(1)
      });
      */

      addLog(`✅ Varning skickad: "${warningMessage}"`);
      setWarningMessage(''); // Rensa input
    } catch (error: any) {
      addLog(`❌ Kunde inte skicka varning: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-6xl mx-auto">

          <header className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500">Hantera testdata och användare</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* VÄNSTER KOLUMN: ACTIONS */}
            <div className="space-y-6">

              {/* KORT 1: Generera Data */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold mb-4 text-green-700">🌱 Generera Testdata</h2>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-4">
                    Skapa slumpmässiga events utspridda i hela Sverige (Stockholm, Gbg, Malmö, Växjö m.fl).
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleSeedEvents(40)}
                      disabled={loading}
                      className="flex-1 bg-green-100 text-green-800 py-2 px-4 rounded-lg font-medium hover:bg-green-200 transition disabled:opacity-50"
                    >
                      +40 Events
                    </button>
                    <button
                      onClick={() => handleSeedEvents(100)}
                      disabled={loading}
                      className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg font-bold hover:bg-green-700 transition disabled:opacity-50"
                    >
                      +100 Events
                    </button>
                  </div>
                </div>
              </div>

              {/* KORT 2: Rensa Data */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold mb-4 text-red-600">⚠️ Farozon</h2>
                <p className="text-sm text-slate-600 mb-4">
                  Ta bort all data i `events`-samlingen. Går ej att ångra.
                </p>
                <button
                  onClick={handleClearEvents}
                  disabled={loading}
                  className="w-full bg-red-50 text-red-600 border border-red-200 py-3 px-4 rounded-lg font-bold hover:bg-red-100 transition disabled:opacity-50"
                >
                  🗑️ RADERA ALLA EVENTS
                </button>
              </div>

              {/* KORT 3: Varna Användare */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold mb-4 text-slate-800">📢 Skicka Varning</h2>
                <form onSubmit={handleSendWarning} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Välj användare</label>
                    <select
                      className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      {users.map(u => (
                        <option key={u.uid} value={u.uid}>
                          {u.displayName || u.email} ({u.uid.substring(0, 5)}...)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Meddelande</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-slate-300 rounded-lg"
                      placeholder="T.ex. Vänligen följ våra regler..."
                      value={warningMessage}
                      onChange={(e) => setWarningMessage(e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !warningMessage}
                    className="w-full bg-slate-800 text-white py-2 rounded-lg hover:bg-slate-900 disabled:opacity-50"
                  >
                    Skicka Meddelande
                  </button>
                </form>
              </div>

            </div>

            {/* HÖGER KOLUMN: LOGG */}
            <div className="h-full min-h-[500px]">
              <div className="bg-slate-900 rounded-xl p-4 h-full flex flex-col shadow-lg">
                <div className="flex justify-between items-center border-b border-slate-700 pb-2 mb-2">
                  <span className="text-green-400 font-mono font-bold">System Terminal</span>
                  <span className="text-slate-500 text-xs">{loading ? 'ARBETAR...' : 'VÄNTAR'}</span>
                </div>
                <div className="flex-1 overflow-y-auto font-mono text-xs md:text-sm space-y-1 pr-2">
                  {log.length === 0 && <span className="text-slate-600 italic">Ingen aktivitet än...</span>}
                  {log.map((entry, i) => (
                    <div key={i} className="text-green-300 border-l-2 border-slate-700 pl-2">
                      {entry}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}