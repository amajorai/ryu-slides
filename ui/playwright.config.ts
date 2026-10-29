import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@playwright/test";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const baseURL = "http://127.0.0.1:61427/";
const buildDir = "/private/tmp/ryu-slides-owned-build";

export default defineConfig({
	fullyParallel: false,
	outputDir: "/private/tmp/ryu-slides-owned-playwright-results",
	reporter: "line",
	retries: 0,
	testDir: resolve(uiRoot, "e2e/specs"),
	testMatch: /slides-owned-coverage\.spec\.mjs$/,
	use: {
		acceptDownloads: true,
		actionTimeout: 10_000,
		baseURL,
		browserName: "chromium",
		launchOptions: { args: ["--autoplay-policy=no-user-gesture-required"] },
		viewport: { width: 1880, height: 1600 },
	},
	webServer: {
		command: `bunx vite build --config vite.config.ts --outDir ${buildDir} && bunx vite --config e2e/harness/vite.config.ts --host 127.0.0.1 --port 61427 --strictPort`,
		cwd: uiRoot,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
});
