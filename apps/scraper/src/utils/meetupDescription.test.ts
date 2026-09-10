import { describe, it, expect } from 'vitest';
import { meetupFullDescription, stripMeetupMarkdown, MEETUP_SNIPPET_MAX } from './meetupDescription';
import { pickBetterDescription } from './contentRefresh';

// Riktiga texter från meetup.com/prata-svenska/events/316325068 (2026-09-10).
const FULL = 'Välkommen till Internationella Bekantskapers språkkafé på Södergården på torsdagar kl. 16:30-18:00!\nSamtal på svenska (fika valfritt).\n\nOm du vill öva svenska:\nDu ska helst kunna föra ett enklare samtal på svenska - berätta vad du heter, vad du gillar och vill göra.\n\nFrågor? info@bekantskaper.se';
const SNIPPET = FULL.slice(0, MEETUP_SNIPPET_MAX).trim(); // "…Om du vill öva sven"

const nextData = (pageProps: unknown) => JSON.stringify({ props: { pageProps } });

describe('meetupFullDescription', () => {
    it('läser hela texten ur pageProps.event', () => {
        expect(meetupFullDescription(nextData({ event: { description: FULL } }))).toBe(FULL);
    });

    it('faller tillbaka på Apollo-cachen via event-id:t i URL:en', () => {
        const nd = nextData({ __APOLLO_STATE__: { 'Event:316325068': { description: FULL } } });
        expect(meetupFullDescription(nd, 'https://www.meetup.com/prata-svenska/events/316325068/')).toBe(FULL);
    });

    it('null när datan saknas eller är trasig', () => {
        expect(meetupFullDescription('')).toBeNull();
        expect(meetupFullDescription('{inte json')).toBeNull();
        expect(meetupFullDescription(nextData({ event: { description: '  ' } }))).toBeNull();
    });
});

describe('stripMeetupMarkdown', () => {
    it('fetstil, länkar och nollbreddstecken bort — texten kvar', () => {
        expect(stripMeetupMarkdown('**Agenda:**\n\n\u200B17: 30 Welcome from [Developers Bay](https://developersbay.se/) & GAIA'))
            .toBe('Agenda:\n\n17: 30 Welcome from Developers Bay & GAIA');
    });

    it('länk utan egen text behåller adressen', () => {
        expect(stripMeetupMarkdown('The event is mainly on: [https://nordicsociety.org/](https://nordicsociety.org/)'))
            .toBe('The event is mainly on: https://nordicsociety.org/');
    });

    it('rubriker, punktlistor, kursiv och escapes', () => {
        expect(stripMeetupMarkdown('## Program\n* fika\n* *lätt* samtal\nPris: 50 kr \\- betala på plats'))
            .toBe('Program\n- fika\n- lätt samtal\nPris: 50 kr - betala på plats');
    });

    it('ren text och e-postadresser rörs inte', () => {
        expect(stripMeetupMarkdown(FULL)).toBe(FULL);
    });
});

// Kända event med den kapade snutten ska bytas mot hela texten vid omskrapning.
describe('snutt → hel text via pickBetterDescription', () => {
    it('hela texten räknas som en längre fortsättning av snutten', () => {
        expect(SNIPPET.endsWith('öva sven')).toBe(true);
        expect(pickBetterDescription(SNIPPET, FULL)).toBe(FULL);
    });

    it('en redan hel text byts inte', () => {
        expect(pickBetterDescription(FULL, FULL)).toBeNull();
    });
});
