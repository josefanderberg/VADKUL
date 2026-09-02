import { CITIES, getCityOptInEvents } from '../../cityData';
import { buildListedDays } from '../../EventList';

// Stadens OPT-IN-EVENT (Svenska kyrkan, PRO, Korpen) som bakad JSON — hämtas
// av stadssidans växel (OptInToggle) först när den slås på (Josef 2/9: "aa
// vi kan väl ha de också"). Ligger UTANFÖR sidornas HTML/siffror/metadata:
// SEO-beslutet 1/9 (källorna var 39 % av eventen och siffrorna ljög) står.
// Raderna har exakt serverns form (buildListedDays) så klienten bara syr in
// dem i daglistan (utils/cityOptIn.mergeListedDays). Förrenderas vid build
// för varje stad, precis som sidorna — deploy = färsk data.
export const dynamic = 'force-static';
export const dynamicParams = false;

export function generateStaticParams() {
    return CITIES.map(c => ({ stad: c.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ stad: string }> }) {
    const { stad } = await params;
    const city = CITIES.find(c => c.slug === stad);
    if (!city) return new Response('Not found', { status: 404 });
    const { events, updatedAt } = await getCityOptInEvents(city);
    const { days } = buildListedDays(events, city.name);
    return Response.json({ updatedAt, total: events.length, days });
}
