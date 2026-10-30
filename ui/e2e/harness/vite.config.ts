import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const here = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(here, "../../../../..");

export default defineConfig({
	root: here,
	base: "/",
	plugins: [react()],
	server: {
		fs: { allow: [repositoryRoot] },
		host: "127.0.0.1",
		port: 61_427,
		strictPort: true,
	},
	resolve: { dedupe: ["react", "react-dom"] },
});
