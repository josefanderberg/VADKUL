# Arrangörs-outreach

Målet: **riktiga inlänkar** till vadkul.se (SEO-flaskhalsen är auktoritet, inte
teknik — 86 sidor låg "upptäckt – inte indexerad" 2026-07-15) + relationer med
arrangörerna vars event redan visas på kartan.

## Filerna

| Fil | Vad |
|---|---|
| [arrangorer.md](arrangorer.md) | Bocklistan — 120 arrangörer ur riktiga eventdatat, prioriterade i tre nivåer |
| [mail-mallar.md](mail-mallar.md) | Mall A (mejl), mall B (Facebook), uppföljning, stjärn-P.S., signatur |
| [generate-arrangorer.mjs](generate-arrangorer.mjs) | Bygger om arrangorer.md ur `apps/web/public/events-*.json` — **skriver över ibockningarna**, kopiera undan dem först |

## Veckorutinen (≈30 min)

1. Öppna [arrangorer.md](arrangorer.md), ta **5–10 orörda** rader uppifrån
   (Prio 1 först).
2. Hitta kontaktvägen: gå till domänen i raden → "Kontakt"/"Om oss" → mejladress.
   Facebook-arrangörer (mall B): skriv till FB-sidan direkt.
3. Kopiera mallen, **byt ut första raden** mot något om just deras event
   (exempel-eventen står i raden) och klistra in rätt stadslänk.
4. Skicka från **josef@vadkul.se** (Zoho, se nedan). Ett mejl i taget — aldrig BCC.
5. Bocka i `- [x]`, fyll i `skickat: 2026-07-__`.
6. Efter 7–10 dagar utan svar: EN uppföljning (mallen finns), sen släpp.
7. När en länk är uppe: fyll i `länk:` — det är målraden.

## Stjärn-erbjudandet (morotslänken i mejlet)

`https://vadkul.se/?stjarna=ARRANGOR1` → arrangören skapar gratis konto,
öppnar sitt event, trycker ⭐ → **guld-bricka, alltid synlig på kartan tills
eventet ägt rum**. En stjärna per konto, server-säkrat. Attribution via
`starGiftCode: 'ARRANGOR1'` på user-dokumentet — så här räknar du nappen
(Firebase Console → Firestore → users, filtrera på fältet, eller be Claude).

## Zoho-mejlen (engångs-setup, ~15 min)

1. [zoho.com/mail](https://zoho.com/mail) → Business Email → **Forever Free**
   (1 domän, 5 konton, 5 GB — räcker gott).
2. Lägg till domänen `vadkul.se`, verifiera med TXT-posten Zoho ger.
3. Skapa **josef@vadkul.se** (personlig avsändare får fler svar än info@).
4. DNS: MX (`mx.zoho.eu` 10, `mx2.zoho.eu` 20, `mx3.zoho.eu` 50) + SPF
   (`v=spf1 include:zoho.eu ~all`) + DKIM-posten Zoho genererar.
5. Inställningar → Signatur → klistra in HTML-signaturen ur
   [mail-mallar.md](mail-mallar.md).

## Varför detta är rätt fokus

- 10 riktiga länkar från arrangörer/kommuner/föreningar gör mer för
  indexeringen än någon kodändring (ung domän = crawl-budgeten styrs av
  auktoritet).
- Arrangören får något konkret först (gratis synlighet + stjärnan) →
  svarsfrekvensen blir bra.
- Långsvansen (Prio 3) är lokala föreningar — precis de länkar Google värderar
  för "vad händer i [stad]"-sökningar.
