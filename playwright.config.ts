import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout. Ils démarrent l'application construite (npm run build && npm start) et pilotent un vrai navigateur.
 * Par défaut aucun service externe n'est nécessaire : les appels à l'IA sont simulés. Le parcours complet avec un compte
 * (e2e/journey.spec.ts) ne s'exécute que si E2E_EMAIL et E2E_PASSWORD sont définis (compte de test sur un projet de préproduction).
 *
 *   npm run build && npm run test:e2e
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/confidentialite`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:9',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'e2e-anon-key',
    },
  },
});
