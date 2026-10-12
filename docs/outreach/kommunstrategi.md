# Kommunstrategi

Hur vi arbetar med kommunerna så att båda sidor får ut något. Skriven 12/10 2026 efter de
första kommunsvaren (se *Kommuner: lärdomar från svaren* i
[arrangorserbjudandet.md](arrangorserbjudandet.md)). Utskicken sker i studion
(vadkul.se/admin → Marknad), och varje kontakt dokumenteras där.

Utgångsläget: ett par hundra kommuner och destinationsbolag har evenemang hos oss.
Förvaltningarna kan inte marknadsföra ett företag. Men de har ett uppdrag som vi hjälper till
med: att invånarna hittar och deltar i förenings- och kulturlivet.

## Utbytet

| Kommunen får | Vi får |
|---|---|
| Invånarna hittar hela utbudet på en karta: föreningar, församlingar, scener, biblioteken och kommunens egna verksamheter. Det stöder kultur- och fritidsuppdraget, folkhälsan och arbetet mot ofrivillig ensamhet. | Fler evenemang och fler besökare. |
| En **ortsrapport** gratis: utbudet i kommunen, tomma dagar och jämförelse med grannkommunerna (se nedan). | En dialog, en kontaktperson och en referens. |
| Föreningarna syns gratis, med egen arrangörssida och möjlighet att lägga till event själva. | Föreningarna som arrangörer och användare. |
| Vi rapporterar fel i deras kalender och visar rätt arrangör (Visit Eskilstuna 12/10). | Bättre data och färre fel. |
| Senare, om de vill: kommunens egen karta på deras sajt eller en årsrapport, köpt som tjänst. | Intäkt, och en länk som följer med kartan ("Drivs av vadkul.se"). |

## Spelreglerna

- **Förvaltningen länkar inte för att marknadsföra oss** (objektivitetsprincipen, Jönköping
  12/10). Det vi ber om ska kunna erbjudas andra på samma villkor, till exempel en plats där
  flera kalendrar listas.
- **Allt blir allmän handling.** Skriv för diariet: saklig ton, siffror som stämmer och inga
  överdrifter. Ett medborgarargument tål att läsas av politiker och journalister.
- **Köp går via upphandlingsreglerna.** Kommunen avgör formen, och små belopp kan ofta köpas
  direkt. Vi pratar pris först när de frågar.
- **Destinationsbolag som är aktiebolag** har friare händer. Länkfrågan och betaltjänsterna
  går att ta upp som med övriga arrangörer.

## Trappan för kommuner

1. **Rätt data först.** Innan första mejlet: kolla hur kommunens evenemang ser ut på
   vadkul.se (arrangör, plats, dubbletter). Är kalendern en guide där föreningarna lägger in
   sina event är kommunen källan, inte arrangören.
2. **Ge först.** Mejla kultur- och fritidsförvaltningen med ortsrapporten, faktabladet och
   frågan om något ser fel ut. Ställ en enda fråga: vem är kontaktperson för kalendern? Ingen
   länkfråga.
3. **När de svarar:** erbjud (a) att föreningarna kan få tips om vadkul.se i kommunens
   föreningsinformation, bredvid andra kanaler, och (b) att vi hellre läser deras öppna data
   eller API än skrapar sajten. Båda kan sluta i en länk, men på sakliga grunder.
4. **Regionalt.** När två eller tre kommuner i samma län har svarat: kontakta regionens
   kulturförvaltning. Hela länet syns på en karta, kommunerna ser varandras utbud och kan
   inspireras av det.
5. **Betalt, bara när de frågar:** kommunens egen karta på deras sajt eller en årsrapport.

## Håll det enkelt, men ge dem argumenten

Mejlet ska vara kort: en gåva, en fråga. Djupet ligger i bilagorna. Den som svarar på en
kommun beslutar sällan själv, utan ska kunna föra det vidare till chef eller nämnd. Ge hen
underlag att argumentera med, skrivet så att det kan vidarebefordras som det är:

