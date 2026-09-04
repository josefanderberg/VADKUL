# Omtag: Landskrona + Stockholm (1/9)

Landskrona-gruppen **avvisade** ansökan 1/9 med motiveringen "Ta bort alla
evenemang som ej finns i Landskrona kommun och lägg upp igen". Gruppen har
rätt: skriptet väljer event inom en RADIE (25 km), och en radie bryr sig
inte om kommungränser. Landskrona-inlägget innehöll Helsingborg
(Sundspärlan, Jazzdans), Kävlinge (Löddeköpinge), Lomma (Bjärred) och
Svalöv — fler utsocknes rader än egna.

Utkasten nedan är handkurerade och **varje rad är kontrollerad mot
Landskrona respektive Stockholms kommun**.

---

## Landskrona — omtag

Allt ligger i Landskrona kommun: staden, Borstahusen, Slottsparken,
Landskrona IP, Landskrona GK, Säbybäcken. Landskrona Foto Festival
(4–20 september) är veckans stora grej och saknades helt i förra utkastet.

```
Det händer grejer i Landskrona de närmaste dagarna 👇

🎭 Social dans med Landskrona stad (onsdag kl 14)
🎭 SoulTime – BAUN — Landskrona Teater (torsdag kl 19)
🎨 Landskrona Foto Festival — invigning, pågår 4–20 september (fredag kl 12)
🎨 Artist talk med Pieter Hugo — Landskrona Teater (fredag kl 14.30)
🤝 Visning av Flaggskeppet i Borstahusen (lördag kl 10)
🎵 Jazz på stan — Rådhustorget (lördag kl 10.30)
🎭 Danskväll i Slottsparken (lördag kl 20)
⚽ Distriktsmästerskap i golf — Landskrona GK (söndag kl 12)

Och nästa vecka:
⚽ Landskrona BoIS – Helsingborgs IF — Landskrona IP (onsdag 9/9 kl 19)
🎵 Bohuslän Big Band spelar Davis & Coltrane (torsdag 10/9 kl 19)
🍽️ Skaldjurskryssning med M/S Tilda — Lilla Strandgatan (fredag 11/9 kl 18)
🎭 The Father av Florian Zeller — Landskrona Teater (fredag 11/9 kl 19)
✨ Håvning i Säbybäcken (lördag 12/9 kl 11)
🎵 Österdagen (lördag 12/9 kl 12)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vad har vi missat? Tipsa i kommentarerna 👇
```

**Uteslutna med flit** (låg inom 13 km men i annan kommun): FashionSwop
i Rydebäck (Helsingborg), Friluftsfrämjandet Lödde-Kävlinge, Hundens
vecka i Kävlinge, hundpromenad i Löddeköpinge, vandring med
Friluftsfrämjandet Malmö.

---

## Stockholm — omtag

Samma kommunregel tillämpad: bara Stockholms kommun. Utesluter Nacka,
Solna, Sundbyberg, Danderyd, Järfälla, Huddinge, Sollentuna och Ekerö —
exakt den sortens rader som fällde Landskrona.

```
Vad händer i Stockholm den här veckan? 👇

🎵 Live Sessions: Thomas Stenström — Trädgården (onsdag kl 17)
🎵 Snarky Puppy: SOMNI World Tour — Fållan (onsdag kl 20)
🎨 Temavisning: Vasaskandaler — Livrustkammaren (torsdag kl 18)
🎉 MAMMA MIA! THE PARTY — Tyrol (torsdag kl 18.30)
🎉 Bio Skandia 103 år – block party (fredag kl 17)
🛍️ The Hornstull Market — Hornstulls strand (lördag kl 14)
🎭 Stockholms blodbad – teater på Gamla stans gator (lördag kl 16)
🎵 Bach på Sergels torg — Parkteatern (lördag kl 18)
🚲 Stockholm Bicycle Show — Tekniska museet (söndag kl 11)

Och nästa vecka:
🎵 Carola — Mosebacketerrassen (tisdag 8/9 kl 19.30)
🎭 Magnus Betnér (tisdag 8/9 kl 20)
🎵 The Jayhawks – 40 år — Nalen (onsdag 9/9 kl 21)
🎭 Skriet från kloaken — Teater Brunnsgatan Fyra (torsdag 10/9 kl 19)
🎵 Markus Krunegård — Gröna Lund (torsdag 10/9 kl 20)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se/evenemang/stockholm

Vilken av dem lockar mest? 👇
```

Not: 🚲 är inte en av `CATEGORY_EMOJI`-emojierna (cykelmässan klassas som
`stage` → 🎭). Byt till 🎭 om raden ska matcha skriptets format exakt.

---

## Rotorsaken är inte fixad

Radie-urvalet i `eventsForTown` (schedule-city-posts.ts) känner inga
kommungränser. **Samma fel sitter i inlägg som redan är schemalagda:**

- **Märsta (ons 2/9 kl 08)** — Järfälla, Vallentuna och Gottsunda Dans &
  Teater (som ligger i UPPSALA, 60 km bort).
- **Torshälla (tors 3/9 kl 07)** — i praktiken ett Västerås-inlägg
  (domkyrkan, Stora torget, Tuna Park, Parkteatern).
- **Skärhamn (fre 4/9 kl 07)** — Stenungsund, Marstrand, Orust.

Ett kommunfilter (eller en snävare radie för orter nära en större
grannkommun) behövs innan bandet rullar vidare.
