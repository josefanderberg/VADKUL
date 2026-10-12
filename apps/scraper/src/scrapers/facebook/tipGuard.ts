/**
 * Tipsade FB-event ska inte skrapas in en gång till.
 *
 * Ett tips (userCreated + isTip) bor på kartans live-spår med dokument-id:t
 * som event-id; ett skrapat event hamnar i aggregatet med url:en som id.
 * Kartan dedupar bara på id — så när sidbevakningen/seed-filen hittar samma
 * FB-event som någon redan tipsat om ritas det TVÅ gånger från nästa natt.
 * Tipset vinner: dess /e/-länk kan redan vara delad (Mikaeliskolans
 * höstmarknad 30/9 — tipsad för att ge arrangören en länk samma dag, och
 * sidan bevakas från samma natt).
 *
 * Tips-länkar sparas som användaren klistrade in dem (t.ex. FB:s delnings-
 * form /events/s/<slug>/<id>/), så båda sidor normaliseras till skraperns
 * kanoniska https://www.facebook.com/events/<id>/.
 */

const FB_EVENT_ID = /facebook\.com\/events\/(?:[a-zA-Z0-9_-]+\/)*(\d{10,})/;

/** Kanonisk eventsides-URL, eller null om det inte är en FB-eventlänk. */
export function canonicalFbEventUrl(raw: unknown): string | null {
    const m = String(raw ?? '').match(FB_EVENT_ID);
    return m ? `https://www.facebook.com/events/${m[1]}/` : null;
}

/** Tipsens url-fält → mängden kanoniska FB-event-URL:er de täcker. */
export function tippedFbEventUrls(urls: Iterable<unknown>): Set<string> {
    const out = new Set<string>();
    for (const u of urls) {
        const c = canonicalFbEventUrl(u);
        if (c) out.add(c);
    }
    return out;
}
