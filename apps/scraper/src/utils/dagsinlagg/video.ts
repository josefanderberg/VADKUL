/**
 * video.ts - klippet blir ett inlägg: textraderna läggs på som genomskinliga
 * PNG:er (renderade av bildRender.ts med samma Fredoka som korten), slutkortet
 * läggs på 1,5 s, ljudet normaliseras och allt muxas till H.264/AAC
 * 1080x1920 som Meta tar.
 *
 * REN del: byggFfmpegArgs() och de andra bygg-/tolka-funktionerna returnerar
 * argumentlistor och tolkar ffprobe-svar, så vitest kan låsa kedjan utan
 * ffmpeg. I/O (körFfmpeg, bildrutor, probe) längst ner, tunt.
 *
 * Fallgropar som kedjan tar hand om:
 *  - drawtext finns INTE i Homebrews ffmpeg (byggt utan freetype, kollat på
 *    minin 3/11 2026), därför overlay: varje textrad är en PNG som loopas
 *    hela klippet och tonas in 0,3 s / ut 0,2 s via alfa-fade, synlig bara
 *    i sitt fönster (enable=between). Vår tolkning av BAS pop-in/fade-out.
 *  - concat kräver samma fps, storlek, pixelformat, samplingsfrekvens och
 *    kanaler på båda grenarna; därför normaliseras bägge först.
 *  - loudnorm räknar i 192 kHz och lämnar det så; aresample tillbaka till
 *    48 kHz innan concat.
 *  - saknar klippet ljudspår (Grok kan ge tyst video) används anullsrc.
 *  - slutkortet är en PNG: -loop 1 -t 1.5 plus ett tyst spår.
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const UT_BREDD = 1080;
export const UT_HOJD = 1920;
export const FPS = 30;
export const SLUTKORT_SEK = 1.5;
export const MIN_SEK = 10;
export const MAX_SEK = 31;
/** BAS: rubrik 84 px, centrerad kring y 520. Underrad något mindre, ljusblå. */
export const RUBRIK_PX = 84;
export const UNDERRAD_PX = 64;
export const TEXT_Y = 520;
export const FARG_VIT = 'white';
export const FARG_GUL = '#FDE047';
export const FARG_LJUSBLA = '#BAE6FD';
export const TONA_IN = 0.3;
export const TONA_UT = 0.2;

export interface Textrad {
    /** Genomskinlig PNG 1080x1920 med raden (bildRender.renderaTextOverlay). */
    fil: string;
    fran: number;
    till: number;
}

export interface FfmpegVal {
    klipp: string;
    slutkort: string;
    ut: string;
    texter: Textrad[];
    harLjud: boolean;
    /** Klippets längd i sekunder (tystnad när ljud saknas, loop för textbilderna). */
    langd: number;
    slutkortSek?: number;
}

export interface KlippInfo {
    langd: number;
    bredd: number;
    hojd: number;
    harLjud: boolean;
}

/** Alfa-toning för en textbild: in 0,3 s från `fran`, ut 0,2 s mot `till`. */
export function textToning(t: Textrad): string {
    return `format=rgba,fps=${FPS},fade=t=in:st=${t.fran}:d=${TONA_IN}:alpha=1,fade=t=out:st=${(t.till - TONA_UT).toFixed(2)}:d=${TONA_UT}:alpha=1`;
}

const NORMALISERA_VIDEO = `scale=${UT_BREDD}:${UT_HOJD}:force_original_aspect_ratio=increase,crop=${UT_BREDD}:${UT_HOJD},fps=${FPS},format=yuv420p,setsar=1`;
const NORMALISERA_LJUD = 'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo';

/** Hela argumentlistan till ffmpeg (utan programnamnet). */
export function byggFfmpegArgs(v: FfmpegVal): string[] {
    const slutSek = v.slutkortSek ?? SLUTKORT_SEK;
    const inputs = [
        '-i', v.klipp,
        '-loop', '1', '-t', String(slutSek), '-i', v.slutkort,
        '-f', 'lavfi', '-t', String(slutSek), '-i', 'anullsrc=r=48000:cl=stereo',
    ];
    if (!v.harLjud) inputs.push('-f', 'lavfi', '-t', String(v.langd), '-i', 'anullsrc=r=48000:cl=stereo');
    const forstaText = v.harLjud ? 3 : 4;
    for (const t of v.texter) inputs.push('-loop', '1', '-t', String(v.langd), '-i', t.fil);

    // Textbilderna läggs på en i taget: [v0a] -> [v0b] -> ... -> [v0].
    const steg: string[] = [];
    let bas = 'v0a';
    v.texter.forEach((t, i) => {
        const inp = forstaText + i;
        const nasta = i === v.texter.length - 1 ? 'v0' : `v0${String.fromCharCode(98 + i)}`;
        steg.push(`[${inp}:v]${textToning(t)}[t${i}]`);
        steg.push(`[${bas}][t${i}]overlay=0:0:enable='between(t,${t.fran},${t.till})':eof_action=pass[${nasta}]`);
        bas = nasta;
    });
    const videoKedja = v.texter.length ? `[0:v]${NORMALISERA_VIDEO}[v0a];${steg.join(';')}` : `[0:v]${NORMALISERA_VIDEO}[v0]`;
    const ljudKalla = v.harLjud ? '[0:a]' : '[3:a]';
    const ljudKedja = v.harLjud
        ? `${NORMALISERA_LJUD},loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000,${NORMALISERA_LJUD}`
        : NORMALISERA_LJUD;

    const filter = [
        videoKedja,
        `${ljudKalla}${ljudKedja}[a0]`,
        `[1:v]${NORMALISERA_VIDEO},fade=t=in:st=0:d=0.2[v1]`,
        `[2:a]${NORMALISERA_LJUD}[a1]`,
        '[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]',
    ].join(';');

    return [
        '-y', '-hide_banner', '-loglevel', 'error',
        ...inputs,
        '-filter_complex', filter,
        '-map', '[v]', '-map', '[a]',
        '-c:v', 'libx264', '-profile:v', 'high', '-crf', '20', '-r', String(FPS), '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000',
        '-movflags', '+faststart',
        v.ut,
    ];
}

