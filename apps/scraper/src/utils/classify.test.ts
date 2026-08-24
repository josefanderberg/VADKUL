/** Nyckelordsklassificeraren — regressionsfall från riktiga felklassningar. */
import { describe, it, expect } from 'vitest';
import { classifyEvent } from './classify';

describe('classifyEvent', () => {
    it('foto-aktiviteter är art, inte sport (Botaniska-incidenten 25/8)', () => {
        // Regeln måste vinna ÖVER sport trots "vandring"/"friluft" i texten.
        expect(classifyEvent('Fotografera med mobilen i Botaniska trädgården',
            'Friluftsevent. Vill du utveckla ditt fotograferande med mobilen?')).toBe('art');
        expect(classifyEvent('Fotovandring i Pålsjö skog', 'Vi vandrar och fotograferar')).toBe('art');
        expect(classifyEvent('Fotokurs för nybörjare', '')).toBe('art');
    });

    it('riktiga friluftsaktiviteter förblir sport', () => {
        expect(classifyEvent('Vandring med matlagning', 'Vi vandrar i Murstensdalen')).toBe('sport');
        expect(classifyEvent('Forspaddlingskurs för nybörjare', 'Kajaktiv')).toBe('sport');
    });

    it('titeln vinner över beskrivningen', () => {
        expect(classifyEvent('Konsert i parken', 'Efteråt blir det korvgrillning')).toBe('music');
    });
});
