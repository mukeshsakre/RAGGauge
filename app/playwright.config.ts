import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:8511',
    channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: process.platform === 'win32'
        ? '..\\.venv\\Scripts\\python.exe ..\\tests\\ui_server.py'
        : '../.venv/bin/python ../tests/ui_server.py',
      url: 'http://127.0.0.1:8011/health/ready',
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port=8511',
      url: 'http://127.0.0.1:8511',
      env: { RAGGAUGE_API_PROXY_TARGET: 'http://127.0.0.1:8011' },
      timeout: 60_000,
    },
  ],
});
