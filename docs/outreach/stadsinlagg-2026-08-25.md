# Stadsinlägg tis 25/8 — Helsingborg, Falun, Mora (kl 6, 7, 8)

Dag 3 efter [stadsinlagg-2026-08-24.md](stadsinlagg-2026-08-24.md).
Flyttade från 24/8 (dagen var redan full med Ystad/Göteborg/Haparanda) och
**alla måndagsrader är utbytta** — inlägget publiceras på tisdagen.

**Nytt från och med nu (ägarbeslut 24/8): Facebook får REN TEXT — ingen
bild, ingen länkförhandsvisning.** `schedule-city-posts.ts` är ändrad och
schemalägger utan bild. De genererade kartbilderna används enbart till
Instagram (URL:er nedan, manuell IG-publicering tills vidare).

## ✅ REDAN SCHEMALAGT — kör INTE skriptet (dubbelpostrisk)

Samtliga inlägg i den här filen publicerades/schemalades direkt via Graph
API (ren text, utan bild) 2026-08-24 ~07:35. De ligger i Sidans schemakö
(Business Suite → Planner). Texterna nedan = det som postas.

Permalänkar (för Dela → Dela i en grupp efter publicering):
- Helsingborg: https://www.facebook.com/122131945197235371/posts/122131945263235371
- Falun: https://www.facebook.com/122131945197235371/posts/122131945287235371
- Mora: https://www.facebook.com/122131945197235371/posts/122131945341235371

(Mora gick också in via Graph API — skriptets Mora→Hedemora-matchningsbugg
kringgicks helt; fixen ligger som separat uppgift.)

## Kurateringsnoter (varför texterna avviker från skriptets råtext)

- **Falun:** råtexten domineras av Borlänge-rutiner (25 km-radien når hela
  Borlänge). Texten nedan är Falun-centrerad; enda Borlänge-raden är
  Juholt-kvällen (medvetet — publikvärde).
- **Helsingborg:** skriptet missade Thomas Stenström, Fest på kajen och
  Gåsebäck Film Festival. Struket: "Helsingborg för ett fritt Palestina"
  (demonstration — sidan listar inte politiska manifestationer),
  "Balett prova på 25/8" (titel-datum motsäger datats onsdag — datastrul),
  "Linedance — Landskrona" (svag).
- **Mora:** råtexten var rutiner (Återbyggdepåns öppettider, Gubbfrukost,
  körövningar). Kurerad vinkel: friluft + kulturarv.
- Måndagsrader från 24/8-utkastet ersatta: Helsingborg TIKVA → Bamse 60 år
  (Höganäs, lördag); Falun Akvarell-prova-på flyttad till onsdagspasset
  (finns i datat 26/8 kl 17.30); Mora Via Dolorosa → tisdagsraden,
  Huskyäventyret (fanns bara måndag) struket.

## IG-bilder (används INTE på FB)

- Helsingborg: `https://vadkul.se/api/marketing/ad-plats?lat=56.0500&lng=12.6900&namn=Helsingborg&radie=25&stil=annons`
- Falun: `https://vadkul.se/api/marketing/ad-plats?lat=60.6100&lng=15.6300&namn=Falun&radie=25&stil=annons`
- Mora: `https://vadkul.se/api/marketing/ad-plats?lat=61.0100&lng=14.5400&namn=Mora&radie=25&stil=annons`

Helsingborg och Falun har stadssidor (`/evenemang/helsingborg`,
`/evenemang/falun`) — länkarna i texterna pekar dit. Mora saknar →
`vadkul.se`.

---

## Helsingborg — kl 06:00 (397 event inom 25 km)

2 grupper att dela in i: "Det händer i Helsingborg", "Vad händer i Helsingborg?"

