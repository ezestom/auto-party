import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL === "chrome" ? "chrome" : undefined },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    // Isolated, non-working credentials: browser tests never use the user's Groq/Redis quota.
    env: { GROQ_API_KEY: "e2e-server-key-not-a-real-credential", AI_ACCESS_CODE: "e2e-access-code-123456",
      AI_SESSION_SECRET: "e2e-session-secret-with-more-than-thirty-two-characters", AI_ALLOWED_ORIGINS: "http://localhost:3000",
      UPSTASH_REDIS_REST_URL: "", UPSTASH_REDIS_REST_TOKEN: "" },
    timeout: 120000,
  },
});
