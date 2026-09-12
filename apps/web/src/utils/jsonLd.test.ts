import { describe, it, expect } from 'vitest';
import { safeJsonLd } from './jsonLd';

describe('safeJsonLd', () => {
    it('kan aldrig avsluta en script-tagg', () => {
        const out = safeJsonLd({ description: 'Fest!</script><script>alert(1)</script>' });
        expect(out).not.toContain('</script');
        expect(out).not.toContain('<');
    });

    it('är semantiskt identisk JSON (parse ger tillbaka originalet)', () => {
        const obj = { title: 'Å<ä>ö & "citat" \\ snedstreck', n: 3, list: ['</script>'] };
        expect(JSON.parse(safeJsonLd(obj))).toEqual(obj);
    });

    it('escapar radbrytarna U+2028/U+2029', () => {
        const out = safeJsonLd({ t: 'a b c' });
        expect(out).toContain('\\u2028');
        expect(out).toContain('\\u2029');
        expect(JSON.parse(out)).toEqual({ t: 'a b c' });
    });
});
