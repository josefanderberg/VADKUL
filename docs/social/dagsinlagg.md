# Dagsinlägget - ett inlägg om dagen på Facebook och Instagram

Ägarbeslut 3/11 2026. Ett inlägg om dagen på VADKUL-sidan och @vadkul.se, utan
att Josef behöver göra dem. Inte eventlistor från kartan (de provades två
gånger: 58 automatiska inlägg gav 1 reaktion, avvecklade 14/9 och 13/9), utan
temainlägg: siffror, ett gissningsspel, Grok-filmer, helgen i en stad, quiz
och tidlösa budskap. Både video och bild. Ett AI-steg granskar klippen i
inkorgen, väljer bästa och skriver texten. Tyst godkännande i Telegram.

Koden: `apps/scraper/src/scripts/dagsinlagg.ts` (kommandot) och
`apps/scraper/src/utils/dagsinlagg/` (ren, testad logik). Jobbet:
`infra/launchd/se.vadkul.dagsinlagg.plist` (07:00 på minin).

## Besluten som styr

- **Siffror som får användas:** eventsiffror och orter (antal event i dag,
  i helgen, i veckan, städer, kategorier, nya på kartan), medlemsantal (exakt
  antal konton med e-post) och nedladdningar (matas in för hand som milstolpe).
  Besökssiffror är spärrade sedan 29/8 och används aldrig.
- **Grok-klippen** genererar Josef själv i batch i Grok-appen och lämnar i en
  inkorg. Inget xAI-API.
- **Tyst godkännande:** förhandsvisning i Telegram 07:00, publicering 09:00 om
  inget "nej" kommit.
- **Spelet** avgörs av klick på kartan. Bara vinnaren visas, aldrig siffrorna.
- **Aldrig en eventlista.** Spelet och helgen nämner högst tre event med namn.

## Temahjulet, en vecka

| Dag | Tema | Form | Reserv om inget klipp finns |
|---|---|---|---|
| Mån | **Veckan i siffror**: event i Sverige den här veckan, nya på kartan, största kategori | bild (siffer-kort) | - |
| Tis | **Grok-film, tidlös**: "Vad händer ikväll?", "Allt på ett ställe", "Vad ska vi hitta på?" | video 9:16, 15-30 s | budskaps-bild |
| Ons | **Gissa dagens bästa event**: tre kandidater i tre städer, "vilken tror du flest öppnar?" | bild (tre brickor) | - |
| Tor | **I helgen i <stad>**: staden med flest helgevent, riktigt antal, tre exempel | video om stadsklipp finns, annars bild | stads-kort |
| Fre | **Grok-film, stämning**: "Fredag. Vad händer?", "Bjud med en vän", "Regnig dag?" | video | "X event i helgen"-bild |
| Lör | **Quiz**: "Vilken veckodag händer det minst i Växjö?" (tre svar) | bild | - |
| Sön | **Budskap**: lägg upp ditt eget, appen finns, bjud med, milstolpe | bild eller video | - |

Regler i hjulet: samma tema aldrig två dagar i rad, samma klipp används en
gång, "helg" bara torsdag och fredag, en stad vilar fyra veckor efter ett
helginlägg och åtta efter ett quiz. Går dagens tema inte att bygga (för få
kandidater, inget tydligt quiz) blir det siffror i stället. Vikter per tema
(`vikter` i loggen, 0 stänger av) sätts för hand utifrån veckorapporten.

## Reglerna för varje inlägg

- Alla siffror kommer ur data (aggregat-JSON), aldrig ur en språkmodell.
  Ärliga golv, avrundat nedåt ("11 000+"). Opt-in-källorna (Svenska kyrkan,
  PRO, Korpen) räknas aldrig med. Kontrollen stoppar varje siffra i texten
  som inte finns i inläggets data.
- Ton: du-tilltal, granne som tipsar. Avsluta med en fråga. Max ett
  utropstecken. 3-6 emojis som radmarkörer, aldrig mitt i en mening. Aldrig
  "Häng med", "Missa inte", "Passa på", "Dags att", "Vi har koll", "dela
  gärna", "vi erbjuder", "plattform", "lansering". Aldrig tankstreck.
- Facebook får länk till vadkul.se (i spelet en djuplänk per kandidat).
  Instagram får aldrig länk i texten: "Länk i bion" och hashtaggar sist.
- Samma 9:16-video till båda. Bilder 1080x1350 till båda.
- Inga arrangörsfoton i våra kort: brickor med emoji i märkesstilen.
- En palett: `#08304A` till `#0A5077`, gult `#FDE047`, ljusblått `#BAE6FD`,
  vitt. Fredoka. Loggan uppe till vänster, vit vadkul.se-pill nere till
  vänster. EN sak gul per bild.
- Videotexterna renderas som genomskinliga bilder med samma Fredoka som
  korten och läggs på klippet med ffmpegs overlay (Homebrews ffmpeg saknar
  drawtext): rubrik 84 px vit kring y 520, underrad ljusblå, 0,3 s in och
  0,2 s ut (toning, inte pop-in som BAS säger). Slutkortet renderas av koden
  (inga siffror på det).

## Så ser de ut

**Måndag (siffra):** "7 500+ event i Sverige den här veckan 📍 / 810+ bara i
dag 🗓️ / 6 200+ nya på kartan sedan förra veckan ✨ / Flest just nu: musik 🎵 /
vadkul.se / Vad lockar dig den här veckan?" plus ett siffer-kort med talet
stort i gult.

