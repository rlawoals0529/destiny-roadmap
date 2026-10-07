import { defineConfig } from '@playwright/test';
const live = process.env.SITE_URL;
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: 0,
  use: { baseURL: live || 'http://127.0.0.1:4173', browserName: 'chromium' },
  webServer: live ? undefined : { command: 'npm run dev', url: 'http://127.0.0.1:4173', reuseExistingServer: true }
});
