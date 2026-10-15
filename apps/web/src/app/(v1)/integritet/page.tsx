import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    // Root-layoutens title-template lägger själv till "– VADKUL"
    title: 'Integritet',
    description: 'Så hanterar VADKUL dina uppgifter: vad som lagras, var, och hur du raderar det.',
    alternates: { canonical: '/integritet' },
};

/**
 * Integritetspolicy — den enda "riktiga sidan" utöver kartan, eftersom en
 * policy behöver en stabil URL (länkas från kontoskapandet och profilen, och
 * är appens integritetspolicy i App Store Connect och Play Console).
 * Innehållet speglar vad koden faktiskt gör, på webben OCH i appen — uppdatera
 * sidan när datahanteringen ändras, och håll den i takt med App Privacy-svaren
 * i docs/app-store-butik.md (Apple jämför dem vid granskningen).
 */
export default function IntegritetPage() {
    const sections: { title: string; body: React.ReactNode }[] = [
        {
            title: 'Vad VADKUL är',
            body: (
                <>VADKUL visar publika evenemang i Sverige på en karta, på vadkul.se och i
                VADKUL-appen för iPhone och Android. Eventen samlas in från öppna källor —
                arrangörers webbplatser, biljettplattformar och föreningskalendrar — samt skapas
                av användare direkt i tjänsten. Den här sidan gäller både webben och appen.</>
            ),
        },
        {
            title: 'Utan konto',
            body: (
                <>Du kan använda hela kartan utan konto. Event du sparar (hjärtan) ligger då bara
                lokalt i din webbläsare eller på din telefon. Tipsar du om ett event eller svarar
                Kommer utan konto skapas ett anonymt id, utan namn eller e-post, som kopplas till
                tipset eller svaret.</>
            ),
        },
        {
            title: 'Din plats',
            body: (
                <>Du kan alltid välja en stad i stället för att dela din plats, eller svara nej.
                Säger du ja används positionen i din webbläsare eller på din telefon för att visa
                kartan där du är, välja rätt län och visa avståndet till eventen. Koordinaterna
                skickas aldrig till våra servrar. Har du konto sparar vi bara namnet på närmaste
                ort (t.ex. ”Falun”) på kontot, så att utskick kan handla om din stad. Det ändrar
                du i profilen.</>
            ),
        },
        {
            title: 'Med konto',
            body: (
                <>Kontot är frivilligt och skapas med e-post, Google eller Apple. Vi lagrar din
                e-postadress, ditt visningsnamn och en profilbild om du lägger till en. I profilen
                kan du frivilligt ange ålder, kön, stad, om du har barn och barnens åldrar — det
                styr vilka event och utskick du får se och hjälper oss förstå vilka som använder
                VADKUL. Vi lagrar också det du gör inloggad: sparade event, svar (Kommer),
                stjärnor, önskningar, event du skapar med omslagsbild, din vänlista och meddelanden
                i eventchattar och privata chattar. Event du skapar visas publikt med ditt
                visningsnamn som värd, och det du skriver i en eventchatt syns för andra med ditt
                namn.</>
            ),
        },
        {
            title: 'Notiser',
            body: (
                <>Tillåter du notiser sparar vi en notis-token för din enhet tillsammans med kontot,
                så att vi kan skicka påminnelser och besked om dina event och vänner. Du stänger av
                notiserna i profilen eller i telefonens eller webbläsarens inställningar.</>
            ),
        },
        {
            title: 'Kraschrapporter i appen',
            body: (
                <>Om appen kraschar eller stöter på ett fel skickas en kraschrapport via Google
                Firebase Crashlytics: var i koden felet uppstod, telefonmodell, systemversion,
                appversion och ett installations-id. Är du inloggad följer ditt användar-id med,
                men aldrig ditt namn, din e-post eller vad du skrivit. Rapporterna sparas i 90
                dagar och används bara för att hitta och laga fel.</>
            ),
        },
        {
            title: 'Moderering',
            body: (
                <>Anmäler du ett meddelande eller blockerar en annan användare sparas anmälan
                eller blockeringen, så att vi kan granska den och dölja den blockerades
                meddelanden för dig. Anmälningar läses av oss.</>
            ),
        },
        {
            title: 'Var datan lagras',
            body: (
                <>Kontot och det du gör inloggad lagras i Google Firebase, med databasen i EU
                (regionerna europe-north1/north2, norra Europa). Crashlytics är en global tjänst
                och kraschrapporterna kan därför behandlas utanför EU, till exempel i USA. Google
                behandlar datan åt oss som leverantör och använder EU-kommissionens
                standardavtalsklausuler för sådana överföringar.</>
            ),
        },
        {
            title: 'Analys och kakor',
            body: (
                <>På webben använder vi Google Analytics och Hotjar för att förstå hur sajten
                används (t.ex. vilka funktioner som används och var det skaver). Dessa verktyg
                använder kakor/lokal lagring och samlar inte in ditt namn eller din e-post. Appen
                har inga analysverktyg utöver kraschrapporterna ovan och spårar dig inte mellan
                andra appar och webbplatser. Vi säljer aldrig dina uppgifter.</>
            ),
        },
        {
            title: 'Betalningar',
            body: (
                <>Köper du synlighet för ett event på webben sköts betalningen av Stripe. Vi ser
                aldrig dina kortuppgifter. Appen säljer ingenting.</>
            ),
        },
        {
            title: 'Dina rättigheter',
            body: (
                <>Du ser och ändrar dina uppgifter i profilen. Du kan när som helst radera ditt
                konto själv, på webben och i appen (profilen → Radera konto) — då tas kontot och
                din profil bort, med profilfälten och dina sparade event. Event du skapat och
                meddelanden du skrivit raderas inte automatiskt med kontot. Mejla oss så tar vi
                bort dem, eller om du vill ha en kopia av det vi har om dig. Sparade
                event utan konto rensar du genom att rensa webbplatsdata i webbläsaren eller
                avinstallera appen. Tycker du att vi hanterar dina uppgifter fel kan du klaga hos
                Integritetsskyddsmyndigheten (IMY).</>
            ),
        },
        {
            title: 'Eventdata och arrangörer',
            body: (
                <>Eventen på kartan är publik information: titel, tid, plats och arrangör, hämtade
                från öppna källor. Är något fel, eller vill du som arrangör att ett event tas bort,
                använd ”Rapportera event” längst ner på eventkortet — rapporterna läses löpande.</>
            ),
        },
        {
            title: 'Kontakt',
            body: (
                <>Mejla <a href="mailto:hej@vadkul.se" className="font-bold text-[#006AA7] underline">hej@vadkul.se</a>,
                eller använd rapport-/feedbackfunktionen i appen — den når oss direkt.</>
            ),
        },
    ];

    return (
        <main className="min-h-screen bg-slate-50 text-slate-800">
            <div className="max-w-2xl mx-auto px-5 py-10">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-black text-[#006AA7] hover:text-[#005590] transition-colors"
                >
                    ← Tillbaka till kartan
                </Link>

                <h1 className="mt-5 text-3xl font-black text-[#006AA7] tracking-tight">Integritet på VADKUL</h1>
                <p className="mt-1 text-xs font-bold text-slate-400">Senast uppdaterad 15 oktober 2026</p>

                <div className="mt-8 flex flex-col gap-7">
                    {sections.map(s => (
                        <section key={s.title}>
                            <h2 className="text-base font-black text-slate-900 mb-1.5">{s.title}</h2>
                            <p className="text-sm leading-relaxed text-slate-600 font-medium">{s.body}</p>
                        </section>
                    ))}
                </div>

                <div className="mt-10 pt-6 border-t border-slate-200">
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center px-6 py-3 rounded-2xl bg-[#006AA7] hover:bg-[#005590] text-white font-black text-sm shadow-lg transition-colors"
                    >
                        Utforska kartan
                    </Link>
                </div>
            </div>
        </main>
    );
}