export function byggProbeArgs(fil: string): string[] {
    return ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,duration', '-show_entries', 'format=duration', '-of', 'json', fil];
}

/** Tolkar ffprobe -of json. Längden tas från format, annars videoströmmen. */
export function tolkaProbe(json: string): KlippInfo {
    const d = JSON.parse(json) as {
        streams?: { codec_type?: string; width?: number; height?: number; duration?: string }[];
        format?: { duration?: string };
    };
    const video = d.streams?.find(s => s.codec_type === 'video');
    if (!video) throw new Error('ffprobe: ingen videoström');
    const langd = Number(d.format?.duration ?? video.duration ?? 0);
    return {
        langd,
        bredd: video.width ?? 0,
        hojd: video.height ?? 0,
        harLjud: !!d.streams?.some(s => s.codec_type === 'audio'),
    };
}

/** Brott som gör att klippet inte kan användas alls (före granskaren). */
export function kontrolleraKlipp(info: KlippInfo): string[] {
    const brott: string[] = [];
    if (info.langd < MIN_SEK) brott.push(`för kort (${info.langd.toFixed(1)} s, minst ${MIN_SEK})`);
    if (info.langd > MAX_SEK) brott.push(`för långt (${info.langd.toFixed(1)} s, max ${MAX_SEK})`);
    if (info.bredd > 0 && info.hojd > 0 && info.hojd / info.bredd < 1.6) brott.push(`inte stående (${info.bredd}x${info.hojd})`);
    return brott;
}

/** Tidpunkter för bildrutorna granskaren tittar på: start, var tredje
 *  sekund, och den lugna landningen strax före slutet. */
export function bildruteTider(langd: number): number[] {
    const tider: number[] = [0.5];
    for (let t = 3; t < langd - 1; t += 3) tider.push(t);
    const sista = Math.max(0.5, langd - 0.5);
    if (sista - tider[tider.length - 1] > 1) tider.push(sista);
    return tider;
}

export function byggBildruteArgs(klipp: string, tid: number, ut: string): string[] {
    return ['-y', '-hide_banner', '-loglevel', 'error', '-ss', tid.toFixed(2), '-i', klipp, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '3', ut];
}

/** Två textrader enligt BAS-rytmen: rubriken 0,5-4 s, underraden 5-9 s.
 *  Lämnar landningen (de sista tre sekunderna) ren. */
export function standardTider(langd: number): [{ fran: number; till: number }, { fran: number; till: number }] {
    const slut = Math.max(9, Math.min(langd - 3, 12));
    return [{ fran: 0.5, till: 4 }, { fran: 5, till: slut }];
}

// --- I/O -------------------------------------------------------------------

export const FFMPEG = process.env.FFMPEG ?? 'ffmpeg';
export const FFPROBE = process.env.FFPROBE ?? 'ffprobe';

function kor(bin: string, args: string[]): string {
    const r = spawnSync(bin, args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    if (r.error) throw new Error(`${bin}: ${r.error.message}`);
    if (r.status !== 0) throw new Error(`${bin} misslyckades (${r.status}): ${r.stderr?.slice(0, 2000)}`);
    return r.stdout;
}

export function probe(fil: string): KlippInfo {
    return tolkaProbe(kor(FFPROBE, byggProbeArgs(fil)));
}

/** Plockar bildrutor till en mapp; returnerar JPEG-sökvägarna i tidsordning. */
export function bildrutor(klipp: string, mapp: string, langd: number): string[] {
    fs.mkdirSync(mapp, { recursive: true });
    return bildruteTider(langd).map((tid, i) => {
        const ut = path.join(mapp, `ruta-${String(i).padStart(2, '0')}-${tid.toFixed(1)}s.jpg`);
        kor(FFMPEG, byggBildruteArgs(klipp, tid, ut));
        return ut;
    });
}

/** Renderar klippet med färdiga textbilder. Returnerar utfilen. */
export function renderaVideo(v: FfmpegVal): string {
    fs.mkdirSync(path.dirname(v.ut), { recursive: true });
    kor(FFMPEG, byggFfmpegArgs(v));
    return v.ut;
}
