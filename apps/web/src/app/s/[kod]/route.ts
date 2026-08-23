import { type NextRequest } from 'next/server';

/**
 * Kortlänk till stjärn-gåvan: vadkul.se/s/2 → kartan med koden inlöst.
 *
 * Bakgrund (Josef 22/8): kampanjlänken såg ut så här i mejlet —
 *   vadkul.se/?stjarna=STJARNA2&utm_source=zoho&utm_medium=email&…
 * 90 tecken som bryter radbrytningen i klienter och ser skräppostig ut.
 * Nu räcker `vadkul.se/s/2`; själva koden ÄR attributionen (den sparas som
 * starGiftCode på kontot), så utm-parametrarna behövs inte för att veta
 * vilken kampanj stjärnan kom från — bara för Analytics.
 *
 * Koden valideras INTE här — den skickas vidare som den är och avgörs av
 * redeemStarGift i Cloud Functions (enda stället som får dela ut stjärnor).
 * Ev. övriga parametrar (utm_*) följer med så spårningen överlever hoppet.
 *
 * RELATIV Location, inte NextResponse.redirect(new URL(...)): bakom Firebase
 * Hosting kör Next i en Cloud Run-container som ser sin egen interna adress,
 * så en absolut URL byggd ur request.url pekade rakt ner i
 * https://0.0.0.0:8080/ (verifierat i prod 22/8). En relativ Location löses
 * mot adressen webbläsaren faktiskt bad om.
 */
export function GET(req: NextRequest, ctx: { params: Promise<{ kod: string }> }) {
    return ctx.params.then(({ kod }) => {
        const params = new URLSearchParams();
        params.set('s', kod);
        req.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 's') params.set(key, value);
        });
        // 302, inte 301: koder kommer och går, och en permanent redirect
        // cachas i webbläsaren tills användaren rensar den.
        return new Response(null, {
            status: 302,
            headers: { Location: `/?${params.toString()}`, 'Cache-Control': 'no-store' },
        });
    });
}
