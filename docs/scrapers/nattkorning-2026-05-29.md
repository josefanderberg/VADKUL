# Nattköning 2026-05-29 — Förberedelser

> **Körning startar:** kl 01:00 (launchd `se.vadkul.scraper.full`)
> **Loggfil:** `~/Library/Logs/vadkul-scraper/full.log`
> **Mål ikväll:** lat=0 < 20%, category != 'other' på >40%

---

## Att implementera IDAG (innan 01:00)

### 0. Rensa DB från gamla K1-läckor (1 min)

```bash
sqlite3 apps/scraper/events.db \
  "DELETE FROM link_events WHERE extractedAddress LIKE '%Universitetsplatsen%';"
# Ska ta bort 61 rader. Verifieras med SELECT COUNT(*) efteråt.
```

---

### 1. Fix dubbel-sökord i BROAD_KEYWORDS (5 min)

`teater` förekommer 2× och `dans` riskerar att dubbleras.  
Fil: [`facebook/index.ts:162`](../../apps/scraper/src/scrapers/facebook/index.ts)

```diff
- 'musik', 'dans', 'teater', 'comedy', 'sport', 'yoga', 'kurs', 'workshop',
+ 'musik', 'dans', 'comedy', 'sport', 'yoga', 'kurs', 'workshop',
```

Sparar 2 sökord × 2 filter = **4 queries** per körning (~3 min körtid).

---

### 2. isForeignAddress — täck Norden (15 min)

Fil: [`utils/venueCoordinates.ts`](../../apps/scraper/src/utils/venueCoordinates.ts)

Lägg till markörer för Danmark och Norge. Använd flerteckensfragment som inte förekommer i svenska ord:
- `søndag`, `lørdag`, `mandag`, `onsdag` (danska/norska veckodagar)
- `københavn`, `oslo`, `bergen`, `trondheim`, `aarhus`, `odense`
- `norge`, `danmark`, `finland` (om de dyker upp i eventbeskrivning)

Undvik enkla bokstäver som `ø` och `æ` ensamt — de kan finnas i legit svenska adresser (Hörby = Hørby i äldre stavning etc.). Matcha på ordfragment.

---

### 3. K2 — Geocoding-retry med stadsextraktion (30 min)

Fil: [`facebook/index.ts:421–436`](../../apps/scraper/src/scrapers/facebook/index.ts)

**Nuvarande flöde:**
1. Om stad (från sök-kön) inte finns i adress → lägg till stad → Nominatim
2. Om Nominatim returnerar null → lat=0

**Nytt flöde:**
1. Försök som idag (stad från kön appendas om den saknas)
2. Om null → extrahera stad ur `extractedAddress` via `SWEDISH_CITIES.find(c => addr.includes(c))`
3. Om stad hittas → retry `"${addr}, ${stad}"` (kan vara samma som steg 1, skippa om så)
4. Om fortfarande null → retry enbart `"${stad}, Sverige"` → spara med `locationPrecision: 'city'`
5. Om ingen stad hittas → lat=0, `locationPrecision: 'none'`

Lägg till `locationPrecision: 'exact' | 'city' | 'none'` i event-typ och DB-schema.  
Gynnar direkt: "Foajén - Örebro Konserthus" → retry → "Örebro" → koord.

---

### 4. Regelbaserad kategori-classifier (20 min)

Ny fil: [`utils/classify.ts`](../../apps/scraper/src/utils/classify.ts)

```typescript
export function classifyEvent(title: string, description: string): string {
    const t = (title + ' ' + description).toLowerCase();
    if (/konsert|spelning|live|gig|band|festival|dj|klubb|club/.test(t))   return 'music';
    if (/teater|föreställning|musikal|opera|dans|balett|scen/.test(t))      return 'performing-arts';
    if (/standup|stand-up|comedy|humor|kabaré/.test(t))                     return 'comedy';
    if (/loppis|marknad|bazar|hantverk|antikvitet|loppi/.test(t))           return 'market';
    if (/yoga|meditation|träning|sport|löpning|match|turnering/.test(t))    return 'sport';
    if (/föreläsning|workshop|kurs|seminarium|utbildning/.test(t))          return 'education';
    if (/vernissage|utställning|konst|galleri|expo/.test(t))                return 'art';
    if (/quiz|pub|afterwork|fest|party|mingel|sällskap/.test(t))            return 'social';
    return 'other';
}
```

Använd i `index.ts` vid sparning:
```typescript
import { classifyEvent } from '../../utils/classify';
// ...
category: classifyEvent(details.title, details.description),
```

---

## Hypoteser inatt

### H1 — lat=0 sjunker till <20% (Hög tro)
Geocoding-retry steg 3–4 bör lösa events där ett stadsnamn finns i adressen.  
*Falsifieras om:* lat=0 inte sjunker > 3 procentenheter mot 26%.

### H2 — category != 'other' på >40% (Hög tro)
Klassifikatorn täcker de vanligaste event-typerna.  
*Falsifieras om:* category='other' fortfarande > 65%.

### H3 — Inga danska/norska event sparas (Medelhög tro)
isForeignAddress-utökning täcker de kända exemplen.  
*Falsifieras om:* dansk/norska titlar dyker upp i loggen.

### H4 — Universitetsplatsen = 0 i DB (Säker)
SQL-rensning innan körning.  
*Falsifieras om:* SELECT returnerar > 0.

---

## Checklista imorgon bitti

- [ ] `SELECT COUNT(*) FROM link_events WHERE extractedAddress LIKE '%Universitetsplatsen%'` = 0? (H4)
- [ ] `SELECT COUNT(*) FROM link_events WHERE lat=0 AND lng=0` / totalt FB < 20%? (H1)
- [ ] `SELECT category, COUNT(*) FROM link_events WHERE url LIKE '%facebook%' GROUP BY category` — category!='other' > 40%? (H2)
- [ ] Loggen: inga "SUPER søndag", "lørdag"-titlar? (H3)
- [ ] `⏱️ Facebook-skrapan tog:` — kortare tid pga färre queries?
- [ ] Uppdatera `facebook.md`, `STATUS.md` och `runs/2026-05-29.md` med ny snapshot

---

*Skriven: 2026-05-28 — av AI tillsammans med Josef*
