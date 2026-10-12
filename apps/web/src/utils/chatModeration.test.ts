// Port av appens vadkul-app/src/lib/moderering.test.ts - samma fall och
// SAMMA facit för reports-dokumentet, så webben och appens build 7 aldrig
// skriver olika former mot den formlåsta reports-regeln.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import {
    REPORT_LIMITS,
    REPORT_RECIPIENT,
    addHidden,
    blockWrites,
    canModerate,
    chatReportDoc,
    chatReportMailto,
    genitive,
    parseBlockRow,
    parseHiddenList,
    senderLabel,
    sortBlocked,
    unblockWrite,
    visibleMessages,
    type ChatReportInput,
} from './chatModeration';

const input = (extra: Partial<ChatReportInput> = {}): ChatReportInput => ({
    chat: 'public',
    eventId: 'https://exempel.se/event/1',
    eventTitle: 'Loppis i Hudiksvall',
    threadId: null,
    message: { id: 'm1', senderId: 'anna', senderName: 'Anna', text: 'Dumt skrivet' },
    reason: 'Stötande eller kränkande',
    reporterUid: 'jag',
    ...extra,
});

describe('canModerate', () => {
    it('andras meddelanden går att anmäla', () => {
        expect(canModerate({ senderId: 'anna' }, 'jag')).toBe(true);
    });

    it('egna, avsändarlösa och utloggat går inte', () => {
        expect(canModerate({ senderId: 'jag' }, 'jag')).toBe(false);
        expect(canModerate({ senderId: '' }, 'jag')).toBe(false);
        expect(canModerate({}, 'jag')).toBe(false);
        expect(canModerate({ senderId: 'anna' }, null)).toBe(false);
    });
});

describe('chatReportDoc', () => {
    it('bygger EXAKT samma publika dokument som appen (facit delas med appens test)', () => {
        expect(chatReportDoc(input())).toEqual({
            type: 'chatMessage',
            chat: 'public',
            eventId: 'https://exempel.se/event/1',
            eventTitle: 'Loppis i Hudiksvall',
            messageId: 'm1',
            senderId: 'anna',
            senderName: 'Anna',
            text: 'Dumt skrivet',
            reason: 'Stötande eller kränkande',
            reporterUid: 'jag',
        });
    });

    it('privat chatt bär trådens id', () => {
        const d = chatReportDoc(input({ chat: 'private', threadId: 'inbjudaren' }));
        expect(d?.chat).toBe('private');
        expect(d?.threadId).toBe('inbjudaren');
    });

    it('privat chatt utan tråd-id är ogiltig', () => {
        expect(chatReportDoc(input({ chat: 'private', threadId: null }))).toBeNull();
    });

    it('publik chatt tar aldrig med tråd-id', () => {
        expect(chatReportDoc(input({ threadId: 'x' }))).not.toHaveProperty('threadId');
    });

    it('vägrar eget meddelande, saknat id/avsändare och tomt event', () => {
        expect(chatReportDoc(input({ reporterUid: 'anna' }))).toBeNull();
        expect(chatReportDoc(input({ message: { senderId: 'anna', text: 'x' } }))).toBeNull();
        expect(chatReportDoc(input({ message: { id: 'm1', text: 'x' } }))).toBeNull();
        expect(chatReportDoc(input({ eventId: '' }))).toBeNull();
        expect(chatReportDoc(input({ reporterUid: '' }))).toBeNull();
    });

    it('utelämnar tomt avsändarnamn i stället för att skicka en tom sträng', () => {
        const d = chatReportDoc(input({ message: { id: 'm1', senderId: 'anna', senderName: '  ', text: 'x' } }));
        expect(d).not.toHaveProperty('senderName');
    });

    it('klipper text och namn till reglernas tak', () => {
        const long = 'x'.repeat(5000);
        const d = chatReportDoc(input({
            chat: 'private',
            threadId: 'tråd',
            eventId: long,
            eventTitle: long,
            message: { id: 'm1', senderId: 'anna', senderName: long, text: long },
        }))!;
        expect(d.eventId.length).toBe(REPORT_LIMITS.eventId);
        expect(d.eventTitle.length).toBe(REPORT_LIMITS.eventTitle);
        expect(d.senderName!.length).toBe(REPORT_LIMITS.senderName);
        expect(d.text.length).toBe(REPORT_LIMITS.text);
    });

    it('vägrar id:n längre än reglernas tak hellre än att klippa dem', () => {
        const longId = 'a'.repeat(REPORT_LIMITS.id + 1);
        expect(chatReportDoc(input({ message: { id: longId, senderId: 'anna', text: 'x' } }))).toBeNull();
        expect(chatReportDoc(input({ message: { id: 'm1', senderId: longId, text: 'x' } }))).toBeNull();
    });
});

