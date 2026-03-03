import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
    return new Promise((resolve) => {
        // Path to the scraper-bot directory
        const scraperDir = path.join(process.cwd(), 'scraper-bot');

        console.log(`[API /admin/scrape] Starting scraper in directory: ${scraperDir}`);

        // Execute the npm start command inside the scraper-bot directory
        exec('npm start', { cwd: scraperDir }, (error, stdout, stderr) => {
            if (error) {
                console.error(`[API /admin/scrape] Error executing scraper: ${error.message}`);
                // Still return 200, but with success false so the UI can handle it gracefully.
                // Firebase operations might have succeeded partially.
                return resolve(NextResponse.json({
                    success: false,
                    message: "Ett fel uppstod vid skrapningen.",
                    details: error.message
                }, { status: 500 }));
            }

            if (stderr) {
                console.warn(`[API /admin/scrape] Scraper stderr: ${stderr}`);
            }

            console.log(`[API /admin/scrape] Scraper completed successfully.\n${stdout}`);

            resolve(NextResponse.json({
                success: true,
                message: "Skrapning slutförd! Nya event har lagts till i databasen.",
                output: stdout
            }));
        });
    });
}