- **Ortsrapporten** (nedan): siffrorna för just deras kommun.
- **Ett faktablad på en sida**, samma för alla kommuner:
  - vad vadkul.se är: alla evenemang i en kommun på en karta, gratis för invånarna;
  - att alla arrangörer visas på samma villkor, oavsett storlek;
  - var datat kommer ifrån, och att varje evenemang länkar tillbaka till arrangörens sida;
  - hur fel rättas och hur föreningar lägger till egna evenemang;
  - att inga personuppgifter om besökarna lämnas ut;
  - kontaktuppgifter.

  Saklig ton, inga säljord. Det ska fungera i ett diarium och i en tjänsteskrivelse.

Hellre ett enkelt mejl som ger något än att sluta höra av sig. Ett nej på länkfrågan är inte
ett nej till kontakt.

## Mottagare och kopior

- **Rätt mottagare är kultur- och fritidsförvaltningen**, som ska stödja förenings- och
  kulturlivet. Kommunikationsenheten förvaltar webben och svarar utifrån länkpolicyn.
- **Ett mejl, en mottagare.** Sätt inte en annan förvaltning som kopia för att komma runt den
  som redan svarat, det läses som att gå över huvudet på hen. Fråga i stället vem som är rätt
  person, eller skriv ett nytt mejl i ett nytt ärende, till exempel med ortsrapporten.
- **Svara alla** när kommunens kontaktcenter eller registrator är med, så att ärendet hålls ihop.

## Ortsrapporten

Det vi ger kommunerna gratis. Inga personuppgifter, bara sammanställda siffror:

- Antal evenemang de kommande 30 dagarna, och per 10 000 invånare.
- Sammansättningen: lokala arrangörer, riksomfattande organisationer (församlingar,
  studieförbund, biblioteken) och biljettplattformar.
- Tomma dagar, och orter i kommunen med få eller inga evenemang.
- Grannkommunerna bredvid, som jämförelse och inspiration.
- Vilka kategorier som visas mest på kartan.

Exempel, Jönköping 12/10: drygt 600 evenemang de kommande 30 dagarna inom 15 km, från ett
80-tal arrangörer, och ungefär en fjärdedel från kommunens egna sidor.

**Byggd 13/10 som underlag på två A4-sidor med loggan**, ortsrapporten och faktabladet i samma
PDF. Bifoga den i mejlet till kultur- och fritidsförvaltningen. Kör i apps/scraper, helst på
minin där spegeln är färsk:

    npm run ortsrapport -- Eskilstuna --kalender=visiteskilstuna.se \
        --till="Kultur- och fritidsförvaltningen, Eskilstuna kommun"

Filerna hamnar i `docs/outreach/underlag/` (ej i git). Sidan 1: gissningsfrågan (vilken
veckodag händer minst?), antal evenemang, arrangörer, per 10 000 invånare, andelen från
kommunens kalender, vem som arrangerar, de största lokala arrangörerna (bara de med minst tre
evenemang, så att ingen privatperson namnges), kategorierna och grannorterna. Sidan 2: veckan
med svaret, faktabladet och tre förslag med kryssrutor (kontaktperson, tips i
föreningsinformationen, kalendern som öppna data) som de kan ta med till ett möte. Det är
"omröstningen": tjänstepersoner röstar inte om leverantörer, men de kan kryssa i vad de vill
göra. Kalla det underlag, inte motion; en motion lämnas bara av förtroendevalda.

Kolla listan över största arrangörer före utskick: står kommunens egen guide överst (som
Visit Eskilstuna före rättelsen 12/10) är det samma fel som i Eskilstunas svar.

## Mätetal

- Hur många kommuner som svarar och anger en kontaktperson.
- Hur många som nämner vadkul.se i föreningsinformation, på en evenemangssida eller en sida om
  öppna data. Det är länkarna.
- Hur många regioner vi har dialog med.
- Hur många som frågar efter betaltjänsten.

## Pilot

Fem kommuner: de med flest kommande evenemang där vi hittar en adress till kultur- och
fritidsförvaltningen. Eskilstuna är ett naturligt första val, efter rättelsen. Jönköping får
vila efter svaret; en ny kontakt, med ortsrapporten till kultur- och fritidsförvaltningen,
tidigast om några månader.
