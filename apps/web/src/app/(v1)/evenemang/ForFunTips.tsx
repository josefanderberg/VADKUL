import { FORFUN_URL } from '@/utils/partnerLinks';

/** Partnerrutan till ForFun — bakgrund och placeringsregler i
 *  utils/partnerLinks.ts. Synligt kort i sajtens vanliga kortstil (Josef
 *  27/9: "om jag vill att hon exponerar mig bra borde jag också göra det"
 *  — hennes rad i guiderna är väl synlig, så vår ska matcha). */
export default function ForFunTips({ cityName }: { cityName: string }) {
    return (
        <div className="mt-6 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <p className="text-sm font-black text-slate-900 dark:text-zinc-100">
                <span aria-hidden>🧸</span> Fler tips för barnfamiljer i Sörmland
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 font-medium">
                <a
                    href={FORFUN_URL}
                    target="_blank"
                    rel="noopener"
                    className="font-bold text-[#006AA7] dark:text-sky-400 hover:underline"
                >
                    ForFun
                </a>{' '}
                samlar aktiviteter för barnfamiljer i {cityName} och resten av Sörmland — på flera språk.
            </p>
        </div>
    );
}
