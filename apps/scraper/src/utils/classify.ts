// Kategorinamnen matchar EVENT_CATEGORIES i apps/web/src/utils/categories.ts
const RULES: [string, RegExp][] = [
    // kultur: musik + scen + komedi
    ['culture',   /konsert|spelning|\blive\b|gig\b|\bband\b|festival|dj\b|rave|techno|hip[\s-]?hop|jazz|blues|folkmusik|symfoniker|orkester|musikfest|kör\b|gitarr|tribute|\bteater\b|föreställning|musikal|musical|opera\b|balett|cirkus|impro|pjäs\b|monolog|revyr?|dansföreställning|standup|stand[\s-]?up|comedy|kabaré|komedi|allsång|karaoke/i],
    ['creative',  /vernissage|utställning|konst\b|galleri|expo\b|skulptur|fotografi|keramik|målning|teckning|hantverk/i],
    ['market',    /loppis|marknad|bazar|antikvite|designmarknad|matmarknad|hantverksmarknad/i],
    ['sport',     /match\b|turnering|idrotts|simtävl|handboll|fotboll|hockey|basket|tennis|friidrott|cykeltour|\blopp\b|simning|golf\b|padel\b/i],
    ['training',  /\byoga\b|meditation|träning\b|fitness|pilates|crossfit|löpning|runners\b|bootcamp|styrketräning|breathwork|mindfulness|gympa|aerobics/i],
    ['workshop',  /föreläsning|workshop|kurs\b|seminarium|utbildning|konferens|föredrag|lektion|hackathon/i],
    ['boardgame', /\bquiz\b|pubquiz|quiz[\s-]?kväll|quizkväll|brädspel|sällskapsspel|game\s+night|escape\s+room|bingo\b/i],
    ['social',    /afterwork|after[\s-]?work|mingel|träff\b|häng\b|mingle|speed\s+dating|nätverkst|pratcafé|öppet\s+hus/i],
    ['party',     /\bfest\b|kalas\b|party\b|\bgala\b|\bbal\b|avskedsfest|studentfest|jubileumsfest|uppladdning/i],
    ['outdoor',   /vandring|friluft|orientering|utomhus|naturprom|utedag|cykeltur\b|paddling|kajaktur|uteträning|friluftskonsert/i],
    ['food',      /matfestival|vinfest|ölprovning|matlagning|smakprovning|brunch|picknick|middag\b|gastron|vinprovning/i],
    ['community', /barnteater|barnfest|familjeevent|barnklubb|sagostund|barnens\b|barnaktivitet|sagoträff|för\s+barn|gudstjänst|kyrka\b/i],
];

export function classifyEvent(title: string, description: string): string {
    const text = (title + ' ' + (description || '')).toLowerCase();
    for (const [category, pattern] of RULES) {
        if (pattern.test(text)) return category;
    }
    return 'other';
}
