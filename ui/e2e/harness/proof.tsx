import { APP_DOWNLOAD_GRANT, ExtensionHost } from "@ryu/app-host/ExtensionHost";
import {
	type Capability,
	capabilitiesFromGrants,
	type HostServices,
	validatePluginRoute,
} from "@ryu/app-host/rpc";
import { htmlCompanionSrcdoc } from "@ryu/app-host/third-party-plugin";
import { Toaster, toast } from "@ryu/ui/components/sileo.tsx";
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
	createScopedToastHost,
	createSileoToastRenderer,
} from "../../../../../packages/app-host/src/toast-host.ts";
import { slidesStateSchema } from "../../src/schemas.ts";
import type { SlidesState } from "../../src/types.ts";

const PLUGIN_ID = "@ryu/slides";
const STORAGE_NAMESPACE = "slides";
const STORAGE_KEY = "state.v1";
const MODEL_RESULT = JSON.stringify({
	slides: [
		{
			body: "Give each frame one clear job.",
			headline: "Keep the signal clear",
			visualPrompt: "A paper kite over calm water",
		},
		{
			body: "End with the action you want people to take.",
			headline: "Close with a next step",
			visualPrompt: "An open studio door",
		},
	],
});
const GENERATED_IMAGE =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

interface MountOptions {
	appHtml: string;
	grants: string[];
	pluginId: string;
}

type SlidesFixtureArgs =
	| Parameters<NonNullable<HostServices["storageGet"]>>[0]
	| Parameters<NonNullable<HostServices["storageSet"]>>[0]
	| Parameters<NonNullable<HostServices["modelComplete"]>>[0]
	| Parameters<NonNullable<HostServices["generateImage"]>>[0]
	| Parameters<NonNullable<HostServices["generateVideo"]>>[0];

interface FixtureCall {
	args: SlidesFixtureArgs;
	method: string;
}

interface FixtureOptions {
	failures?: Record<string, string[]>;
	generatedVideoDataUrl?: string;
}

interface SlidesOwnedProofApi {
	calls: () => FixtureCall[];
	configure: (options: FixtureOptions) => void;
	connected: () => boolean;
	mount: (options: MountOptions) => void;
	persisted: () => SlidesState | null;
	reset: () => void;
}

declare global {
	interface Window {
		__slidesOwnedProof: SlidesOwnedProofApi;
	}
}

const storage = new Map<string, string>();
const calls: FixtureCall[] = [];
const failures = new Map<string, string[]>();
let connected = false;
let generatedVideoDataUrl: string | null = null;
let root: Root | null = null;
let toastHost = createScopedToastHost({
	renderer: createSileoToastRenderer(toast),
	sourceId: PLUGIN_ID,
});

function address(namespace: string | undefined, key: string): string {
	return `${namespace ?? ""}/${key}`;
}

function record(method: string, args: SlidesFixtureArgs): void {
	calls.push({ args: structuredClone(args), method });
}

function failIfConfigured(method: string): void {
	const queue = failures.get(method);
	const message = queue?.shift();
	if (queue?.length === 0) {
		failures.delete(method);
	}
	if (message) {
		throw new Error(message);
	}
}

function services(pluginId: string): HostServices {
	return {
		listAgents: async () => [],
		registerRoute: (claim) =>
			validatePluginRoute(pluginId, claim)
				? Promise.resolve({ path: claim.path })
				: Promise.reject(
						new Error("Route is outside the companion namespace.")
					),
		storageGet: async ({ key, namespace }) => {
			record("storage.get", { key, namespace });
			return storage.get(address(namespace, key)) ?? null;
		},
		storageSet: async ({ key, namespace, value }) => {
			record("storage.set", { key, namespace, value });
			failIfConfigured("storage.set");
			storage.set(address(namespace, key), value);
		},
		modelComplete: async (input) => {
			record("model.complete", input);
			failIfConfigured("model.complete");
			return MODEL_RESULT;
		},
		generateImage: async (input) => {
			record("media.image", input);
			failIfConfigured("media.image");
			return [GENERATED_IMAGE];
		},
		generateVideo: async (input) => {
			record("media.video", input);
			failIfConfigured("media.video");
			if (!generatedVideoDataUrl) {
				throw new Error("The generated-video fixture was not configured.");
			}
			return [{ mediaType: "video/webm", url: generatedVideoDataUrl }];
		},
	};
}

function reset(): void {
	storage.clear();
	calls.length = 0;
	failures.clear();
	generatedVideoDataUrl = null;
}

function configure(options: FixtureOptions): void {
	failures.clear();
	for (const [method, queue] of Object.entries(options.failures ?? {})) {
		failures.set(method, [...queue]);
	}
	generatedVideoDataUrl = options.generatedVideoDataUrl ?? null;
}

function mount(options: MountOptions): void {
	toastHost.dispose();
	toastHost = createScopedToastHost({
		renderer: createSileoToastRenderer(toast),
		sourceId: options.pluginId,
	});
	connected = false;
	const nonce = crypto.randomUUID();
	const granted: ReadonlySet<Capability> = capabilitiesFromGrants(
		options.grants
	);
	const srcdoc = htmlCompanionSrcdoc(nonce, options.appHtml, options.pluginId);
	const container = document.getElementById("host-root");
	if (!container) {
		throw new Error("Slides regression host is missing #host-root.");
	}
	root?.unmount();
	root = createRoot(container);
	const app = createElement(ExtensionHost, {
		srcdoc,
		nonce,
		granted,
		allowDownloads: options.grants.includes(APP_DOWNLOAD_GRANT),
		services: services(options.pluginId),
		onConnected: () => {
			connected = true;
		},
		title: "Slides regression proof",
	});
	const toaster = createElement(Toaster, { position: "bottom-right" });
	root.render(
		createElement(
			"div",
			{ style: { minHeight: "100%", height: "100%" } },
			app,
			toaster
		)
	);
}

window.__slidesOwnedProof = {
	calls: () => structuredClone(calls),
	connected: () => connected,
	configure,
	mount,
	persisted: () => {
		const serialized = storage.get(address(STORAGE_NAMESPACE, STORAGE_KEY));
		return serialized ? slidesStateSchema.parse(JSON.parse(serialized)) : null;
	},
	reset,
};
document.body.setAttribute("data-harness-ready", "1");
