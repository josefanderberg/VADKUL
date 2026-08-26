# Dataförsäljning — dagsfil vs API

Arbetsdokument för hur eventdatat kan säljas vidare (kommuner, media,
turistbyråer, appbyggare). Två leveransformer övervägs: **dagsfil** och **API**.

## Kärnfrågan: måste kunden läsa in datan i sin egen databas?

- **Dagsfil: ja, alltid.** Kunden får en dump och måste själv importera den —
  bygga inläsningsrutin, hantera dubbletter, uppdaterade och försvunna event.
  Det är hela modellen.
- **API: nej, inte nödvändigtvis.** Kunden kan fråga API:et live och rendera
  direkt ("visa event i Umeå denna vecka" på sin sajt) utan egen DB — eller
  synka via API:et till egen DB precis som med filen. De flesta seriösa kunder
  bygger ändå en lokal cache för att slippa vara beroende av vår upptid.

Skillnaden ligger alltså mindre i var datan hamnar och mer i **vem som bär
drift- och integrationsbördan**.

## Dagsfil (JSON/CSV levererad varje natt)

**För oss: nästan gratis att erbjuda.** Nattkedjan producerar redan
aggregat-JSON:er till `apps/web/public/` kl 00:30. En dagsfil är i praktiken
samma data bakom en signerad URL eller ett mejl-/SFTP-jobb.

- Färskhet: en gång per dygn — men pipelinen skrapar ändå bara nattetid, så
  datan är inte färskare än så oavsett leveranssätt. Ett API skulle **inte**
  ge kunden nyare data än dagsfilen gör i dag.
- Integrationsbördan ligger hos kunden (import, dedup, borttagna event).
- Nackdel för oss: levererad fil = noll kontroll. Vi kan inte mäta användning,
  strypa volym eller stänga av åtkomst till data kunden redan hämtat.

## API

**För oss: ett driftåtagande.** Endpoint som ska vara uppe dygnet runt,
autentisering, rate limiting, versionering, övervakning.

- **Kostnadsregeln gäller fullt ut:** API:et måste servera från SQLite-spegeln
  eller färdiga aggregat — aldrig Firestore-läsningar per anrop, annars äter
  kundtrafiken upp marginalen (Firestore-reads/egress är största driftkostnaden).
- Fördel: vi kan mäta, prissätta per volym och stänga av en kund som slutar
  betala.
- Kunden slipper egen DB om de vill — sänker tröskeln för små aktörer som bara
  vill embedda.

## Slutsats

Eftersom datan bara uppdateras en gång per dygn är **dagsfilen det ärliga och
billiga erbjudandet att börja med** — nästan noll ny kod. API motiveras först
när:

1. en kund inte vill hålla egen databas (små aktörer, embed-fall), eller
2. vi vill prissätta per användning.

Naturligt mellanläge: sälj dagsfilen som bas nu, lägg ett tunt läs-API ovanpå
samma aggregat senare — samma data, två leveransformer.
