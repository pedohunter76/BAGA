import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    {
      name: "desktop",
      testMatch: "app.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile",
      testMatch: "app.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "cloud-desktop",
      testMatch: "cloud.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4175" },
    },
    {
      name: "cloud-mobile",
      testMatch: "cloud.spec.ts",
      use: { ...devices["Pixel 7"], baseURL: "http://127.0.0.1:4175" },
    },
  ],
  webServer: [
    {
      command: "npm run preview -- --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
    },
    {
      command:
        "npm run build:cloud-test && npm run preview -- --outDir dist-cloud-test --port 4175 --strictPort",
      url: "http://127.0.0.1:4175",
      reuseExistingServer: !process.env.CI,
    },
  ],
});
