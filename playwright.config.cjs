const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.cjs",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  use: { screenshot: "only-on-failure", trace: "retain-on-failure" },
});
