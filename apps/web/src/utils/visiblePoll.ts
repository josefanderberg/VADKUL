/**
 * visiblePoll.ts - en poll som bara går medan fliken syns.
 *
 * BAKGRUND (14/10): önskningspollen på kartan läste HELA eventWishes var 30:e
 * sekund med en vanlig setInterval - även i dolda flikar (desktop-Chrome
 * stryper bara takten till en gång i minuten, den stannar inte). Varje varv
 * kostar minst ett Firestore-read, och en bortglömd flik debiterade dygnet
 * runt. Samma fälla som användarevent-pollen hade före 20/9 (utils/userEventPoll).
 *
 * Reglerna:
 * - Ett varv i dold flik hoppas över helt (kostar ingenting).
 * - Startar sidan dold (bakgrundsflik) görs första hämtningen när den syns.
 * - När fliken blir synlig igen hämtas direkt, men bara om senaste hämtningen
 *   är minst ett intervall gammal - att växla flik fram och tillbaka ska inte
 *   kosta ett varv per växling.
 */

/** Det lilla av `document` som pollen behöver (injicerbart i tester). */
export interface VisibilitySource {
    readonly visibilityState: string;
    addEventListener(type: 'visibilitychange', listener: () => void): void;
    removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/**
 * Kör `run` direkt (om fliken syns) och sedan var `intervalMs`, bara medan
 * fliken syns. Returnerar en stoppfunktion. Utan `doc` (server, tester utan
 * DOM) räknas fliken som synlig.
 */
export function startVisiblePoll(
    run: () => unknown,
    intervalMs: number,
    doc: VisibilitySource | undefined = typeof document !== 'undefined' ? document : undefined,
    now: () => number = () => Date.now(),
): () => void {
    let lastRunMs: number | null = null;
    const visible = () => !doc || doc.visibilityState !== 'hidden';
    const tick = () => {
        if (!visible()) return;
        lastRunMs = now();
        void run();
    };

    tick();
    const iv = setInterval(tick, intervalMs);
    const onVisibilityChange = () => {
        if (!visible()) return;
        if (lastRunMs !== null && now() - lastRunMs < intervalMs) return;
        tick();
    };
    doc?.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
        clearInterval(iv);
        doc?.removeEventListener('visibilitychange', onVisibilityChange);
    };
}
