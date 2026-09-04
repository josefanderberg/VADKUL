# K4: Lokal AI-granskning (Mac mini + Ollama)

Status: IMPLEMENTERAD (pilot pågår)
Startad: 2026-05-28
Implementerad: 2026-05-28
Klart-kriterium: Varje sparat event kompletteras eller flaggas av en lokal LLM. Mätbart: <5 % events lämnar scrapern med `locationName=null` *och* utan AI-försök i logg.

## Bakgrund

Mac mini står oanvänd. En 3-7B-modell via Ollama kan tillföra det Puppeteer inte gör: fritextförståelse, kategorisering, skräp-detektering, plats-extraktion ur beskrivning.

Förutsättning: **K3 måste vara klar först.** Annars matar vi LLM:n med default-värden (`'Växjö'`, `'other'`) som ser ut som riktiga data → LLM:n kan inte upptäcka att de är hål.

## Hypoteser

- *Hypotes:* Llama 3.2 3B räcker för: plats-extraktion ur description, kategorisering (music/sport/culture/party/market/other), skräp-detektering. Behöver inte 70B.
- *Hypotes:* Tidskostnad per event: ~1 sek. 277 events → 5 min extra körtid. Inte ett problem.
- *Hypotes:* Mac mini når vi från scraper-datorn via Tailscale eller LAN — annars måste scrapern köras på Mac minin själv.

## Plan

1. Setup på Mac minin: Ollama + Llama 3.2 3B (eller Qwen 2.5 7B om RAM finns). Exponera `localhost:11434`.
2. Nätverk: avgör om scrapern flyttar till Mac minin eller når den remote.
3. Skriv `apps/scraper/src/utils/llmEnrich.ts` — funktion `enrichEvent(event) → { location?, category?, isJunk?, confidence }`.
4. Kör som **post-processor enbart för events där `locationVerified=false`** (efter K3). Pilot på 277 events.
5. Mät: andel som AI:n kan ge en plats-kandidat, andel som faller till "okänd plats"-bucket.
6. Om pilot lyckas: utöka till kategorisering över alla events.

## Risker

- LLM hallucinerar platser. Måste alltid feeda tillbaka till Nominatim för verifiering — accepterar bara om Nominatim hittar koord på AI-platsen.
- Confidence-score behövs så vi vet vad vi inte kan lita på.

## Implementering (2026-05-28)

**Modell:** `qwen3:8b` med `think: false` (Ollama `localhost:11434`)
- Utan `think: false` returnerar modellen tom `content` och lägger allt i `thinking`-fältet.

**Filer:**
- [`utils/llmEnrich.ts`](../../../apps/scraper/src/utils/llmEnrich.ts) — `llmEnrichEvent()` extraherar location + category. Normaliserar numerisk confidence (0–1) till high/medium/low/none.
- [`scripts/llm-enrich-missing.ts`](../../../apps/scraper/src/scripts/llm-enrich-missing.ts) — post-processor: läser alla FB-events med lat=0 (max 200), anropar Ollama, feedar tillbaka till Nominatim, uppdaterar SQLite.
- [`scripts/run-daily.sh`](../../../apps/scraper/scripts/run-daily.sh) — K4-steget körs automatiskt efter scrapern (`npm run llm-enrich`).

**Test (3 kända lat=0-events):**
- "Dansfest - Örebro Salsafriends" → Örebro: [59.27, 15.21] ✅
- "Zumba Gold® i Linköping" → Linköping: [58.41, 15.62] ✅  
- "Morgonmässa" (Härnösands domkyrka) → Härnösand: [62.63, 17.94] ✅

**Pilot-insikt (2026-05-28 pilot på 28 events):**
De flesta lat=0-events är genuint utländska (USA, Frankrike, Polen, Belgien, Australien) — inte svenska event med saknad koordinat. `isForeignAddress` stoppade geocoding men sparade ändå eventen i DB. Ny pre-save-filter inlagd i `index.ts`.

**Regressionsrisk som åtgärdades:** Ollama extraherade platsnamn som "Taormina", "Madrid", "Nancy" ur utländska event-titlar. `nominatimSearchSweden` hittade danska/svenska bynamnshomonymer med samma namn → fel koordinater. Fix: `llm-enrich-missing.ts` accepterar bara geocode-resultat om `city` är ett känt svenskt stadsnamn (SWEDISH_GEO_CITIES) ELLER confidence='high' för specifik adress.

## Resultat

(Mäts i körning 2026-05-29 efter fullskalig körning med alla fixes.)

## Parallellism (2026-09-04)

Nattkedjans två LLM-steg (K4 `llm-enrich`, K8 `audit-events`) körde ett event
i taget: upp till 500 + 500 anrop à 10–40 s = flera timmar per natt. Nu går
anropen i batchar om `OLLAMA_CONCURRENCY` (default 3, `utils/ollamaPool.ts`);
Nominatim (1 req/s) och Firestore-skrivningarna är fortfarande sekventiella.

**Servern måste tillåta parallella anrop.** Ollama ≥ 0.2 sätter
`OLLAMA_NUM_PARALLEL` till 4 automatiskt om minnet räcker, annars 1 — då
köas anropen och vinsten uteblir (timeouten är skalad så köade anrop inte
avbryts). Sätt explicit på minin och starta om Ollama-appen:

```sh
launchctl setenv OLLAMA_NUM_PARALLEL 3
```

Verifiera i nattloggen: K8-raden "Att auditera: N (3 parallella Ollama-anrop)"
och "Total tid" i sammanfattningen mot föregående natt.

## Modeller (läge 2026-09-04)

| Steg | Modell | Sedan |
|---|---|---|
| K4 llm-enrich (plats/kategori/pris ur FB-text) | `qwen3:8b`, `think: false` | maj 2026 |
| K8 audit (junk/kategori/emoji/pris) + audit-daemon | `gemma4:latest` (`OLLAMA_AUDIT_MODEL`) | sommaren 2026 |

Uppgiften är svensk JSON-extraktion ur korta texter — 8B-klassen räcker, och
största vinsten är hastighet (parallellism ovan), inte modellbyte. Kandidater
om ett byte ändå ska provas: Qwen3.8-familjen (aug 2026, starkast flerspråkigt)
eller en större Gemma 4-storlek. Byt via `OLLAMA_MODEL`/`OLLAMA_AUDIT_MODEL`
och jämför på samma 50 event i dry-run (`npm run audit-events -- --limit=50`)
innan något ändras i nattkedjan. Modellen får inte kräva mer minne än att
tre anrop ryms samtidigt.
