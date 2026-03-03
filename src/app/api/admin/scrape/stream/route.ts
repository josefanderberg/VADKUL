import { spawn } from 'child_process';
import path from 'path';

export async function POST() {
    const scraperDir = path.join(process.cwd(), 'scraper-bot');
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            const send = (data: object) => {
                try {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch {
                    // Controller already closed
                }
            };

            send({ type: 'start', message: '--- VADKUL SCRAPER BOT STARTING ---' });
            send({ type: 'info', message: `Tid: ${new Date().toLocaleString('sv-SE')}` });
            send({ type: 'info', message: `Katalog: ${scraperDir}` });

            const child = spawn('npm', ['start'], {
                cwd: scraperDir,
                shell: true,
                env: { ...process.env }
            });

            child.stdout?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n').filter(l => l.trim());
                lines.forEach(line => send({ type: 'log', message: line }));
            });

            child.stderr?.on('data', (data: Buffer) => {
                const lines = data.toString().split('\n').filter(l => l.trim());
                lines.forEach(line => send({ type: 'warn', message: line }));
            });

            child.on('close', (code) => {
                if (code === 0) {
                    send({ type: 'done', exitCode: 0, message: '✅ Skrapning klar! Nya event har lagts till.' });
                } else {
                    send({ type: 'error', exitCode: code, message: `❌ Skrapning avslutades med felkod ${code}` });
                }
                controller.close();
            });

            child.on('error', (err) => {
                send({ type: 'error', message: `Process error: ${err.message}` });
                controller.close();
            });
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        }
    });
}
