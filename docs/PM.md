# VADKUL – Produktplan

> Enkel översikt för att hålla koll på vad vi bygger, varför och vad som är på gång.

## Note
npm run dashboard

npm run dev

npm run today

npm run create-event

npm run start

## 📚 Dokument & resurser

[PROJECT.md](bio/PROJECT.md) – Teknisk projektöversikt och arkitektur
[README.md](bio/README.md) – Introduktion och kom-igång-guide
[AI_CONTENT.txt](bio/AI_CONTENT.txt) – AI-genererat innehåll och texter
[social.md](social.md) – Facebook-scraping och marknadsföring

## 🎯 Vision

**Hitta spontana events nära dig – i realtid.**

VADKUL hjälper folk att upptäcka vad som händer just nu. Enkel sökning, bra karta, snabb bokning.

## 🗂️ Områden

### 1. Sökning & Upptäck
**Mål:** Bättre sökfunktion med autocomplete som täcker alla events – inte bara de nära dig.

- [ ] Autocomplete-sökning på alla events
- [ ] Kartvy (redan klar ✅)
- [ ] Snabb-modal / detaljsida när man klickar på ett event
- [ ] VERIFIERA på mobil i prod: eventkortet ska gå att dra/scrolla även när
      fingret börjar på en knapp (Anmäl/chatten/listan) — fixat 31/8
      (`fe1f0c3`, pointer-capture på knappen själv + klick-svalning efter
      drag). Rena klick och chattfältets textmarkering ska funka som vanligt.
      **Ta bort den här raden så fort det är bekräftat klart.**

### 2. Event-scraping
**Mål:** Fyll appen med lokalt innehåll automatiskt.

- [ ] Tickster / Upplev Växjö (utöka geografiskt)
- [ ] Eventbrite – Kronoberg-regionen

### 3. Marknadsföring
Se [social.md](social.md) för Facebook-scraping och videotexter.