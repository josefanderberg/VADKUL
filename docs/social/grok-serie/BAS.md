# BAS - stilschemat för Grok-serien

Det här är grunden som alla avsnitt bygger på, precis som `Bas/` i CV-mappen.
Ändra bara här när något ska gälla **alla** avsnitt, och för sedan ut
ändringen i avsnittsfilerna (be Claude: *"för ut BAS-ändringen i grok-serien"*).

Stilen är spikad mot studions slutbild (`vadkulyt/mall/slut.png`), så att
Grok-klippen och slutbilden ser ut som samma film.

---

## 1. Färger

| Roll | Värde | Används till |
|---|---|---|
| Natt, topp | `#08304A` | bakgrundens övre del |
| Natt, botten | `#0A5077` | bakgrundens nedre del (mjuk gradient uppifrån och ned) |
| Gult ljus | `#FDE047` | event-prickar, glöd, EN nyckelsak per text |
| Vit | `#FFFFFF` | rubriker, emoji-brickor, molnet, pillen |
| Ljusblå | `#BAE6FD` | underrader, molnets kontur |
| Pillblå | `#0284C7` | bara texten `vadkul.se` i den vita pillen |

Regeln: **mörkblå natt + gult ljus. Gult = något händer här.**
Inga andra färger i scenen (emojis får behålla sina egna färger).

## 2. Bildvärlden

- **Rendering:** mjuk 2.5D-illustration med lite djup och mjuk glöd. Som en
  påkostad app-förklaringsfilm. Aldrig fotorealism.
- **Kartan:** Sverige på natten ovanifrån. Land lite ljusare blått än havet.
  Inga vägar, gränser eller ortnamn. Orter = kluster av gula prickar.
- **Event:** gula glödande prickar på avstånd, runda vita brickor med EN emoji
  när vi kommer nära. Aldrig två emojis i samma bricka.
- **Molnet (maskoten):** litet vitt fluffigt moln, ljusblå kontur, två stängda
  glada ögonbågar och ett enkelt leende. Samma som appikonen
  (`apps/web/public/pwa-icon-bla-512.png`). Det är seriens återkommande figur.
- **Människor (när de behövs):** enkla rundade illustrerade figurer med
  prick-ögon. Inga riktiga ansikten.
- **Ordmärket `VADKUL` ritas aldrig av Grok.** Det kommer bara via slutbilden
  och klipprogrammet.

## 3. Komposition (9:16, 1080 × 1920)

- **Övre tredjedelen (y 250-700) är lugn och tom** - där bor texten.
- **Nedersta femtedelen (y 1500-1920) har inget viktigt** - där ligger
  TikTok/Reels-texten och knapparna.
- Håll 140 px fritt längs högerkanten i mitten (gilla/dela-knapparna).

## 4. Text (läggs på i efterhand, aldrig av Grok)

AI kan inte stava svenska (å ä ö blir gröt). **Grok gör scenen, du gör texten.**

| Del | Typsnitt | Storlek | Färg |
|---|---|---|---|
| Rubrik | Fredoka Bold (700) | 84 px | vit |
| Nyckelord eller siffra | Fredoka Bold (700) | 84 px (siffror 160-250 px) | gul `#FDE047` med gul glöd ca 35 % |
| Underrad | Fredoka SemiBold (600) | 52 px | ljusblå `#BAE6FD` |

- Centrerad, mittlinje runt **y 520**. Max 2 rader, max 6 ord per text.
- **En text i taget**, minst 2 sekunder i bild.
- **In:** pop - skala 85 % till 100 % med liten överstuds, 0,3 s.
  **Ut:** tona bort, 0,2 s. Inga andra textanimationer.
- Vanlig meningsbyggnad, inga VERSALER i hela meningar (bara ordmärket
  `VADKUL`). Max ett utropstecken per video. Inga emojis i texten - emojis bor
  i brickorna.
- Tilltal: du. Granne som tipsar, aldrig reklamröst.
  Aldrig: "vi erbjuder", "revolutionerande", "plattform", "lansering".

## 5. Rörelse

Seriens rörelsegrammatik. Samma i varje tagning:

- **Bara tre kamerarörelser:** långsam push-in, mjuk dykning ner i kartan,
  lätt sidodrift. En rörelse åt gången.
- **Aldrig:** skakig kamera, snabba panoreringar, rotation, hårda klipp inne i
  en tagning.
