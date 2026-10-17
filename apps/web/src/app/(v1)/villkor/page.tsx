import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    // Root-layoutens title-template lägger själv till "– VADKUL"
    title: 'Användarvillkor',
    description: 'VADKUL:s användarvillkor: nolltolerans mot stötande innehåll, hur modereringen fungerar och hur du når oss.',
    alternates: { canonical: '/villkor' },
};

/**
 * Användarvillkor — kravet kommer från App Store-regel 1.2: appar med
 * användarskapat innehåll måste ha publicerade villkor med nolltolerans mot
 * stötande innehåll och en kontaktväg, och användaren måste godkänna dem vid
 * kontoskapandet (appens kontovy och webbens AuthModal länkar hit).
 * Samma stil som /integritet. Innehållet speglar vad modereringen faktiskt
 * gör — uppdatera sidan när verktygen ändras.
 */
export default function VillkorPage() {
    const sections: { title: string; body: React.ReactNode }[] = [
        {
            title: 'Vad villkoren gäller',
            body: (
                <>Villkoren gäller när du använder VADKUL på vadkul.se eller i appen, och särskilt
                när du har konto och själv bidrar med innehåll: event du skapar eller tipsar om,
                meddelanden i eventchattar, bilder, önskningar och ditt visningsnamn. Genom att
                skapa ett konto godkänner du villkoren.</>
            ),
        },
        {
            title: 'Nolltolerans mot stötande innehåll',
            body: (
                <>VADKUL har nolltolerans mot stötande innehåll och mot användare som beter sig
                illa. Det är förbjudet att publicera hot, trakasserier, hat mot personer eller
                grupper, sexuellt eller pornografiskt material, våldsförhärligande, bedrägerier,
                spam och annat olagligt eller kränkande innehåll. Sådant innehåll tas bort och
                kontot som publicerat det kan stängas av utan förvarning.</>
            ),
        },
        {
            title: 'Så modereras innehållet',
            body: (
                <>Alla chattar har ett ordfilter som stoppar grovt språk innan det skickas.
                Du kan anmäla event (”Rapportera event” på eventkortet) och enskilda
                chattmeddelanden (menyn på meddelandet), och du kan blockera användare så att
                deras meddelanden döljs för dig. Anmälningar granskas löpande och hanteras inom
                24 timmar: innehåll som bryter mot villkoren tas bort och användaren bakom kan
                stängas av.</>
            ),
        },
        {
            title: 'Ditt innehåll och ditt ansvar',
            body: (
                <>Du ansvarar för det du publicerar och måste ha rätt att dela det. Event du
                skapar visas publikt på kartan med ditt visningsnamn som värd, och du ger VADKUL
                rätt att visa innehållet i tjänsten. Publicera bara riktiga evenemang - kartan
                är ingen anslagstavla för annat.</>
            ),
        },
        {
            title: 'Avstängning och borttagning',
            body: (
                <>Vi kan ta bort innehåll och stänga av konton som bryter mot villkoren, utan
                förvarning om överträdelsen är allvarlig. Du kan själv radera ditt konto när som
                helst (profilen → Radera konto). Hur dina uppgifter hanteras beskrivs i{' '}
                <Link href="/integritet" className="underline hover:text-slate-900 transition-colors">
                    integritetspolicyn
                </Link>.</>
            ),
        },
        {
            title: 'Kontakt',
            body: (
                <>Snabbaste vägen är rapport-/feedbackfunktionen i appen - den når oss direkt.
                Du kan också mejla{' '}
                <a href="mailto:hej@vadkul.se" className="underline hover:text-slate-900 transition-colors">
                    hej@vadkul.se
                </a>{' '}
                om något innehåll eller någon användare bryter mot villkoren, eller om du har
                frågor om dem.</>
            ),
        },
        {
            title: 'Ändringar',
            body: (
                <>Villkoren kan uppdateras när tjänsten ändras. Den senaste versionen finns
                alltid på den här sidan, och större ändringar berättar vi om i appen.</>
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

                <h1 className="mt-5 text-3xl font-black text-[#006AA7] tracking-tight">Användarvillkor</h1>
                <p className="mt-1 text-xs font-bold text-slate-400">Senast uppdaterad 17 oktober 2026</p>

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
