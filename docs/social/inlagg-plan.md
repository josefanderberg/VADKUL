# Planerbara inlägg — Facebook & Instagram

Tre **eviga** inlägg (inga datum, inga namngivna event) som kan schemaläggas
veckor framåt utan att bli inaktuella. Färskvaruregeln i
[../outreach/facebook-poster.md](../outreach/facebook-poster.md) gäller bara
inlägg med konkreta event — därför innehåller inget av inläggen nedan ett
enda eventnamn.

Postas från **VADKUL-sidan** (till skillnad från gruppinläggen, som går från
privata kontot).

---

## Stilreglerna (håll dem i varje inlägg)

### Färg

| Roll | Värde | Används till |
|---|---|---|
| Bas | `#04395E` → `#006AA7` (mjuk gradient, mörkast uppe till vänster) | bakgrund, alltid |
| Accent | `#FECC02` | siffror, event-prickar, EN sak per bild |
| Vit | `#FFFFFF` | logga, rubriktext, emoji-brickor, CTA-pillen |
| Ljusblå | `#8FC7E8` | underrubrik/brödtext på mörk botten |

Inga andra färger. Ingen lila, ingen orange, inga gradientfilter över foton.
Regeln: **mörkblå natt + gult ljus**. Gult = "något händer här".

### Form och typografi

- Fet, rundad, geometrisk sans (Poppins ExtraBold / Fredoka). Hög kontrast.
- Rubrik: **max 6 ord** eller **en stor siffra**. Aldrig både och i samma storlek.
- Rundade hörn överallt — kort, pill-knappar, brickor.
- Event = **vit cirkel med EN emoji** (🎸 🎭 ☕ ⚽ 🎨). Aldrig två emoji i samma bricka.
- Gula prickar = event utan bricka. De får gärna forma Sverige.
- Vitt luftigt utrymme uppe till vänster åt loggan.

### Fasta element i varje bild

1. Loggan uppe till vänster (vitt moln + `VADKUL`).
2. Vit pill nere till vänster: `vadkul.se`.
3. Under pillen, litet: `Gratis · Inget konto behövs`.

### Format

- Feed FB + IG: **1080 × 1080**.
- IG-porträtt (mer yta i flödet): **1080 × 1350** — samma layout, mer luft.
- Stories/Reels-cover: **1080 × 1920**.
Gör kvadraten först, beskär uppåt/nedåt för de andra.

### Tonalitet i texten

- **Granne som tipsar**, inte varumärke som annonserar. Du-tilltal.
- Ärlig hobbyprojekt-vinkel funkar: "jag har byggt den själv".
- Avsluta **alltid med en fråga** — kommentarer ger räckvidd.
- Ett utropstecken per inlägg, inte fem. Inga VERSALER i hela meningar.
- Aldrig: "Vi erbjuder", "revolutionerande", "plattform", "lansering".
- Emoji: 3–6 stycken, som radmarkörer — aldrig mitt i en mening.

### Aldrig

- Stockfoto på leende människor.
- Konkreta event i ett inlägg som ska ligga i kön (färskvara).
- Text som AI:n själv har renderat (se nedan).

---

## Loggan — så gör du

**Ja, bifoga loggan** — men i två steg, för AI-bildverktyg kan varken rita om
en logga korrekt eller stava svenska (`å ä ö` blir `a a o`, ord blir gröt).

1. **Till AI:n:** bifoga loggan + en skärmdump av kartan med emoji-brickor som
   *stilreferens*. Skriv i prompten: *"do not draw any text or logo — leave the
   top-left corner and the lower-left corner empty for later placement"*.
2. **Efteråt (Canva/Figma/Preview):** lägg dit den riktiga loggan, rubriken,
   `vadkul.se`-pillen och `Gratis · Inget konto behövs` själv. Då blir text och
   logga exakt rätt, varje gång.

Kortversionen: **AI:n gör scenen, du gör texten.**

Loggfilen i repot: `apps/web/public/pwa-icon-512.png` (molnet). Wordmarken
`VADKUL` finns på de gamla annonserna i `apps/web/public/marketing/` — enklast
är att klippa den ur `annons_sverige_20260707.png` eller sätta den i Poppins
ExtraBold med vidgad teckenspärr.

---

## Inlägg 1 — "Va, var det i lördags?!" (igenkänningen)

**Syfte:** räckvidd. Ingen produkt förrän på tredje raden.
**Bäst att posta:** tisdag–onsdag kväll, 19–21.

### Bildbrief (till AI:n, engelska)