// VAKT mot regeln: reports-blocket i firestore.rules ska släppa igenom
// exakt de nycklar och tak dokumentet använder (plus createdAt, som
// tjänsten lägger på). Glider någon av dem isär nekas anmälningarna tyst.
describe('reports-regeln i firestore.rules', () => {
    const rules = readFileSync(path.resolve(__dirname, '../../../../infra/firebase/firestore.rules'), 'utf8');
    const block = rules.slice(rules.indexOf('match /reports/{reportId}'));
    const body = block.slice(0, block.indexOf('allow read, update, delete'));
    const listAfter = (marker: string) => {
        const start = body.indexOf(marker);
        const list = body.slice(start + marker.length, body.indexOf('])', start));
        return [...list.matchAll(/'([^']+)'/g)].map(m => m[1]).sort();
    };

    it('hasOnly = dokumentets alla möjliga nycklar + createdAt', () => {
        const full = chatReportDoc(input({ chat: 'private', threadId: 't' }))!;
        expect(listAfter('keys().hasOnly([')).toEqual([...Object.keys(full), 'createdAt'].sort());
    });

    it('hasAll = nycklarna som alltid finns + createdAt', () => {
        const minimal = chatReportDoc(input({ message: { id: 'm1', senderId: 'anna', text: 'x' } }))!;
        const always = Object.keys(minimal).filter(k => k !== 'eventTitle');
        expect(listAfter('keys().hasAll([')).toEqual([...always, 'createdAt'].sort());
    });

    it('taken i regeln är desamma som REPORT_LIMITS', () => {
        expect(body).toContain(`eventId.size() <= ${REPORT_LIMITS.eventId}`);
        expect(body).toContain(`'eventTitle', ${REPORT_LIMITS.eventTitle}`);
        expect(body).toContain(`'threadId', ${REPORT_LIMITS.id}`);
        expect(body).toContain(`messageId.size() <= ${REPORT_LIMITS.id}`);
        expect(body).toContain(`senderId.size() <= ${REPORT_LIMITS.id}`);
        expect(body).toContain(`'senderName', ${REPORT_LIMITS.senderName}`);
        expect(body).toContain(`text.size() <= ${REPORT_LIMITS.text}`);
        expect(body).toContain(`reason.size() <= ${REPORT_LIMITS.reason}`);
    });
});

describe('chatReportMailto', () => {
    const d = chatReportDoc(input({ chat: 'private', threadId: 'inbjudaren' }))!;

    it('adresserar supportbrevlådan', () => {
        expect(chatReportMailto(d).startsWith(`mailto:${REPORT_RECIPIENT}?subject=`)).toBe(true);
    });

    it('bär event-id, meddelande-id, avsändarens uid, texten och skälet', () => {
        const body = decodeURIComponent(chatReportMailto(d).split('&body=')[1]);
        expect(body).toContain('Event-id: https://exempel.se/event/1');
        expect(body).toContain('Meddelande-id: m1');
        expect(body).toContain('uid anna');
        expect(body).toContain('Dumt skrivet');
        expect(body).toContain('Skäl: Stötande eller kränkande');
        expect(body).toContain('Tråd: inbjudaren');
    });
});

