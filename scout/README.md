# scout/ — recon-verktyg för källjakt

Fristående probe-skript (ren node, inga deps utom puppeteer för Axiell).
Körs manuellt, skriver aldrig till DB eller registry. Byggda under
kommun-svans-svepet 2026-08-26 — se `docs/scrapers/kommun-svansen.md`.

| Skript | Vad | Kör |
|---|---|---|
| `kommun-fingerprint.cjs` | Plattform, kalendersidor, API-signaturer per kommunsajt | `node kommun-fingerprint.cjs` (läser `uncovered.txt`) |
| `restapp-dig2.cjs` | SiteVision-webbappens API-bas ur `registerInitialState` + 3 anropssignaturer | `node restapp-dig2.cjs` (läser `fingerprint.json`) |
| `sibling-sweep.cjs` | Gissade turist-/biblioteksdomäner per kommun | `node sibling-sweep.cjs` |
| `external-sweep.cjs` | Externa domäner kommunen själv länkar till + regionala plattformar | `node external-sweep.cjs` |
| `lib-prefilter.cjs` | HTTP-förfilter: vilka bibliotekssajter är Axiell Arena | `node lib-prefilter.cjs` |
| `axiell-discover.cjs` | Puppeteer: fångar `customerId` ur browserns api.axiell.com-anrop | `node axiell-discover.cjs` |
| `xhr-batch-scout.cjs` | Puppeteer i batch: fångar alla JSON-svar + externa länkar per kalendersida | `node xhr-batch-scout.cjs scout-tasks.json ut.json` |
| `sniff-one.cjs` | Puppeteer på enstaka URL:er — visar metod, URL och POST-body | `node sniff-one.cjs <url> [<url>…]` |
| `bestevent-probe.cjs` | Letar Innocode BestEvent på kalender./evenemang.-subdomäner | `node bestevent-probe.cjs` |
| `cruncho-sweep.cjs` | Letar SiteVision-Cruncho-kalendrar + portletId | `node cruncho-sweep.cjs` |

`uncovered.txt` (`Namn|region|domän`) genereras med
`npm run coverage -- --uncovered --json`.
