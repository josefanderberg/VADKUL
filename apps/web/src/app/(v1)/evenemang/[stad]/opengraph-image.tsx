import { CITIES, getCityEvents } from '../cityData';
import { renderCityShareImage, SHARE_IMAGE_SIZE, SHARE_IMAGE_CONTENT_TYPE } from '../cityShareImage';

// Stadssidans delningsbild — se cityShareImage.tsx.
//
// FÖRRENDERAS VID BUILD (force-static + generateStaticParams, precis som
// sidan): bilden blir en statisk PNG på Hosting som Facebooks crawler får på
// millisekunder. Den dynamiska varianten (rendering på begäran i SSR-
// funktionen: cold start + 50 MB JSON + fonter) gav Facebook ingen bild vid
// första testet 4/9. Morgondeployen bakar om bilderna varje dag, som sidorna.
export const dynamic = 'force-static';
export const alt = 'Vad händer i staden? Evenemang på VADKUL-kartan';
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_CONTENT_TYPE;

export function generateStaticParams() {
    return CITIES.map(c => ({ stad: c.slug }));
}

export default async function CityShareImage({ params }: { params: Promise<{ stad: string }> }) {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) return renderCityShareImage({ headline: 'Se vad som händer nära dig', kicker: 'JUST NU I HELA SVERIGE', events: [] });
    // Datafel får aldrig ge en trasig bild: hellre rubrik utan rader.
    const events = await getCityEvents(city).then(r => r.events).catch(() => []);
    return renderCityShareImage({
        headline: `Vad händer i ${city.name}?`,
        kicker: `JUST NU I ${city.name.toUpperCase()}`,
        events,
        city: { lat: city.lat, lng: city.lng },
    });
}
