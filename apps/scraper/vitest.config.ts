import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        // Stabil TZ — datumheuristiken (lokal vs UTC-midnatt) och TZ-lösa
        // ISO-strängar från källorna är Stockholmstids-beroende.
        env: {
            TZ: 'Europe/Stockholm',
            // Tester får ALDRIG röra riktiga DB:er.
            SCRAPER_SQLITE_PATH: ':memory:',
        },
        // Nät är förbjudet i tester — allt IO mockas. (Ingen global fetch-mock;
        // testerna anropar mappers/pure functions, inte engines end-to-end.)
    },
});
