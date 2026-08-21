# Arrangörs-outreach

Målet: **riktiga inlänkar** till vadkul.se (SEO-flaskhalsen är auktoritet, inte
teknik — 86 sidor låg "upptäckt – inte indexerad" 2026-07-15) + relationer med
arrangörerna vars event redan visas på kartan.

## Filerna

| Fil | Vad |
|---|---|
| [arrangorer.md](arrangorer.md) | Bocklistan — 120 arrangörer ur riktiga eventdatat, prioriterade i tre nivåer |
| [mail-mallar.md](mail-mallar.md) | Mall A (mejl), mall B (Facebook), uppföljning, stjärn-P.S., signatur |
| [facebook-poster.md](facebook-poster.md) | Inläggsutkast för "Vad händer i [stad]"-grupperna (privata kontot) |
| [gruppinlagg-2026-08-21.md](gruppinlagg-2026-08-21.md) | Färdiga gruppinlägg 21/8: Mariestad, Halmstad, Norrköping — 10 event per stad |
| [generate-arrangorer.mjs](generate-arrangorer.mjs) | Bygger om arrangorer.md ur `apps/web/public/events-*.json` — **skriver över ibockningarna**, kopiera undan dem först |

## Veckorutinen (≈30 min)

1. Öppna [arrangorer.md](arrangorer.md), ta **5–10 orörda** rader uppifrån
   (Prio 1 först).
2. Hitta kontaktvägen: gå till domänen i raden → "Kontakt"/"Om oss" → mejladress.
   Facebook-arrangörer (mall B): skriv till FB-sidan direkt.
3. Kopiera mallen, **byt ut första raden** mot något om just deras event
   (exempel-eventen står i raden) och klistra in rätt stadslänk.
4. Skicka från **info@vadkul.se** (Zoho). Ett mejl i taget — aldrig BCC.
5. Bocka i `- [x]`, fyll i `skickat: 2026-07-__`.
6. Efter 7–10 dagar utan svar: EN uppföljning (mallen finns), sen släpp.
7. När en länk är uppe: fyll i `länk:` — det är målraden.

## Stjärn-erbjudandet (morotslänken i mejlet)

`https://vadkul.se/?stjarna=ARRANGOR1` → arrangören skapar gratis konto,
öppnar sitt event, trycker ⭐ → **guld-bricka, alltid synlig på kartan tills
eventet ägt rum**. En stjärna per konto, server-säkrat. Attribution via
`starGiftCode: 'ARRANGOR1'` på user-dokumentet — så här räknar du nappen
(Firebase Console → Firestore → users, filtrera på fältet, eller be Claude).

## Avsändare

**info@vadkul.se** (Zoho — uppsatt 2026-07-16). Signaturen finns i
[mail-mallar.md](mail-mallar.md) → Inställningar → Signatur i Zoho.

## Vidarelänknings-statistiken (siffrorna till framtida mejl)

Varje ANMÄL-klick på ett eventkort räknas i Firestore-collectionen
**`eventStats`** (`recordEventClick` i `eventStatsService.ts`):

- `clicks` — totalt antal besökare vi skickat vidare till eventet
- `clicksByMonth` — `'2026-07': 12, '2026-08': 31 …` (tidsserien)
- `hostName` / `domain` / `title` — inbakade så statistiken kan summeras
  **per arrangör** även efter att eventet passerat och lämnat datat

**Så läser du dem:** Firebase Console → Firestore → `eventStats`, eller be
Claude summera per arrangör ("hur många klick har ABF fått totalt/per månad?").
Användning i uppföljningsmejl/nya mejl: _"Sedan i somras har vi skickat
**X besökare** vidare till era event via kartan."_ — konkret värde, svårslaget
argument för en länk tillbaka.

> OBS: räknaren kräver att firestore-reglerna deployats
> (`firebase deploy --only firestore:rules`) — före det faller skrivningarna
> tyst (medvetet: får aldrig störa utlänkningen).

## Varför detta är rätt fokus

- 10 riktiga länkar från arrangörer/kommuner/föreningar gör mer för
  indexeringen än någon kodändring (ung domän = crawl-budgeten styrs av
  auktoritet).
- Arrangören får något konkret först (gratis synlighet + stjärnan) →
  svarsfrekvensen blir bra.
- Långsvansen (Prio 3) är lokala föreningar — precis de länkar Google värderar
  för "vad händer i [stad]"-sökningar.
