import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(here, "..");
const baseURL = "http://127.0.0.1:61427/";
const buildDir = "/private/tmp/ryu-slides-owned-build";

export default {
	fullyParallel: false,
	outputDir: "/private/tmp/ryu-slides-owned-playwright-results",
	reporter: "line",
	retries: 0,
	testDir: resolve(here, "specs"),
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
		command: `bunx vite build --config vite.config.ts --outDir ${buildDir} && bunx vite --config e2e/harness/vite.config.ts`,
		cwd: uiRoot,
		url: baseURL,
		reuseExistingServer: false,
		timeout: 120_000,
	},
};
