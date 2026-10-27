import { describe, it, expect } from 'vitest';
import {
    parseLocalTime, reelTiming, formatDuration, videoStorageKey, videoContentType, formatStockholm,
    REEL_MAX_WAIT_MS, REEL_MAX_LATE_MS,
} from './videoPost';

// vitest.config sätter TZ=Europe/Stockholm — 26/10 2026 är vintertid (UTC+1).
const MIN = 60_000;

describe('parseLocalTime', () => {
    it('tolkar "YYYY-MM-DD HH:MM" som Stockholmstid', () => {
        expect(parseLocalTime('2026-10-26 11:00')).toBe(Date.UTC(2026, 9, 26, 10, 0));
    });
    it('tar även T-form och ensiffrig timme', () => {
        expect(parseLocalTime('2026-10-26T9:05')).toBe(Date.UTC(2026, 9, 26, 8, 5));
    });
    it('sommartid: 15/7 11:00 är 09:00 UTC', () => {
        expect(parseLocalTime('2026-07-15 11:00')).toBe(Date.UTC(2026, 6, 15, 9, 0));
    });
    it('avvisar skräp och datum som inte finns', () => {
        expect(parseLocalTime('imorgon 11')).toBeNull();
        expect(parseLocalTime('2026-02-30 11:00')).toBeNull();
        expect(parseLocalTime('2026-10-26')).toBeNull();
        expect(parseLocalTime('')).toBeNull();
    });
});

describe('formatStockholm', () => {
    it('skriver klockslaget i Stockholmstid utan sekunder', () => {
        expect(formatStockholm(Date.UTC(2026, 9, 26, 10, 0))).toBe('2026-10-26 11:00');
    });
});

describe('reelTiming', () => {
    const at = Date.UTC(2026, 9, 26, 10, 0);

    it('väntar när klockslaget ligger inom fönstret', () => {
        expect(reelTiming(at - 12 * MIN, at)).toEqual({ action: 'vänta', waitMs: 12 * MIN });
        expect(reelTiming(at - REEL_MAX_WAIT_MS, at)).toEqual({ action: 'vänta', waitMs: REEL_MAX_WAIT_MS });
    });
    it('publicerar direkt när klockslaget nyss passerat', () => {
        expect(reelTiming(at, at)).toEqual({ action: 'publicera-nu', lateMs: 0 });
        expect(reelTiming(at + 7 * MIN, at)).toEqual({ action: 'publicera-nu', lateMs: 7 * MIN });
        expect(reelTiming(at + REEL_MAX_LATE_MS, at)).toEqual({ action: 'publicera-nu', lateMs: REEL_MAX_LATE_MS });
    });
    it('avbryter när körningen startats för tidigt', () => {
        expect(reelTiming(at - REEL_MAX_WAIT_MS - 1, at)).toEqual({ action: 'för-tidigt', waitMs: REEL_MAX_WAIT_MS + 1 });
        expect(reelTiming(at - 5 * 60 * MIN, at)).toMatchObject({ action: 'för-tidigt' });
    });
    it('avbryter när klockslaget är för gammalt (färskvara)', () => {
        expect(reelTiming(at + REEL_MAX_LATE_MS + 1, at)).toEqual({ action: 'för-sent', lateMs: REEL_MAX_LATE_MS + 1 });
    });
    it('fönstren går att justera', () => {
        expect(reelTiming(at - 10 * MIN, at, { maxWaitMs: 5 * MIN })).toMatchObject({ action: 'för-tidigt' });
        expect(reelTiming(at + 10 * MIN, at, { maxLateMs: 5 * MIN })).toMatchObject({ action: 'för-sent' });
    });
});

describe('formatDuration', () => {
    it('sekunder, minuter, timmar', () => {
        expect(formatDuration(40_000)).toBe('40 s');
        expect(formatDuration(12 * MIN)).toBe('12 min');
        expect(formatDuration(65 * MIN)).toBe('1 h 5 min');
        expect(formatDuration(120 * MIN)).toBe('2 h');
        expect(formatDuration(-3 * MIN)).toBe('3 min');
    });
});

describe('videoStorageKey', () => {
    const now = Date.UTC(2026, 9, 25, 23, 30);
    it('ASCII-säkert namn + tidsstämpel i marketing-videos/', () => {
        expect(videoStorageKey('VADKUL Event nära dig – Ny iOS-app.mp4', now))
            .toBe('marketing-videos/vadkul-event-nara-dig-ny-ios-app-202610252330.mp4');
    });
    it('behåller filändelsen och faller tillbaka på mp4', () => {
        expect(videoStorageKey('klipp.MOV', now)).toBe('marketing-videos/klipp-202610252330.mov');
        expect(videoStorageKey('ööö', now)).toBe('marketing-videos/ooo-202610252330.mp4');
    });
});

describe('videoContentType', () => {
    it('mp4 respektive mov', () => {
        expect(videoContentType('a.mp4')).toBe('video/mp4');
        expect(videoContentType('a.MOV')).toBe('video/quicktime');
        expect(videoContentType('a')).toBe('video/mp4');
    });
});
