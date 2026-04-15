import { defineConfig, devices } from "@playwright/test";

const useExistingApp = process.env.PLAYWRIGHT_USE_EXISTING_APP === "1";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || (useExistingApp ? "http://127.0.0.1:5173" : "http://127.0.0.1:4173");
const backendEnv = "UI_E2E_TEST_MODE=1 DATABASE_ENGINE=sqlite SQLITE_NAME=/tmp/local-llm-query-e2e.sqlite3";
const webServer = useExistingApp
  ? undefined
  : [
      {
        command: `cd ../backend && ${backendEnv} python manage.py migrate && ${backendEnv} python manage.py runserver 127.0.0.1:8010 --noreload`,
        url: "http://127.0.0.1:8010/api/core/health/",
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
      {
        command: "VITE_API_PROXY_TARGET=http://127.0.0.1:8010 npm run dev -- --host 127.0.0.1 --port 4173",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
    ];

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  ...(webServer ? { webServer } : {}),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