- **Prickar** tänds en och en som stjärnor (mjuk intoning, aldrig blink).
- **Brickor** poppar upp med en liten mjuk studs.
- **Molnet** guppar sakta upp och ned.
- Max en ny sak per sekund. Lugnt tempo vinner.

## 6. Rytmen i en tagning (15 s)

| Tid | Del | Vad som händer |
|---|---|---|
| 0-2 s | Krok | Något händer direkt (en prick tänds, molnet dyker upp). Aldrig svart start. |
| 2-12 s | Resa | EN kamerarörelse och max tre nya saker. |
| 12-15 s | Landning | Lugn, nästan stilla, centrerad bild. Tom övre tredjedel. |

Landningen är det som gör serien skarvbar: varje tagning slutar i ett lugnt
läge som en förlängning (+15 s) kan ta vid ifrån, eller som slutbilden kan
klippas mot.

## 7. Ljud

- I Grok: be om stämningen i LJUD-blocket nedan.
- I klippet: **byt till seriens fasta spår** så att alla avsnitt låter
  likadant. Seriens spår: `[VÄLJ ETT LICENSFRITT SPÅR OCH SKRIV IN NAMNET HÄR]`.
- Ingen speakerröst. Videon ska funka ljudlöst (de flesta ser utan ljud).

## 8. Slutbilden

Varje video slutar med studions slutbild, `vadkulyt/mall/slut.png`
(1080 × 1920), **1,5 s**, mjuk övertoning 0,3 s. Samma i alla avsnitt.
Molnet, `VADKUL`, siffran, `vadkul.se`-pillen och "Gratis · Ingen app behövs"
kommer alla därifrån.

---

## 9. Blocken (klistras in i prompterna)

Prompterna till Grok skrivs på engelska - Grok följer engelska bäst.
Avsnittsfilerna har redan blocken inklistrade; de här är originalen.

### STIL (bildprompter)

```text
Vertical 9:16 frame. VADKUL brand style: soft 2.5D vector illustration with gentle depth and soft glow, like a premium app explainer animation. Background: smooth deep navy gradient, #08304A at the top to #0A5077 at the bottom. The map: Sweden at night seen from above, land a slightly lighter blue than the sea, no roads, no borders, no labels. Events are small warm yellow glowing dots (#FDE047) and round white tiles, each holding exactly one emoji, with a soft yellow halo. Mascot: a small fluffy white cloud with a light-blue outline, two closed happy eye arcs and a simple smile, exactly like the attached reference. People, when shown: simple rounded illustrated figures with dot eyes. Palette: navy, deep blue, warm yellow, white and light blue (#BAE6FD) only; emojis keep their own colors. Rounded shapes everywhere. Calm, warm, Scandinavian and uncluttered. Keep the top third of the frame calm and empty, and the bottom fifth free of important details.
```

### STIL-KORT (videoprompter, bilden bär resten)

```text
Keep the exact look of the image: VADKUL style, soft 2.5D illustration, navy night gradient, warm yellow glowing dots, round white emoji tiles, the white smiling cloud mascot. No new colors. Keep the top third calm and empty.
```

### RÖRELSE

```text
Motion: slow, smooth and calm, one camera move at a time. Allowed camera moves: slow push-in, smooth top-down dive into the map, gentle sideways drift. No shaky camera, no whip pans, no rotation, no hard cuts. Yellow dots light up one by one like stars, with a soft fade-in, never blinking. Emoji tiles pop in with a small soft bounce. The cloud mascot bobs gently up and down. The last 3 seconds are a calm, almost still, centered frame.
```

### LJUD

```text
Audio: warm, upbeat Scandinavian indie-pop instrumental with soft plucked guitar and light hand percussion, around 110 BPM. No vocals, no voiceover. A soft, quiet pop when a tile appears.
```

### UNDVIK

```text
Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

### FORTSÄTT (först i varje förlängning)

```text
Continue seamlessly from the last frame: same style, same colors, same lighting, same camera height, same cloud mascot. No cut.
```

### Så sätts en prompt ihop

| Prompt | Ordning |
|---|---|
| Bild (startbild) | STIL + scen + UNDVIK |
| Video A (15 s) | "15-second video." + STIL-KORT + RÖRELSE + handling + LJUD + UNDVIK |
| Förlängning B (+15 s) | FORTSÄTT + "15 more seconds." + STIL-KORT + RÖRELSE + handling + LJUD + UNDVIK |
