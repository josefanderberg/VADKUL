import { CITIES, getCityEvents } from '../cityData';
import { renderCityShareImage, SHARE_IMAGE_SIZE, SHARE_IMAGE_CONTENT_TYPE } from '../cityShareImage';

// Stadssidans delningsbild — se cityShareImage.tsx. På begäran, som /e/<slug>.
export const alt = 'Vad händer i staden? Evenemang på VADKUL-kartan';
export const size = SHARE_IMAGE_SIZE;
export const contentType = SHARE_IMAGE_CONTENT_TYPE;

export default async function CityShareImage({ params }: { params: Promise<{ stad: string }> }) {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) return renderCityShareImage({ headline: 'Se vad som händer nära dig', kicker: 'JUST NU I HELA SVERIGE', events: [] });
    const { events } = await getCityEvents(city);
    return renderCityShareImage({
        headline: `Vad händer i ${city.name}?`,
        kicker: `JUST NU I ${city.name.toUpperCase()}`,
        events,
    });
}
