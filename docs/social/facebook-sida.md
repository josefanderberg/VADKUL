# VADKUL:s egen Facebook-sida — manuella inlägg

Skiljer sig från [outreach/facebook-poster.md](../outreach/facebook-poster.md):
där postar **Josef privat** i andras grupper (och måste undvika att låta som
reklam). Här postar **varumärket på sin egen sida** — reklamkvoten är inte
problemet, tråkigheten är det.

**Sidan har redan en robot.** `publish-fb.ts` publicerar automatiskt kl 11
varje dag: fem kommande event formade som en "dagsresa" (morgon/dag/kväll) för
en dominerande stad. Ett manuellt inlägg ska därför INTE vara ännu en
eventlista för en stad — då konkurrerar vi med oss själva. Manuella inlägg gör
det roboten inte kan: se hela landet på en gång, eller berätta vad som hänt i
produkten.

**Tonregler (ärvda ur robotens prompt):** börja aldrig med "Häng med!", "Här är
dagens events" eller liknande. Var specifik — ort, tid, en detalj som bara
finns i just det eventet. Länken sist, hashtags sist.

---

## 1. "Sverige i helgen" — klart att posta fredag 7/8

Alla sex raderna faktakollade 7/8 mot koordinater och beskrivningar i
snapshoten (6/8 10:04). Helgtotalen (8–9/8) var **1 493 event** i datat.

> Nästan 1 500 saker händer i Sverige i helgen. Här är sex av dem, och
> tillsammans säger de något om landet:
>
> 🎸 Rockkwälln på Strandbackens Folkpark i Dala-Floda — hårdrock och metal i
> en folkpark, lördag 17.00
> 🚜 Tractorpulling i Siljegropen utanför Sundsvall — fullt ös på traktorerna,
> lördag 10.00
> 🚗 Augustifest-cruising i Smedjebacken — och Norrbärke kyrka kör drive
> in-vigsel igen, lördag 18.00
> ⚓ Kajkalaset i Tyrislöt — hamnen fyller 40 år med knallar, marknad och mat
> hela lördagen, fri entré
> 🎻 Musica Vitae i Linnéparken, Växjö — Mozart och Grieg under träden,
> lördag 19.00
> 🚶 "Kvinnorna som skapade Sverige" — historievandring från Nobelmuseet i
> Stockholm, lördag 13.00
>
> Metal i Dalarna, traktorer i Medelpad, drive in-vigsel i Smedjebacken. Det
> är svensk sommar, och den syns bäst på en karta.
>
> Hela helgen, hela landet, gratis: vadkul.se
>
> Vad blir det för er i helgen? 👇
>
> #vadkul #helgtips #vadhänder

**Varför den funkar:** småorterna är poängen. En lista med Stockholm, Göteborg
och Malmö hade sett ut som vilken evenemangssajt som helst — Dala-Floda och
Tyrislöt är beviset på att kartan faktiskt täcker landet. Drive in-vigseln är
inlägget delningsvärda detalj.

## 2. "Ni sa till, vi byggde om" — ⚠️ posta FÖRST efter `npm run repair-geo -- --apply`

Berättar om feedbacken ur Sundsvallstråden 6/8 och vad den ledde till. Namnge
INGEN — kommentarerna kom från privatpersoner i en grupp, de ska inte hängas
ut på sidan.

> Ett par personer i Sundsvall hörde av sig i veckan. Två kyrkor låg på fel
> plats på kartan, och kyrkoprogrammet de letade efter syntes inte alls.
>
> Båda hade rätt.
>
> Det första var en geokodningsbugg: en församling i Stockholm hade hamnat
> söder om Sundsvall, en i Krokom likaså. Fixat — och när vi började leta
> hittade vi fyra fel till av exakt samma sort.
>
> Det andra var klurigare. Svenska kyrkans och PRO:s arrangemang ligger
> avstängda som standard i kartans filter. Man kunde slå på dem, men fick
> göra om det vid varje besök. Nu sparas valet när du är inloggad — slår du
> på Svenska kyrkan en gång ligger det kvar.
>
> Så säg till: ligger något på fel plats där ni bor? Saknas en förening?
> Är något bara krångligt? Skriv en rad — det är precis så här kartan blir
> bättre.
>
> vadkul.se
>
> #vadkul

**Sanningskrav innan den postas:**

- `npm run repair-geo -- --apply` måste ha körts (aliastabellen är utbyggd
  7/8, men själva datat repareras först vid körning) — annars är "fixat" inte
  sant och någon kommer att kolla.
- Sparade kategorifilter ligger i main (6/8) men måste vara **deployat** till
  produktion innan påståendet stämmer.
