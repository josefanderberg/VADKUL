# Appen i grupperna — lanseringsinlägget (okt 2026)

_Utkast 24/10 2026. Appen ligger i App Store (`apps.apple.com/se/app/id6820135961`),
Android kommer senare i höst till Google Play. Systerdokument: `facebook-poster.md`
(varianterna A–D), `facebook-grupper.md` (loggen + lärdomarna), `app-store-butik.md`._

## Tidpunkt: iPhone-vågen nu, Android via sidan och mejlet när Play är live

Ägarbeslut 24/10 (Josefs fråga: "borde vi vänta?"). Ja, av fyra skäl:

1. **Gruppen får ett skott.** Maker-storyn postas en gång, och karensen är
   tre veckor. Går den upp med "Android på väg" bränns lanseringen för
   ungefär fyra av tio läsare, och ett andra inlägg "nu även Android" i
   samma grupp är ren reklam utan nyhetsvärde.
2. **"På väg" är ett löfte vi inte styr över.** Plays granskning av en ny
   app kan ta dagar eller veckor. Halkar den, åldras varje gruppinlägg
   som redan ligger uppe.
3. **Tråden ska handla om event, inte om "när kommer Android?"** Hälften
   av kommentarerna blir annars den frågan.
4. **Det kostar nästan inget att vänta.** Appen är sökbar i App Store, och
   den varma publiken (medlemmarna, sidföljarna) kan få iPhone-nyheten nu
   via sidinlägget och medlemsmejlet. Grupperna är den kalla publiken —
   de får den färdiga nyheten.

**Hur länge är "tills Play är live"?** (kollat 24/10 mot Googles hjälpsidor)
Identitetsverifieringen har ingen publicerad handläggningstid — räkna med
några dagar, ibland längre. Sedan beror allt på kontotypen i Play Console:

- **Personligt konto skapat efter 13/11 2023:** produktion är låst tills
  appen legat i ett **stängt test med minst 12 testare som varit opt-in
  oavbrutet i 14 dagar**. Därefter ansöker man om produktionsåtkomst
  (några dagars granskning) och sedan granskas själva releasen (vanligen
  några dagar, upp till en vecka eller mer för en ny app). Realistiskt
  **3–4 veckor** från nu. Faller testarna under 12 startar klockan om —
  värva 15–20. Medlemmarna med förtur är den givna testarpoolen
  ("Android-testare får appen först" passar oktobermejlets löfte).
- **Organisationskonto (D-U-N-S):** inget 12-testarkrav. Verifiering →
  produktionsrelease → granskning. Realistiskt **1–2 veckor**.

**Facit 25/10** (`docs/google-play-butik.md` på main): kontot är
**personligt**, skapat 9/10, id-verifieringen är inte klar och appen går
inte ens att skapa i Play Console förrän den är det. Alltså den långa
vägen: verifiering → skapa appen → internt test direkt → stängt test med
12 testare i 14 dagar → produktionsansökan → releasegranskning. Räkna med
**minst 3–4 veckor**, troligen mer. Därför gäller planen nedan för
3–4 veckor: grupperna får iPhone-nyheten nu med "Android kommer senare i
höst" (rekommendation 25/10 — Josef avgör).

**Skriv aldrig "om några dagar"** — det är Googles klocka, inte vår. Blir
det 1–2 veckor: vänta med grupperna (planen nedan). Blir det 3–4 veckor:
kör iPhone-vågen i grupperna med "Android kommer senare i höst" och låt
Android-nyheten gå via sidan och medlemsmejlet, inte som ett andra
gruppinlägg. Vågen tar i sig 4+ veckor i 2–3-om-dagen-takt, så de sista
grupperna skulle annars vänta två månader.

**Ordningen:**
- Nu: id-verifieringen, sedan skapa appen i Play Console och starta det
  stängda testet samma dag (klockan börjar ticka först då; värva 15–20
  testare ur förturslistan). Sidinlägget på VADKUL-sidan + egna profilen (iPhone nu, Android
  snart) och medlemsmejlet. Fyll i `APP_STORE_URL` i webben.
- Dagarna emellan: laga det TestFlight- och App Store-användarna
  rapporterar, så att första gruppvågen möter en bättre 1.0.x. Kolla att
  "vadkul" ger appen överst i både App Store och Play.
- När Play är live: fyll i `PLAY_STORE_URL`, byt appmeningen i variant R
  till "för både iPhone och Android — sök på vadkul i App Store eller
  Google Play", och börja med grupperna i 2–3-om-dagen-takten.

## Bedömningen

En ren "nu finns appen i App Store"-nyhet är det mest reklamlika vi kan posta
i en grupp: en butikslänk läses som annons av varje moderator, oavsett hur
nyttig appen är. Gotland-lärdomen (72 likes, borttaget som reklam) och
17/7-lärdomen (länkinlägg plockas inom ett dygn) gäller fullt ut. Därför:

