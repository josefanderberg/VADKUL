# Förlängningar (+15 s)

Påbyggnader som tar vid där tagning A landar. Alla avsnitt slutar i en lugn
bild med brickor och molnet över en stad, så alla moduler passar efter alla
avsnitt.

**Så kör du:** förläng tagning A i Grok (Extend) med modulens prompt. Finns inte
Extend, eller glider stilen iväg: ta sista bildrutan (kommandot i
[README](README.md)) och kör image to video från den.

**Efter avsnitt 04** (som landar inomhus): lägg in den här meningen först i
handlingen: `First (0-2 s), the camera glides gently out through the window and over the glowing town.`
och korta modulens första steg med 2 sekunder.

| Modul | Idé | Tidlös? |
|---|---|---|
| [B1 Tips](#b1-tips---3-saker-att-göra) | Tre brickor fälls upp som små dioramor | ja med kategorier, nej med riktiga event |
| [B2 Förslag](#b2-förslag---efter-läget) | Regn, gratis, med barn: kartan visar det som passar | ja |
| [B3 Skapa eget](#b3-skapa-eget-event) | En ny bricka läggs på kartan, folk går dit | ja |
| [B4 Bjud med](#b4-bjud-med) | Ljuslinjer från vännernas hus till samma bricka | ja |

---

## B1 Tips - 3 saker att göra

Kameran dyker in i tre brickor i tur och ordning; varje bricka fälls upp som en
pop-up-bok till en liten glödande diorama.

### Välj tre ur tabellen

| Emoji (engelska till prompten) | Text i klippet | `[SCEN]` (engelska) |
|---|---|---|
| a shopping bag emoji | Loppis | a tiny outdoor flea market with tables, string lights and people browsing |
| a guitar emoji | Livemusik | a small stage with a band in warm yellow spotlight and a small crowd |
| a brain emoji | Pubquiz | a cozy pub table where friends lean in, thinking hard |
| a theater masks emoji | Teater | a little theater stage with deep blue curtains and soft yellow spotlights |
| a football emoji | Match | a small floodlit football pitch with players and a cheering stand |
| a coffee cup emoji | Fika | a café window with cinnamon buns and steaming cups |
| an artist palette emoji | Vernissage | a small gallery with framed blank canvases and people looking |
| a dancer emoji | Dans | a dance floor with couples dancing under string lights |
| a fallen leaf emoji | Höstmarknad | market stalls with lanterns, baskets and warm drinks |
| a child emoji | För barnen | children building with big soft blocks in a bright playroom |

Med riktiga event (färskvara): ta emoji + text ur kartdatat, och skriv en scen
som passar eventet. Be Claude: *"ge mig tre tips för [stad] i helgen till B1"*.

### Prompt

```text
Continue seamlessly from the last frame: same style, same colors, same lighting, same camera height, same cloud mascot. No cut.

15 more seconds. Keep the exact look of the image: VADKUL style, soft 2.5D illustration, navy night gradient, warm yellow glowing dots, round white emoji tiles, the white smiling cloud mascot. No new colors. Keep the top third calm and empty.

Motion: slow, smooth and calm, one camera move at a time. Allowed camera moves: slow push-in, smooth top-down dive into the map, gentle sideways drift. No shaky camera, no whip pans, no rotation, no hard cuts. Yellow dots light up one by one like stars, with a soft fade-in, never blinking. Emoji tiles pop in with a small soft bounce. The cloud mascot bobs gently up and down. The last 3 seconds are a calm, almost still, centered frame.

Action: First (0-4 s), a smooth dive toward a tile with [EMOJI 1]; the tile unfolds like a pop-up book into a tiny glowing diorama: [SCEN 1]. Then (4-8 s), a gentle sideways drift to a tile with [EMOJI 2], which unfolds the same way into: [SCEN 2]. Then (8-12 s), a gentle drift to a tile with [EMOJI 3], which unfolds into: [SCEN 3]. Finally (12-15 s), the camera pulls back slightly so all three little dioramas glow on the night map, the cloud mascot bobbing above them. Calm, still landing frame. All dioramas lit in warm yellow on navy, people as simple rounded figures with dot eyes.

Audio: warm, upbeat Scandinavian indie-pop instrumental with soft plucked guitar and light hand percussion, around 110 BPM. No vocals, no voiceover. A soft, quiet pop when a tile appears.

Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

### Texter (tiden räknas från förlängningens start)

| Tid | Text | Stil |
|---|---|---|
| 0,3-3,8 s | **1.** [Text 1] | siffran gul, texten vit rubrik |
| 4,3-7,8 s | **2.** [Text 2] | samma |
| 8,3-11,8 s | **3.** [Text 3] | samma |
| 12,5-14,8 s | Hitta fler på kartan | underrad, ljusblå |

Rubrik innan tipsen (sätt den sist i tagning A i stället för A:s sista rad):
"3 saker att göra i helgen".

---

## B2 Förslag - efter läget

Något händer med vädret eller ljuset över kartan, och bara det som passar
lyser upp. Bra för "vad gör man när...".

### Välj läge

| Läge | `[LÄGE]` (engelska) | `[EMOJIS]` (engelska) | Texter i klippet |
|---|---|---|---|
| Regn | soft light-blue rain starts falling over the town; most yellow dots dim, but a few glow brighter under little rounded roofs | a cinema clapper emoji, a swimmer emoji and a framed picture emoji | Regnig söndag? / **Det här händer inomhus** |
| Gratis | most yellow dots dim, and a few dots grow brighter with a soft golden ring around them | a park bench emoji, a library books emoji and a guitar emoji | Ingen budget? / **Gratis i helgen** |
| Med barn | small balloon-like light-blue bubbles float up from a few dots, which grow brighter | a teddy bear emoji, a puppet theater emoji and a playground slide emoji | Ledig med barnen? / **Det här passar dem** |
| Sent | the town gets a little darker, and a few late-night dots glow brighter | a microphone emoji, a disco ball emoji and a cocktail emoji | Inte trött än? / **Det här händer ikväll** |

### Prompt

```text
Continue seamlessly from the last frame: same style, same colors, same lighting, same camera height, same cloud mascot. No cut.

15 more seconds. Keep the exact look of the image: VADKUL style, soft 2.5D illustration, navy night gradient, warm yellow glowing dots, round white emoji tiles, the white smiling cloud mascot. No new colors. Keep the top third calm and empty.

Motion: slow, smooth and calm, one camera move at a time. Allowed camera moves: slow push-in, smooth top-down dive into the map, gentle sideways drift. No shaky camera, no whip pans, no rotation, no hard cuts. Yellow dots light up one by one like stars, with a soft fade-in, never blinking. Emoji tiles pop in with a small soft bounce. The cloud mascot bobs gently up and down. The last 3 seconds are a calm, almost still, centered frame.

Action: First (0-4 s), the tiles from before sink softly back into dots, and [LÄGE]. Then (4-11 s), a slow push-in toward the brightest dots, which grow into three round white tiles that pop up one after another: [EMOJIS]. The cloud mascot floats over and settles next to them, smiling. Finally (11-15 s), calm, still landing frame with the three tiles glowing in the middle of the frame.

Audio: warm, upbeat Scandinavian indie-pop instrumental with soft plucked guitar and light hand percussion, around 110 BPM. No vocals, no voiceover. A soft, quiet pop when a tile appears.

Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

### Texter

| Tid | Text | Stil |
|---|---|---|
| 0,3-3,8 s | första texten (frågan) | rubrik, vit |
| 6-11 s | andra texten | rubrik, hela gult |
| 12-14,8 s | Allt på en karta | underrad, ljusblå |

---

## B3 Skapa eget event

Till arrangörer och föreningar: lägg upp ditt eget event gratis.

### Prompt

```text
Continue seamlessly from the last frame: same style, same colors, same lighting, same camera height, same cloud mascot. No cut.

15 more seconds. Keep the exact look of the image: VADKUL style, soft 2.5D illustration, navy night gradient, warm yellow glowing dots, round white emoji tiles, the white smiling cloud mascot. No new colors. Keep the top third calm and empty.

Motion: slow, smooth and calm, one camera move at a time. Allowed camera moves: slow push-in, smooth top-down dive into the map, gentle sideways drift. No shaky camera, no whip pans, no rotation, no hard cuts. Yellow dots light up one by one like stars, with a soft fade-in, never blinking. Emoji tiles pop in with a small soft bounce. The cloud mascot bobs gently up and down. The last 3 seconds are a calm, almost still, centered frame.

Action: First (0-3 s), a gentle sideways drift to a quiet, dark corner of the town with no dots. Then (3-8 s), a simple rounded illustrated figure walks in carrying a round white tile with a plus sign emoji, and places it on the ground; the tile pops, turns into a tile with a [EMOJI] and starts to glow, and a soft ring of yellow light ripples out from it. Then (8-12 s), small rounded figures from around the town start walking toward the new tile, and more dots light up around it. Finally (12-15 s), calm, still landing frame: the little crowd gathered around the glowing tile, the cloud mascot bobbing above.

Audio: warm, upbeat Scandinavian indie-pop instrumental with soft plucked guitar and light hand percussion, around 110 BPM. No vocals, no voiceover. A soft, quiet pop when a tile appears.

Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

`[EMOJI]`: t.ex. `shopping bag emoji` (loppis), `guitar emoji` (spelning),
`soccer ball emoji` (match), `cake emoji` (fest).

### Texter

| Tid | Text | Stil |
|---|---|---|
| 0,3-3 s | Ordnar du något? | rubrik, vit |
| 4-8 s | Lägg upp det **gratis** | rubrik, "gratis" gult |
| 9-14 s | Så hittar folk dit | underrad, ljusblå |

---

## B4 Bjud med

Kolla att Intresserad / Kommer / Bjud med syns på sajten innan den här körs.

### Prompt

```text
Continue seamlessly from the last frame: same style, same colors, same lighting, same camera height, same cloud mascot. No cut.

15 more seconds. Keep the exact look of the image: VADKUL style, soft 2.5D illustration, navy night gradient, warm yellow glowing dots, round white emoji tiles, the white smiling cloud mascot. No new colors. Keep the top third calm and empty.

Motion: slow, smooth and calm, one camera move at a time. Allowed camera moves: slow push-in, smooth top-down dive into the map, gentle sideways drift. No shaky camera, no whip pans, no rotation, no hard cuts. Yellow dots light up one by one like stars, with a soft fade-in, never blinking. Emoji tiles pop in with a small soft bounce. The cloud mascot bobs gently up and down. The last 3 seconds are a calm, almost still, centered frame.

Action: First (0-3 s), a slow pull-back so we see more of the town: one tile in the center glows brighter than the others. Then (3-9 s), thin soft light-blue lines of light reach out one by one from the tile to four little houses around the town, and each house window lights up warm yellow. Then (9-12 s), small rounded figures step out of the houses and walk along the lines toward the tile, meeting there. Finally (12-15 s), calm, still landing frame: the friends together around the glowing tile, the cloud mascot bobbing above them.

Audio: warm, upbeat Scandinavian indie-pop instrumental with soft plucked guitar and light hand percussion, around 110 BPM. No vocals, no voiceover. A soft, quiet pop when a tile appears.

Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

### Texter

| Tid | Text | Stil |
|---|---|---|
| 0,3-3 s | Hittat något kul? | rubrik, vit |
| 4-8,5 s | **Bjud med** vännerna | rubrik, "Bjud med" gult |
| 9,5-14 s | Se vilka som kommer | underrad, ljusblå |
