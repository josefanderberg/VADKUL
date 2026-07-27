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

OBS: seed-filen (fb-seed-urls.json) skrivs i steg 1 av separat kommando:
    node -e "const d=require('./out/host-snowball.json'),fs=require('fs');const ids=[...new Set(d.flatMap(r=>r.related||[]))];fs.writeFileSync('../../fb-seed-urls.json',JSON.stringify(ids.map(id=>({url:'https://www.facebook.com/events/'+id+'/'})),null,1));console.log(ids.length)"

Kör om ~veckovis: pipelinen läser DB:n som växer av sina egna fynd
(självförstärkande). Typkolla + vitest efter regenerering innan commit.
