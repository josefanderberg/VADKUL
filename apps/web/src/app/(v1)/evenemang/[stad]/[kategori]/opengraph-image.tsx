import { CITIES, categoryBySlug, getCityCategoryEvents } from '../../cityData';
import { renderCityShareImage, SHARE_IMAGE_SIZE, SHARE_IMAGE_CONTENT_TYPE } from '../../cityShareImage';

// Kategorisidans delningsbild (t.ex. /evenemang/pitea/konserter) — samma
// renderare som stadssidan, med kategorins rubrik och kategorins event.
export const alt = 'Evenemang i staden på VADKUL-kartan';
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_CONTENT_TYPE;

export default async function CategoryShareImage({ params }: { params: Promise<{ stad: string; kategori: string }> }) {
    const { stad, kategori } = await params;
    const city = CITIES.find(c => c.slug === stad);
    const cat = categoryBySlug(kategori);
    if (!city || !cat) return renderCityShareImage({ headline: 'Se vad som händer nära dig', kicker: 'JUST NU I HELA SVERIGE', events: [] });
    // Datafel får aldrig ge en trasig bild: hellre rubrik utan rader.
    const events = await getCityCategoryEvents(city, cat.dataKey).then(r => r.events).catch(() => []);
    return renderCityShareImage({
        headline: cat.h1(city.name),
        kicker: `JUST NU I ${city.name.toUpperCase()}`,
        events,
    });
}
