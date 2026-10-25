# iOS-appens lanseringsvideo (FB + IG)

Den korta vertikala filmen "VADKUL: Event nära dig – ny iOS-app" (7 s,
1080 × 1920) med inläggstexterna till Facebook-sidan och Instagram.
Beställt 26/10 2026: ut på Meta **26/10 kl 11:00**, med en rad om att
appen kommer till Android snart.

| Fil | Vad |
|---|---|
| `vadkul-ios-app.mp4` | Filmen. H.264 + tyst AAC-spår, gjord ur originalexporten (HEVC utan ljudspår) med ffmpeg — Metas reels-spec kräver AAC-ljud och H.264 tar alla deras vägar utan diskussion. Bildinnehållet är orört (crf 18). |
| `fb.txt` | Texten på Facebook-sidan (klickbar App Store-länk). |
| `ig.txt` | Bildtexten på Instagram (ingen klickbar länk → "sök i App Store") + seriens hashtaggar. |

Rösten är sidans "vi"/neutral (cityPostText.ts), inte maker-jaget. Avslutas
med en fråga, ett utropstecken max, emoji som radmarkörer — reglerna i
[../inlagg-plan.md](../inlagg-plan.md).

## Hur det publiceras

Workflown **Videoinlägg (FB + IG)** (`.github/workflows/videoinlagg.yml`,
kör `apps/scraper/src/scripts/schedule-video-post.ts`). Nycklarna är
GitHubs (samma probe som stadsinläggen); minin behövs inte.

1. **Facebook** schemaläggs hos Meta i förväg (`lage=fb`, `commit=true`,
   `klockan=2026-10-26 11:00`): videon laddas till Storage
   (`marketing-videos/`), `/videos` får `scheduled_publish_time`. Syns i
   Business Suite → Planner fram till publiceringen.
2. **Instagram** kan inte schemaläggas via API. Körningen `lage=ig` startas
   i stället strax före klockslaget (≤ 45 min): reel-containern skapas och
   bearbetas direkt, sedan väntar jobbet till utsatt tid och publicerar.
   Har klockslaget passerat med mer än 60 min avbryts den (färskvara).
   Startas den manuellt: Actions → Videoinlägg → `lage=ig`, `commit=true`,
   samma `klockan`. Vill man posta NU oavsett klockslag: `nu=true`.

`lage=kolla` (default) publicerar inget: visar sidtokenens scopes
(`publish_video` krävs för FB-video, `instagram_content_publish` för IG),
IG-kontot och planen.

## När Android-appen är ute

Byt raden "Har du Android? Appen kommer dit snart." mot Play-länken
(`https://play.google.com/store/apps/details?id=se.vadkul.app`) och kör
ett nytt inlägg — eller ett eget Android-inlägg med samma film.
