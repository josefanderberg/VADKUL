# Grok-serien - korta reklamfilmer för VADKUL

Korta vertikala filmer (TikTok, Reels, Shorts) gjorda i Grok. Samma upplägg som
CV-mappen: **en bas som aldrig ändras per film, och ett avsnitt per film som
bara byter innehållet.** Allt är skrivet för att kopieras rakt in i Grok.

## Filer

| Fil | Vad |
|---|---|
| [BAS.md](BAS.md) | Stilschemat: färger, text, rörelse, rytm, ljud och de färdiga prompt-blocken. Läs en gång. |
| [avsnitt/](avsnitt/) | Ett avsnitt per fil: startbild + tagning A (15 s) + texterna + caption. |
| [forlangningar.md](forlangningar.md) | Påbyggnader på +15 s som passar efter vilket avsnitt som helst: tips, förslag, skapa eget, bjud med. |
| [avsnitt/_mall.md](avsnitt/_mall.md) | Tom mall för nya avsnitt. |

### Avsnitten

| # | Avsnitt | Idé |
|---|---|---|
| 01 | [Vad händer ikväll?](avsnitt/01-vad-hander-ikvall.md) | Grundfilmen: Sverige vaknar, prickar tänds, vi dyker ner i en stad. |
| 02 | [Allt på ett ställe](avsnitt/02-allt-pa-ett-stalle.md) | Problemet: affischer och flöden överallt. Lösningen: en karta. |
| 03 | [[Stad] i helgen](avsnitt/03-stad-i-helgen.md) | Mall per stad, med veckans riktiga antal event. |
| 04 | [Vad ska vi hitta på?](avsnitt/04-vad-ska-vi-hitta-pa.md) | Vardagsfrågan i soffan, molnet kommer med svaret. |

## Så kör du ett avsnitt

**Bifoga alltid två referensbilder i Grok:**
1. `apps/web/public/pwa-icon-bla-512.png` - molnet.
2. `apps/web/public/marketing/annons_sverige_20260707.png` - prick-Sverige och brickorna.

Sedan:

1. **Startbild.** Klistra in avsnittets *Bild*-prompt. Generera, välj bästa.
   Spara som `vk-<nr>-bild.png`. Kolla mot checklistan nedan innan du går vidare -
   allt i videon ärver från bilden.
2. **Tagning A (15 s).** Gör video från bilden (image to video), 9:16, 15 s.
   Klistra in avsnittets *Video A*-prompt. Spara som `vk-<nr>-a.mp4`.
3. **Förlängning B (+15 s, valfritt).** Välj en modul i
   [forlangningar.md](forlangningar.md), fyll i hakparenteserna, förläng från
   tagning A (Extend). Spara som `vk-<nr>-b-<modul>.mp4`.
4. **Klipp ihop** (CapCut eller valfritt):
   - A (+ B) i följd.
   - Texterna från avsnittets texttabell, exakt enligt BAS avsnitt 4
     (Fredoka, färger, pop in 0,3 s, ut 0,2 s).
   - Slutbilden `vadkulyt/mall/slut.png` sist, 1,5 s, övertoning 0,3 s.
   - Byt ljudet mot seriens fasta spår (BAS avsnitt 7).
5. **Exportera** 1080 × 1920, spara som `vk-<nr>-klar.mp4`.
6. **Publicera** med avsnittets caption. Länk i bion: vadkul.se.

Videofilerna hör inte hemma i git. Lägg dem i t.ex. `~/Movies/VADKUL-grok/`.

### Om Förläng/Extend inte finns eller glider iväg

Ta sista bildrutan ur tagning A och kör en ny *image to video* från den, med
förlängningsprompten:

```bash
ffmpeg -sseof -0.5 -i vk-01-a.mp4 -update 1 -q:v 1 vk-01-a-sista.png
```

Det blir samma skarv, och du har full kontroll över startbilden.

## Checklista före publicering

- [ ] Bara navy, blått, gult, vitt, ljusblått (plus emojis).
- [ ] Ingen text, inga bokstäver, inga loggor som Grok har ritat.
- [ ] Molnet ser ut som appikonen (ljusblå kontur, stängda ögon, leende).
- [ ] Varje bricka har EN emoji.
- [ ] Kameran gör en sak åt gången, inget skak, inga snabba svep.
- [ ] Övre tredjedelen är lugn där texten ligger.
- [ ] Tagningen slutar lugnt och stilla.
- [ ] Texterna i Fredoka, rätt färger, en i taget.
- [ ] Slutbilden sist, 1,5 s.
- [ ] Siffror och event i texten är riktiga och färska (se nedan).

## Färskvara

Avsnitt utan datum (01, 02, 04 och tips med kategorier) kan ligga uppe hur
länge som helst. Allt med **"i helgen"**, ett antal eller ett namngivet event
är färskvara: publicera samma vecka, och hämta siffran ur kartdatat - hitta
aldrig på.

## Be Claude om mer

- *"Ge mig antalet event och fyra bra emojis för [stad] i helgen till grok-serien avsnitt 03."*
- *"Gör avsnitt 05 i grok-serien enligt mallen, idé: [idé]."*
- *"Gör en ny förlängningsmodul i grok-serien: [idé]."*
- *"För ut BAS-ändringen i grok-serien."*

## Öppna frågor

- **Seriens musikspår** är inte valt (BAS avsnitt 7).
- **Två nästan lika paletter:** de statiska inläggen
  ([../inlagg-plan.md](../inlagg-plan.md)) kör `#04395E → #006AA7` och gult
  `#FECC02`, studion och den här serien kör `#08304A → #0A5077` och `#FDE047`.
  Serien följer studion eftersom slutbilden kommer därifrån. Bör samordnas.
