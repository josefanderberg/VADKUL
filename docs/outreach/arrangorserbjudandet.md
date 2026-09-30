# Arrangörserbjudandet

Hur arrangörerna kontaktas, vad de erbjuds och vad som kan bli betalt. Planen togs fram
29/9 2026 och det här dokumentet skrevs 30/9. Allt arbete sker i Vad kul-studion:
**vadkul.se/admin → Marknad**. Tekniken står i `vadkulyt/README.md` under Marknad.

## Målet

1. **Länkar tillbaka till vadkul.se** från arrangörernas sajter. Det är den största
   SEO-hävstången för en ung domän.
2. **Betalande arrangörer.** Gratis först, fråga om det betalda, och bygg det betalda först
   när någon har sagt ja. Priset är en gissning tills en arrangör har svarat.

Boost (99 kr per event och vecka) passar en förening med en konsert, men inte Visit
Linköping med hundratals event. Kommuner och destinationsbolag köper hellre en sak per år
som går att fakturera. Siffrorna är fortfarande blygsamma (Visit Linköping: cirka 1 500
visningar och 110 klick), så det som säljs är synlighet och en egen plats, inte klick.

## Trappan

| Steg | Innehåll | Pris | Läge 30/9 |
|---|---|---|---|
| 1. Gratis dörröppnare | Arrangörssida (`vadkul.se/arrangor/<namn>`) med alla deras event, och en månadsrapport med deras siffror. I utbyte: en länk från deras sajt. | 0 kr | Sidan live sedan 29/9. Månadsrapporten inte byggd. |
| 2. Arrangör Plus | Deras logga i brickan på kartan, klick på loggan visar alla deras event, "Följ arrangör" (notis om nya event), några boost-veckor ingår, mer statistik. | 300-500 kr/mån eller årspris | Bara filtret "visa alla deras event" (`?arrangor=`) finns. |
| 3. Karta på deras sajt | Inbäddad karta med "Drivs av vadkul.se". Arrangörsläge (deras egna event, del av Plus) eller stadsläge (allt i kommunen, egen affär med kommuner och destinationsbolag). | Några tusen kr/år | Inte byggt. |

## Vem får vad

Studion väljer mall själv och visar den ovanför texten ("Mall: …"). Antalen gäller 30/9.

| Segment | Antal | Kanal | Mejlet innehåller | Frågan om det betalda |
|---|---|---|---|---|
| Kommun eller destinationsbolag (Visit X, X kommun, X stad) | ~225 | Mejl | Arrangörssidan, siffrorna, be om en länk | En karta över allt som händer i orten på deras egen sajt, och en månadsrapport |
| Övriga arrangörer med arrangörssida | ~768 | Mejl | Arrangörssidan, siffrorna, be om en länk | Deras logga på kartan, och en månadsrapport |
| Facebook-arrangörer | ~257 | Messenger | Kort version av samma sak | Samma som deras typ |
| Svenska kyrkan, PRO, Korpen (ingen arrangörssida) | ~1 350 | Vänta | Bara att eventen finns med | Ingen. De är dolda som förval på kartan. Vänta tills erbjudandet är testat på de andra. |
| Privat adress (gmail, telia, hotmail …) | - | Mejl | Bara gratissidan | Ingen (se Juridik). Leta hellre upp föreningens egen adress. |

Siffrorna nämns bara när de är värda att visa: minst 50 visningar, och klicken bara från 10.

### Så är mejlet uppbyggt (1/10)

1. Hälsning och vem Josef är, med två av arrangörens **populäraste** kommande event som
   exempel (🔥 enligt kartans klassning först, sedan högst popularitetspoäng). Pipelinen
   väljer dem (`organizerStats` i apps/scraper), inte de närmaste i tid.
2. **Arrangörskortet:** deras sida på vadkul.se med knappen *Se er sida*. Hur många event de
   har på kartan **just nu** (och hur många av dem som är 🔥 populära) står för sig.
   Visningar och klick står för sig med bildtexten "för era event från den senaste månaden
   och framåt". Det är vad siffrorna mäter: totalt antal visningar och klick för event i
   spegelns fönster (30 dagar bak och alla kommande). Visningar har ingen dagshink, så en
   ren 30-dagarssiffra går inte att räkna ännu.
3. Sidan är gratis och uppdateras varje natt. Be om en länk.
4. **Paketen** ("Så kan ni få ut ännu mer av vadkul.se"):
   - **Gratis** (grå ruta): egen sida, länk vidare till deras sajt och biljetter, på kartan
     och stadssidorna.
   - **Arrangör Plus** (blå ruta): logga på kartan, event framlyfta hela veckan, följare får
     notis, månadsrapport.
   - **Karta på er egen sajt** (blå ruta, bara kommuner och destinationsbolag).
