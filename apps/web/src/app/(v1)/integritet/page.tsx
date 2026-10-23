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
 * policy behöver en stabil URL (länkas från kontoskapandet och profilen).
 * Innehållet speglar vad koden faktiskt gör — uppdatera sidan när datahanteringen ändras.
 */
export default function IntegritetPage() {
    const sections: { id?: string; title: string; body: React.ReactNode }[] = [
        {
            title: 'Vad VADKUL är',
            body: (
                <>VADKUL visar publika evenemang i Sverige på en karta. Eventen samlas in från
                öppna källor — arrangörers webbplatser, biljettplattformar och föreningskalendrar —
                samt skapas av användare direkt i appen.</>
            ),
        },
        {
            title: 'Utan konto',
            body: (
                <>Du kan använda hela kartan utan konto, och då lagrar vi inga personuppgifter om dig.
                Event du sparar (hjärtan) ligger bara lokalt i din webbläsare. Kraschar mobilappen
                skickas en anonym teknisk rapport (se ”Kraschrapporter i mobilappen” nedan).</>
            ),
        },
        {
            title: 'Din plats',
            body: (
                <>Kartan frågar inte om din plats när du öppnar den. Frågan kommer först när du
                går vidare till kartan utan att ha valt en stad, och du kan alltid välja en stad i
                stället eller svara nej. Säger du ja används positionen i din webbläsare för att visa
                kartan där du är och avståndet till eventen. Koordinaterna skickas aldrig till
                våra servrar. Har du konto sparar vi bara namnet på närmaste ort (t.ex. ”Falun”)
                på kontot, så att utskick kan handla om din stad. Det ändrar du i profilen.</>
            ),
        },
        {
            title: 'Med konto',
            body: (
                <>Skapar du ett konto lagrar vi din e-postadress och ditt visningsnamn, samt det du
                gör inloggad: sparade event, event du skapar och meddelanden du skriver i eventchattar.
                Event du skapar visas publikt på kartan med ditt visningsnamn som värd.</>
            ),
        },
        {
            title: 'Var datan lagras',
            body: (
                <>All kontodata lagras i Google Firebase i EU (regionerna europe-north1/north2,
                norra Europa). Undantaget är kraschrapporterna från mobilappen (nästa avsnitt) -
                de hanteras av Crashlytics, en global Firebase-tjänst där Google kan behandla
                datan utanför EU.</>
            ),
        },
        {
            title: 'Kraschrapporter i mobilappen',
            body: (
                <>Kraschar mobilappen skickas en rapport till Firebase Crashlytics (Google) så
                att vi kan hitta och laga felet. Rapporten innehåller tekniska uppgifter:
                enhetsmodell, operativsystemsversion, appversion och vad som hände i koden vid
                kraschen - aldrig innehållet i det du skrivit. Är du inloggad följer ditt
                konto-id med så att vi kan koppla ihop rapporter från samma konto; utan konto är
                rapporten anonym. Crashlytics är en global tjänst, så kraschdatan lagras inte
                enbart i EU, och Google raderar den efter 90 dagar. Webbplatsen skickar inga
                kraschrapporter.</>
            ),
        },
        {
            title: 'Analys och kakor',
            body: (
                <>Vi använder Google Analytics och Hotjar för att förstå hur appen används
                (t.ex. vilka funktioner som används och var det skaver). Dessa verktyg använder
                kakor/lokal lagring och samlar inte in ditt namn eller din e-post.</>
            ),
        },
        {
            title: 'Dina rättigheter',
            body: (
                <>Du ser och ändrar ditt namn i profilen på kartan. Du kan när som helst radera
                ditt konto själv (profilen → Radera konto) — då tas kontot och din profildata bort.
                Sparade event utan konto rensar du genom att rensa webbplatsdata i din webbläsare.</>
            ),
        },
        {
            // Google Play kräver en webbadress där man kan begära kontoradering
            // (Data safety → Dataradering): https://vadkul.se/integritet#radera-konto
            id: 'radera-konto',
            title: 'Radera ditt konto',
            body: (
                <>Du raderar kontot själv, i appen och på vadkul.se: öppna profilen och välj Radera
                konto. Då tas kontot och din profil bort direkt, och det går inte att ångra. Kommer
                du inte åt appen kan du i stället mejla{' '}
                <a href="mailto:hej@vadkul.se" className="underline hover:text-slate-900 transition-colors">
                    hej@vadkul.se
                </a>{' '}
                från kontots e-postadress, så raderar vi kontot åt dig inom 30 dagar. Kraschrapporter
                rensas automatiskt efter 90 dagar.</>
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
                <>Snabbaste vägen är rapport-/feedbackfunktionen i appen — den når oss direkt.</>
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
                <p className="mt-1 text-xs font-bold text-slate-400">Senast uppdaterad 23 oktober 2026</p>

                <div className="mt-8 flex flex-col gap-7">
                    {sections.map(s => (
                        <section key={s.title} id={s.id}>
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
