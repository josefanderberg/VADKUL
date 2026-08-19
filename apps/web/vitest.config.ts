import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['src/**/*.test.ts'],
        // Stabil TZ — "Idag/Imorgon"-formatteringen och NO_TIME_PAST_HOUR-
        // gränsen (kl 20 lokal tid) är Stockholmstids-beroende, precis som
        // scraperns tester.
        env: {
            TZ: 'Europe/Stockholm',
        },
        // Nät och Firebase är förbjudna i tester — testa rena funktioner
        // (utils/, lib/, React-fria moduler som v2MapBricka), inte komponenter.
    },
});
