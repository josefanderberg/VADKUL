# VADKUL-skills

Det finns ingen central `skills.md` — varje skill är en egen mapp med en `SKILL.md`:

```
.claude/skills/
├── deploy/SKILL.md      Manuella deployflödet + alla deploy-gotchas
├── pipeline/SKILL.md    Skrapning, stamped(), sync-to-sqlite → aggregate, nattjobbet
├── dev-miljo/SKILL.md   En dev-server-regeln, .next-cache, node-version, full disk
└── kart-ui/SKILL.md     Kartans designregler + fattade ägarbeslut
```

## Hur de används

- **Automatiskt**: Claude läser alla skills `description`-rader varje session och laddar
  rätt skill när uppgiften matchar. Du behöver alltså inte nämna dem.
- **Manuellt**: skriv `/deploy`, `/pipeline`, `/dev-miljo` eller `/kart-ui` för att
  tvinga in en skill i kontexten.

## Så promptar du bäst

- Korta prompter räcker nu — "deploya fixen" laddar deploy-skillen med alla gotchas,
  du behöver inte upprepa dem.
- Fastslagna beslut ligger i skillsen — Claude ska inte fråga om dem igen.
  Ändrar du dig om ett beslut: säg det, så uppdateras skillen.

## Lägga till en ny skill

Skapa `.claude/skills/<namn>/SKILL.md` med frontmatter:

```markdown
---
name: mitt-namn
description: Vad skillen gör OCH när den ska användas — description-raden är
  det enda Claude ser innan den laddas, så var konkret om triggersituationerna.
---

# Instruktionerna...
```

Enklast: säg "gör en skill av det här" i slutet av en session där ett bra
arbetsflöde etablerats, så skriver Claude den.
