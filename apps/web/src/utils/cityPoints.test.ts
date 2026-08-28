import { describe, expect, it } from 'vitest';
import { nearestCityPoint } from './cityPoints';

// nearestCityPoint är platsrubriken för centroid-högar i multi-event-listan
// och stadsrutans namnuppslag — fel ort här syns direkt i UI:t.
describe('nearestCityPoint', () => {
    it('träffar orten exakt på dess egen koordinat', () => {
        expect(nearestCityPoint(57.71, 11.97).name).toBe('Göteborg');
        expect(nearestCityPoint(59.33, 18.06).name).toBe('Stockholm');
    });

    it('väljer närmsta ort, inte största — Hudiksvall vinner över Gävle/Sundsvall', () => {
        // Strax utanför Hudiksvalls centrum.
        expect(nearestCityPoint(61.74, 17.12).name).toBe('Hudiksvall');
    });

    it('längdkorrigerar longituden — Kiruna vinner över orter på samma longitud längre söderut', () => {
        // Uppe i norr är en longitudgrad bara ~hälften så bred som en latitud-
        // grad; utan cos-korrigering ser öst/väst-avstånd dubbelt så långa ut
        // och fel ort kan vinna. Nära Kiruna ska Kiruna vinna.
        expect(nearestCityPoint(67.8, 20.3).name).toBe('Kiruna');
    });
});
