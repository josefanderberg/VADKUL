# Övriga: Meetup, VäxjöCo, Upplev

Tre scrapers som ger data men med samma kvalitetsbrist. Grupperade för att problemet och fixen är gemensamma.

| Källa | Events | Fil |
|---|---|---|
| Meetup | 30 | [meetup.ts](../../apps/scraper/src/scrapers/meetup.ts) |
| VäxjöCo | 9 | [vaxjoco.ts](../../apps/scraper/src/scrapers/vaxjoco.ts) |
| Upplev Växjö | 9 | [upplev.ts](../../apps/scraper/src/scrapers/upplev.ts) |

## Nu-läget

Snapshot: `events.db` 2026-05-27. Alla 48 events delar mönster:

| Fält | Meetup | VäxjöCo | Upplev |
|---|---|---|---|
| `description=''` | 30/30 | 9/9 | 9/9 |
| `extractedAddress=''` | 30/30 | 9/9 | 9/9 |
| `geocodedQuery=''` | 30/30 | 9/9 | 9/9 |
| `isHostVerified=0` | 30/30 | 9/9 | 9/9 |
| `isLocationVerified=1` | 30/30 | 0/9 | 0/9 |
| Korrekt host-namn | ja | "Växjö & Co" | "Upplev Växjö" |

VäxjöCo har events som sträcker sig till **2026-11-28** (Karl-Oskardagarna, MAT2026, HippHipp Live!). Inget 7-dagars-filter — scrapen tar allt som finns på listan.

SQL: `SELECT MAX(time) FROM link_events WHERE url LIKE '%vaxjoco%'`.

## Analys

**Gemensam orsak**: alla tre bygger event-objektet utan `description`, `extractedAddress`, `geocodedQuery`, `isHostVerified` ([meetup.ts:203](../../apps/scraper/src/scrapers/meetup.ts:203), [vaxjoco.ts:308](../../apps/scraper/src/scrapers/vaxjoco.ts:308), [upplev.ts:335](../../apps/scraper/src/scrapers/upplev.ts:335)).

Samma rotorsak som i [tickster.md](tickster.md): fält-shape inte konsekvent mellan scrapers.

*Hypotes*: en scraper skrevs först (sannolikt Facebook), de andra kopierade strukturen *innan* alla fält fanns. Schemat växte, scraperna följde inte med.

**VäxjöCo, frågan om datum-fönster**:
- Bra: VäxjöCo har riktigt verifierade lokala events (Karl-Oskar, MAT, etc.) långt fram.
- Bug eller feature? *Hypotes*: feature — VäxjöCo är så liten att vi vinner mer på att behålla dem som "framtida lokala events" än att tvinga in 7-dagars-fönster. Behöver bekräftas.

**Meetup/Upplev**:
- Volymerna är låga men datan är ren. Inga galna koord, inga skräp-titlar.
- Lägsta prioritet att fixa.

## Begränsningar

Den här rundan: dokumentera *bara*. Inga kodändringar.

Skäl: vi vet inte ännu om vi vill standardisera shape via en hjälpfunktion (`buildLinkEvent({...})`) eller bara fylla i fält per scraper. Det beslutet hör hemma i [tickster.md](tickster.md) först — tickster är största fallet och setting the pattern.

Vi rör **inte**:
- VäxjöCo:s 7-dagars-fråga (behöver produktinput).
- Volymökning. 48 events är 4% — inte värt prioritet.

## Fortsättning

Öppna frågor:

- [ ] En `buildLinkEvent`-helper med alla fält tvingade, eller TypeScript-strikt typ?
- [ ] Behåller vi VäxjöCo:s långa horisont?
- [ ] Meetup-events från Stockholm/Göteborg: relevanta för Växjö-användare?

Nästa beslut: efter Tickster är fixad — applicera samma pattern här. Inte före.
