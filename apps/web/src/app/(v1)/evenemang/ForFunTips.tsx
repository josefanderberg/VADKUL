'use client';

import { forFunHref } from '@/utils/partnerLinks';
import { analytics } from '@/lib/firebase';
import { logEvent } from 'firebase/analytics';

/** Partnerrutan till ForFun — bakgrund och placeringsregler i
 *  utils/partnerLinks.ts. Synligt kort i sajtens vanliga kortstil (Josef
 *  27/9: "om jag vill att hon exponerar mig bra borde jag också göra det"
 *  — hennes rad i guiderna är väl synlig, så vår ska matcha).
 *  Klientkomponent sedan 27/9: klicket loggas som GA-eventet
 *  `partner_outbound` (partner + stad) så vi kan räkna hur många vi
 *  skickar vidare — spegeln av trafiken hit, som GA4 redan ser via
 *  referrer/UTM. Länken är en vanlig <a> (target _blank), så loggningen
 *  hinner iväg och mittenklick/långtryck funkar som vanligt. */
export default function ForFunTips({ cityName, citySlug }: { cityName: string; citySlug: string }) {
    const logClick = () => {
        analytics
            .then(a => { if (a) logEvent(a, 'partner_outbound', { partner: 'forfun', stad: citySlug }); })
            .catch(() => { /* statistik får aldrig stoppa klicket */ });
    };
    return (
        <div className="mt-6 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
            <p className="text-sm font-black text-slate-900 dark:text-zinc-100">
                <span aria-hidden>🧸</span> Fler tips för barnfamiljer i Sörmland
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-zinc-400 font-medium">
                <a
                    href={forFunHref(citySlug)}
                    target="_blank"
                    rel="noopener"
                    onClick={logClick}
                    className="font-bold text-[#006AA7] dark:text-sky-400 hover:underline"
                >
                    ForFun
                </a>{' '}
                samlar aktiviteter för barnfamiljer i {cityName} och resten av Sörmland — på sex språk.
            </p>
        </div>
    );
}
