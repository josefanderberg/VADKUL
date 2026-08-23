# Stadsinlägg mån 24/8 — Ystad, Göteborg, Haparanda (kl 6, 7, 8)

Dag 2 efter [stadsinlagg-2026-08-23.md](stadsinlagg-2026-08-23.md). Texterna
är byggda med `cityPostText.ts`-logiken mot aggregatdatat från 22/8, men
**kuraterade** — se avvikelserna per ort nedan. Målet: ligga färdiga i
Business Suite → Planner så de kan publiceras/delas direkt på förmiddagen.

## Schemalägg (minin/MacBooken, kan köras i samma sittning som 23/8-inläggen)

```bash
cd apps/scraper
PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" \
npx ts-node src/scripts/schedule-city-posts.ts \
  --orter=Ystad,Göteborg,Haparanda --start=2026-08-24 --klockan=06:00 --per-dag=3
# granska dry-runnen, kör om med --commit — byt sedan Göteborg-texten i Planner (se nedan)
```

## ⚠️ Göteborg: byt skriptets text mot den kuraterade

Skarpa skriptet fyller Göteborg-inlägget med veckorutiner ("Allsång",
"Terminsstart: S:t Olofskören", "Fysisk aktivitet") — hundratals rutiner är
felkategoriserade som `music` och vinner på tidssortering. Riktiga
dragplåster (Liseberg-spelningarna, Kungälvsparken 483 anmälda, Brännö
Konstrunda) begravs. Texten nedan är i stället urvald på publiksiffror
(≥8 anmälda). **Efter --commit: öppna Göteborg-inlägget i Planner och klistra
in texten nedan.** (Brusfiltret i `cityPostText.ts` behöver byggas ut för
storstäder — separat jobb.)

Småfixar redan gjorda i texterna nedan (stryk motsvarande rader i dry-runnen
om du behåller skriptets text): Ystad hade "I list & lust" dubbelt (Folkets
Park + Teaterhallen, samma dag — Teaterhallen struken) och en
`&quot;`-entitet i P-M Nilsson-raden; Haparanda hade Seskarö-teatern dubbelt
("Teater — PRO Seskarö" struken, samma föreställning).

## Bilder

- Ystad: `https://vadkul.se/api/marketing/ad-plats?lat=55.4300&lng=13.8200&namn=Ystad&radie=25&stil=annons`
- Göteborg: `https://vadkul.se/api/marketing/ad-plats?lat=57.7100&lng=11.9700&namn=G%C3%B6teborg&radie=25&stil=annons`
- Haparanda: `https://vadkul.se/api/marketing/ad-plats?lat=65.8400&lng=24.1400&namn=Haparanda&radie=25&stil=annons`

Göteborg har stadssida (`/evenemang/goteborg`) — länken i texten pekar dit.
Ystad och Haparanda saknar stadssida → `vadkul.se`.

---

## Ystad — kl 06:00 (94 event inom 25 km)

```
Veckan i Ystad 👇

🎭 Happy Monday — Ystad Studios Visitor Center (måndag kl 10)
🎨 Explore Ystad 2026 (måndag kl 10)
🛍️ "Det politiska läget" P-M Nilsson — Löderups Strandbad (måndag kl 19)
🎨 Vernissage på Träffpunkten i Ystad! (tisdag kl 10)
🎵 Musik i sommarkväll - Genom eld och vatten — Sövde kyrka (torsdag kl 19)
🎭 Säsongspresentation 26/27 — Skurups Folkets Hus och Park (lördag kl 15)
🎵 Konsert med Wendy McNeill på Rynge Teater (lördag kl 19)

Och nästa vecka:
🍽️ Seniorfrukost — Betlehem i Köpingebro (fd Trendklippet) (måndag 31/8 kl 9)
🎭 Säsongspresentation 26/27 — Flora biografteater (tisdag 1/9 kl 19)
🎵 Berättande konsert om romernas historia och kultur med Krilja Duo — S:t Petri kyrkoplan (lördag 5/9 kl 14)
🎭 I list & lust — Folkets Park (lördag 5/9 kl 17)
🎵 Ystad Seriefestival 2026 (söndag 6/9 kl 15.40)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vad har vi missat? Tipsa i kommentarerna 👇
```

## Göteborg — kl 07:00 (kuraterad, publiksiffror ≥8)

```
Det händer grejer i Göteborg de närmaste dagarna 👇

🎨 Visning: Noughties – 00-talets mode och trender — Kvarnbygatan 12 (tisdag kl 12.15)
🎭 GHOST: 2 BIG TO RIG på Bio Roy — 45 Kungsportsavenyen (onsdag kl 20.30)
🎵 Micke Ahlgrens på Liseberg — Lilla Scenen på Liseberg (torsdag kl 19)
🎨 Brännö Konstrunda 2026 (lördag kl 11)
🎵 Snowstorm & HAAKS i Kungälvsparken! — Karebyvägen 4 (lördag kl 18)
🎵 HISFOG live at Brännö Värdshus (lördag kl 19)
🎵 Sommarturné i Göteborg — Flunsåsparken (söndag kl 14.30)

Och nästa vecka:
🎨 Guidad stadspromenad längs Östra gatan i Kungälv — Gamla torget (tisdag 1/9 kl 18)
🎵 🪩✨ 80/90s MUSIC NIGHT @ GRETAS NIGHTCLUB ✨🪩 — Drottninggatan 35 (lördag 5/9 kl 22)
⚽ Blåbärstävling - agility — Kniparedsgården 10 (söndag 6/9 kl 10)
🛍️ Waterfront Marknad & Loppis — Adolf Edelsvärds Gata 10 (söndag 6/9 kl 11)
👨‍👩‍👧 Reservatets Dag 2026 — Pölgatan (söndag 6/9 kl 11)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se/evenemang/goteborg

Vad blir det för er? 👇
```

## Haparanda — kl 08:00 (6 event inom 25 km — ärliga tunna formatet)

```
Veckan i Haparanda 👇

🎵 Världens kör — Haparanda församlingshem (måndag kl 16)
⚽ Styrketräning | Yoga (onsdag kl 18)
🎭 VÄCKELSEFÖRESTÄLLNINGEN AVVÄXTEN — Seskarö Folkets Hus (lördag kl 18)

Och nästa vecka:
🎵 Världens kör — Haparanda församlingshem (måndag 31/8 kl 16)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vad har vi missat? Tipsa i kommentarerna 👇
```

---

Efter publicering: permalink → Dela → Dela i en grupp. Haparanda är tunn —
maker-story-varianten (`facebook-poster.md`, variant B) kan passa bättre där
om gruppen inte fått den förut.
