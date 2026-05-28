const RULES: [string, RegExp][] = [
    ['music',           /konsert|spelning|live\b|gig\b|band\b|festival|dj\b|klubb|club\b|rave|techno|hip[\s-]?hop|jazz|blues|folkmusik|symfoniker|orkester|musikfest/i],
    ['performing-arts', /\bteater\b|föreställning|musikal|opera|balett|cirkus|impro|pjäs\b|monolog|revyr/i],
    ['comedy',          /standup|stand[\s-]?up|comedy|kabaré|komedi/i],
    ['market',          /loppis|marknad|bazar|antikvite|loppi|designmarknad|matmarknad|hantverks/i],
    ['sport',           /\byoga\b|meditation|träning\b|idrotts|löpning|match\b|turnering|fitness|pilates|crossfit|cykeltour|simtävl/i],
    ['education',       /föreläsning|workshop|kurs\b|seminarium|utbildning|konferens|föredrag|lektion/i],
    ['art',             /vernissage|utställning|konst\b|galleri|expo\b|skulptur|fotografi|keramik/i],
    ['social',          /quizkväll|quiz[\s-]?kväll|pubquiz|afterwork|mingel|sällskap|träff\b/i],
    ['food-drink',      /matfestival|vinfest|ölprovning|matlagning|smakprovning|brunch|picknick/i],
    ['family',          /barnteater|barnfest|familjeevent|barnklubb|sagostund|barnens\b/i],
];

export function classifyEvent(title: string, description: string): string {
    const text = (title + ' ' + (description || '')).toLowerCase();
    for (const [category, pattern] of RULES) {
        if (pattern.test(text)) return category;
    }
    return 'other';
}
