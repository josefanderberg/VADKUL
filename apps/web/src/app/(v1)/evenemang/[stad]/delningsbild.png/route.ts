import { CITIES, getCityEvents } from '../../cityData';
import { renderCityShareImage } from '../../cityShareImage';

// Stadssidans delningsbild — se cityShareImage.tsx.
//
// ROUTE HANDLER (inte fil-konventionen opengraph-image.tsx) sedan 5/9:
// Facebook cachar bild-BYTES per bild-URL, separat från sidans og-metadata.
// Fil-konventionens URL (…/opengraph-image-<hash>?<hash>) var identisk mellan
// builds, så FB fortsatte visa gamla blå Esri-bilder trots lyckad scrape=true
// (metadatan färsk, bytesen gamla). Sidans generateMetadata pekar nu hit med
// ?v=<dagens datum> — ny URL varje dag ⇒ FB kan aldrig fastna på gamla bytes.
// Hosting ignorerar query-strängen och serverar samma statiska fil.
//
// FÖRRENDERAS VID BUILD (force-static + generateStaticParams, precis som
// sidan): bilden blir en statisk PNG på Hosting som Facebooks crawler får på
// millisekunder. Den dynamiska varianten (rendering på begäran i SSR-
// funktionen: cold start + 50 MB JSON + fonter) gav Facebook ingen bild vid
// första testet 4/9. Morgondeployen bakar om bilderna varje dag, som sidorna.
export const dynamic = 'force-static';

export function generateStaticParams() {
    return CITIES.map(c => ({ stad: c.slug }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ stad: string }> }) {
    const { stad } = await ctx.params;
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
