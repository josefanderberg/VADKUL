# Sociala lagret (spår 3) - vänner, privat eventchatt, vänprofiler

Byggt 7/10 kväll på `claude/kartfilter` utifrån Josefs beskrivning: "man både
kan ha en publik chatt och en privat chatt med folk man bjuder in", "om man
klickar kommer så kan man välja att ... bjuda in vänner", "man kan gå in på
sina vänners profiler och se vilka de är intresserade av, kommer på" - "lite
mer av [det] happymap hade". Bygger ovanpå RSVP-lagret från 6-7/10
(eventRsvps/eventStats/useEventRsvp/rsvpTransition - orört).

**DRIFTLÄGE: reglerna är DEPLOYADE 2026-10-07 kl 22:21** (Josefs ok; live-
rulesetet verifierat identiskt med `infra/firebase/firestore.rules` via
`admin.securityRules().getFirestoreRuleset()`). Samma deploy släppte även
6/10-reglerna för Kommer/Intresserad (eventRsvps + going/interested i
eventStats) som legat committade men aldrig gått ut. Grenen är mergad i
main samma kväll (PR #111), så repofilen på main == live.

## Datamodell

### Vänner - `users/{uid}/friends/{vänUid}`

Befintlig v1-undersamling, nu med låst tillståndsmaskin. Ett dokument PER SIDA
av relationen, status sedd från ägarens håll:

| users/A/friends/B | users/B/friends/A | betyder |
|---|---|---|
| `outgoing` | `incoming` | A har frågat B |
| `accepted` | `accepted` | vänner |

Fält: `status`, `name`/`photoURL` (motpartens, denormaliserade så vänlistan
visas med EN query - ingen users-läsning per vän), `createdAt`. Alla
övergångar skriver BÅDA dokumenten i en `writeBatch` (friendService);
logiken är ren och testad i `apps/web/src/utils/friendStatus.ts`. Reglerna
låser: skapa = bara egen 'outgoing' resp. motpartens 'incoming' (= förfrågan),
uppdatera = bara 'incoming'→'accepted' (ägaren) och 'outgoing'→'accepted'
(motparten som accepterar), radera = båda parter. Läsning: bara de två
parterna. Kräver riktigt konto (`!isAnonymous()`).

Vägar in i UI:t: inbjudningsbannern i kartkortets footer ("Lägg till X som
vän" / "Acceptera vänförfrågan") och profilpanelens Vänner-mapp
(FriendsSection: förfrågningar, vänlista, ångra, ta bort).

### Privat eventchatt - `eventChats/{nyckel}/privat/{inbjudarUid}`

EN tråd per inbjudare och event. `nyckel` = samma URL-enkodning som publika
chatten men på SERIENS dokument-id (`rsvpShareId`, som eventRsvps) -
inbjudningslänken `/e/<slug>` pekar dit, och inbjudare + mottagare måste
hamna i samma tråd oavsett tillfälle. Dokument: `eventId`, `inviterName`,
`members` som MAP `uid → true` (voters-mönstret från eventPhotos: en
uppdatering får bara röra ens EGEN nyckel, max 50 medlemmar). Meddelanden i
`.../messages` med samma form som publika chatten. INGEN spegel till
`latestActivity/latestComment` - privata meddelanden ska aldrig till kartans
publika bubbla.

Flöde: "Bjud med" skapar tråden best-effort (ensurePrivateThread) och delar
`/e/<slug>?inb=1&fran=<uid>`; mottagaren får "Gå med i privata chatten" i
chattens privata block -
`?fran=` ÄR trådens id, så **länken är nyckeln**: den som har länken kan gå
med. Medlemslistan hittas med `where('members.<mitt uid>', '==', true)` -
exakt det läsregeln kan bevisa. Ren logik i `apps/web/src/utils/privateChat.ts`.

**Sedan 7/10 sent (Josef: "en till chat. där man kan bjuda in andra direkt i
en privat chatt. alltså så kan man kopiera länken"):** EventChatPanel visar
TVÅ block, publik chatt + privat chatt (flikarna är borta). Privata blocket
syns för alla inloggade: utan medlemskap "Bjud in" (delningsarket) + "Kopiera
länk", som startar ens egen tråd i bakgrunden och delar samma
inbjudningslänk; som medlem kan man bjuda in fler till SAMMA tråd (länken
bär trådägarens uid - `privateInviteThreadId`). Att bjuda in via chatten rör
inte ens eget svar (Bjud med i svarsraden sätter Kommer som förut).

### Vänprofiler + integritetsgrind

Vännens "profil" bor i profilpanelens vänlista: raden fälls ut och visar
hens kommande event med Kommer/Intresserad-status. Underlag:
`users.goingEventIds/interestedEventIds` (RSVP-spegeln som redan skrivs av
kartan/stadssidorna) - urval/sortering i `apps/web/src/utils/friendEvents.ts`
(senast svarade först, tak 12, dubblett = Kommer vinner, `isEventPast`-
gränsen). Eventen slås upp i laddade kartdatan först, därefter
`/api/event?id=` (ingen Firestore per event).

Grinden: `users.rsvpVisibleToFriends` - utelämnad = synlig, `false` = av
(reglaget "Visa vad jag kommer på för mina vänner" i Vänner-mappen).
UI:t visar dessutom bara listan för ACCEPTERADE vänner.

## Beslut Josef behöver ta

1. **Ska vänförfrågningar synas mer?** Nu upptäcks en inkommande förfrågan
   först när man öppnar profilpanelens Vänner-mapp (siffer-badge på raden).
   Vill vi ha en prick på profilknappen eller en push (functions-jobb) krävs
   mer bygge.
2. **Integritetsgrindens hårdhet.** `goingEventIds/interestedEventIds` ligger
   i users-dokumentet som är PUBLIKT LÄSBART på regelnivå - grinden
   (rsvpVisibleToFriends + bara-vänner) upprätthålls i klienten. Riktig
   serversidig integritet kräver att spegeln flyttas till en skyddad
   undersamling (t.ex. `users/{uid}/privat/rsvp`) med regel-get:ar - en
   migrering som rör kartans och stadssidornas delade RSVP-flöde. Tills dess:
   den som orkar läsa Firestore direkt kan se listorna, precis som före det
   här bygget.
3. **Länken är nyckeln till privata chatten.** Vem som helst med
   inbjudningslänken (vidarebefordrad etc.) kan gå med i tråden - medvetet
   (så funkar "dela till den man vill ha med"), men värt att äga beslutet.
   Alternativ: inbjudaren godkänner varje medlem (mer bygge + regeländring).
4. **Ska vänlistan synas för andra?** Nu ser bara jag min lista (och varje
   relation ses av sina två parter). Happymap-stilen "X och Y är också
   vänner med Z" kräver öppnare läsregler - inget byggt för det.
5. **"N vänner kommer" på eventkorten** (B7-resten): avatarraden i footern
   särskiljer inte vänner än. Kräver att vänlistan korsas med eventRsvps -
   görbart utan nya kollektioner, men fler läsningar per kortöppning.
6. **Verifiering i browser** av vänflödet och privata chatten (rules är ute
   sedan 7/10 22:21, men flödena är bara statiskt granskade + testade på ren
   logik).

## Filer

- Ren logik + tester: `apps/web/src/utils/friendStatus.ts`, `friendEvents.ts`,
  `privateChat.ts` (+ `.test.ts` för alla tre, 32 tester).
- Firestore-rör: `apps/web/src/services/friendService.ts`,
  `privateChatService.ts`.
- UI: `components/v2/FriendsSection.tsx` (ny, i ProfilePanel),
  `EventChatPanel.tsx` (publikt + privat block), `EventRsvpFooter.tsx` (vänknappen i
  bannern), `EventCard.tsx`/`EventExpanded.tsx`/`page.tsx` (koppling).
- Regler: `infra/firebase/firestore.rules` (friends skärpt + 8e privat chatt).