5. Frågan: "Vi öppnar Arrangör Plus för ett fåtal arrangörer först. Vill ni vara med från
   början? Svara bara på det här mejlet, så berättar jag mer och vad det kostar." Inget pris
   i första mejlet; det sätts när de första har svarat.
6. Rättelser och avregistrering, hälsning, signatur.

I studions textruta skrivs paketen som en **fetstilad** rad följd av rader som börjar med
"- ". **Förhandsvisa** visar hur det ser ut hos mottagaren.

## Så jobbar du i Marknad

1. **Välj arrangörer:** sortera på *Flest visningar*. Kolumnen ✓ visar vilka som har e-post.
   Börja med de största som har arrangörssida.
2. **Kolla adressen:** under e-postfältet står var den hittades. Öppna källan om du är osäker.
   Hembygdsföreningarnas adresser är ofta en styrelseledamots privata.
3. **Skriv om första raden personligt** och klicka **Skicka**, eller **Lägg som utkast i
   Zoho** om du vill se det där först. Facebook-arrangörer: **Kopiera texten**, skicka i
   Messenger och klicka **Markera som skickat**.
4. **Svar** syns i studion inom tio minuter (status Svarat). Läs och svara i Zoho, sätt
   sedan status **Positiv** (vill ha loggan, kartan eller rapporten) eller **Nej tack**, och
   skriv vad de sa under Anteckning.
5. **Följ upp:** filtret *Följ upp* visar de som fått mejl för minst en vecka sedan utan att
   svara. Studion föreslår en kort påminnelse. En påminnelse, sedan släpper du det.

Takt: högst 20 mejl om dagen. Studion stoppar vid 20.

## Regler

- Personliga mejl från josef@vadkul.se, ett i taget. Aldrig massutskick eller BCC.
- Varje första mejl har raden "Vill ni inte att jag hör av mig igen räcker det med ett kort
  svar." Den som tackar nej får status Nej tack, och studion skickar inte till dem.
- Högst en påminnelse.
- Månadsrapporten går bara till dem som sagt ja.
- Det betalda presenteras som nästa steg som öppnas för ett fåtal först, aldrig som något som
  redan finns att köpa. Inget pris förrän någon har svarat.
- Siffrorna knappas aldrig in för hand. De räknas varje natt av pipelinen.
- Visningssiffrorna visas aldrig publikt på vadkul.se, bara för arrangören själv.

## Juridik i korthet

Det här är ingen juridisk rådgivning, men det är utgångspunkten för mallarna:

- E-post till företag, föreningar och kommuner (juridiska personer) får användas i
  marknadsföring utan förhandssamtycke, men mottagaren ska enkelt kunna tacka nej. Det
  gör raden om att svara.
- Till privatpersoner, även enskild firma, krävs samtycke. Därför frågar studion inte om
  något betalt när adressen ser privat ut.
- Adresserna är hämtade från arrangörernas egna sajter och finns bara i studion. Ber någon
  om det: sätt Nej tack och töm e-postfältet.

## När någon säger ja

- Samla Positiv-svaren. När två eller tre vill ha samma sak: sätt pris och bygg.
- **Plus:** Stripe-abonnemang (månad eller år), med faktura som alternativ för kommuner.
  Loggan i brickan ska stämmas av mot kartans ägarbeslut i `.claude/skills/kart-ui/` först.
- **Karta på deras sajt:** räkna på kostnaden per kartvisning först. Alternativ: egna
  kartplattor, eller en lista med en statisk kartbild som öppnar kartan vid klick.
- **Månadsrapporten:** ett automatiskt mejl från studion till Positiv-arrangörerna.
  Datat finns redan (`arrangor_historik` i studion).

## Övriga intäkter

- **Boost:** 99 kr per event och vecka, live sedan 19/8 ([stripe-event-boost.md](../stripe-event-boost.md)).
- **Affiliate:** Ticketmaster via Impact, live sedan 31/8. Tiotals kronor i månaden med dagens
  trafik ([affiliate.md](../affiliate.md)).
- **Datalicens:** Voxcompanion (Guide My Trip) har pratat om 2 500-5 000 kr/mån och väntar
  tills de har egna kunder.

## Öppet

- Skicka de första 15-20 mejlen, störst först, och se vad som händer.
- Länkar med `?ref=mejl` för att se om mottagarna klickar (inte byggt).
- Studsade mejl (mailer-daemon) hanteras inte än.
- DMARC-post saknas för vadkul.se (`_dmarc.vadkul.se`, TXT `v=DMARC1; p=none`).
- Adress saknas för ~1 420 arrangörer på delade sajter utan egen undersida (Svenska kyrkan,
  Göteborgs kalender, biblioteken, Naturskyddsföreningen, Friluftsfrämjandet) och för ett
  tjugotal stora som bara har kontaktformulär (Linköpings kommun, Upplev Växjö, Visit Stockholm …).
