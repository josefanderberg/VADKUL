# K5: Länk-baserad enrichment

Status: PLAN
Startad: 2026-05-28
Klart-kriterium: För events där minst ett av {locationName, description, koord} saknas och vi har en `url` — kör ett enrichment-pass som hämtar mer från länken. Mätbart: andel "skräp-events" (3+ tomma fält) går från 13/277 (4.7 %) till <1 %.

## Idé

Vi sparar `url` för varje event. Om första scrapen gav tomt på viktiga fält kan vi gå tillbaka till länken i ett separat pass — med andra strategier än första scrapen.

Skillnad mot vanlig scrape: enrichment körs **bara på hål**, inte på alla events. Billigare och tål långsammare metoder.

## Hypoteser

- *Hypotes A:* En del FB-events visar mer info om vi väntar längre på sidan / scrollar / accepterar cookies / klickar "Visa mer" på beskrivningen.
- *Hypotes B:* Inloggad FB-session visar location-pin som annars är dold. Risk: rate-limit / ban.
- *Hypotes C:* Om vi feedar hela sidtexten till en lokal LLM (K4) kan vi extrahera plats/desc från strukturer Puppeteer-selektorerna missar.

## Plan

1. Skriv `apps/scraper/src/enrichment/index.ts` — kör efter huvudscrapen. Tar alla events med `locationVerified=false || !description`.
2. Strategi 1 (billig): re-besök URL:en med längre `waitFor` + scroll + klicka "Visa mer"-knappar. Försök extrahera igen med samma selektorer.
3. Strategi 2 (om K4 är klar): feeda full sidtext till lokal LLM med prompt "givet denna FB-event-sidtext, returnera JSON med location, description, category". Skicka kandidaten till Nominatim för verifiering.
4. Strategi 3 (sista resort): om events fortfarande har tomt locationName + url är `/events/123/` → testa öppna gruppens sida eller hostens sida för platsledtrådar.
5. Mät: andel av enrichment-batchen som fick koord, andel som fick description.

## Risker

- Dubbla anrop till FB → ökar rate-limit-risk. Behöver fördröjning mellan requests.
- Strategi 2 kräver K4. Strategi 1 + 3 är oberoende.

## Beroenden

- Strategi 1 + 3: oberoende, kan göras före K4.
- Strategi 2: kräver K4 i drift.

## Resultat

(Fylls i efter pilot.)
