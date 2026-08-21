import { NextResponse, type NextRequest } from 'next/server';

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
 */
export function GET(req: NextRequest, ctx: { params: Promise<{ kod: string }> }) {
    return ctx.params.then(({ kod }) => {
        const url = new URL('/', req.url);
        url.searchParams.set('s', kod);
        req.nextUrl.searchParams.forEach((value, key) => {
            if (key !== 's') url.searchParams.set(key, value);
        });
        // 302, inte 301: koder kommer och går, och en permanent redirect
        // cachas i webbläsaren tills användaren rensar den.
        return NextResponse.redirect(url, 302);
    });
}
