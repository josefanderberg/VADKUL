import { CITIES, categoryBySlug, getCategoryCombos, getCityCategoryEvents } from '../../../cityData';
import { renderCityShareImage } from '../../../cityShareImage';

// Kategorisidans delningsbild (t.ex. /evenemang/pitea/konserter) — samma
// renderare som stadssidan, med kategorins rubrik och kategorins event.
// Route handler med daglig ?v=-cache-bust i sidans metadata — se
// ../delningsbild.png/route.ts för varför fil-konventionen övergavs 5/9.
export const dynamic = 'force-static';

export async function generateStaticParams() {
    const combos = await getCategoryCombos();
    return combos.map(({ city, cat }) => ({ stad: city.slug, kategori: cat.slug }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ stad: string; kategori: string }> }) {
    const { stad, kategori } = await ctx.params;
    const city = CITIES.find(c => c.slug === stad);
    const cat = categoryBySlug(kategori);
    if (!city || !cat) return renderCityShareImage({ headline: 'Se vad som händer nära dig', kicker: 'JUST NU I HELA SVERIGE', events: [] });
    // Datafel får aldrig ge en trasig bild: hellre rubrik utan rader.
    const events = await getCityCategoryEvents(city, cat.dataKey).then(r => r.events).catch(() => []);
    return renderCityShareImage({
        headline: cat.h1(city.name),
        kicker: `JUST NU I ${city.name.toUpperCase()}`,
        events,
        city: { lat: city.lat, lng: city.lng },
    });
}
