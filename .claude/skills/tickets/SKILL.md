---
name: tickets
description: Ticketflödet på GitHub (issues i josefanderberg/VADKUL) - hitta rätt ticketgrupp, se var vi är, skapa ticket (även för snabba saker), referera #nr i commits och PR:er, stänga med Closes. Använd ALLTID i början av varje uppgift som ändrar kod eller docs (kolla tickets först så du ser var vi är), när Josef säger "ticket", "issue", "grupp", "vad ligger öppet", "var är vi", "lägg upp det som en ticket", och innan en commit eller PR skrivs.
---

# Tickets på GitHub

Varje ändring utgår från en ticket i `josefanderberg/VADKUL`. Ticketarna ligger i
**ticketgrupper**: en förälder-issue per område med under-issues (GitHubs sub-issues).
Grupperna är sättet att se var vi är: öppna gruppen, läs vad som ligger där, jobba
på rätt ticket, låt commiten peka på den.

## Grupperna

| Grupp | Issue | Label | Område |
|---|---|---|---|
| Appen (iOS + Android) | #147 | `grupp:app` | vadkul-app, delat för båda plattformarna, OTA, kontraktet |
| ↳ Android (Google Play) | #148 | `grupp:android` | Play Console, sluten testning, aab, Play-varningar |
| ↳ iOS (App Store) | #149 | `grupp:ios` | App Store Connect, TestFlight, APNs |
| Marknadsföring | #150 | `grupp:marknad` | FB-sidan, Instagram, dagsinlägget, gruppinlägg, Grok, TikTok, studion |
| Outreach | #151 | `grupp:outreach` | arrangörsmejl, kommuner, boost-erbjudandet |
| Webben och kartan | #152 | `grupp:webb` | apps/web, V2Map, stadssidor, sök, SEO |
| Pipelinen | #153 | `grupp:pipeline` | apps/scraper, källor, audit, nattkedjan |
| Functions och notiser | #154 | `grupp:functions` | apps/functions, push, boost, rules |
| Drift, kostnad och CI | #155 | `grupp:drift` | Firebase-notan, hosting, launchd, maskinerna |
| Släpp | #181 | `grupp:slapp` | få ut uppdateringar smidigt: byggen, OTA, butiker, CI-grindar, beroenden, kvalitetsrundor |

Android och iOS är under-grupper till Appen. Något som rör båda plattformarna
ligger direkt under Appen. Något som rör webben OCH appen får båda labels men
ligger under den grupp där jobbet börjar.

Extra labels: `snabb` (liten sak, ticket för commithistorikens skull), `idé`
(inte beslutat, behöver Josefs ja), `bug`. `ticketgrupp` sitter bara på föräldrarna.

## Prioritet

Varje öppen ticket har en av `prio:nu` (den här veckan), `prio:snart` (den här
månaden) eller `prio:sen` (backlog). Josef prioriterar; Claude föreslår en prio på
nya tickets och säger det i svaret. `tickets.sh nu` är dagens arbetslista.
Byt: `tickets.sh prio 172 nu`. En gång i veckan: gå igenom `snart` och `sen` ihop
med Josef (inventera och prioritera, 6/11 2026).

## Boarden

Alla tickets ligger också på en board (GitHub Project "VADKUL tickets",
https://github.com/users/josefanderberg/projects/3) med kolumnerna
**Kvar / Pågår / Ska ut / Klart**. Det är där Josef ser vad vi har kvar, vad som
pågår och vad som väntar på att gå ut.

| Kolumn | Betyder |
|---|---|
| Kvar | öppna tickets som inte har påbörjats |
| Pågår | någon jobbar på den nu |
| Ska ut | klar och committad, men inte pushad till main. Går ut med nästa push |
| Klart | stängd, ute på main |

- **Börjar du på en ticket: `tickets.sh start <nr>`.** Den flyttas till Pågår. Glöm inte det,
  annars syns inte arbetet på boarden.
- **Committat men inte pushat: `tickets.sh klar <nr> "Kommentar"`.** Den flyttas till Ska ut,
  och kommentaren hamnar på ticketen. Skriv commit-hashen och vad som krävs för att den ska
  ut, t.ex. "Committad i a7bdec7c, inte pushad. Går ut med nästa push till main (startar en
  deploy)." Så ser både Josef och nästa session på boarden att den väntar på en push.
- Pausar du eller lämnar den halvfärdig: `tickets.sh paus <nr>` (tillbaka till Kvar).
- `tickets.sh ny` lägger nya tickets i Kvar. `tickets.sh pagar` listar Pågår och Ska ut,
  `tickets.sh board` öppnar boarden.
- **Innan du pushar till main:** kör `tickets.sh pagar` och nämn för Josef vilka tickets i
  Ska ut som följer med pushen.
- Stängs en ticket (`Closes #nr` eller `tickets.sh stang`) flyttar GitHub den till Klart själv.
  Åt andra hållet också: drar Josef ett kort till Klart stänger GitHub ticketen.
