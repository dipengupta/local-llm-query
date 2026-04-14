import { defineConfig, devices } from "@playwright/test";

const backendEnv = "UI_E2E_TEST_MODE=1 DATABASE_ENGINE=sqlite SQLITE_NAME=/tmp/local-llm-query-e2e.sqlite3";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: `cd ../backend && ${backendEnv} python manage.py migrate && ${backendEnv} python manage.py runserver 127.0.0.1:8010 --noreload`,
      url: "http://127.0.0.1:8010/api/core/health/",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: "VITE_API_PROXY_TARGET=http://127.0.0.1:8010 npm run dev -- --host 127.0.0.1 --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
