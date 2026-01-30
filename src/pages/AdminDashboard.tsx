import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, Timestamp, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/layout/Layout';
import { CATEGORY_LIST, type EventCategoryType } from '../utils/categories';
import { notificationService } from '../services/notificationService';
import { CheckCircle2, XCircle, ShieldAlert, User, MessageSquare } from 'lucide-react';
import { feedbackService } from '../services/feedbackService';
import type { FeedbackItem } from '../types';
import toast from 'react-hot-toast';

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  // Verification State
  const [pendingVerifications, setPendingVerifications] = useState<any[]>([]);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  // Feedback State
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);

  // Pagination for user list
  const [visibleCount, setVisibleCount] = useState(5);

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

        // Filter pending verifications
        const pending = userList.filter((u: any) => u.verificationStatus === 'pending');
        setPendingVerifications(pending);

        if (userList.length > 0) setSelectedUserId(userList[0].uid);
      } catch (e) {
        addLog("Kunde inte hämta användarlistan.");
      }
    };

    const fetchFeedback = async () => {
      const data = await feedbackService.getRecentFeedback(5);
      setFeedback(data);
    };

    fetchUsers();
    fetchFeedback();

  }, [loading]); // Reload when loading finishes (e.g. after action)

  const addLog = (msg: string) => setLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  // ---------------------------------------------------------
  // FUNKTION 1: SKAPA RANDOM EVENTS (SEED)
  // ---------------------------------------------------------

  // ---------------------------------------------------------
  // FUNKTION: TA BORT ALLA EVENTS
  // ---------------------------------------------------------
  const handleDeleteAllEvents = async () => {
    if (!confirm("VARNING: Detta tar bort ALLA events permanent. Vill du fortsätta?")) return;
    if (!confirm("Är du verkligen helt säker? Det går inte att ångra.")) return;

    setLoading(true);
    setLog([]);
    addLog("🗑️ Startar radering av alla events...");

    try {
      const snapshot = await getDocs(collection(db, 'events'));
      const total = snapshot.size;

      if (total === 0) {
        addLog("✅ Inga events att ta bort.");
        setLoading(false);
        return;
      }

      addLog(`Hittade ${total} events. Raderar...`);

      let count = 0;

      // Firestore batch limit is 500
      const docs = snapshot.docs;

      // Vi måste köra flera batcher om det är > 500
      // Här gör vi det enkelt och kör en-och-en via promise.all eller seriemässigt om det är säkrare, 
      // men för prestanda är batch bäst. Låt oss köra uppdelade batcher.

      for (let i = 0; i < docs.length; i += 400) {
        const chunk = docs.slice(i, i + 400);
        const currentBatch = writeBatch(db);
        chunk.forEach(doc => {
          currentBatch.delete(doc.ref);
        });
        await currentBatch.commit();
        count += chunk.length;
        addLog(`🗑️ Raderat batch ${Math.ceil(count / 400)} (${count} / ${total})...`);
      }

      addLog(`✅ Alla ${count} events har raderats.`);
      toast.success("Alla events raderade.");

      // Clear cache
      sessionStorage.removeItem('vadkul_events_cache');
      sessionStorage.removeItem('vadkul_events_cache_time');

    } catch (error: any) {
      addLog(`❌ Fel vid radering: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


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

      // UPDATED CATEGORY EXAMPLES TO MATCH ids in categories.ts
      const MOCKED_TEMPLATES: Record<string, { title: string, desc: string }[]> = {
        study: [
          { title: "Tenta-P i biblioteket", desc: "Vi sitter hela dagen. Kom och plugga med oss för motivation." },
          { title: "Språkcafé: Engelska", desc: "Öva din engelska över en kopp kaffe. Alla nivåer välkomna." },
          { title: "Grupparbete & Pizza", desc: "Vi pluggar effektivt i 2 timmar, sen beställer vi pizza." },
          { title: "Lär dig koda React", desc: "Enkel intro för nybörjare. Ta med laptop!" },
          { title: "Matte-stuga inför tentan", desc: "Vi hjälps åt att räkna gamla tentor. Kaffe ingår." },
          { title: "Uppsats-skrivande (Shut up & Write)", desc: "45 min skrivande, 15 min paus. Upprepa." },
          { title: "Bokcirkel: Kurslitteratur", desc: "Vi diskuterar veckans läsning så det fastnar bättre." }
        ],
        party: [
          { title: "Förfest innan kåren", desc: "Vi ses och värmer upp inför kvällens släpp. Ta med egen dryck." },
          { title: "Spontan hemmafest", desc: "Öppet hus! Kom och häng, lyssna på musik och träffa folk." },
          { title: "Utgång ikväll?", desc: "Någon som är taggad på dansgolvet? Vi möts upp på torget." },
          { title: "Pubkväll på nationen", desc: "Billig öl och hamburgare. Kom och häng med oss!" },
          { title: "Sittning: Tema 80-tal", desc: "Vi har några biljetter över till sittningen. Först till kvarn!" },
          { title: "Korridorsfest hos mig", desc: "Trångt, varmt och sjukt kul. Alla får plats!" },
          { title: "Karaokekväll på puben", desc: "Vem vågar sjunga först? Vi bjuder på första rundan." },
          { title: "Takfest (om vädret tillåter)", desc: "Fantastisk utsikt och gott sällskap. Ta med filt." }
        ],
        social: [ // Was 'fika'
          { title: "Söndagsfika", desc: "Kaffe och bulle på stans mysigaste café. Kom och snacka skit." },
          { title: "Lunch på stan", desc: "Vi testar det nya stället på hörnet. De har bra vegatariskt!" },
          { title: "Afternoon Tea", desc: "Lite lyxigare fika. Vi har bokat bord för 6 pers." },
          { title: "After Work med branschen", desc: "Mingel för oss som jobbar inom IT/Tech." },
          { title: "Mingelkväll för nyinflyttade", desc: "Ny i stan? Kom och lär känna folk!" },
          { title: "Hundpromenad & Kaffe", desc: "Ta med vovven (eller kom utan) så går vi en sväng." },
          { title: "Glass i hamnen", desc: "Bästa glassbaren har öppnat för säsongen. Häng med!" }
        ],
        food: [
          { title: "Hemlagad Pizza-kväll", desc: "Jag gör degen, ni tar med topping. Blir sjukt gott!" },
          { title: "Knytkalas i parken", desc: "Alla tar med sig en rätt var att bjuda på." },
          { title: "Sushi-workshop", desc: "Vi lär oss rulla sushi. Ingredienser köps in gemensamt." },
          { title: "Korvgrillning vid sjön", desc: "Vi tänder grillen kl 18. Ta med det du vill grilla." },
          { title: "Kårfrukost", desc: "Gratis frukost för medlemmar. Vi ses i kårhuset." },
          { title: "Taco Tuesday", desc: "Klassisk tacokväll. Guacamolen är 'on me'." },
          { title: "Pannkaksbrunch", desc: "Amerikanska pannkakor med lönnsirap och bär." }
        ],
        market: [
          { title: "Klädbytardag", desc: "Ta med plagg du inte använder, byt till dig nya favoriter." },
          { title: "Bakluckeloppis", desc: "Vi delar på en plats. Samling 09:00." },
          { title: "Säljer kurslitteratur", desc: "Möts upp för att köpa/sälja gamla böcker." },
          { title: "Växtstickling-byte", desc: "Har du för många Palettblad? Byt till dig en Monstera!" }
        ],
        community: [ // Was 'help'
          { title: "Hjälp med flytt?", desc: "Bjuder på pizza och öl till den som kan bära lite lådor." },
          { title: "Städdag i parken", desc: "Vi hjälps åt att snygga till i parken. Fika bjuds det på!" },
          { title: "Volontärmöte", desc: "Vill du engagera dig? Kom och lyssna på vad vi gör." },
          { title: "Kattvakts-träff", desc: "Vi som gillar katter ses och pratar." },
          { title: "Fixar-kväll i cykelrummet", desc: "Lär dig laga punka och smörja kedjan." }
        ],
        creative: [
          { title: "Måla och skåla", desc: "Vi målar akvarell och dricker lite bubbel. Material finns." },
          { title: "Stickjunta", desc: "Ta med din stickning/virkning. Vi fikar och handarbetar ihop." },
          { title: "Kreativt skrivande", desc: "Vi gör skrivövningar tillsammans. Penna och papper räcker." },
          { title: "Fotokurs: Grunderna", desc: "Lär dig din systemkamera. Vi går igenom ISO och slutartid." },
          { title: "Impro-teater workshop", desc: "Prova på teater! Inga förkunskaper krävs, bara glatt humör." },
          { title: "Jam-session (Musik)", desc: "Ta med instrument. Vi kör lite covers och improviserar." }
        ],
        sport: [
          { title: "Fotbollsmatch 5-mot-5", desc: "Vi behöver folk till en vänskapsmatch. Vi delar upp lagen på plats." },
          { title: "Volleyboll på stranden", desc: "Spontan volleyboll i solen. Vi har boll och nät." },
          { title: "Padel-turnering (Amerikano)", desc: "Vi kör en spontan Americano. Alla nivåer välkomna!" },
          { title: "Brännboll med klassen", desc: "Klassisk brännboll i parken. Ta med dryck!" },
          { title: "Basket skills & game", desc: "Vi tränar lite teknik och spelar match sen." },
          { title: "Badminton i hallen", desc: "Vi har bokat två banor. Racket finns att hyra." }
        ],
        training: [ // NEW
          { title: "Morgonjogg 5km", desc: "Lugnt tempo, vi håller ihop gruppen. Startar vid utegymmet." },
          { title: "Yoga i solnedgången", desc: "Ta med egen matta. Vi kör ett pass för alla nivåer." },
          { title: "Utomhusträning stationer", desc: "Jag tar med redskap, vi kör cirkelträning i parken." },
          { title: "Intervaller i backen", desc: "Jobbigt men effektivt! Vi kör 10 vändor." },
          { title: "Långpass Löpning (10km+)", desc: "För dig som vill springa lite längre i prattempo." }
        ],
        game: [ // Was 'games'
          { title: "LAN-party hela helgen", desc: "Ta med burken och skärm. Vi har plats och nätverk." },
          { title: "Mario Kart-turnering", desc: "Vem är bäst på Rainbow Road? Pris till vinnaren!" },
          { title: "CS:GO Matchkväll", desc: "Vi behöver en femte spelare till vårt lag. Rank spelar ingen roll." },
          { title: "Super Smash Bros Ultimate", desc: "Vi kör turnering på storbildsskärm. Kontroller finns." }
        ],
        boardgame: [ // NEW
          { title: "Spelkväll: Catan & Ticket to Ride", desc: "Klassiska brädspel. Vi förklarar reglerna." },
          { title: "Dungeons & Dragons One-shot", desc: "Ett äventyr på en kväll. Karaktärer finns färdiga." },
          { title: "Schack-turnering", desc: "Snabbschack 10 minuter. Alla möter alla." },
          { title: "Komplexa Brädspel (Twilight Imperium)", desc: "För dig som gillar tunga strategispel. Tar hela dagen!" },
          { title: "Kortspel & Poker", desc: "Vi spelar Texas Hold'em (utan riktiga pengar såklart)." }
        ],
        play: [ // NEW
          { title: "Kubb i parken", desc: "Kom och spela kubb! Alla är välkomna, vi kör så länge vi orkar." },
          { title: "Vattenkrig - Alla mot alla", desc: "Ta med vattenpistol så kör vi! Samling vid fontänen." },
          { title: "Kurragömma Extreme", desc: "Kurragömma över hela campusområdet. Kom i oömma kläder." },
          { title: "Tipspromenad", desc: "Gå en runda och svara på kluriga frågor. Prisutdelning efteråt." }
        ],
        outdoor: [ // NEW
          { title: "Vandring i naturreservatet", desc: "Ca 1 mil i lugnt tempo. Ta med matsäck." },
          { title: "Fiske-tur", desc: "Vi drar ut med båt och kastar lite. Flytvästar finns." },
          { title: "Upptäcktsfärd i skogen", desc: "Vi letar svamp och bara njuter av naturen." },
          { title: "Grilla korv vid vindskyddet", desc: "Mysig kväll vid elden. Ta med varma kläder." },
          { title: "Kajakpaddling", desc: "Vi hyr kajaker och paddlar en tur i ån." }
        ],
        movie: [ // NEW
          { title: "Bio: Nya Marvel-filmen", desc: "Vi har bokat mittenplatserna. Häng med!" },
          { title: "Filmkväll: Sagan om Ringen", desc: "Maraton (Extended edition) hemma hos mig. Popcorn ingår." },
          { title: "Utomhusbio i parken", desc: "Ta med filt och stol. Filmen startar vid mörkrets inbrott." },
          { title: "Skräckfilmskväll", desc: "Vågar du? Vi kollar på klassiker och äter snacks." }
        ],
        culture: [ // NEW
          { title: "Konstutställning vernissage", desc: "Vi går och kollar in den nya utställningen tillsammans." },
          { title: "Livejazz på puben", desc: "Lokalt band spelar ikväll. Skön stämning utlovas." },
          { title: "Teaterbesök", desc: "Vi ser den nya uppsättningen på stadsteatern." },
          { title: "Museum: Gratis inträde", desc: "Vi passar på när det är fri entré. Guidad tur kl 14." }
        ],
        workshop: [ // NEW
          { title: "Keramik-kurs", desc: "Prova på att dreja! Lera ingår i priset." },
          { title: "Lär dig dansa salsa", desc: "Nybörjarkurs. Ingen partner krävs." },
          { title: "Kryddväxt-plantering", desc: "Plantera basilika och chili. Krukor och jord finns." }
        ],
        campus: [ // NEW
          { title: "Pubkväll på nationen", desc: "Vi drar dit när de öppnar. Billig öl och gött häng." },
          { title: "Kårtrappan-häng", desc: "Vi sitter i solen på trappan och dricker kaffe." },
          { title: "Campus-orientering", desc: "Hitta rätt på campus. Bra för dig som är ny!" }
        ],
        mingle: [ // NEW
          { title: "Nätverksfrukost", desc: "Träffa andra studenter och företagare. Frukost ingår." },
          { title: "After School Mingle", desc: "Vi ses efter föreläsningen och snackar." },
          { title: "Speed-friending", desc: "Lär känna 10 nya personer på en timme!" }
        ],
        other: [
          { title: "Diskussionskväll: Klimat", desc: "Hur kan vi leva mer hållbart? Öppen diskussion." },
          { title: "Överrasknings-event", desc: "Hemlig aktivitet! Samling vid statyn." },
          { title: "Loppisrunda på stan", desc: "Vi går runt till alla second hand-butiker." }
        ]
      };

      let successCount = 0;
      let lastEventData = null;

      for (let i = 0; i < count; i++) {
        const randomUser = users[Math.floor(Math.random() * users.length)];
        const location = getRandomLocationInSweden();
        const category = getRandomCategory(); // Hämta slumpmässig kategori (e.g. 'sport', 'social')

        // Look up templates properly
        // If exact match exists, user it. Else use 'other'.
        const templates = MOCKED_TEMPLATES[category] || MOCKED_TEMPLATES.other;
        const template = templates[Math.floor(Math.random() * templates.length)];

        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(now.getDate() + Math.floor(Math.random() * 60)); // 0-60 dagar framåt
        futureDate.setHours(10 + Math.floor(Math.random() * 12), 0, 0);

        const minPart = 2; // Minst 2 deltagare
        const maxPart = 5 + Math.floor(Math.random() * 20); // Som tidigare

        const eventData = {
          title: template.title,
          description: template.desc,
          time: Timestamp.fromDate(futureDate),

          lat: location.lat,
          lng: location.lng,

          location: {
            name: `Genererad plats, ${location.cityName}`,
            distance: Math.floor(Math.random() * 5),
          },

          // Använd den slumpmässiga kategorin
          type: category,
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
            verified: randomUser.isVerified || false,
            rating: randomUser.rating || (3 + Math.random() * 2),
            photoURL: randomUser.photoURL || `https://i.pravatar.cc/150?u=${randomUser.uid}`,
          },
          attendees: [],
          createdAt: Timestamp.now()
        };

        lastEventData = eventData;

        await addDoc(collection(db, 'events'), eventData);
        successCount++;
        if (successCount % 10 === 0) addLog(`...skapat ${successCount} av ${count}`);
      }

      addLog(`✅ Klart! ${successCount} events skapades.`);

      // LOGGA FEILDS FÖR EN EVENT
      if (lastEventData) {
        addLog("--------------- SAMPLE EVENT ---------------");
        addLog(JSON.stringify(lastEventData, null, 2));
        // Also log keys clearly
        addLog("FIELDS: " + Object.keys(lastEventData).join(", "));
        addLog("--------------------------------------------");
      }

    } catch (error: any) {
      addLog(`❌ Fel: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // FUNKTION 2: SYNKA HOST BILDER
  // ---------------------------------------------------------
  // ---------------------------------------------------------
  // FUNKTION 2: SYNKA HOST BILDER
  // ---------------------------------------------------------
  const handleSyncHostImages = async () => {
    if (!confirm("Vill du uppdatera alla events med värdens nuvarande profilbild? Detta kan ta en stund.")) return;

    setLoading(true);
    addLog(`🔄 Startar synkronisering av profilbilder...`);

    try {
      // 1. Hämta alla events
      const eventsSnap = await getDocs(collection(db, 'events'));
      const events = eventsSnap.docs;
      addLog(`Hittade ${events.length} events.`);

      let updateCount = 0;
      let batchCount = 0;
      let currentBatch = writeBatch(db);
      let operationsInBatch = 0;
      const MAX_BATCH_SIZE = 400; // Firestore limit is 500, keeping safety margin

      // 2. Loopa och kolla mot users
      for (const docSnap of events) {
        const eventData = docSnap.data();
        const hostUid = eventData.host?.uid;

        if (hostUid) {
          const hostUser = users.find(u => u.uid === hostUid);

          if (hostUser) {
            // Använd 'photoURL' från user, ELLER null om det saknas.
            const correctPhoto = hostUser.photoURL || null;
            const currentEventPhoto = eventData.host.photoURL || null;

            if (correctPhoto !== currentEventPhoto) {
              const eventRef = doc(db, 'events', docSnap.id);
              currentBatch.update(eventRef, {
                "host.photoURL": correctPhoto,
                "host.name": hostUser.displayName || eventData.host.name, // Passa på att uppdatera namn också
                "host.verified": hostUser.isVerified || false
              });

              updateCount++;
              operationsInBatch++;

              // Commit batch if full
              if (operationsInBatch >= MAX_BATCH_SIZE) {
                await currentBatch.commit();
                batchCount++;
                addLog(`💾 Sparade batch ${batchCount} (${operationsInBatch} ändringar)...`);
                currentBatch = writeBatch(db); // Start new batch
                operationsInBatch = 0;
              }
            }
          }
        }
      }

      // Commit remaining operations
      if (operationsInBatch > 0) {
        await currentBatch.commit();
        batchCount++;
        addLog(`💾 Sparade sista batchen (${operationsInBatch} ändringar).`);
      }

      if (updateCount > 0) {
        addLog(`✅ KLART! Uppdaterade totalt ${updateCount} events.`);
        toast.success(`Synkade ${updateCount} events!`);
      } else {
        addLog(`✅ Alla events är redan synkade.`);
        toast.success("Allt är redan synkat!");
      }

    } catch (error: any) {
      console.error("Sync Error:", error);
      addLog(`❌ Svarar servern med fel? Kontrollera dina rättigheter.`);
      addLog(`❌ Felmeddelande: ${error.message}`);
      toast.error("Kunde inte synka. Se loggen för detaljer.");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // FUNKTION [NEW]: BLI ADMIN
  // ---------------------------------------------------------
  const handleBecomeAdmin = async () => {
    if (!user) {
      toast.error("Du måste vara inloggad först.");
      return;
    }
    if (!confirm("Vill du ge dig själv admin-rättigheter?")) return;

    setLoading(true);
    addLog(`👑 Uppdaterar rättigheter för ${user.email}...`);

    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        isAdmin: true
      });
      addLog(`✅ KLART! Du är nu admin.`);
      toast.success("Du är nu admin! 👑");
    } catch (error: any) {
      addLog(`❌ Fel: ${error.message}`);
      toast.error("Kunde inte uppdatera rättigheter.");
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

  // ---------------------------------------------------------
  // FUNKTION 4: HANTERA VERIFIERINGAR
  // ---------------------------------------------------------
  const handleAcceptVerification = async (user: any) => {
    if (!confirm(`Godkänn verifiering för ${user.displayName}?`)) return;
    setLoading(true);
    addLog(`🔍 Godkänner verifiering för ${user.displayName}...`);

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', user.uid);

      // 1. Update User
      batch.update(userRef, {
        isVerified: true,
        verificationStatus: 'verified',
        // Note: verificationImage remains in DB for record, but is private
      });

      // 2. Send Notification
      await notificationService.send({
        recipientId: user.uid,
        type: 'system',
        message: 'Din identitet har verifierats! Du har nu en verifierad profil.',
        read: false,
        createdAt: Timestamp.now() // Will be addressed by service logic but added here for clarity if needed
      } as any);

      await batch.commit();
      addLog(`✅ ${user.displayName} är nu verifierad!`);
      toast.success(`${user.displayName} verifierad!`);

    } catch (error: any) {
      addLog(`❌ Fel vid godkännande: ${error.message}`);
      toast.error("Något gick fel");
    } finally {
      setLoading(false);
    }
  };

  const handleDenyVerification = async (userId: string) => {
    if (!rejectReason) {
      toast.error("Ange en anledning!");
      return;
    }
    setLoading(true);
    addLog(`🚫 Nekar verifiering för ID: ${userId}...`);

    try {
      const batch = writeBatch(db);
      const userRef = doc(db, 'users', userId);

      batch.update(userRef, {
        isVerified: false,
        verificationStatus: 'rejected',
        rejectionReason: rejectReason
      });

      // Send Notification
      await notificationService.send({
        recipientId: userId,
        type: 'system',
        message: `Din verifiering nekades. Anledning: ${rejectReason}`,
        read: false,
        createdAt: Timestamp.now()
      } as any);

      await batch.commit();
      addLog(`✅ Verifiering nekad.`);
      toast.success("Verifiering nekad.");
      setRejectingId(null);
      setRejectReason('');

    } catch (error: any) {
      addLog(`❌ Fel vid nekande: ${error.message}`);
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


              {/* KORT: Senaste Feedback */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-purple-100 ring-4 ring-purple-50">
                <h2 className="text-xl font-bold mb-4 text-purple-900 flex items-center gap-2">
                  <MessageSquare className="text-purple-600" />
                  Senaste Feedback
                </h2>
                <div className="space-y-4">
                  {feedback.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Ingen feedback än.</p>
                  ) : (
                    feedback.map((item) => (
                      <div key={item.id} className="border border-purple-100 rounded-lg p-4 bg-purple-50/50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <span key={i} className={`text-sm ${i < item.rating ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.createdAt?.toDate().toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-slate-800 italic">"{item.message}"</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* KORT 0: Verifieringsförfrågningar */}
              {pendingVerifications.length > 0 && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-indigo-100 ring-4 ring-indigo-50">
                  <h2 className="text-xl font-bold mb-4 text-indigo-900 flex items-center gap-2">
                    <ShieldAlert className="text-indigo-600" />
                    Verifieringsförfrågningar ({pendingVerifications.length})
                  </h2>
                  <div className="space-y-4">
                    {pendingVerifications.map((u: any) => (
                      <div key={u.uid} className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                        <div className="flex items-start gap-4 mb-3">
                          <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 border border-slate-300">
                            {u.verificationImage ? (
                              <a href={u.verificationImage} target="_blank" rel="noreferrer">
                                <img src={u.verificationImage} alt="Verif" className="w-full h-full object-cover" />
                              </a>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <User size={24} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 truncate">{u.displayName || 'Utan namn'}</p>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                            <p className="text-xs text-slate-500 mt-1">Ålder: {u.age || '?'}</p>
                          </div>
                        </div>

                        {rejectingId === u.uid ? (
                          <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                            <label className="text-xs font-bold text-red-700 block mb-1">Anledning till nekande:</label>
                            <textarea
                              value={rejectReason}
                              onChange={e => setRejectReason(e.target.value)}
                              className="w-full p-2 text-sm border border-red-200 rounded mb-2"
                              placeholder="T.ex. Bilden är för mörk..."
                            />
                            <div className="flex gap-2">
                              <button onClick={() => handleDenyVerification(u.uid)} className="px-3 py-1 bg-red-600 text-white text-sm font-bold rounded hover:bg-red-700">Neka</button>
                              <button onClick={() => setRejectingId(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-sm font-bold rounded hover:bg-slate-300">Avbryt</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAcceptVerification(u)}
                              className="flex-1 py-2 bg-emerald-600 text-white font-bold rounded-lg text-sm hover:bg-emerald-700 flex items-center justify-center gap-1"
                            >
                              <CheckCircle2 size={16} /> Godkänn
                            </button>
                            <button
                              onClick={() => { setRejectingId(u.uid); setRejectReason(''); }}
                              className="flex-1 py-2 bg-white border border-red-200 text-red-600 font-bold rounded-lg text-sm hover:bg-red-50 flex items-center justify-center gap-1"
                            >
                              <XCircle size={16} /> Neka
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* KORT 1: Generera Data */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold mb-4 text-green-700">🌱 Datahantering</h2>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-4">
                    Hantera testdata och rensa databasen.
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

                  <hr className="border-slate-100 my-2" />

                  <button
                    onClick={handleDeleteAllEvents}
                    disabled={loading}
                    className="w-full bg-red-50 text-red-600 border border-red-200 py-2 px-4 rounded-lg font-bold hover:bg-red-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    🗑️ Radera ALLA events
                  </button>
                </div>
              </div>

              {/* KORT: UNDERHÅLL */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-semibold mb-4 text-blue-800">🛠️ Underhåll</h2>
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-4">
                    Uppdatera alla events så att värdens bild matchar deras nuvarande profilbild (användbart om bilder ändrats eller saknas).
                  </p>
                  <button
                    onClick={handleSyncHostImages}
                    disabled={loading}
                    className="w-full bg-blue-100 text-blue-800 py-2 px-4 rounded-lg font-medium hover:bg-blue-200 transition disabled:opacity-50 flex items-center justify-center gap-2 mb-2"
                  >
                    🔄 Synka Profilbilder
                  </button>

                  <button
                    onClick={handleBecomeAdmin}
                    disabled={loading}
                    className="w-full bg-amber-100 text-amber-800 py-2 px-4 rounded-lg font-medium hover:bg-amber-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    👑 Bli Admin (Lös rättighetsproblem)
                  </button>
                </div>
              </div>



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

            {/* HÖGER KOLUMN: LOGG & ANVÄNDARLISTA */}
            <div className="space-y-6">

              {/* 1. Terminal */}
              <div className="h-[300px]">
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

              {/* 2. Användarlista (ADMIN POWER) */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
                  <User className="text-slate-600" />
                  Alla Användare ({users.length})
                </h2>
                <div className="space-y-3">
                  {users.slice(0, visibleCount).map(u => (
                    <div key={u.uid} className="flex flex-col md:flex-row items-center gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50 transition-colors hover:bg-slate-100">

                      {/* Verification Image Thumbnail */}
                      <div className="w-16 h-16 bg-slate-200 rounded-lg overflow-hidden flex-shrink-0 border border-slate-300 shadow-sm relative group">
                        {u.verificationImage ? (
                          <a href={u.verificationImage} target="_blank" rel="noreferrer" className="block w-full h-full">
                            <img src={u.verificationImage} alt="Verif" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                          </a>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <User size={24} />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 text-center md:text-left">
                        <div className="font-bold text-slate-900 truncate">{u.displayName || 'John Doe'}</div>
                        <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {u.uid.substring(0, 6)}...</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`text-xs font-bold px-3 py-1 rounded-full ${u.isVerified
                          ? 'bg-green-100 text-green-700 border border-green-200'
                          : (u.verificationStatus === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-200 text-slate-500')
                          }`}>
                          {u.isVerified ? 'Verifierad' : (u.verificationStatus === 'pending' ? 'Väntar' : 'Ej verifierad')}
                        </div>
                        {u.isVerified ? (
                          <button
                            onClick={async () => {
                              const reason = prompt(`Vill du återkalla verifieringen för ${u.displayName}? Ange anledning:`, "Verifiering återkallad av admin.");
                              if (!reason) return; // Cancelled

                              setLoading(true);
                              try {
                                const batch = writeBatch(db);

                                // 1. Update User to Rejected (so they can upload new)
                                const userRef = doc(db, 'users', u.uid);
                                batch.update(userRef, {
                                  isVerified: false,
                                  verificationStatus: 'rejected',
                                  rejectionReason: reason
                                });

                                // 2. Send Notification
                                await notificationService.send({
                                  recipientId: u.uid,
                                  type: 'system',
                                  message: `Din verifiering har återkallats. Anledning: ${reason}. Du kan ladda upp en ny bild under Inställningar.`,
                                  read: false,
                                  createdAt: Timestamp.now()
                                } as any);

                                await batch.commit();

                                toast.success("Verifiering återkallad.");
                                addLog(`Revoked verification for ${u.displayName}`);

                                // Trigger fetch to update list & UI
                                const snap = await getDocs(collection(db, 'users'));
                                setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
                              } catch (e) {
                                console.error(e);
                                toast.error("Kunde inte återkalla.");
                              }
                              setLoading(false);
                            }}
                            className="text-xs bg-white border border-red-200 text-red-600 px-3 py-1 rounded-lg font-bold hover:bg-red-50 transition-colors"
                          >
                            Återkalla
                          </button>
                        ) : (<span className="w-20"></span> // Spacer for alignment
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {visibleCount < users.length && (
                  <button
                    onClick={() => setVisibleCount(prev => prev + 5)}
                    className="w-full mt-4 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Visa fler ({users.length - visibleCount} kvar)
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      </div>
    </Layout>
  );
}