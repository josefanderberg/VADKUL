# VADKUL — Scalable Source Discovery (SSD): State & Next Steps

Last updated: 2026-06-11

This file documents the current state of VADKUL's scraper expansion toward 1000 sources. Read this first before continuing the work.

## 1. Current State (snapshot 2026-06-11)

**Effective scrapers running daily: ~303 configs.**
- Registry sources: 297 (in `apps/scraper/src/sources/registry.ts`), 5 dead, 292 effective
- Bespoke scrapers: 11 (today-sweden, tickster, ticketmaster, eventbrite, meetup, facebook, vaxjoco, upplev, kollektivetlivet, upplev-stockholm, hembygd)
- Disabled: billetto (dead domain), eventim (Akamai WAF)
- Per-event-producing endpoints: ~527+ (Hembygd umbrella covers 1988 associations, 225 with ≥3 events)
- Distance to 1000: 697 configs / 473 endpoints

**Audit daemon:** `se.vadkul.audit-pending` runs permanently via launchd, calls qwen3:14b via local Ollama, fills category (11 categories), bespoke emoji, price, Sweden-check, verdict (ok/suspect/junk), auto-hides high-confidence junk.

**Web pipeline:** Scraper → SQLite → aggregate-events.ts → Firestore + static JSON. Live web updates within minutes.

## 2. What was built today (2026-06-11)

| Source | Volume | Type |
|---|---|---|
| Tickster-sitemap | +2240 events | Sitemap + urlDateRegex |
| Hembygd umbrella | 1988 assoc., 225 active | Platform API `/api/<siteId>/activities` |
| +18 bulk-added cities | Trosa 178, Vimmerby 725, Västervik 185, Knivsta 223, Vaxholm 143, Kiruna, Borgholm, Älvsbyn, Perstorp, Vilhelmina, Nordmaling, Oskarshamn, Katrineholm, Hässleholm, Pajala, Visit Sörmland, Visit Dalarna, Stockholm | tribe/wp-v2/sitemap |
| Kollektivet Livet | 97 events | Bespoke WordPress |
| upplev.stockholm | ~27 events (Tanto+Parkteatern+park-program) | Bespoke crawler |
| Södra Teatern | 54 events | Sitemap+text |
| Visit Östersund | 74 events | Sitemap+JSON-LD |
| Malmö Pride | 95 events | Sitemap+JSON-LD startDate |
| Kulturbolaget Malmö | 112 events | Sitemap |
| Berns Stockholm | 84 events (autumn) | Sitemap+text |
| Kungliga Operan | 65 events | Sitemap |
| Dramaten | 31 productions (with time) | Sitemap |
| Stockholms Stadsbibliotek | 20 events | JS-rendered catalog (useBrowser) |
| Norrlandsoperan + Pustervik time-fix | 182 events with correct time | Venue text-time parsing |

**Infrastructure:** network-scout.ts, bulk-probe.ts, audit-pending daemon, status lifecycle (active/experimental/dead), useBrowser flag, 11-category taxonomy + emoji + price, dual-check midnight detection, Firestore ignoreUndefinedProperties, jsonLdExtract.ts for Eventbrite+Eventim.

## 3. Insights and Patterns

**What works (high → low leverage):**
1. **Umbrella-API pattern** (Hembygd model): national network with platform API listing members. ONE scraper covers all members. Best ROI.
2. **Sitemap with date-in-URL** (Tickster pattern): urlDateRegex prefilters to window BEFORE fetching details.
3. **tribe REST + wp/v2**: common WordPress patterns, bulk-probe tests both.
4. **JSON-LD Event in detail pages** + Swedish text parser (`findFirstDateInText`).

**Dead ends:**
- JS-SPA without exposed XHR API (Västerås, start.stockholm, Skansen, Gröna Lund, universities, festival programs)
- Bot-protected without UA fix (Svenska Kyrkan 403 → fixed with Chromium UA)
- Course-dominated sites (Sensus, Medborgarskolan, ABF, Vuxenskolan — mostly @type:Course not Event)
- Global aggregators (Eventbrite organizer-sitemap is worldwide, Allevents.in JS-rendered)

## 4. Svenska Kyrkan: Partial Findings (HIGH VALUE NEXT)

