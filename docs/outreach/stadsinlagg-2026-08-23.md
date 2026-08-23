# Stadsinlägg sön 23/8 — Arvika, Borlänge, Falkenberg (kl 6, 7, 8)

Förberedda sidinlägg att schemalägga imorgon bitti, för delning in i grupperna
under förmiddagen. Texterna nedan är byggda med `cityPostText.ts`-logiken mot
aggregatdatat från 22/8 kl 12:04 — samma urval som `schedule-city-posts.ts`
skulle göra, förutom Falkenberg-justeringen nedan.

## Schemalägg (körs på minin eller MacBooken, kräver FB-token + events.db)

```bash
cd apps/scraper
PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH" \
npx ts-node src/scripts/schedule-city-posts.ts \
  --orter=Arvika,Borlänge,Falkenberg --start=2026-08-23 --klockan=06:00 --per-dag=3
# granska dry-runnen, kör sedan om med --commit
```

`--per-dag=3` ger kl 6, 7 och 8 samma dag. Vilken ort som får vilken timme
styrs av gruppantal (flest grupper först) — spelar timmen per ort roll, kör
tre separata anrop med varsin `--klockan`.

## ⚠️ Före --commit: felgeokodade församlingar vid Falkenberg

**39 event** från Fässbergs församling (ligger i Mölndal) och Klövedals
församling (Tjörn) har koordinater i Falkenbergstrakten i datat. Skarpa
skriptet kommer plocka in dem i Falkenberg-inlägget ("Fässberg Gospel",
"Söndagsklubben i Fässbergs kyrka", "Klövedals kyrkokör"). Stryk de raderna i
dry-runnen — eller redigera det schemalagda inlägget i Business Suite →
Planner och klistra in Falkenberg-texten nedan, där de redan är bortrensade.
Grundfelet (geokodningen av församlingseventen) är ett separat pipelinejobb.

## Bilder (hämtas av FB vid schemaläggningen)

- Arvika: `https://vadkul.se/api/marketing/ad-plats?lat=59.6500&lng=12.5900&namn=Arvika&radie=25&stil=annons`
- Borlänge: `https://vadkul.se/api/marketing/ad-plats?lat=60.4800&lng=15.4400&namn=Borl%C3%A4nge&radie=25&stil=annons`
- Falkenberg: `https://vadkul.se/api/marketing/ad-plats?lat=56.9000&lng=12.4900&namn=Falkenberg&radie=25&stil=annons`

Ingen av orterna har stadssida än, så länken i texterna är `vadkul.se`.

---

## Arvika — kl 06:00 (46 event inom 25 km)

```
Helgen i Arvika ser inte tom ut direkt 👇

👨‍👩‍👧 Skogsmulle (barn fött 2021 eller 2022) — Friluftsfrämjandet Arvika-Sunne (söndag kl 10)
🤝 Nyfiket — Ny kyrka (söndag kl 15)
✨ Toy Story 5 (Tal: Svenska (dubbat)) (Text: Svensk — Filmhuset Palladium Arvika (söndag kl 16)

Och nästa vecka:
⚽ Boule — PRO Gunnarskog (måndag 24/8 kl 10)
👨‍👩‍👧 "Kyrkis" — Trefaldighetskyrkans församlingshem (tisdag 25/8 kl 9)
👨‍👩‍👧 After school — Arvika bibliotek (fredag 28/8 kl 15)
👨‍👩‍👧 Familjedag! 0 till hundra — Brunskogs kyrka (lördag 29/8 kl 11)
🎵 PUBKVÄLL MED LIVEMUSIK - AXEL & RASMUS — Kvarnen (lördag 29/8 kl 19)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vad blir det för er? 👇
```

## Borlänge — kl 07:00 (163 event inom 25 km)

```
Vad händer i Borlänge i helgen? Mer än man tror 👇

✨ Tansvägga naturreservat — Gagnef kommun (söndag kl 9)
⚽ Trivselboule på sportfältet/hockeyrinken — PRO Domnarvet (söndag kl 13)
👨‍👩‍👧 Giftmord, trolldom och farliga väsen - berättarstund Kapellet vid Arkhyttans bystuga, Säter (söndag kl 16)

Och nästa vecka:
🎵 Logdans — Tunabygdens Hembygdsförening (måndag 24/8 kl 18)
🎵 Borlänge Tjejkör — Hagakyrkan (tisdag 25/8 kl 17)
🎵 Sångövning i Karlsbyhedens FH. — PRO Sundborn (tisdag 25/8 kl 18)
🎭 Carola! (Tal: Svenska) (Text: Svenska) — Biosalongen (onsdag 26/8 kl 15)
🎵 En kväll med sill&nubbe med Håkan Juholt — Äteriet Hantverksbyn (onsdag 26/8 kl 18)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vilken av dem lockar mest? 👇
```

## Falkenberg — kl 08:00 (57 event inom 25 km, Fässberg/Klövedal bortrensade)

```
Vad händer i Falkenberg i helgen? Mer än man tror 👇

✨ Båt museets dag — Tvååkers Hembygdsförening (söndag kl 13)
🎨 Inre rum | Guidad meditation & reflektion | Falkenberg — Hälsoloftet (söndag kl 15.30)
📚 Föreläsning med Elin Unnes – Att återuppliva en gammal trädgård (söndag kl 16)

Och nästa vecka:
🎵 BATIK med sång och musik – en konstresa i toner! (onsdag 26/8 kl 15)
🎨 Uti Guds hage — Getinge Församlingshem (torsdag 27/8 kl 17)
🎵 Sommarmusik - See you later alligator - (mera) kyrkrock! — Morups kyrka (torsdag 27/8 kl 19)
🎵 Maxida Märak med musiker Louice Ottosson — Ätrasalen (fredag 28/8 kl 19)
🎵 Kyrkogårdens dag — Harplinge kyrka (söndag 30/8 kl 14)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vilken av dem lockar mest? 👇
```

---

Efter publicering: öppna permalinken, Dela → Dela i en grupp (max 2–3 grupper
per dag, variera gärna en rad eller två — se `facebook-poster.md`).
