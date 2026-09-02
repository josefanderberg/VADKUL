# Instagram-publicering: behörigheterna som saknas

**Status 2026-09-02: FORTFARANDE BLOCKERAT — och ingen ny token har någonsin
landat.** Token som ligger på MacBooken (`apps/scraper/.env`,
`apps/web/.env.local`) och på minin (`~/.vadkul-secrets/env`) är en och
samma, utfärdad 2026-08-20 10:52 UTC, med exakt de fyra scopes som listas
nedan. Så vad som än gjorts i Metas gränssnitt sedan dess har inget nytt
sparats där jobbet läser. Allt annat i kedjan är verifierat friskt 2/9:
FB-inläggen går ut på sina tider, annonsbilden bygger (1080×1080, JPEG via
sips), Storage-uppladdningen funkar, kön fylls. Det ENDA som fattas är
tokenen.

Facit-kommandot efter tokenbytet — det ska köras **på minin** (det är den
som kör timjobbet och den vars `~/.vadkul-secrets/env` gäller):

```sh
ssh mini 'cd ~/Repos/VADKUL/apps/scraper && export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH \
  && npx ts-node src/scripts/publish-ig-queue.ts --kolla \
  && npx ts-node src/scripts/publish-ig-queue.ts --publicera --tvinga=2026-09-02'
```

`--tvinga=<datum>` skjuter ut dagens poster även om de hunnit markeras
`förfallen` (6 h-regeln), publicerade rörs aldrig. Den finns för exakt det
här läget: token lagas mitt på dagen och morgonens tre ska ändå ut.

**Status 2026-08-26: BLOCKERAT.** Sidans access-token har bara
`pages_show_list, pages_read_engagement, pages_manage_posts, public_profile`.
För Instagram krävs dessutom **`instagram_basic`** och
**`instagram_content_publish`**. Utan dem svarar Meta:

```
(#10) Application does not have permission for this action
```

Det är samma orsak som gjorde att den dagliga 10-listan aldrig kom ut på
Instagram — i loggen syns det som `[IG] 0 carousel-items skapade` varje
morgon, medan Facebook-halvan gick igenom. Facebook har alltså fungerat hela
tiden, Instagram inte.

Kolla nuläget när som helst:

```sh
cd apps/scraper && npm run ig-ko -- --kolla
```

## Så förnyas token (~10 minuter, kräver ägarens Meta-inloggning)

Jag kan inte göra det här steget — det sker i Metas inloggade gränssnitt och
resultatet är en hemlighet som bara ska passera dina händer.

1. **Kontrollera förutsättningarna** på
   [business.facebook.com](https://business.facebook.com):
   Instagram-kontot `@vadkul.se` ska vara ett **Business- eller
   Creator-konto** och vara kopplat till Facebook-sidan **Vadkul**. Ett
   privat IG-konto kan inte publiceras till via API.

2. **Lägg till produkten i appen.** I
   [developers.facebook.com/apps](https://developers.facebook.com/apps) →
   appen *VADKUL* → *Lägg till produkt* → **Instagram Graph API** (heter
   "Instagram" i nyare gränssnitt).

3. **Hämta en användartoken med rätt behörigheter** i
   [Graph API Explorer](https://developers.facebook.com/tools/explorer):
   välj appen *VADKUL*, klicka *Generate Access Token* och kryssa i
   samtliga:

   ```
   pages_show_list
   pages_read_engagement
   pages_manage_posts
   instagram_basic
   instagram_content_publish
   ```

4. **Växla upp till en långlivad token.** Klistra in den korta token i
   Explorer och kör:

   ```
   GET /oauth/access_token
       ?grant_type=fb_exchange_token
       &client_id=<APP-ID>
       &client_secret=<APP-SECRET>
       &fb_exchange_token=<KORT-TOKEN>
   ```

5. **Hämta SIDANS token** med den långlivade användartoken:

   ```
   GET /me/accounts
   ```

   Fältet `access_token` för sidan *Vadkul* är den som ska sparas. En
   sidtoken som hämtats med en långlivad användartoken går inte ut.

6. **Spara den** i `~/.vadkul-secrets/env` **på minin** (`ssh mini`, user
   `ai`) — det är den filen timjobbet läser. Ersätt raden som finns:

   ```
   FB_PAGE_TOKEN="<ny sidtoken>"
   ```

   Vill du kunna köra `--kolla`/`--provkör` från MacBooken också: byt även
   `FB_PAGE_TOKEN` i `apps/scraper/.env` och `FB_PAGE_ACCESS_TOKEN` i
   `apps/web/.env.local` (samma värde). MacBooken saknar
   `~/.vadkul-secrets/env`.

   **Vanliga fällor när "vi har försökt flera gånger" inte ger något:**
   - Sidtoken hämtad med en GAMMAL användartoken ärver gamla scopes. Steg 5
     måste köras med den nya långlivade token från steg 4.
   - Rutorna `instagram_basic` + `instagram_content_publish` måste vara
     ikryssade INNAN du klickar *Generate Access Token* — dyker de inte upp
     i listan saknas Instagram-produkten i appen (steg 2).
   - Token sparad på fel maskin (MacBooken) medan jobbet kör på minin.
   - Verifiera med `debug_token` (det `--kolla` gör): står inte båda
     IG-scopes i listan är det fortfarande fel token, oavsett vad
     Explorer visade.

7. **Verifiera** — båda ska vara gröna:

   ```sh
   cd apps/scraper
   npm run ig-ko -- --kolla       # behörigheter + att IG_USER_ID stämmer
   npm run ig-ko -- --provkör     # bygger bild + IG-container, publicerar INTE
   ```

   `--provkör` skapar en container hos Meta men hoppar över publiceringen,
   så inget hamnar i flödet. Går den igenom fungerar hela kedjan.

## Vad som händer sedan

`se.vadkul.ig-queue` kör varje hel timme 06–21 och publicerar det som
förfallit i `apps/scraper/ig-queue.json`. Så snart token är på plats går
inläggen ut vid sina schemalagda tider, i takt med FB-tvillingarna.

En post som blivit mer än 6 timmar gammal markeras `förfallen` i stället för
att publiceras (utils/igQueue.ts). Dröjer token-fixen förbi ett inläggs
tidpunkt går just det inlägget alltså aldrig ut på Instagram — resten står
kvar i kön. Kön syns med `npm run ig-ko`.

## Relaterat fynd: CARTO kräver API-nyckel

Kartbilderna (`/api/marketing/ad-plats`, och stadssidornas hero-karta i
`CityMapHero.tsx`) hämtar rastertiles från `basemaps.cartocdn.com`. CARTO
kräver numera API-nyckel och levererar annars kakel med **"API KEY
REQUIRED"** tvärs över kartan — verifierat 2026-08-26, oavsett referer.

Stadsinläggens IG-bild använder därför den brandade annonsbilden
(`/api/marketing/ad/<slug>`, ren vektorgrafik utan externa kakel) i stället.
Kartvarianten är fortfarande fallback för orter utan stadssida, och den är
inte publicerbar förrän nyckeln är på plats.
