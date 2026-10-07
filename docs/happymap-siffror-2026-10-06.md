# Happymap i siffror - mätning 2026-10-06 kväll

_Komplement till `konkurrentgranskning-happymap.md` (egen gren `docs/konkurrentgranskning-happymap`).
Underlag: happymaps publika kartdata (`jambo-pulse/pulse.json`, öppen storage-fil som deras karta
läser; byggd 2026-10-06 19:09) samt deras publika sitemaps. Inga inloggade eller betalda anrop._

## Den ärliga veckojämförelsen

Deras karta serveras ur en puls-fil som täcker EXAKT 7 dagar framåt - samma horisont som vår
välkomstruta räknar. Det ger den första siffran som faktiskt är jämförbar:

| Kommande 7 dagar | Happymap | VADKUL |
|---|---|---|
| Event | 22 766 | 17 729 |

**De ligger ca 28 % över oss - inte 3x.** Rubriksiffran 139 697 på deras /vad-hander är alla
kommande event utan tidsgräns, kraftigt uppblåst av serieexpansion: varje tillfälle i en
återkommande serie räknas ("Bön för freden - 131 datum"). En enda källa, Uppsala
domkyrkoförsamling, står för 1 034 av dem. Vi expanderar också serier, men kortare.

Per dag (deras puls, 6-12 okt): ti 1 168 (bara kvällens återstod - filen byggdes 19:09),
on 4 586, to 4 439, fr 2 973, lö 3 041, sö 2 978, må 3 581.

## Deras vecka per kategori

| Kategori | Event/vecka | | Kategori | Event/vecka |
|---|---|---|---|---|
| music | 3 625 | | family | 1 203 |
| workshop | 2 933 | | food-drink | 1 133 |
| community | 2 814 | | theater | 823 |
| religion | 2 365 | | talks | 793 |
| art | 2 037 | | film | 753 |
| sports | 1 513 | | wellness | 633 |

Övriga: tours 544, quiz 444, other 281, nightlife 217, festival 194, outdoors 177, comedy 146,
market 82, karaoke 56. Notera religion (2 365) och community (2 814): volymen vi redan skrapar
via Svenska kyrkan-API:t och PRO men gömmer bakom opt-in visar de för alla.

## Källbredd (sitemap-analys, 2 729 arrangörer / 3 780 platser)

- **Vi har övertag:** biljettplattformar (TM/Billetto/Tickster/Nortic - de har 0), ligasport
  (deras 16 klubbar mot våra ligamotorer), kommun/region/turism (27 mot ~237), museer/hembygd.
- **Paritet men dold:** Svenska kyrkan (~850 församlingar hos dem = vårt nationella API),
  PRO (468 = vårt SiteVision-API med ~970 föreningar). Gapet är PRESENTATION, inte skrapning.
- **Verkliga gap hos oss:** frikyrkor (~149 slugs hos dem), Sensus (Medborgarskolans motor kan
  nära nog återanvändas - registry.ts rad 6374), Folkuniversitetet (dead hos oss), biografer/
  caféscener/Folkets hus (long tail), fler Axiell-bibliotekskommuner (67 av ~250 möjliga).
- **Snabbvinster:** laga folketshusochparker (motorn hittar 148 event, sparar 0 -
  mappningsfel), aktivera everysport (klar, väntar bara API-nyckel), SPF Seniorerna (saknas
  hos båda, samma 65+-fack som PRO).

## Deras stack (för referens)

Next.js på Vercel, Supabase (Postgres, öppet REST-API med RPC:er), egen vektor-tileserver
(tiles.happymap.se, pmtiles) med OpenFreeMap-fallback, MapLibre GL (samma som vi),
Cloudflare-bildproxy (img.happymap.se), SMHI-väder. Eventdata till kartan = en enda
förbyggd puls-fil + viewport-RPC:er.
