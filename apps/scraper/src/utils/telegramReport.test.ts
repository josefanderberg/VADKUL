import { describe, it, expect } from 'vitest';
import { escapeHtml, factLines, section, preBlock, clampTelegram } from './telegramReport';

describe('telegramReport', () => {
    it('escapeHtml skyddar &, <, >', () => {
        expect(escapeHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d');
    });
    it('factLines: punktlista med fet titel, värden escapade', () => {
        expect(factLines([{ title: 'Status', value: '✅ OK' }, { title: 'Fel', value: '<3>' }]))
            .toBe('• <b>Status:</b> ✅ OK\n• <b>Fel:</b> &lt;3&gt;');
    });
    it('section: tom kropp → tom sträng, annars rubrik + kropp', () => {
        expect(section('Karantän', '')).toBe('');
        expect(section('Karantän', '• x')).toBe('\n<b>Karantän</b>\n• x');
    });
    it('preBlock escapar innehållet', () => {
        expect(preBlock('a<b')).toBe('<pre>a&lt;b</pre>');
    });
    it('clampTelegram kapar och stänger öppen <pre>', () => {
        const long = '<b>Rubrik</b>\n<pre>' + 'x'.repeat(5000) + '</pre>';
        const out = clampTelegram(long);
        expect(out.length).toBeLessThanOrEqual(4000 + '…</pre>'.length);
        expect(out.endsWith('…</pre>')).toBe(true);
        expect(clampTelegram('kort')).toBe('kort');
    });
});
