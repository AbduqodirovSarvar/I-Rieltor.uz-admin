import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the running local stack (backend `deploy/local/up.ps1`, admin on ADMIN_PORT).
 *   E2E_BASE_URL (default http://127.0.0.1:8081), E2E_LOGIN and E2E_PASSWORD of the SUPER_ADMIN (DefaultAdmin__* in the backend .env).
 *   npm run e2e
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:8081',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'uz-UZ',
    timezoneId: 'Asia/Tashkent',
  },
  outputDir: 'e2e-results',
});
