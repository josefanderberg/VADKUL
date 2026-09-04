import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    // Samma @/-alias som tsconfig.json. Utan det kraschar varje test som (via
    // en importkedja) når en modul som använder @/ — cityData.ts fällde
    // countsSentence.test.ts på exakt det 1/9.
    resolve: {
        alias: { '@': path.resolve(__dirname, 'src') },
    },
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