```
Veckan i Helsingborg 👇

🎨 Sofieros levande arv – guidning i sensommarblom — Sofiero slott (onsdag kl 13.30)
🎵 Succén är tillbaka – Pontus på stranden! — Drottninggatan 95 (onsdag kl 18)
🎭 Stand-up vid havet — Parapeten (torsdag kl 19.30)
🎵 Thomas Stenström — Ångfärjeparken (fredag kl 18)
👨‍👩‍👧 Bamse fyller 60 år — Höganäs (lördag kl 11)
🎉 Fest på kajen 2026 — Ångfärjeparken (lördag kl 18)
✨ Gåsebäck Film Festival — Röda Kvarn (söndag kl 14)

Och nästa vecka:
🎭 Författarafton med Horace Engdahl — Höganäs bibliotek (tisdag 1/9 kl 19)
🎵 QUILTY — Vinylbaren, The Tivoli (torsdag 3/9 kl 19.30)
🎨 Landskrona Foto Festival — invigning (fredag 4/9 kl 12)
🎭 Billy Elliot (lördag 5/9 kl 13.30)
👨‍👩‍👧 Rydebäcksdagen — Rydebäcks kyrka (söndag 6/9 kl 11)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se/evenemang/helsingborg

Vad blir det för er? 👇
```

## Falun — kl 07:00 (180 event inom 25 km, Falun-kurerat)

```
Vad händer i Falun den här veckan? 👇

🎨 Akvarell- och akrylmålning – prova på (onsdag kl 17.30)
🎵 En kväll med sill & nubbe med Håkan Juholt — Äteriet Hantverksbyn (onsdag kl 18)
🎵 FaluFolkFredag: Esbjörn Hazelius & Johan Hedin (fredag kl 17.30)
🎨 The Dala horse – guided tour + decorate your own horse (lördag kl 14)
🎵 Kulturlördag: Grabbarna från Eken tolkar Olle Adolphsson — Hjorthagskyrkan (lördag kl 15)
🎵 Julia Siraj — Rökbacken (lördag kl 22)
🎨 Arkeologidagen: Dolda spår — Dalarnas museum (söndag kl 12)

Och nästa vecka:
🎨 Konstnären Anders Zorn – världsman och morakarl — Dalarnas museum (onsdag 2/9 kl 17.30)
✨ Debatt: Världsarvet Falun (torsdag 3/9 kl 18)
🎭 Granny Goes Street 2026 — Dalateatern (lördag 5/9 kl 11)
🎵 Borlänge Jazz Open — Folkets Park (lördag 5/9 kl 14)
🎉 Prideparty på Backyard — Backyard Club (lördag 5/9 kl 21)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se/evenemang/falun

Vilken av dem lockar mest? 👇
```

## Mora — kl 08:00 (56 event inom 25 km)

```
Det händer mer i Mora än man tror 👇

🎨 Via Dolorosa – utställning — Mora kyrka (tisdag kl 9)
👨‍👩‍👧 Träffa familjen Matz (tisdag kl 14)
🤝 Afternoon Ice Tea — Kaplansgatan 14, Orsa (tisdag kl 14.30)
⚽ Forspaddlingskurs för nybörjare — Kajaktiv (onsdag kl 17)
⚽ Tennis på studs — Sporthallen (fredag kl 15)
✨ Svampexkursion — Siljansfors skogsmuseum (söndag kl 9)

Och nästa vecka:
✨ Hej Orsa! Upptäck mer av vår bygd (måndag 31/8 kl 9)
⚽ Dogscooter – huskyäventyr med Måseks (tisdag 1/9 kl 14)
✨ Guidad vandring till Njupeskär och Old Tjikko — Särna Adventures (fredag 4/9 kl 14)
🎨 Immateriellt kulturarv på Kaplagården Mora (lördag 5/9 kl 11)
✨ Svampens dag — Naturskyddsföreningen i Orsa (söndag 6/9 kl 10)

Allt kommer från vadkul.se — kartan där det som händer samlas på ett
ställe i stället för utspritt på tio olika sidor. Gratis, inget konto
behövs för att titta: https://vadkul.se

Vad har vi missat? Tipsa i kommentarerna 👇
```

---

Efter publicering: permalink → Dela → Dela i en grupp (Helsingborg har två
registrerade grupper; Falun/Mora-grupper söks upp manuellt). Svara på varje
kommentar första dygnet.