> Square 1080×1080 illustration. Night-time Swedish small-town street seen from
> above at a slight angle, drawn flat and friendly, deep blue palette (#04395E
> to #006AA7), rounded shapes, no photorealism, no people's faces. Scattered
> across the map are small warm yellow glowing dots (#FECC02) — but they are all
> fading out, dimming, as if the evening already happened. One single white
> circular tile with a 🎪 emoji is still glowing brightly in the corner. Soft
> glow, subtle grain, calm and a little wistful but not sad. Leave the top-left
> corner and the lower-left third completely empty — no text, no logo, no
> lettering anywhere in the image.

**Sätt sedan dit själv:** rubrik i vitt, ExtraBold, vänsterställd —
*"Va, var det i lördags?"* — och under i ljusblått: *"Missade du det igen?"*
Plus logga + pill.

### Text — Facebook

> "Va, var det i lördags?!"
>
> Den känslan. Loppisen, konserten, tivolit i grannbyn — man får alltid veta
> det efteråt. Av en granne. Två veckor för sent.
>
> Det var därför jag byggde **vadkul.se**: en karta där allt som händer i
> Sverige ligger samlat. Konserter, loppisar, barnkalas, föreläsningar,
> hembygdsdagar. Gratis, inget konto, ingen app.
>
> 👉 vadkul.se
>
> Vad är det roligaste du missat för att du fick veta för sent? 👇

### Text — Instagram

> "Va, var det i lördags?!" 🫠
>
> Loppisen. Konserten. Tivolit i grannbyn. Alltid får man veta det efteråt.
>
> Därför byggde jag en karta över allt som händer i Sverige. Gratis, inget
> konto. Länk i bion 💛
>
> Vad har du missat senast? 👇

**Hashtags (IG):** `#vadkul #vadhänderisverige #evenemang #tipstorsdag
#sverige #upptäcksverige #helgtips`

---

## Inlägg 2 — Kartan (produkten, den bärande bilden)

**Syfte:** förklara vad det är på tre sekunder. Detta är inlägget att boosta.
**Bäst att posta:** torsdag 17–19, inför helgen.

### Bildbrief

> Square 1080×1080. Stylised night map of Sweden, deep blue background gradient
> (#04395E to #006AA7), the country's silhouette formed entirely out of hundreds
> of small glowing yellow dots (#FECC02) — dense around the cities, sparse in the
> north. Four white circular tiles with a soft drop shadow float on the map, each
> containing exactly one emoji: 🎸 ☕ ⚽ 🎨. Gentle glow around each tile, clean
> flat vector look, rounded, joyful, no clutter, no confetti. Keep the entire
> left half of the image empty and dark — no text, no logo, no lettering anywhere.

**Sätt sedan dit själv:** i vänsterhalvan — stor gul siffra (hämta dagens
siffra från kartan innan du postar, t.ex. `1 260`) + *"event i Sverige — bara
idag."* + i ljusblått *"Varje gul prick är något som händer."* + logga + pill.

> Siffran är det enda i inläggskön som behöver kollas före publicering.
> Avrunda nedåt (`över 1 200`) så håller den i veckor.

### Text — Facebook

> Så här ser en vanlig onsdag ut i Sverige 👇
>
> Varje gul prick är något som faktiskt händer: en konsert, en loppis, en
> öppen förskola, en föreläsning, en fotbollsmatch.
>
> Allt ligger samlat på **vadkul.se** — zooma in på din stad och se vad som
> händer i kväll. Gratis, inget konto behövs, funkar direkt i mobilen.
>
> 👉 vadkul.se
>
> Zooma in på din hemstad — hur många prickar hittar du? 👇

### Text — Instagram

> Varje gul prick = något som händer i kväll 💛
>
> Konserter, loppisar, föreläsningar, matcher. Hela Sverige på en karta,
> gratis och utan konto.
>
> Länk i bion 🗺️
>
> Hur ser det ut i din stad? 👇

**Hashtags (IG):** `#vadkul #sverige #evenemang #karta #vadhänderisverige
#konsert #loppis #kultur`

---

## Inlägg 3 — "Lägg upp ditt eget" (arrangörer & tipsare)

**Syfte:** fylla kartan. Talar till föreningen, kaféet, loppisarrangören.
**Bäst att posta:** söndag kväll eller måndag förmiddag — då planerar folk.

### Bildbrief

> Square 1080×1080, deep blue night background (#04395E to #006AA7), same flat
> rounded style. Centre: one large white circular tile with a soft glow and a
> gold star ⭐ resting on its upper edge, and inside the tile a single 🎪 emoji.
> Around it, three or four smaller white tiles with emoji (🎻 🍰 🏃) float at
> different depths with a gentle bounce feel. Small yellow dots scattered behind
> them like distant lights. Generous empty dark space in the upper-left and along
> the bottom — no text, no logo, no lettering anywhere in the image.

**Sätt sedan dit själv:** *"Arrangerar du något?"* som rubrik, under i
ljusblått *"Lägg upp det gratis — det syns på kartan direkt."* + logga + pill.

### Text — Facebook

> Arrangerar ni något? Lägg upp det gratis. 🎪
>
> Loppis i församlingshemmet, öppen scen på kaféet, hembygdsdag, träningspass
> i parken, konsert i kyrkan — allt får plats på kartan, och det kostar
> ingenting.
>
> Det tar en minut: gå in på **vadkul.se**, tryck på plus, sätt en nål där det
> händer. Sen syns det för alla i närheten.
>
> Och saknas ert event fast ni redan annonserat det någon annanstans — skriv
> en rad i kommentarerna så lägger jag in det åt er.
>
> 👉 vadkul.se
>
> Vad arrangerar ni i höst? Berätta här 👇

### Text — Instagram

> Arrangerar du något? Lägg upp det gratis 🎪
>
> Loppis, öppen scen, träningspass i parken, konsert i kyrkan — allt får plats
> på kartan. Tar en minut, kostar ingenting.
>
> Länk i bion ⭐
>
> Vad har du på gång? 👇

**Hashtags (IG):** `#vadkul #arrangör #förening #loppis #lokalt #evenemang
#sverige #småföretagare`

---

## Publiceringsrytm

En vecka per inlägg, i ordningen 1 → 2 → 3, sen om från början med nya bilder
och samma vinklar. Samma bild på FB och IG; texten kortas alltid för IG.

- **FB:** länken i brödtexten funkar (räckvidden straffas något — lägg gärna
  länken i första kommentaren istället och testa vilket som går bäst).
- **IG:** aldrig länk i texten. `vadkul.se` i bion, "länk i bion" i texten.
- **Svara på varje kommentar första dygnet** — samma regel som i grupperna.
