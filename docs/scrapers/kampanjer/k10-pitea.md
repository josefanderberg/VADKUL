# K10 — Piteå: community-kritiken 2026-09-04

Status: **KOD KLAR 2026-09-04**. Källjakten (Fortsättning) kräver nätåtkomst — körs från minin.

## Nu-läget

Kommentar på FB-inlägget "Vad händer i Piteå?" (Elin Johansson): biografen ligger mellan Svensbyn och Hemmingsmark, bristande info, blandar publika event med slutna sällskap, hittar en bråkdel av eventen. Kontroll mot aggregatet 2026-09-03:

| Mått | Antal |
|---|---|
| Event inom 35 km från Piteå | 307 |
| Källor | Visit Piteå 114, Svenska kyrkan ~114, Tickster 31 (bio), PRO 15, ABF 11, Korpen 9, Facebook 8 |
| Visit Piteå-event på stadens mittpunkt (locationName "Piteå") | 59 av 114 |
| Visit Piteå-beskrivningar som slutar i taggsoppa ("aktiviteter & upplevelser …") | 30 |
| Bio 3:an: "Saga - Bio 3:an" | 65.2523, 21.2211 — 14 km SV om stan (= kritiken) |
| Bio 3:an: "Röda Kvarn - Bio 3:an" / "Metropol - Bio 3:an" | två olika platser i stan |
| "Salong - Bio"-platser i hela landet | 97 |
| "Framnäs Folkhögskolas Aula, Piteå" | 44 km fel |
| "Ponnypromenad PRK" | locationName "Dat" (ur "Datum") |
| Rotary (clubrunner.ca), hela landet | 660 event, 110 klubb-värdar |
| Event med "årsmöte/medlemsmöte/endast medlemmar" | 30 |

Framnäs trädgårdsfest (12/9) och Grandagen FINNS — men på stadens mittpunkt. Coop-joggen saknas helt.

## Analys

- **Biografen**: Tickster namnger platsen "SALONG - BYGGNAD" utan adress; salongsnamnet geokodas för sig. Generellt fel (97 platser), inte Piteå-specifikt.
- **Mittpunkten**: Visit Piteås API saknar platsfält; detaljsidan hämtades bara när beskrivning/bild saknades, så "Plats:" lästes aldrig.
- **Taggsoppan**: wp-rest klistrade WP-termer på beskrivningen för klassificeraren och sparade resultatet.
- **Slutna sällskap**: PRO/Svenska kyrkan är opt-in på kartan; Rotary och Korpen var det inte. Rotary = lunchmöten för medlemmar.
- **Täckning**: ingen Piteå-sida i FB-bevakningen; inga lokala sajter utöver Visit Piteå.

## Begränsningar (gjort 2026-09-04)

- `venueBuildingOf`: "Saga - Bio 3:an" → "Bio 3:an" geokodas först (runner-kedjan + Tickster; salongskoordinaten behålls bara om byggnaden inte träffar).
- wp-rest: detaljsidans "Plats:" hämtas för nya event utan plats; WP-termer → `classifyHints` (aldrig i beskrivningen); "Dat"/etikettord spärrade som venue. Befintlig taggsoppa byts i innehålls-svepet.
- Rotary: `status: 'dead'` + nattligt `hide-source --url-like=clubrunner.ca`.
- FB-bevakning Piteå: piteakommun, visitpitea, studioacusticum, piteamuseum, framnasfolkhogskola, piteaif — **overifierade slugs**, kolla nattloggen.

Rörs inte: Korpen som opt-in på kartan (ägarbeslut), årsmötesfilter (ägarbeslut), Bio 3:an i `known_venues` (koordinat ej verifierbar utan nät).

## Fortsättning

- [ ] Minin: `npm run venues -- add "Bio 3:an" <lat> <lng> --city Piteå` när koordinaten kollats (Storgatan, Piteå).
- [ ] Källkandidater att proba från minin: `https://www.pitea.se` (kommunkalender, SiteVision? `npm run probe-sitevision`), `https://bibliotek.pitea.se` (Axiell? bibliotek-engine), `https://studioacusticum.se` (`npm run probe-wp`), `https://kaleido.pitea.se`, `https://www.framnas.nu`, `https://www.nolia.se`, `https://piteahavsbad.se`.
- [ ] Nattloggen: vilka Piteå-slugs gav eventlänkar? Ta bort tomma.
- [ ] Ägarbeslut: Korpen opt-in på kartan? Dölja "årsmöte/medlemsmöte" (30 st)?
- [ ] Svara Elin när biografen och Öjebyn-platserna ligger rätt (nästa natt + geo-refine).

## Snabbkörning på minin (utan att vänta på nattkedjan)

`apps/scraper/scripts/run-quickfix.sh` kör dagens innehållsfixar direkt när
nattkedjan är klar (vägrar om `run-daily.sh` fortfarande kör):

```sh
bash ~/Repos/VADKUL/apps/scraper/scripts/run-quickfix.sh --fb-city=Piteå --sources=visitpitea
```

Steg: git pull → Facebook bara för Piteå (`npm run scrape-fb -- --city=Piteå`:
stadssök + de sex Piteå-sidorna, omskrapar tomma beskrivningar/generiska
värdar) → `visitpitea` i full-refresh ("Plats:" ur detaljsidan för kända
event) → `repair-salong` (salongs-event flyttas till byggnaden, t.ex.
"Saga - Bio 3:an" → Bio 3:an) → hide Rotary → K9 (pris ur text, 🎬, �) →
aggregate → whitelist-commit + push. Logg: `~/Library/Logs/vadkul-scraper/quickfix.log`.
`--no-push` för att bara testa lokalt.
