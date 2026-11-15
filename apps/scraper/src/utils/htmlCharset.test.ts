import { describe, it, expect } from 'vitest';
import { decodeHtmlBytes, declaredCharset } from './htmlCharset';

const latin1 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'latin1'));
const utf8 = (s: string): Uint8Array => Uint8Array.from(Buffer.from(s, 'utf8'));

describe('decodeHtmlBytes', () => {
    const page = '<html><head><title>Julmarknad på Östgötateatern</title></head><body>Räksmörgås på slottet</body></html>';

    it('UTF-8 läses som förut', () => {
        expect(decodeHtmlBytes(utf8(page), 'text/html; charset=utf-8')).toBe(page);
        expect(decodeHtmlBytes(utf8(page), null)).toBe(page);
    });

    it('ISO-8859-1 enligt huvudet eller sidans meta-tagg (larssonsresor.se 15/11)', () => {
        expect(decodeHtmlBytes(latin1(page), 'text/html; charset=ISO-8859-1')).toBe(page);
        const withMeta = page.replace('<head>', '<head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">');
        expect(decodeHtmlBytes(latin1(withMeta), 'text/html')).toBe(withMeta);
        const html5 = page.replace('<head>', '<head><meta charset="windows-1252">');
        expect(decodeHtmlBytes(latin1(html5), null)).toBe(html5);
    });

    it('en sida som säger UTF-8 men är Latin-1 räddas i stället för att bli "�"', () => {
        expect(decodeHtmlBytes(latin1(page), 'text/html; charset=utf-8')).toBe(page);
        expect(decodeHtmlBytes(latin1(page), null)).toBe(page);
    });

    it('huvudet går före meta-taggen, och en okänd kodning faller tillbaka på UTF-8', () => {
        expect(declaredCharset('text/html; charset="UTF-8"', '<meta charset="iso-8859-1">')).toBe('utf-8');
        expect(declaredCharset('text/html', '<meta charset=iso-8859-1>')).toBe('iso-8859-1');
        expect(declaredCharset(null, '<html>')).toBeNull();
        expect(decodeHtmlBytes(utf8(page), 'text/html; charset=x-okänd')).toBe(page);
    });
});
