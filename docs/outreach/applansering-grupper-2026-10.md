# Appen i grupperna — lanseringsinlägget (okt 2026)

_Utkast 24/10 2026. Appen ligger i App Store (`apps.apple.com/se/app/id6820135961`),
Android är på väg till Google Play. Systerdokument: `facebook-poster.md`
(varianterna A–D), `facebook-grupper.md` (loggen + lärdomarna), `app-store-butik.md`._

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
> iPhone (sök på "vadkul" i App Store — Android är på väg).
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

Maker-storyn (variant B i `facebook-poster.md`) med appnyheten. Det enda som
byts per grupp är **ort** och **antal** — antalet är det lokala ankaret som
gör texten till ett tips om just den här orten och inte en kopia. Hämta det
från stadssidans rubrik (`vadkul.se/evenemang/[stad]`), eller be Claude
räkna ur nattaggregatet. Småort utan stadssida: se nedan.

> Hej [Ort]! 👋
>
> Jag har byggt vadkul.se — en karta där allt som händer i hela Sverige
> samlas på ett ställe i stället för utspritt på tio olika sidor. Konserter,
> loppisar, hockey, barnaktiviteter, teater. Just nu ligger [X] event i
> [ort]-trakten på kartan.
>
> Nu finns den äntligen som riktig app för iPhone — sök på "vadkul" i
> App Store. Android är på väg.
>
> Det är första versionen, byggd på kvällar och helger, så räkna med en och
> annan bugg. Hittar du något som strular, eller ett event som saknas i
> [ort], skriv här så fixar jag så fort jag kan. Gratis, och inget konto
> behövs för att titta.
>
> Vad saknas i [ort]? 👇

Utan rader måste slutfrågan göra jobbet: "vad saknas?" ger tips i
kommentarerna, och kommentarer ger räckvidd. Räkna med färre
"vilket går ni på?"-trådar och fler "lägg till X" — det är bra för kartan.

**Tre öppningar att rotera** (identisk text i många grupper flaggas av
FB:s filter även utan länk):

1. "Hej [Ort]! 👋 Jag har byggt vadkul.se — ..."
2. "Ni som brukar fråga här vad som händer i helgen: jag har byggt en
   karta för exakt det — vadkul.se, där allt som händer i hela Sverige
   samlas på ett ställe. ..."
3. "Litet hobbyprojekt som växt: vadkul.se, en karta över allt som
   händer i Sverige — [X] event i [ort]-trakten just nu. ..."

**Småort (under ~5 event i själva orten):** skriv inte ut antalet för
"trakten" (Nykvarn-läxan). Byt antalsmeningen mot: "För [ort] är kartan
tunn just nu — det är därför jag skriver här: vad borde vara med?" Det är
Malå-formatet, och det fungerar bättre än en siffra som lokalborna
genomskådar.

**Karens:** maker-storyn postas en gång per grupp. I grupper där B redan
gått (augusti) är appsläppet ett giltigt andra tillfälle, men håll tre
veckor sedan senaste inlägget som vanligt.

## Appstycket — tre formuleringar att rotera

**1 (stommen ovan):** "...och nu finns den äntligen som riktig app för iPhone
(sök på "vadkul" i App Store — Android är på väg)."

**2:** "Efter ett år som webbsida blev den i veckan en riktig app — VADKUL i
App Store. Androidversionen är på väg. Jag bygger allt själv, så den är inte
felfri än; säg till vad som krånglar så lagar jag."

**3:** "Nyhet för er med iPhone: kartan finns nu som app (sök på vadkul i App
Store). Ni med Android får vänta några dagar till, den ligger hos Google. Och
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
> iPhone: finns i App Store nu. Android: på väg till Google Play.
>
> Första versionen, byggd på kvällar och helger. Hittar du en bugg eller ett
> event som saknas: skriv till mig, så lagar jag.
>
> https://apps.apple.com/se/app/id6820135961

Med butiksskärmbilden `docs/butik-assets/skarmbild-01-karta.png` som bild.
Butikslänkarna (App Store nu, Play när den finns:
`https://play.google.com/store/apps/details?id=se.vadkul.app`) hör hemma
här och i medlemsmejlet — inte i grupperna.