1. **Två format, välj per grupp.** Eventlistan (stommen nedan) är det
   säkraste: raderna är värdet för den som aldrig klickar, och appen är ett
   PS. Rakt-på-sak-varianten (variant R) är maker-storyn utan rader — bara
   ort och eventantal byts. Den duger i grupper där kartan redan postats
   och blev väl mottagen (nyheten är då "den jag visade i augusti finns som
   app"), och är billig nog att hinna 2–3 grupper om dagen i flera veckor.
   Raderna behövs fortfarande där vi är nya, där gruppen är strikt eller
   ämnesbegränsad, och där ett inlägg redan tagits bort.
2. **Ingen länk alls i grupperna** (ägarbeslut 24/10) — varken i inlägget
   eller i en kommentar. "Sök på vadkul i App Store" ersätter länken, precis
   som "googla vadkul" gjorde när gruppregler stoppade webblänken. En
   butikslänk är den starkaste reklamsignalen vi kan skicka, och den som
   vill hitta appen gör det på fem sekunder ändå. Kolla innan första
   inlägget att sökningen "vadkul" i App Store verkligen visar appen överst
   (nysläppta appar kan ta något dygn att indexeras).
3. **Ärligheten om buggarna är en styrka, inte en brasklapp.** "Första
   versionen, byggd på kvällar och helger, säg till vad som strular" är exakt
   den hobbyprojekt-vinkel svenska grupper belönar — och den gör inlägget till
   en förfrågan om hjälp i stället för en annons. Kräver att alla kommentarer
   besvaras första dygnet (buggrapporter i tråden är publika).
4. **Skriv Android dag-agnostiskt.** Inläggen postas 2–3 om dagen i flera
   veckor; "om några dagar" är fel i grupp nummer tio. Skriv "på väg" och byt
   till "finns för både iPhone och Android" den dag Play är live.
5. **Variera texten.** Samma rader + samma appstycke i tio grupper flaggas av
   både FB:s filter och moddar. Eventraderna byts per grupp (kommunregeln,
   8 km-regeln för småorter), och appstycket roteras mellan de tre
   formuleringarna nedan.
6. **Reklamen hör hemma på VADKUL-sidan och den egna profilen.** Där får
   inlägget vara rakt på: skärmbild, butiksknappar, Android-datum. Gruppen får
   tipsformatet.

**Innan första inlägget:** `APP_STORE_URL` i `apps/web/src/utils/installPrompt.ts`
är fortfarande `null`. En iPhone-användare som klickar sig till vadkul.se från
inlägget får då PWA-erbjudandet ("lägg till på hemskärmen") i stället för
App Store-bannern. Fyll i iOS-länken (och Play-länken när den finns) och
deploya — annars tappar vi installationer från precis den trafiken inlägget
skapar.

## Stommen (en per grupp — fyll raderna samma dag du postar)

> [Ort] den närmaste veckan 👇
>
> 🎵 [Event 1 — i kommunen, dag + klockslag]
> 🧸 [Event 2 — gärna något för barnfamiljer]
> 🛍️ [Event 3]
> 🎭 [Event 4]
> 🎶 Och nästa vecka: [Event 5]
>
> Allt kommer från vadkul.se — kartan där det som händer i hela Sverige samlas
> på ett ställe i stället för utspritt på tio olika sidor. Jag har byggt den
> själv på kvällar och helger, och nu finns den äntligen som riktig app för
> iPhone (sök på "vadkul" i App Store — Android kommer senare i höst).
>
> Det är första versionen, så räkna med en och annan bugg. Hittar du något
> som strular, eller ett event som saknas i [ort], skriv här så fixar jag så
> fort jag kan. Gratis, och inget konto behövs för att titta.
>
> Vad lockar mest? 👇

**Ingen länkkommentar.** Frågar någon i tråden efter adressen: svara
"vadkul.se, eller sök på vadkul i App Store" i klartext — ett svar på en
fråga plockas inte som reklam.

## Variant R — rakt på sak (utan eventrader)

Maker-storyn (variant B i `facebook-poster.md`) med appnyheten. **En enda
plats att byta per grupp: ortnamnet i hälsningen** (ägarbeslut 24/10 —
"för många ställen att byta"). Brödtexten är generisk: "er stad och hela
Sverige", "hos er".

> Hej [Ort]! 👋
>
> Jag har byggt vadkul.se — en karta där allt som händer i er stad och i
> hela Sverige samlas på ett ställe, i stället för utspritt på tio olika
> sidor. Konserter, loppisar, hockey, barnaktiviteter, teater.
>
> Nu finns den äntligen som riktig app för iPhone — sök på "vadkul" i
> App Store. Android kommer senare i höst.
>
> Det är första versionen, byggd på kvällar och helger, så räkna med en och
> annan bugg. Hittar du något som strular, eller ett event som saknas hos
> er, skriv här så fixar jag så fort jag kan. Gratis, och inget konto
> behövs för att titta.
>
> Vad saknas hos er? 👇

Utan rader måste slutfrågan göra jobbet: "vad saknas?" ger tips i
kommentarerna, och kommentarer ger räckvidd. Räkna med färre
"vilket går ni på?"-trådar och fler "lägg till X" — det är bra för kartan.

**Spamfiltret:** samma brödtext i många grupper från ett konto är det FB:s
filter tittar på, med eller utan länk. Skyddet är takten — max 2–3 grupper
om dagen, utspritt över dagen — inte omskrivningar. Blir ett inlägg stoppat
med "liknande innehåll": vänta till nästa dag och byt första meningen
("Hej [Ort]!" → "Ni som brukar fråga här vad som händer i helgen:").

**Valfritt lokalt ankare** när en grupp känns extra skeptisk: lägg till
"Just nu ligger [X] event i [ort]-trakten på kartan" efter kategoriraden,
med antalet från stadssidans rubrik. Inte för småorter (Nykvarn-läxan:
radien ljuger) — där i stället "För [ort] är kartan tunn just nu, vad
borde vara med?".

**Karens:** maker-storyn postas en gång per grupp. I grupper där B redan
gått (augusti) är appsläppet ett giltigt andra tillfälle, men håll tre
veckor sedan senaste inlägget som vanligt.

## Appstycket — tre formuleringar att rotera

**1 (stommen ovan):** "...och nu finns den äntligen som riktig app för iPhone
(sök på "vadkul" i App Store — Android kommer senare i höst)."

**2:** "Efter ett år som webbsida blev den i veckan en riktig app — VADKUL i
App Store. Androidversionen kommer senare i höst. Jag bygger allt själv, så den är inte
felfri än; säg till vad som krånglar så lagar jag."

**3:** "Nyhet för er med iPhone: kartan finns nu som app (sök på vadkul i App
Store). Ni med Android får vänta lite till, den kommer senare i höst. Och
ja — första versionen, så var snäll mot buggarna och skriv gärna vilka ni
hittar."

