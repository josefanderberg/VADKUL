# FB-snöbollen — sidbevakning utan sök

FB stängde utloggad eventsök 2026-07-2x. Denna pipeline bygger i stället
bevakningslistan (`watchlist-national.ts`) ur DB:ns egna FB-arrangörer:

    node snowball.cjs           # 1. en eventsida per återkommande arrangör
                                #    (≥2 event senaste 30 d) → sid-slug +
                                #    relaterade event-ID → out/host-snowball.json
                                #    + skriv apps/scraper/fb-seed-urls.json
    node probe-national.cjs     # 2. verifiera sidornas /events-flik utloggat
    node generate-watchlist.cjs # 3. regenerera watchlist-national.ts
                                #    (policyfilter: SvK/partier/icke-nordiskt UT)

Seed-filen (apps/scraper/fb-seed-urls.json) skrivs numera av snowball.cjs
själv. Hela kedjan körs veckovis av launchd-jobbet se.vadkul.fb-snowball
(måndagar 09:00, se run-weekly.sh — inkl. tsc-vakt med rollback).
Manuell omkörning: bash run-weekly.sh