- Gruppföräldrarna (`ticketgrupp`) ligger inte på boarden.
- Board-kommandona kräver gh-behörigheten `project` på maskinen (`gh auth refresh -s project`).
  Saknas den skapas tickets ändå, men skriptet säger att boarden inte nåddes.
  Fastnar `gh auth refresh` på Y/n-frågan i appens terminal: kör den i bakgrunden med
  `</dev/null`. Då hoppar gh över frågan och skriver ut en engångskod som Josef skriver in
  på github.com/login/device (11/11 2026).

## Var är vi? Gör detta först

```bash
.claude/skills/tickets/tickets.sh nu        # det som ska göras nu
.claude/skills/tickets/tickets.sh pagar     # det som pågår och det som ska ut (boarden)
.claude/skills/tickets/tickets.sh lista     # alla grupper som träd, med prio-tagg
```

`--alla` tar med stängda. Rör uppgiften ett område: `tickets.sh grupp webb` (namnet
efter `grupp:`). En ticket med under-tickets: `tickets.sh visa 172`.

Hittar du ticketen som matchar uppgiften: jobba på den och referera den. Hittar du
ingen: skapa en (nedan) INNAN du börjar, även för små saker. Det är poängen:
commithistoriken ska gå att läsa ticket för ticket.

Josef skriver gärna bara en rad i GitHub. Då fyller Claude på specen (Vad, Varför,
Klart när, Var), lägger ticketen i rätt grupp och på boarden (`tickets.sh paus <nr>`
lägger in den i Kvar) innan arbetet börjar.

## Ny ticket

```bash
.claude/skills/tickets/tickets.sh ny webb "Titel" "Brödtext"            # vanlig
.claude/skills/tickets/tickets.sh ny drift "Titel" --snabb              # snabb sak, en rad räcker
.claude/skills/tickets/tickets.sh ny app "Titel" "Brödtext" --ide       # förslag som väntar på Josefs ja
.claude/skills/tickets/tickets.sh prio 184 snart                        # sätt prio direkt efteråt
```

Skriptet skapar issuen med rätt label och hänger den under gruppens förälder.
Utan brödtext får ticketen mallen med fyra fält. Specen ska svara på:

- **Vad:** vad ska göras, konkret nog att någon annan kan ta den.
- **Varför:** vad det löser för Josef eller användarna.
- **Klart när:** det observerbara kriteriet (en siffra, ett tillstånd i en konsol, ett test).
- **Var:** filer, konsoler, maskin (minin eller MacBooken).

Fattas ett ägarbeslut under arbetet: skriv det som en kommentar på ticketen OCH i
rätt skill (kart-ui, pipeline, deploy). Skillsen är fortfarande källan för regler;
ticketen är spåret.

Repot är publikt. Inga hemligheter, tokens, e-postadresser eller personuppgifter
i tickets eller kommentarer.

## Commits, grenar och PR:er

- **Commit-ämnesrad slutar med ticketnumret:** `Spotlight-listan scrollar i stället för att klämma raderna (#172)`.
  Formen `(#nr)` = ticket. GitHubs egna merge-rader `(PR #144)` är pull requests, blanda inte ihop.
- **Sista commiten för en ticket har `Closes #nr`** på egen rad i brödtexten. Då stängs
  ticketen automatiskt när commiten når main. Delleveranser: bara `(#nr)` i ämnesraden.
- **En ticket per commit.** Rör ändringen två tickets: två commits (pathspec, inte `git add -A`).
- **Gren vid PR:** `tickets.sh gren 172` ger `ticket/172-spotlight-listan-...`. Små saker
  direkt på main är fortfarande ok, med `(#nr)` i ämnesraden.
- **PR:** titeln = ticketens titel, brödtexten enligt `.github/PULL_REQUEST_TEMPLATE.md`
  (grupp, `Closes #nr`, vad som verifierats). Squash-merge ger då en main-rad med både
  ticket och PR.
- Commits i `vadkul-app` refererar huvudrepots ticket med fullt namn:
  `josefanderberg/VADKUL#164`, annars länkar GitHub fel.

## Stänga och städa

- Normalt stänger `Closes #nr` ticketen vid push. Manuellt: `tickets.sh stang 179 "Fixat i abc1234"`.
- Ticket som inte längre är aktuell: stäng med en rad om varför (`--reason "not planned"` via gh).
- Gruppföräldrarna stängs aldrig; de är strukturen.
- Nytt område som inte passar någon grupp: skapa en ny förälder med labels
  `ticketgrupp` + ny `grupp:<namn>`, lägg till raden i tabellen ovan och i
  `tickets.sh`-hjälptexten.

## Varför så här

Josef 6/11 2026: tickets i grupper så man direkt ser var man är, PR:er skrivna mot
gruppen, och tickets även för snabba saker så att commithistoriken blir läsbar
från den punkt vi utgår ifrån vid varje merge. Två maskiner delar main, så en
läsbar historik är också hur vi hittar vad som hände när något gick fel.
