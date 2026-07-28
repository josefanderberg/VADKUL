// Emitterar KANONISKA kategorier (categoryNormalize släpper igenom dem orörda).
// Utökad 2026-07-28 efter att 47% av framtida event låg i 'other' — den gamla
// vokabulären missade kyrkans/föreningslivets vardagsprogram (sommarcafé,
// middagsbön, boule, sommarmusik, guidade visningar m.m.).
//
// Ordningen avgör — specifika mönster före generella. Titeln provas FÖRST för
// alla regler; beskrivningen bara om titeln var tyst (beskrivningar nämner
// ofta mat/fest i förbifarten → falska träffar).
const RULES: [string, RegExp][] = [
    // quiz/bingo/spel — före stage så "SOMMARQUIZ PÅ TEATERVALLEN" inte blir teater
    ['social', /\bquiz\b|pubquiz|\bbingo\b|brädspel|sällskapsspel|game\s+night|escape\s+room|tipspromenad/i],
    // familj & barn — före stage/food så barnföreställningar inte fastnar på "pannkak"
    ['family', /\bbarn|sagostund|\bpyssel|familje|sommarlov|höstlov|sportlov|lekplats|nallesjukhus|junior\b|\bungdom|minior|skattjakt|ponnyridning|ansiktsmålning|pettson|findus|\bbamse\b|\bpippi\b|alfons|mamma\s*mu|babblarna/i],
    // musik
    ['music', /musik|konsert|spelning|\blive\b|gig\b|\bband\b|festival|dj\b|rave|techno|hip[\s-]?hop|jazz|blues|country|folkmusik|symfoniker|orkester|\bkör(en|er)?\b|gitarr|tribute|visafton|sång|orgel|trubadur|spelmän|spelman|allsång|karaoke|dansband|kvartett|kvintett|lunchmusik|aftonmusik|kyrkokonsert|julkonsert/i],
    // scen — teater/film/show (\bteater(n|s)?\b — inte venue-namn som "Teatervallen")
    ['stage', /\bteater(n|s)?\b|sommarteater|barnteater|friluftsteater|teaterförest|föreställning|musikal|musical|\bopera\b|balett|impro|pjäs\b|monolog|revyr?\b|dansföreställning|dansuppvisning|standup|stand[\s-]?up|comedy|kabaré|komedi|cirkus|\bshow\b|filmvisning|\bbio\b|sommarbio|utomhusbio|drive[\s-]?in[\s-]?bio|magiker|trolleri/i],
    // konst/kultur — museer, visningar, vandringar
    ['art', /vernissage|utställning|\bkonst|galleri|expo\b|guidad|guidning|visning|stadsvandring|kulturvandring|museivisning|\bmuseum\b|museet\b|skulptur|fotografi|fotoutställning|keramik|akvarell|målning|teckning|slöjd|hantverk/i],
    // marknad — OBS 'mässa' undviks (krockar med kyrkans mässa)
    ['market', /loppis|loppmarknad|marknad\b|marknaden\b|bazar|antikvite|auktion|julmarknad|hantverksmässa|antikmässa|bokbord|bakluckeloppis|skördemarknad|torgdag/i],
    // sport & motion — före food så "sommaryoga med frukost" blir sport
    ['sport', /\bmatch(er)?\b|turnering|idrotts|simtävl|handboll|fotboll|hockey|basket|tennis|friidrott|\blopp(et)?\b|simning|simskola|golf\b|padel\b|\bboule\b|cykling|cykeltur|\bgympa\b|yoga|meditation|träning\b|fitness|pilates|crossfit|löpning|bootcamp|qigong|zumba|linedance|längdskid|orientering|vattengympa|sittgympa|motionsdans|vandring|promenad|stavgång|klättring|paddling|kajaktur/i],
    // mat & dryck
    ['food', /grill|kräftskiva|surströmming|hyttsill|räkafton|räkfrossa|middag\b|\blunch\b|brunch|frukost|matfest|smakprovning|ölprovning|vinprovning|matlagning|afternoon\s+tea|våffl|pannkak|fikastund|matmarknad|picknick|gastron|tårtkalas|kakbuffé|pizzakväll/i],
    // kurs & lärande
    ['course', /föreläsning|föredrag|\bkurs\b|workshop|seminarium|studiecirkel|bokcirkel|språkcafé|läxhjälp|utbildning|konferens|lektion|hackathon|digital\s+hjälp|it-hjälp|släktforskning/i],
    // fest
    ['party', /\bfest\b|festkväll|kalas\b|party\b|\bgala\b|\bbal\b|jubileum|firande|invigning|nationaldags|midsommarfirande|valborg|kick[\s-]?off|uppladdning/i],
    // socialt — kyrkans och föreningslivets vardagsrum (bred, därför sist)
    ['social', /gudstjänst|\bmässa\b|högmässa|\bbön\b|middagsbön|morgonbön|aftonbön|andakt|diakoni|\bcafé\b|\bcafe\b|sommarcafé|\bfika\b|kyrkkaffe|träffpunkt|mötesplats|öppen\s+(verksamhet|kyrka|förskola|gemenskap)|öppet\s+hus|gemenskapsträff|syförening|stickcafé|handarbet|vävning|pubafton|pubkväll|afterwork|after[\s-]?work|mingel|mingle|speed\s+dating|nätverkst|pratcafé|samtal(sgrupp)?|drop[\s-]?in|väntjänst|dagledig|herrlunch|sopplunch|månadsmöte|årsmöte|medlemsmöte|bussresa|dagsresa|utflykt|träff\b|häng\b/i],
];

export function classifyEvent(title: string, description: string): string {
    const t = (title || '').toLowerCase();
    const d = (description || '').toLowerCase();
    for (const [category, pattern] of RULES) if (pattern.test(t)) return category;
    for (const [category, pattern] of RULES) if (pattern.test(d)) return category;
    return 'other';
}
