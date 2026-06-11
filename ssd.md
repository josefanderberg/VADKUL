# VADKUL — Scalable Source Discovery (SSD): State & Next Steps

Last updated: 2026-06-11 (umbrella-API round 2)

This file documents the current state of VADKUL's scraper expansion toward 1000 sources. Read this first before continuing the work.

## 1. Current State (snapshot 2026-06-11)

**Effective scrapers running daily: ~304 configs.**
- Registry sources: 299 (in `apps/scraper/src/sources/registry.ts`, incl. 5 network engines — 3 duplicate venue-ids removed 2026-06-11), 5 dead
- Bespoke scrapers: **10** (today-sweden, tickster, ticketmaster, eventbrite, meetup, facebook, vaxjoco, upplev, kollektivetlivet, upplev-stockholm)
- **Network engines folded into registry 2026-06-11**: hembygd, svenskakyrkan, naturskyddsforeningen, rotary, rodakorset now run as `ENGINES` via the sources runner (scheduling/dry-run/scrape_runs for free; engine code stays in `src/scrapers/<id>.ts`). New umbrella APIs (PRO, Korpen) should follow this shape: mapper + engine fn + one registry row.
- Disabled: billetto (dead domain), eventim (Akamai WAF)
- Per-event-producing endpoints: ~527+ (Hembygd umbrella covers 1988 associations, 225 with ≥3 events; Svenska kyrkan adds ~3000+ across all parishes; Naturskydd national; Rotary 3 districts; Röda Korset local chapters)
- Distance to 1000: 697 configs / 473 endpoints (raw config count unchanged — these umbrella sources are single scrapers covering hundreds of organizers each)

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
- **HTML-fragment "finders"** (Friluftsfrämjandet ASP.NET MVC Search returns HTML cards behind a stateful GUID/token form, no JSON) — needs Puppeteer form-driving + Swedish-text date parsing, poor ROI
- **Flat hand-authored HTML calendars** (SPF Seniorerna: per-association prose pages, no per-event URL, no structured dates) — not machine-harvestable
- **Auth-locked content APIs** (Rädda Barnen EPiServer Content API → 401 anonymous)

## 4. Umbrella-API sources — DONE (rounds 1–2)

The umbrella-API pattern is now the proven engine for big leaps. Four national networks shipped:

| Network | Endpoint pattern | Auth | Volume | Shape |
|---|---|---|---|---|
| **Svenska kyrkan** | `POST svk-apim-prod.azure-api.net/calendar/v1/event/search/` | `ocp-apim-subscription-key: f6937363a4d94012a78a32442752cf5c` | ~19 700/30d RAW → hard-filtered (see below) | National-aggregated, continuation-token pagination. Filter `owner.type==='Utlandet'` (SKUT abroad). **HARD FILTER since 2026-06-11** (`isPublicSvkEvent`): raw feed is ~55 % `gudstjanstOchMassa` (services incl. baptisms/weddings) — dropped along with `stodOchOmsorg`, online-only and opening-hours notices. Incident: an unfiltered nightly published 845 before being stopped + purged. |
| **Naturskyddsföreningen** | `POST admin.naturskyddsforeningen.se/graphql` `searchContent(context:"calendar")` | none | ~465 | National-aggregated, `filters.page` pagination. Coords + images in payload. ISO date from URL slug. |
| **Rotary** | `POST rotary<NNNN>.se/<siteId>/Event/GetDistrictEvents` | none | ~370/180d | Per-district loop (6 ClubRunner districts; 3 expose endpoint, 3 use widget iframes). **US date format `MMM d, yyyy` required** (ISO → 0). Runtime siteId discovery from `/events`. |
| **Röda Korset** | `GET rodakorset.se/api/episerver/v3.0/content?contentUrl=<url>` | none | ~100 | Sitemap → /kalendarium/ event URLs → resolve each. ISO UTC dates, precise street-address geocoding. |

**Key learnings this round:**
- Recon via parallel agents (curl + Chromium UA + `npm run scout`) over 8 candidates was high-leverage: found 5 APIs, 4 built. Always verify the agent's exact endpoint/IDs yourself — Rotary siteId↔district mapping came back scrambled.
- Geocoding: prefer in-payload coords (Naturskydd) → else `geocodeVenueSweden(venue)` works great on Swedish named places (churches, hotels, street+kommun). Web map **excludes events at exactly 0,0**, so geocoding success = visibility.
- Platform fingerprints that yield clean JSON: Azure APIM, decoupled-WP GraphQL, ClubRunner `GetDistrictEvents`, EPiServer/Optimizely Content Delivery API (`/api/episerver/v3.0/content`), SiteVision WebApp `/activities` (PRO).

## 5. Next Steps (Prioritized)

1. **PRO (Pensionärernas Riksorganisation)** — BUILD-ready, ~1000-1500 events. Per-förening SiteVision WebApp: `POST pro.se/appresource/4.<pageNodeId>/12.4d4eef.../activities` (the `12.…` portlet ID is constant; `4.<pageNodeId>` per-förening from the `vara-aktiviteter` page HTML). Needs a `JSESSIONID` cookie (GET the page first; pair cookie+nodeId from same response). Body `{"startsAfter":"<today>","page":1,"pageSize":100,...}`, paginate via `totalPages`. Discover ~118 structured föreningar from `pro.se/sitemapindex.xml` (grep `…/vara-aktiviteter$`). No coords → geocode kommun from URL path. Sweden-only. **Biggest remaining single leap.**
2. **Korpen** — BUILD-ready but NOISY. Per-association Zoezi API `GET <assoc>.zoezi.se/api/public/workout/get/all?fromDate=&toDate=` (no auth, coords in `resources[].position`). Discover assoc subdomains by scraping `korpen.se/foreningar/` → ~136 slugs → grep `https://<x>.zoezi.se`. **Caveat: tens of thousands of recurring drop-in gym classes (daily spinning/gympa)** — would flood the feed. Needs heavy de-duplication / series-collapsing before shipping (see [[scraper-deferred-tuning]]).
3. **Other umbrella networks to probe:** PRO/SPF done-or-skipped; try Friskis&Svettis (likely Zoezi too), Studiefrämjandet/Bilda (Event-only filter), Riksteatern, scouterna.se.
4. **Studieförbund Event-only filter** (5-10% of 4683 Medborgarskolan = 200-400 real events)
5. **Biljettplattform organizer enumeration** (Tickster /o/, Billetto if returns, Eventbrite SE-filtered)
6. **Pensionera redundans:** bespoke tickster.ts vs tickster-sitemap, bespoke eventbrite.ts vs Eventbrite sitemap
7. **JS-SPA bulk via Puppeteer-render** (995 FAIL list, expect 1-3% yield = 10-30 sources)
8. **Adaptive frequency** (currently 172/175 daily — tier by horizon)
9. **Window widening 30d→180d** (currently throws 72% of scraped events)

**Skipped this round (don't re-probe without new angle):** Friluftsfrämjandet (HTML fragments), SPF Seniorerna (prose HTML), Lions (fragmented, no API; only a loppis Google Sheet with unparseable recurring schedules), Rädda Barnen (auth-locked Content API).

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
