# Arrangörs-outreach

Målet: **länkar tillbaka** till vadkul.se (SEO-flaskhalsen är auktoritet, inte teknik) och
**betalande arrangörer**. Planen, vem som får vilket erbjudande och reglerna står i
[arrangorserbjudandet.md](arrangorserbjudandet.md).

## Var arbetet görs

Allt sker i Vad kul-studion: **vadkul.se/admin → Marknad**.

- Registret över arrangörerna, med visningar, klick och gillningar från nattkedjan
  (`npm run organizer-stats` i apps/scraper). Siffrorna knappas aldrig in för hand.
- E-postadresserna fylls i automatiskt från arrangörernas sajter, med källan synlig.
- Mejlen skickas från **josef@vadkul.se** via Zoho Mail, med förslag anpassade efter
  arrangörstyp. Facebook-arrangörerna får en Messenger-text.
- Svar och mejl som skickats direkt i Zoho synkas var tionde minut och flyttar statusen.
- Filtret *Följ upp* visar vem som ska få en påminnelse.

Tekniken står i `vadkulyt/README.md` under Marknad.

## Äldre filer (juli-augusti)

Från tiden före studion. Läs dem som historik; studion har tagit över.

| Fil | Vad |
|---|---|
| [arrangorer.md](arrangorer.md) | Bocklistan från juli. De tio som bockades av finns med som Skickat i studion. |
| [forsta-10-mejlen.md](forsta-10-mejlen.md) | De första tio mejlen, skickade 17/7 från info@vadkul.se. |
| [mail-mallar.md](mail-mallar.md) | Julimallarna och HTML-signaturen. Studion har egna mallar nu. |
| [facebook-poster.md](facebook-poster.md) | Inlägg för "Vad händer i [stad]"-grupperna (privata kontot). |
| [generate-arrangorer.mjs](generate-arrangorer.mjs) | Byggde arrangorer.md. Används inte längre. |

## Stjärn-erbjudandet (valfri P.S.)

`https://vadkul.se/?stjarna=ARRANGOR1`: arrangören skapar ett gratis konto, öppnar sitt event
och trycker ⭐. Eventet får en guldbricka och syns alltid på kartan tills det har ägt rum.
En stjärna per konto, server-säkrat. Koden ligger i `STAR_GIFT_CODES` i functions, och
`starGiftCode: 'ARRANGOR1'` på user-dokumentet visar vilka som nappade. Den finns inte med i
studions mallar, men går att lägga till som P.S. när det passar.