**Confirmed:**
- 403 was UA-based. Works with Chromium User-Agent.
- robots.txt has Crawl-delay: 10 — respect it.
- Sitemap index lists 1199 unit-sitemaps (`sitemap-unit_<id>.xml`)
- Each unit has calendar at `/kalender?webId=<X>` (e.g. webId=1374643 = unit 3308)
- Calendar UI is JS web component fetching via `/webapi/`
- **API key in page source: `42ac114b-edcc-4ebe-8fa3-fbab2ff764e7`**

**Open:** Exact `/webapi/` endpoint for calendar data. XHR didn't fire on test parish (possibly disabled/maintenance). Try multiple webIds OR inspect calendar JS bundle.

**Potential:** 1199 units × 3-5 events avg = 3 600 – 6 000 events. Largest single remaining source.

**Implementation outline:**
- `apps/scraper/src/scrapers/svenskakyrkan.ts` like `hembygd.ts`
- Enumerate webIds from sitemap-index
- Call /webapi/ with apiKey header
- Respect Crawl-delay 10s
- Weekly or every 3 days

## 5. Next Steps (Prioritized)

1. **Complete Svenska Kyrkan** (+3000-6000 events potential)
2. **Other umbrella networks:** PRO, SPF, Friluftsfrämjandet (re-try with Chromium UA), Korpen, Lions, Rotary
3. **Studieförbund Event-only filter** (5-10% of 4683 Medborgarskolan = 200-400 real events)
4. **Biljettplattform organizer enumeration** (Tickster /o/, Billetto if returns, Eventbrite SE-filtered)
5. **Pensionera redundans:** bespoke tickster.ts vs tickster-sitemap, bespoke eventbrite.ts vs Eventbrite sitemap
6. **JS-SPA bulk via Puppeteer-render** (995 FAIL list, expect 1-3% yield = 10-30 sources)
7. **Adaptive frequency** (currently 172/175 daily — tier by horizon)
8. **Window widening 30d→180d** (currently throws 72% of scraped events)

## 6. Tools Reference

| Tool | Purpose | Invocation |
|---|---|---|
| bulk-probe.ts | Bulk source discovery | `npm run bulk-probe -- <file>` |
| network-scout.ts | Find XHR APIs | `npm run scout -- <url>` |
| audit-pending-daemon.ts | LLM audit (running) | launchd `se.vadkul.audit-pending` |
| aggregate-events.ts | Push to web+Firestore | `npm run aggregate` |
| show-runs.ts | View scrape history | `npm run runs -- [flags]` |
| manage-venues.ts | known_venues CRUD | `npm run venues` |
| audit-all-pending.ts | One-shot batch audit | `npm run audit-all -- [--force]` |

## 7. Architecture

**Scraper-side:** runner.ts orchestrates registry via engines (sitemap, sitevision, wp-rest, nuxt-data, nextjs-data). Bespoke scrapers in `apps/scraper/src/scrapers/`. `scrape_runs` table tracks per-source stats. `link_events` schema: title, time (UTC), venue, lat, lng, description, image, url, hostName, category, category_confidence, emoji, price, aiVerdict, aiConfidence, status (raw/audited/published), hidden.

**Web-side:** linkEventService.ts reads Firestore first, falls back to JSON. HomeContent.tsx client-filters time<today. aggregate-events.ts filters status='published'.

**Audit:** llmAudit.ts → qwen3:14b via Ollama, structured JSON. Daemon picks `aiVerdict IS NULL OR emoji IS NULL` (idempotent — emoji always set after audit).

## 8. Avoid

- Don't add courses as events (filter @type:Event only)
- Don't add JS-SPA sources without verifying extraction works (mark dead if 0 events)
- Don't push directly to main (--no-ff feature branches)
- Don't touch the audit daemon launchd job
- Don't commit events.db, node_modules, generated JSON, .claude/
- Don't use Eventim (WAF) or Billetto (dead domain) currently

## 9. Git Workflow

Feature branches: `feat/scraper-<name>`, `fix/<thing>`, `docs/<thing>`. Always `--no-ff` merge. Push immediately. Delete branch on origin after merge.

## 10. Open Questions for Josef

1. Window widening 30d→180d (UX impact)
2. Adaptive frequency (when to reduce bulk)
3. Course filtering threshold (~5% events from Medborgarskolan)
4. Sport leagues API key ($/month for everysport or TheSportsDB Patreon)
5. Pensionera bespoke scrapers (tickster, eventbrite redundant — safe to delete?)
