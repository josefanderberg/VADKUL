# Mejlmallar — arrangörs-outreach

Tre mallar + stjärn-erbjudandet som P.S. Skicka från **info@vadkul.se** (Zoho)
med signaturen nedan. **Personifiera alltid första raden** — nämn deras
event/stad (exempel-eventen står i [arrangorer.md](arrangorer.md)). Aldrig
masskopia, aldrig BCC-listor: 5–10 mejl i veckan, ett i taget.

> FB-gruppinlägg (privata kontot) ligger separat:
> [facebook-poster.md](facebook-poster.md).

---

## Mall A — arrangör med egen webbplats (mejl)

**Ämne (välj/variera):**
- `Era event finns redan på VADKUL – en liten grej`
- `[Arrangör] – era event syns på Sverigekartan 🗺️`

> Hej [namn / "hej [Arrangör]"]!
>
> Jag heter Josef och driver **vadkul.se** – en gratis karta över allt som
> händer i Sverige. Era evenemang finns redan med (helt gratis!), till exempel
> **[exempel-event från listan]** – och folk hittar er den vägen.
>
> Kika här: **[länk till deras stad/event, t.ex. https://vadkul.se/evenemang/uppsala]**
>
> Om ni tycker det är användbart skulle det hjälpa oss jättemycket med en
> liten länk till vadkul.se från er webbplats – t.ex. under "länkar" eller när
> ni tipsar om evenemang. Fler upptäcker då både er och kartan.
>
> **P.S.** Som tack får ni gärna lyfta fram ett av era event på kartan:
> öppna **https://vadkul.se/?stjarna=ARRANGOR1**, skapa ett gratis konto,
> öppna ert event och tryck på ⭐. Eventet får då en guldmarkör och är
> **alltid synligt på kartan ända tills det ägt rum** – fler visningar, helt
> gratis.
>
> Tack för att ni gör [stad] roligare!
>
> Vänliga hälsningar,
> Josef

---

## Mall B — Facebook-arrangör (kort, via FB-sidan/Messenger)

> Hej! Jag driver **vadkul.se** – en gratis karta över allt som händer i
> Sverige. Era event (t.ex. **[exempel-event]**) finns redan med, helt gratis:
> [länk till staden]. Vill ni lyfta fram ett av dem? Öppna
> vadkul.se/?stjarna=ARRANGOR1, skapa gratis konto och tryck ⭐ på ert event –
> guldmarkör och alltid synligt tills eventet ägt rum. Och delar ni länken
> vidare blir vi bara glada! 🙌 /Josef

---

## Uppföljning (7–10 dagar utan svar, EN gång)

**Ämne:** `Re: [samma som förra]`

> Hej igen!
>
> Bara en vänlig knuff – era event ligger fortfarande gratis på
> **vadkul.se** ([länk]). Stjärnan (guldmarkör på valfritt eget event) väntar
> också: https://vadkul.se/?stjarna=ARRANGOR1
>
> Inget svar behövs om det inte är aktuellt – tack för det ni gör!
>
> /Josef

---

## Stjärn-erbjudandet — så funkar det (för dig, inte i mejlet)

- Länken `vadkul.se/?stjarna=ARRANGOR1` ger **ett konto EN stjärna** (engångs
  per konto, server-säkrat — går inte att fuska).
- Arrangören loggar in → öppnar sitt event på kartan → trycker ⭐.
- Eventet får **guld-bricka + alltid synligt + representant i sin grupp**
  tills eventet passerat. (Vi säger "alltid synligt tills det ägt rum" —
  starkare än "24 timmar".)
- Attribution: kontots `starGiftCode` blir `ARRANGOR1` → vi kan räkna hur
  många arrangörer som nappade (skilt från STJARNA1-kampanjen).
- Koden är hårdkodad i `apps/functions/src/index.ts` (`STAR_GIFT_CODES`).

## Signatur (klistra in i Zoho → Inställningar → Signatur, HTML-läge)

```html
<table cellpadding="0" cellspacing="0" style="font-family:Arial,Helvetica,sans-serif;color:#1e293b;font-size:14px;line-height:1.5">
  <tr>
    <td>
      <strong style="color:#006AA7;font-size:15px;letter-spacing:.3px">Josef Anderberg</strong><br>
      <span style="color:#64748b">VADKUL – hitta events nära dig</span><br>
      <a href="https://vadkul.se" style="color:#006AA7;text-decoration:none;font-weight:bold">vadkul.se</a>
    </td>
  </tr>
</table>
```