Avslutningsfrågan roteras också: "Vad lockar mest? 👇" / "Vad går ni på i
helgen? 👇" / "Vad har jag missat i [ort]? 👇".

## Gruppregler som gäller precis som förut

- Läs regelrutan. Ämnesbegränsad grupp (Gotland: kultur/musik) → bara rader i
  gruppens ämne och kartan beskriven i gruppens språk.
- Bara event i gruppens **kommun** (Landskrona-läxan 1/9); småort → räkna
  inom ~8 km, under fem event → Malå-formatet eller skippa.
- Nämn vadkul.se högst en gång i brödtexten och butiken en gång — fler
  omnämnanden gör texten till en annons igen, länk eller inte.
- Max 2–3 grupper per dag, samma grupp tidigast var tredje vecka, nymedlem →
  delta någon dag först. Admin-DM först i grupper som avvisat tidigare.
- Svara på varje kommentar första dygnet. Bugg i tråden = tacka, bekräfta,
  återkom i tråden när den är fixad (det är bästa reklamen).
- Logga i `facebook-grupper.md` (grupp, datum, variant, reaktioner — OCH om
  inlägget lever efter en vecka).

## När Android är live

Byt appmeningen till: "...och nu finns den äntligen som riktig app, för både
iPhone och Android (sök på "vadkul" i App Store eller Google Play)."
Fortfarande ingen länk i grupperna.

## Variant D — när någon annan frågar vad man ska göra

> Kolla appen VADKUL (eller vadkul.se) — karta med allt som händer. I helgen
> i [ort] finns t.ex. [event 1] och [event 2].

## Sidinlägget (VADKUL-sidan + egna profilen — här får det vara reklam)

> Nu finns VADKUL som app 📱
>
> Allt som händer nära dig — konserter, loppisar, hockey, barnaktiviteter,
> teater — på en karta, dag för dag. Gratis, inget konto behövs.
>
> iPhone: finns i App Store nu. Android: kommer senare i höst.
>
> Första versionen, byggd på kvällar och helger. Hittar du en bugg eller ett
> event som saknas: skriv till mig, så lagar jag.
>
> https://apps.apple.com/se/app/id6820135961

Med butiksskärmbilden `docs/butik-assets/skarmbild-01-karta.png` som bild.
Butikslänkarna (App Store nu, Play när den finns:
`https://play.google.com/store/apps/details?id=se.vadkul.app`) hör hemma
här och i medlemsmejlet — inte i grupperna.
