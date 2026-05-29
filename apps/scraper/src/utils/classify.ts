const RULES: [string, RegExp][] = [
    ['music',           /konsert|spelning|\blive\b|gig\b|\bband\b|festival|dj\b|rave|techno|hip[\s-]?hop|jazz|blues|folkmusik|symfoniker|orkester|musikfest|kör\b|gitarr|tribute/i],
    ['performing-arts', /\bteater\b|föreställning|musikal|musical|opera\b|balett|cirkus|impro|pjäs\b|monolog|revyr?|dansföreställning/i],
    ['comedy',          /standup|stand[\s-]?up|comedy|kabaré|komedi/i],
    ['market',          /loppis|marknad|bazar|antikvite|designmarknad|matmarknad|hantverks/i],
    ['sport',           /match\b|turnering|idrotts|simtävl|handboll|fotboll|hockey|basket|tennis|friidrott|cykeltour|\blopp\b/i],
    ['training',        /\byoga\b|meditation|träning\b|fitness|pilates|crossfit|löpning|runners\b|bootcamp|styrketräning|breathwork|mindfulness/i],
    ['education',       /föreläsning|workshop|kurs\b|seminarium|utbildning|konferens|föredrag|lektion|hackat|hackathon/i],
    ['art',             /vernissage|utställning|konst\b|galleri|expo\b|skulptur|fotografi|keramik/i],
    ['game',            /\bquiz\b|spela\s+tv|tv[\s-]?spel|brädspel|pubquiz|quiz[\s-]?kväll|quizkväll|game\s+night|escape\s+room|bingo\b/i],
    ['social',          /afterwork|after[\s-]?work|mingel|sällskap|träff\b|häng\b|mingle|speed\s+dating|nätverkst/i],
    ['party',           /\bfest\b|kalas\b|party\b|\bgala\b|\bbal\b|avskedsfest|studentfest|jubileumsfest/i],
    ['outdoor',         /vandring|friluft|orientering|utomhus|naturprom|utedag|cykeltur\b|paddling|kajaktur/i],
    ['food-drink',      /matfestival|vinfest|ölprovning|matlagning|smakprovning|brunch|picknick|middag\b|gastron/i],
    ['family',          /barnteater|barnfest|familjeevent|barnklubb|sagostund|barnens\b|barnaktivitet|sagoträff|för\s+barn/i],
];

export function classifyEvent(title: string, description: string): string {
    const text = (title + ' ' + (description || '')).toLowerCase();
    for (const [category, pattern] of RULES) {
        if (pattern.test(text)) return category;
    }
    return 'other';
}
