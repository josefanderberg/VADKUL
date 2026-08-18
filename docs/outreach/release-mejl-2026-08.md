# Release-mejlet augusti 2026 — nyheter + boost + STJARNA2

**STATUS: UTKAST — inget skickat, inget schemalagt.** Uppföljaren till
[medlemsutskicket 28/7](medlemsmejl.md) (MEDLEM1, 166 mottagare, 6 inlösta).
Samma avsändare (**hej@vadkul.se**, "Josef på VADKUL"), samma kanal (**Zoho
Campaigns**, aldrig vanliga Zoho Mail), samma personalisering
(`$[FNAME|där]$` — bara i hälsningen).

Kampanjkod: **STJARNA2** — egen kod så attributionen kan skiljas från MEDLEM1/
STJARNA1/ARRANGOR1 (Firestore `users.starGiftCode == 'STJARNA2'`).

## Före utskick — checklista

- [ ] **STJARNA2 finns INTE i koden ännu.** Lägg till i `STAR_GIFT_CODES` i
      `apps/functions/src/index.ts` (rad ~126, idag `['STJARNA1', 'ARRANGOR1',
      'MEDLEM1']`) och deploya `firebase deploy --only functions:redeemStarGift`
      — annars studsar länken för alla mottagare.
- [ ] **Priserna är platshållare.** Alla belopp står som `[PRIS: …]` i mejlet —
      byt mot de riktiga innan utskick.
- [ ] **Boost-nivåerna:** koden har idag EN nivå (`BOOST_DAYS = 7`, ett enda
      `STRIPE_BOOST_PRICE_ID`). Tre nivåer (1 dag/1 vecka/1 månad) kräver tre
      Stripe-priser + val i checkout-flödet — skeppa det, eller skala ner
      mejltexten till det som är live.
- [ ] **Notis-tidpunkterna:** mejlet lovar upp till 4 notiser (8 h/3 h/1 h/vid
      start) enligt ägarbeslut; koden skickar idag EN påminnelse (1 h före,
      `eventReminders` i functions). Skeppa stegen eller justera meningen.
- [ ] Bygg om medlemslistan strax före utskick (`build-medlemslista.mjs`,
      se medlemsmejl.md steg 0) — city-kolumnen fylls på av sig själv.
- [ ] Behåll Campaigns avregistreringsfot. Skicka vardagkväll 19–20 eller
      söndag kväll.

## Ämnesrad

**Förstaval:**

- `Nytt på VADKUL: din stad har fått en egen sida — och du en ny stjärna ⭐`

**Alternativ (A/B-testa i Campaigns):**

- `$[FNAME|Hej]$, mycket nytt på kartan sedan sist ⭐`
- `VADKUL har uppdaterats — stadssidor, notiser och en gåva till dig`

## Preheader

> Stadssidor med levande karta, sök bland 291 orter, notiser på event — och en
> ny guldstjärna att lösa in.

## Mejlet

> Hej $[FNAME|där]$!
>
> Det var ett tag sedan sist — och det har byggts en hel del på **vadkul.se**.
> Här är det viktigaste, kort och gott:
>
> **Nytt på kartan sedan sist**
>
> - 🗺️ **Din stad har fått en egen sida** — med en levande karta högst upp.
>   Bläddra dag för dag och se allt som händer nära dig:
>   [vadkul.se/evenemang](https://vadkul.se/evenemang)
> - 🔍 **Sök din ort** — sökrutan hittar nu **291 orter**, från Stockholm till
>   Vimmerby, och flyger dit direkt.
> - 📅 **Kalendern bor nu uppe i kartan** — byt dag med pilarna, hoppa via
>   kalendern eller zooma ut och se hela veckan på en gång.
> - 🔔 **Notiser!** Slå på påminnelser på event du gillar — upp till fyra:
>   8 h, 3 h och 1 h före, och en när det börjar. Du missar inget.
> - 💡 Dessutom: **tipsa om event utan konto**, och dina kategorifilter sparas
>   till nästa besök.
>
> **Nyhet: Boosta ditt event 🚀**
>
> Arrangerar du något — eller har du skapat ett event på kartan? Nu kan du
> **boosta** det: eventet får en **guldmarkör** och ligger **alltid synligt på
> kartan**, före allt annat, så länge boosten varar.
>
> - **1 dag** — [PRIS: 99 kr] — upp till **100× fler visningar**
> - **1 vecka** — [PRIS: 299 kr] — upp till **1000× exponering** och
>   **100× fler anmälda**
> - **1 månad** — [PRIS: 795 kr] — upp till **1000× exponering** och
>   **100× fler anmälda**
>
> Öppna ditt event på kartan och tryck på **Boosta** — klart på en minut.
>
> **Och en gåva till dig ⭐**
>
> Som tack för att du är med får du en **ny guldstjärna** — en gratis
> 1-dagars boost till valfritt event. Så här använder du den:
>
> 1. Öppna [vadkul.se/?stjarna=STJARNA2](https://vadkul.se/?stjarna=STJARNA2)
>    och logga in
> 2. Öppna valfritt event på kartan — kanske något du själv ska på?
> 3. Tryck på ⭐
>
> Eventet får guldmarkör och syns för alla i ett helt dygn. Du har en
> stjärna, så välj med omsorg 😊
>
> Tack för att du är med!
>
> /Josef, som bygger VADKUL på kvällar och helger

*(Campaigns lägger själv på avregistreringslänken i sidfoten — låt den vara.)*

## HTML-versionen

[release-mejl-2026-08.html](release-mejl-2026-08.html) — mejlklient-säker
(tabellayout, inline-CSS, max 600 px, inga bilder — logotypen är text).
Klistra in i Campaigns HTML-editor. Merge-taggen `$[FNAME|där]$` står redan i
hälsningen. Prisplatshållarna är gulmarkerade i HTML:en så de inte kan missas.

## Vad som medvetet INTE är med

- **Livebilder** — panelen togs bort från eventkortet 5/8 (c3f8cfe).
- **Önska event ✨** — nämndes redan i 28/7-mejlet, inte nytt sedan sist.

## Efteråt

- Öppnings-/klicksiffror: Campaigns-rapporten.
- Inlösta stjärnor: Firestore `users` → `starGiftCode == 'STJARNA2'`.
- Boost-köp: `boostPayments`-collectionen + Stripe-dashboarden.