describe('visibleMessages', () => {
    const msgs = [
        { id: 'a1', senderId: 'anna', text: 'hej' },
        { id: 'b1', senderId: 'bertil', text: 'tja' },
        { id: 'j1', senderId: 'jag', text: 'mitt' },
        { id: 'b2', senderId: 'bertil', text: 'igen' },
    ];

    it('döljer blockerade avsändare', () => {
        expect(visibleMessages(msgs, 'jag', new Set(['bertil']), new Set()).map(m => m.id)).toEqual(['a1', 'j1']);
    });

    it('döljer meddelanden jag anmält', () => {
        expect(visibleMessages(msgs, 'jag', new Set(), new Set(['a1'])).map(m => m.id)).toEqual(['b1', 'j1', 'b2']);
    });

    it('mina egna syns alltid', () => {
        expect(visibleMessages(msgs, 'jag', new Set(['jag']), new Set(['j1'])).map(m => m.id)).toContain('j1');
    });

    it('samma array tillbaka när inget ska döljas', () => {
        expect(visibleMessages(msgs, 'jag', new Set(), new Set())).toBe(msgs);
    });
});

describe('senderLabel + genitive', () => {
    it('avsändarnamnet, annars "användaren"', () => {
        expect(senderLabel({ senderName: ' Anna ' })).toBe('Anna');
        expect(senderLabel({})).toBe('användaren');
    });

    it('lägger på s utom efter s, x och z', () => {
        expect(genitive('Anna')).toBe('Annas');
        expect(genitive('Lars')).toBe('Lars');
        expect(genitive('Max')).toBe('Max');
    });
});

describe('addHidden + parseHiddenList', () => {
    it('lägger till nyast sist utan dubbletter, äldsta faller bort över taket', () => {
        expect(addHidden(['a', 'b'], 'a')).toEqual(['b', 'a']);
        expect(addHidden(['a', 'b', 'c'], 'd', 3)).toEqual(['b', 'c', 'd']);
        expect(addHidden(['a'], '')).toEqual(['a']);
    });

    it('tolkar sparad lista defensivt', () => {
        expect(parseHiddenList('["a","b"]')).toEqual(['a', 'b']);
        expect(parseHiddenList('["a",3,null,""]')).toEqual(['a']);
        expect(parseHiddenList('{"a":1}')).toEqual([]);
        expect(parseHiddenList('trasig')).toEqual([]);
        expect(parseHiddenList(null)).toEqual([]);
    });
});

describe('parseBlockRow', () => {
    it('tolkar en rad med och utan namn', () => {
        expect(parseBlockRow('anna', { name: ' Anna ' })).toEqual({ uid: 'anna', name: 'Anna' });
        expect(parseBlockRow('anna', {})).toEqual({ uid: 'anna', name: null });
    });

    it('avvisar skräp och tomt id', () => {
        expect(parseBlockRow('', { name: 'x' })).toBeNull();
        expect(parseBlockRow('anna', null)).toBeNull();
    });
});

describe('blockWrites + unblockWrite', () => {
    it('skriver min blocked-rad och river vänskapen åt båda håll', () => {
        expect(blockWrites('jag', { uid: 'anna', name: 'Anna' })).toEqual({
            block: { owner: 'jag', blocked: 'anna', data: { name: 'Anna' } },
            friends: [
                { owner: 'jag', friend: 'anna', data: null },
                { owner: 'anna', friend: 'jag', data: null },
            ],
        });
    });

    it('namnet klipps till 80 tecken och utelämnas när det saknas', () => {
        expect(blockWrites('jag', { uid: 'anna', name: 'x'.repeat(200) })!.block.data!.name).toHaveLength(80);
        expect(blockWrites('jag', { uid: 'anna', name: null })!.block.data).toEqual({});
    });

    it('man kan inte blockera eller häva mot sig själv', () => {
        expect(blockWrites('jag', { uid: 'jag' })).toBeNull();
        expect(unblockWrite('jag', 'jag')).toBeNull();
    });

    it('häv raderar bara min rad', () => {
        expect(unblockWrite('jag', 'anna')).toEqual({ owner: 'jag', blocked: 'anna', data: null });
    });
});

describe('sortBlocked', () => {
    it('namnordning på svenska, namnlösa sist', () => {
        const rows = [
            { uid: '3', name: null },
            { uid: '1', name: 'Örjan' },
            { uid: '2', name: 'Åsa' },
            { uid: '4', name: 'Anna' },
        ];
        expect(sortBlocked(rows).map(r => r.uid)).toEqual(['4', '2', '1', '3']);
    });
});
