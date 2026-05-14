const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests/smoke',
    use: {
        baseURL: 'http://localhost:8080',
        headless: true,
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'npx http-server . -a localhost -p 8080 --no-cache -s',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
