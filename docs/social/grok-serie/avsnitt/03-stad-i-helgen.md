# 03 - [Stad] i helgen

Mall per stad. **Färskvara:** publicera samma vecka, och `[ANTAL]` ska vara
riktigt (be Claude hämta det ur kartdatat). Grok känner inte svenska städer,
så `[KÄNNETECKEN]` är en löst tecknad igenkänning, inte en karta.

**Bifoga:** `pwa-icon-bla-512.png` + `annons_sverige_20260707.png`.

## Fyll i först

| Fält | Exempel (Växjö) |
|---|---|
| `[STAD]` | Växjö |
| `[KÄNNETECKEN]` (engelska) | a lake in the middle of town and a cathedral with two slim spires |
| `[EMOJI 1-4]` (engelska namn) | a guitar emoji, a football emoji, a coffee cup emoji, a theater masks emoji |
| `[ANTAL]` | 312 (ur kartdatat, aldrig gissat) |

Fler kännetecken: Göteborg "a river harbour with cranes", Malmö "a long bridge
over the sea and a tall twisting tower", Stockholm "islands and water between
old rooftops", Uppsala "a cathedral with two tall spires and a river",
Kalmar "a castle by the sea".

## Bild (startbild)

```text
Vertical 9:16 frame. VADKUL brand style: soft 2.5D vector illustration with gentle depth and soft glow, like a premium app explainer animation. Background: smooth deep navy gradient, #08304A at the top to #0A5077 at the bottom. The map: Sweden at night seen from above, land a slightly lighter blue than the sea, no roads, no borders, no labels. Events are small warm yellow glowing dots (#FDE047) and round white tiles, each holding exactly one emoji, with a soft yellow halo. Mascot: a small fluffy white cloud with a light-blue outline, two closed happy eye arcs and a simple smile, exactly like the attached reference. People, when shown: simple rounded illustrated figures with dot eyes. Palette: navy, deep blue, warm yellow, white and light blue (#BAE6FD) only; emojis keep their own colors. Rounded shapes everywhere. Calm, warm, Scandinavian and uncluttered. Keep the top third of the frame calm and empty, and the bottom fifth free of important details.

Scene: a small Swedish town at night seen from above at a slight tilt, in the lower two thirds of the frame: [KÄNNETECKEN], soft rounded rooftops, streets as faint light-blue lines, and many small warm yellow dots of light spread across town. The small white cloud mascot floats at the right edge, looking at the town.

Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

## Video A (15 s)

```text
15-second video. Keep the exact look of the image: VADKUL style, soft 2.5D illustration, navy night gradient, warm yellow glowing dots, round white emoji tiles, the white smiling cloud mascot. No new colors. Keep the top third calm and empty.

Motion: slow, smooth and calm, one camera move at a time. Allowed camera moves: slow push-in, smooth top-down dive into the map, gentle sideways drift. No shaky camera, no whip pans, no rotation, no hard cuts. Yellow dots light up one by one like stars, with a soft fade-in, never blinking. Emoji tiles pop in with a small soft bounce. The cloud mascot bobs gently up and down. The last 3 seconds are a calm, almost still, centered frame.

Action: First (0-2 s), more yellow dots light up across the town in a soft wave, as if the weekend is starting. Then (2-11 s), a slow push-in toward the town center while four round white tiles pop up at different spots, one after another: [EMOJI 1], [EMOJI 2], [EMOJI 3] and [EMOJI 4]. Finally (11-15 s), the cloud mascot drifts gently toward the middle and bobs above the tiles. Calm, still landing frame with the glowing town center.

Audio: warm, upbeat Scandinavian indie-pop instrumental with soft plucked guitar and light hand percussion, around 110 BPM. No vocals, no voiceover. A soft, quiet pop when a tile appears.

Avoid: any text, letters, numbers, logos, watermarks, signs or app screens. Avoid photorealism, realistic faces and stock-photo people. Avoid red, purple, orange and green outside the emojis. Avoid flashing, glitch effects, lens flares, confetti and fast cuts.
```

## Texter (läggs på i klippet)

| Tid | Text | Stil |
|---|---|---|
| 0,3-3 s | [Stad] i helgen? | rubrik, vit |
| 4-8,5 s | **[ANTAL]** saker händer | siffran gul 200 px, resten vit rubrik |
| 9,5-13,5 s | Allt på en karta | underrad, ljusblå |
| efter 15 s | slutbilden `slut.png` | 1,5 s |

Passar ihop med förlängningen **Tips** ([forlangningar.md](../forlangningar.md)):
"3 saker du inte får missa" med helgens riktiga event.

## Caption

```text
Vad gör du i [Stad] i helgen? 👇 [ANTAL] saker händer, allt på en karta. Länk i bion ☁️ #vadkul #[stad] #evenemang #ihelgen
```
