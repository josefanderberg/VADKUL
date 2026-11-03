import { describe, it, expect } from 'vitest';
import {
    bildruteTider, byggBildruteArgs, byggFfmpegArgs, byggProbeArgs, kontrolleraKlipp,
    standardTider, textToning, tolkaProbe,
} from './video';

const bas = {
    klipp: '/in/klipp.mp4', slutkort: '/in/slut.png', ut: '/ut/inlagg.mp4',
    texter: [{ fil: '/t/0.png', fran: 0.5, till: 4 }, { fil: '/t/1.png', fran: 5, till: 9 }],
    harLjud: true, langd: 15,
};

describe('textToning', () => {
    it('tonar in 0,3 s från start och ut 0,2 s mot slut, i alfakanalen', () => {
        expect(textToning({ fil: 'x.png', fran: 0.5, till: 4 }))
            .toBe('format=rgba,fps=30,fade=t=in:st=0.5:d=0.3:alpha=1,fade=t=out:st=3.80:d=0.2:alpha=1');
    });
});

describe('byggFfmpegArgs', () => {
    it('med ljud: normaliserar båda grenarna, loudnorm, concat, H.264/AAC', () => {
        const args = byggFfmpegArgs(bas);
        const filter = args[args.indexOf('-filter_complex') + 1];
        expect(filter).toContain('[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p,setsar=1[v0a]');
        expect(filter).toContain("[3:v]format=rgba,fps=30,fade=t=in:st=0.5:d=0.3:alpha=1,fade=t=out:st=3.80:d=0.2:alpha=1[t0];[v0a][t0]overlay=0:0:enable='between(t,0.5,4)':eof_action=pass[v0b]");
        expect(filter).toContain("[4:v]format=rgba,fps=30,fade=t=in:st=5:d=0.3:alpha=1,fade=t=out:st=8.80:d=0.2:alpha=1[t1];[v0b][t1]overlay=0:0:enable='between(t,5,9)':eof_action=pass[v0]");
        expect(filter).toContain('[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000');
        expect(filter).toContain('[1:v]scale=1080:1920');
        expect(filter).toContain('fade=t=in:st=0:d=0.2[v1]');
        expect(filter).toContain('[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]');
        // Textbilderna loopas hela klippet.
        expect(args.join(' ')).toContain('-loop 1 -t 15 -i /t/0.png -loop 1 -t 15 -i /t/1.png');
        expect(args).toContain('libx264');
        expect(args).toContain('yuv420p');
        expect(args).toContain('+faststart');
        expect(args[args.length - 1]).toBe('/ut/inlagg.mp4');
        // Slutkortet loopas 1,5 s och får ett tyst spår.
        expect(args.join(' ')).toContain('-loop 1 -t 1.5 -i /in/slut.png');
        expect(args.join(' ')).toContain('-f lavfi -t 1.5 -i anullsrc=r=48000:cl=stereo');
        expect(args.filter(a => a === 'anullsrc=r=48000:cl=stereo')).toHaveLength(1);
    });

    it('utan ljud: tystnad i klippets längd som fjärde input, textbilderna därefter, ingen loudnorm', () => {
        const args = byggFfmpegArgs({ ...bas, harLjud: false, langd: 14.2 });
        expect(args.join(' ')).toContain('-f lavfi -t 14.2 -i anullsrc=r=48000:cl=stereo');
        const filter = args[args.indexOf('-filter_complex') + 1];
        expect(filter).toContain('[3:a]aformat=');
        expect(filter).toContain('[4:v]format=rgba');
        expect(filter).toContain('[5:v]format=rgba');
        expect(filter).not.toContain('loudnorm');
        expect(filter).not.toContain('[0:a]');
    });

    it('utan textrader går klippet rakt till [v0]', () => {
        const filter = byggFfmpegArgs({ ...bas, texter: [] })[byggFfmpegArgs({ ...bas, texter: [] }).indexOf('-filter_complex') + 1];
        expect(filter).toContain('setsar=1[v0];');
        expect(filter).not.toContain('overlay');
    });
});

describe('probe och kontroll', () => {
    const json = JSON.stringify({
        streams: [{ codec_type: 'video', width: 1080, height: 1920, duration: '15.02' }, { codec_type: 'audio' }],
        format: { duration: '15.040000' },
    });

    it('tolkar ffprobe-json', () => {
        expect(tolkaProbe(json)).toEqual({ langd: 15.04, bredd: 1080, hojd: 1920, harLjud: true });
        expect(tolkaProbe(JSON.stringify({ streams: [{ codec_type: 'video', width: 720, height: 1280, duration: '12' }] })))
            .toEqual({ langd: 12, bredd: 720, hojd: 1280, harLjud: false });
        expect(() => tolkaProbe('{"streams":[]}')).toThrow('ingen videoström');
        expect(byggProbeArgs('/a.mp4')).toContain('/a.mp4');
    });

    it('avvisar för korta, för långa och liggande klipp', () => {
        expect(kontrolleraKlipp({ langd: 15, bredd: 1080, hojd: 1920, harLjud: true })).toEqual([]);
        expect(kontrolleraKlipp({ langd: 6, bredd: 1080, hojd: 1920, harLjud: true })[0]).toContain('för kort');
        expect(kontrolleraKlipp({ langd: 40, bredd: 1080, hojd: 1920, harLjud: true })[0]).toContain('för långt');
        expect(kontrolleraKlipp({ langd: 15, bredd: 1920, hojd: 1080, harLjud: true })[0]).toContain('inte stående');
    });
});

describe('bildrutor och tider', () => {
    it('bildruteTider: start, var tredje sekund, landningen', () => {
        expect(bildruteTider(15)).toEqual([0.5, 3, 6, 9, 12, 14.5]);
        expect(bildruteTider(30)).toEqual([0.5, 3, 6, 9, 12, 15, 18, 21, 24, 27, 29.5]);
        expect(bildruteTider(10)).toEqual([0.5, 3, 6, 9.5]);
    });

    it('byggBildruteArgs tar en ruta vid tiden', () => {
        expect(byggBildruteArgs('/k.mp4', 3, '/r.jpg')).toEqual(['-y', '-hide_banner', '-loglevel', 'error', '-ss', '3.00', '-i', '/k.mp4', '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '3', '/r.jpg']);
    });

    it('standardTider lämnar landningen ren', () => {
        expect(standardTider(15)).toEqual([{ fran: 0.5, till: 4 }, { fran: 5, till: 12 }]);
        expect(standardTider(30)).toEqual([{ fran: 0.5, till: 4 }, { fran: 5, till: 12 }]);
        expect(standardTider(11)).toEqual([{ fran: 0.5, till: 4 }, { fran: 5, till: 9 }]);
    });
});
