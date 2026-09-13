/**
 * KOPIA av CITIES i apps/web/src/lib/cityUtils.ts — bara fälten helgtips-
 * urvalet behöver (slug/namn/centrum). Hålls i synk för hand, precis som
 * eventShareSlug-kopian: users.citySlug skrivs av webben ur SAMMA lista, så
 * en stad som läggs till där måste in här för att dess användare ska få
 * torsdagspushen.
 */
export interface DigestCity {
    slug: string;
    name: string;
    lat: number;
    lng: number;
}

export const DIGEST_CITIES: DigestCity[] = [
    { slug: 'stockholm', name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
    { slug: 'goteborg', name: 'Göteborg', lat: 57.7089, lng: 11.9746 },
    { slug: 'malmo', name: 'Malmö', lat: 55.6049, lng: 13.0038 },
    { slug: 'uppsala', name: 'Uppsala', lat: 59.8586, lng: 17.6389 },
    { slug: 'vasteras', name: 'Västerås', lat: 59.6099, lng: 16.5448 },
    { slug: 'orebro', name: 'Örebro', lat: 59.2741, lng: 15.2066 },
    { slug: 'linkoping', name: 'Linköping', lat: 58.4108, lng: 15.6214 },
    { slug: 'helsingborg', name: 'Helsingborg', lat: 56.0465, lng: 12.6945 },
    { slug: 'jonkoping', name: 'Jönköping', lat: 57.7826, lng: 14.1618 },
    { slug: 'norrkoping', name: 'Norrköping', lat: 58.5877, lng: 16.1924 },
    { slug: 'lund', name: 'Lund', lat: 55.7058, lng: 13.1932 },
    { slug: 'umea', name: 'Umeå', lat: 63.8258, lng: 20.2630 },
    { slug: 'gavle', name: 'Gävle', lat: 60.6749, lng: 17.1413 },
    { slug: 'boras', name: 'Borås', lat: 57.7210, lng: 12.9401 },
    { slug: 'sodertalje', name: 'Södertälje', lat: 59.1955, lng: 17.6253 },
    { slug: 'eskilstuna', name: 'Eskilstuna', lat: 59.3705, lng: 16.5092 },
    { slug: 'halmstad', name: 'Halmstad', lat: 56.6745, lng: 12.8578 },
    { slug: 'sundsvall', name: 'Sundsvall', lat: 62.3908, lng: 17.3069 },
    { slug: 'vaxjo', name: 'Växjö', lat: 56.8777, lng: 14.8094 },
    { slug: 'karlstad', name: 'Karlstad', lat: 59.3793, lng: 13.5036 },
    { slug: 'kristianstad', name: 'Kristianstad', lat: 56.0294, lng: 14.1567 },
    { slug: 'lulea', name: 'Luleå', lat: 65.5848, lng: 22.1547 },
    { slug: 'molndal', name: 'Mölndal', lat: 57.6554, lng: 12.0140 },
    { slug: 'kalmar', name: 'Kalmar', lat: 56.6634, lng: 16.3613 },
    { slug: 'falun', name: 'Falun', lat: 60.6066, lng: 15.6355 },
    { slug: 'skelleftea', name: 'Skellefteå', lat: 64.7507, lng: 20.9528 },
    { slug: 'karlskrona', name: 'Karlskrona', lat: 56.1612, lng: 15.5869 },
    { slug: 'trollhattan', name: 'Trollhättan', lat: 58.2837, lng: 12.2886 },
    { slug: 'ostersund', name: 'Östersund', lat: 63.1792, lng: 14.6357 },
    { slug: 'uddevalla', name: 'Uddevalla', lat: 58.3498, lng: 11.9419 },
    { slug: 'borlange', name: 'Borlänge', lat: 60.4858, lng: 15.4371 },
    { slug: 'motala', name: 'Motala', lat: 58.5371, lng: 15.0366 },
    { slug: 'landskrona', name: 'Landskrona', lat: 55.8703, lng: 12.8307 },
    { slug: 'nykoping', name: 'Nyköping', lat: 58.7531, lng: 17.0085 },
    { slug: 'falkenberg', name: 'Falkenberg', lat: 56.9055, lng: 12.4912 },
    { slug: 'alingsas', name: 'Alingsås', lat: 57.9295, lng: 12.5333 },
    { slug: 'pitea', name: 'Piteå', lat: 65.3170, lng: 21.4795 },
    { slug: 'katrineholm', name: 'Katrineholm', lat: 58.9967, lng: 16.2089 },
    { slug: 'karlshamn', name: 'Karlshamn', lat: 56.1706, lng: 14.8630 },
    { slug: 'monsteras', name: 'Mönsterås', lat: 57.0394, lng: 16.4421 },
    { slug: 'leksand', name: 'Leksand', lat: 60.7305, lng: 14.9970 },
];

export const DIGEST_CITY_BY_SLUG = new Map(DIGEST_CITIES.map(c => [c.slug, c]));