**Onsdag (gissa):** "Tre event i dag, tre städer. Vilket tror du flest
öppnar? 👇 / 1️⃣ Jazzkonsert med kör och ensemble, Stockholm / 2️⃣ ... / 3️⃣ ... /
Svaret kommer i morgon här i kommentarerna ☁️ / Vilken gissar du på?".
Torsdag 07:00 postas vinnaren som kommentar: "Flest hittade till 2️⃣ ...".
Vinnaren = störst ökning i visningar, klick och svar på kartan sedan
inlägget gick ut. Under tre poäng avgör populäritetspoängen och kommentaren
säger "den vi tror flest hittar till".

**Tisdag (video):** ett klipp ur inkorgen, två textrader inbrända ("Vad
händer ikväll?" / "Allt som händer, på en karta"), slutkort 1,5 s, caption
"Vad gör du ikväll? 👇 / Allt som händer nära dig, samlat på en karta 📍 /
Gratis, hela Sverige ✨ / Länk i bion ☁️ / Vad blir det?".

## Veckorutinen för Josef (ca 30 min, när det passar)

1. Öppna Grok-appen, kör 2-3 prompter ur
   [grok-serie/avsnitt/](grok-serie/avsnitt/) (startbild, sedan video A; i
   appen kan du förlänga till 30 s). Spara startbilderna och återanvänd dem,
   det håller stilen stabil.
2. Skicka klippen som **fil** till Telegram-boten med temat som bildtext:
   "ikväll", "fredag", "bjud med", "regnig", "skapa eget", "allt", "hitta på",
   "helg Växjö". Max 20 MB per fil (Telegrams gräns för botar). Större klipp:
   lägg i `~/Movies/VADKUL-grok/inkorg/` på MacBooken och kör
   `npm run klipp-till-minin` i `apps/scraper`.
3. Klart. Boten svarar "Klipp mottaget". Är inkorgen tom blir videodagarna
   bilder den veckan; veckorapporten säger hur många klipp som är kvar.
4. Varje morgon 07:00: titta på förhandsvisningen i Telegram om du vill.
   Svara `nej` för att stoppa, `ja` för att publicera direkt, `byt` för nästa
   kandidat, `text: ...` för egen text. Inget svar = publiceras 09:00.
5. Söndag efter publiceringen: veckorapporten i Telegram (räckvidd,
   reaktioner, kommentarer per inlägg och snitt per tema, plus föreslagna
   vikter).
6. Milstolpe att fira? Skriv `/milstolpe 1 000 medlemmar` till boten, så går
   den ut i nästa söndagsbudskap.

## Granskaren (AI-steget för klippen)

Sex bildrutor ur klippet (start, var tredje sekund, landningen) och
BAS-reglerna går till en bildmodell som svarar med tema, betyg 0-100, brott,
två förslag på textrader och en motivering. Betyg under 70, eller text/logga
i bild, realistiska ansikten eller flimmer, avvisar klippet (motiveringen
syns i Telegram). Standard är Claude (`ANTHROPIC_API_KEY` i
`~/.vadkul-secrets/env`, kostar ören per klipp); `DAGSINLAGG_GRANSKARE=ollama`
använder `qwen3-vl:4b` på minin gratis; `ingen` godkänner allt (provkörning
eller när du litar på dina egna klipp). Siffror får modellen aldrig hitta på:
textrader med siffror som inte finns i data stryks.

## Så kör du

I `apps/scraper` (på minin: `~/Repos/VADKUL/apps/scraper`):

```bash
npm run dagsinlagg -- --kolla
```
Behörigheter på sidtoken, Storage, Telegram, ffmpeg, font, inkorg, aggregatets ålder.

```bash
npm run dagsinlagg -- --provkör --tema=siffra
```
Bygger inlägget till `dagsinlagg/utkast/<datum>/` (bild.png eller video.mp4,
text-fb.txt, text-ig.txt) utan Telegram och utan uppladdning. Teman: `siffra`,
`video`, `gissa`, `helg`, `quiz`, `budskap`. `--datum=YYYY-MM-DD` provar en
annan dag, `--inkorg=<mapp>` en annan inkorg, `--granskare=ingen` hoppar över
modellen.

```bash
npm run dagsinlagg -- --planera
```
Bygger dagens inlägg, laddar upp och förhandsvisar i Telegram, publicerar inte.

```bash
npm run dagsinlagg -- --publicera
```
Publicerar dagens planerade inlägg (första veckan körs dagarna så, för hand).

```bash
npm run dagsinlagg -- --kör
```
Hela morgonen med vetofönster (det launchd kör 07:00). `--nu` publicerar
direkt utan fönster.

Övrigt: `--följ-upp` (kommentarer och insikter), `--rapport` (veckorapporten).
Loggen är `apps/scraper/dagsinlagg-logg.json` (maskin-lokal, gitignorerad),
inkorgen `apps/scraper/dagsinlagg/inkorg/`.

## Första veckan

Dag 1-3 bild (siffra, gissa, quiz) och dag 4-7 video körs för hand med
`--planera` och `--publicera`. Plisten slås på när 5-7 riktiga inlägg gått ut
och Josef sett dem. Den installeras av nattkedjans launchd-synk när den
ligger i whitelisten i `apps/scraper/scripts/run-daily.sh`.
