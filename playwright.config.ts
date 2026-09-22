import { defineConfig, devices } from "@playwright/test";

import { WEB_URL } from "./e2e/test-data";

/**
 * Browser end-to-end suite.
 *
 * `npm run test:e2e` builds the production frontend and then runs these specs
 * against a real FastAPI server and a real (migrated) database, both started by
 * `e2e/global-setup.ts`. There is no route interception or API mocking.
 *
 * Serial execution is deliberate: the specs share one database, and the
 * acceptance test asserts on portfolio-wide totals.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chrome",
      // Uses the locally installed Chrome so no browser download is required.
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
});
