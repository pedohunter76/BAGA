import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  timeout: 45000,
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    {
      name: "firefox",
      testMatch: "app.spec.ts",
      grep: /private onboarding|record edits|profile drafts|app notifications|historical goals|calendar backdating/,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit-mobile",
      testMatch: "app.spec.ts",
      grep: /private onboarding|record edits|profile drafts|app notifications|historical goals|calendar backdating/,
      use: { ...devices["iPhone 13"] },
    },
  ],
});
