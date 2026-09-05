import {
	carouselPrompt,
	emptyState,
	normalizeState,
	serializeState,
} from "./model";
import type { CarouselSlide, SlidesState } from "./types";

const STORAGE_NAMESPACE = "slides";
const STORAGE_KEY = "state.v1";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function asDataUrl(value: unknown, prefix: "image" | "video"): string | null {
	if (typeof value === "string" && value.startsWith(`data:${prefix}/`)) {
		return value;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = asDataUrl(item, prefix);
			if (found) {
				return found;
			}
		}
	}
	if (isRecord(value)) {
		const url = value.url;
		if (typeof url === "string" && url.startsWith(`data:${prefix}/`)) {
			return url;
		}
		const images = value.images;
		if (prefix === "image" && Array.isArray(images)) {
			return asDataUrl(images, prefix);
		}
	}
	return null;
}

function safeLocalStorageGet(key: string): string | null {
	try {
		return globalThis.localStorage.getItem(key);
	} catch {
		return null;
	}
}

function safeLocalStorageSet(key: string, value: string): void {
	try {
		globalThis.localStorage.setItem(key, value);
	} catch {
		// The null-origin preview may not expose localStorage. Host storage remains optional.
	}
}

export interface BridgeStatus {
	image: boolean;
	model: boolean;
	storage: boolean;
	upload: boolean;
	video: boolean;
}

export type AppMode = "demo" | "live";

export function bridgeStatus(): BridgeStatus {
	const bridge = window.ryu;
	return {
		image: typeof bridge?.media?.image === "function",
		model: typeof bridge?.model?.complete === "function",
		storage:
			typeof bridge?.storage?.get === "function" &&
			typeof bridge.storage.set === "function",
		upload: typeof bridge?.ui?.uploadFile === "function",
		video: typeof bridge?.media?.video === "function",
	};
}

export async function loadState(): Promise<{
	mode: AppMode;
	state: SlidesState;
}> {
	const current = typeof window === "undefined" ? undefined : window.ryu;
	if (!current) {
		const local = safeLocalStorageGet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`);
		if (!local) {
			return { mode: "demo", state: normalizeState(null) };
		}
		try {
			return { mode: "demo", state: normalizeState(JSON.parse(local)) };
		} catch {
			return { mode: "demo", state: normalizeState(null) };
		}
	}
	if (current.storage?.get) {
		try {
			const value = await current.storage.get({
				key: STORAGE_KEY,
				namespace: STORAGE_NAMESPACE,
			});
			if (value) {
				return { mode: "live", state: normalizeState(JSON.parse(value)) };
			}
		} catch {
			// A live storage failure must not fall back to preview data.
			return { mode: "live", state: emptyState() };
		}
	}
	return { mode: "live", state: emptyState() };
}

export async function saveState(state: SlidesState): Promise<void> {
	const value = serializeState(state);
	const current = typeof window === "undefined" ? undefined : window.ryu;
	if (!current?.storage?.set) {
		safeLocalStorageSet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`, value);
		return;
	}
	await current.storage.set({
		key: STORAGE_KEY,
		namespace: STORAGE_NAMESPACE,
		value,
	});
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.addEventListener("load", () => {
			if (typeof reader.result === "string") {
				resolve(reader.result);
			} else {
				reject(new Error("The selected file could not be read."));
			}
		});
		reader.addEventListener("error", () => {
			reject(reader.error ?? new Error("The selected file could not be read."));
		});
		reader.readAsDataURL(file);
	});
}

export interface PickedFile {
	dataUrl: string;
	mimeType: string;
	name: string;
}

export async function pickFile(accept: string): Promise<PickedFile | null> {
	const hostPicker = window.ryu?.ui?.uploadFile;
	if (hostPicker) {
		const result = await hostPicker({ accept, multiple: false });
		const item = Array.isArray(result) ? result[0] : result;
		if (!item || typeof item.data_url !== "string") {
			return null;
		}
		return {
			dataUrl: item.data_url,
			mimeType: item.mime_type,
			name: item.name,
		};
	}
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.accept = accept;
		input.type = "file";
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			void fileToDataUrl(file).then(
				(dataUrl) => resolve({ dataUrl, mimeType: file.type, name: file.name }),
				() => resolve(null)
			);
		});
		input.click();
	});
}

export async function generateImage(prompt: string): Promise<string | null> {
	const image = window.ryu?.media?.image;
	if (!image) {
		throw new Error("Ryu image generation is not available.");
	}
	const result = await image({ count: 1, prompt, size: "1280x1080" });
	return asDataUrl(result, "image");
}

export async function generateVideo(prompt: string): Promise<string | null> {
	const video = window.ryu?.media?.video;
	if (!video) {
		throw new Error("Ryu video generation is not available.");
	}
	const result = await video({ prompt });
	return asDataUrl(result, "video");
}

export async function generateCarousel(
	topic: string,
	count: number
): Promise<CarouselSlide[]> {
	const complete = window.ryu?.model?.complete;
	if (!complete) {
		throw new Error("Ryu model generation is not available.");
	}
	const raw = await complete({
		effort: "medium",
		prompt: carouselPrompt(topic, count),
		system:
			"You are a concise visual editor. Return only valid JSON. Never include markdown fences or HTML.",
	});
	const parsed = JSON.parse(raw);
	if (!(isRecord(parsed) && Array.isArray(parsed.slides))) {
		return [];
	}
	return parsed.slides
		.filter(isRecord)
		.map((slide) => ({
			body: typeof slide.body === "string" ? slide.body : "A useful next step.",
			headline:
				typeof slide.headline === "string" ? slide.headline : "A clearer idea",
			visualPrompt:
				typeof slide.visualPrompt === "string"
					? slide.visualPrompt
					: "Editorial still life",
		}))
		.slice(0, 8);
}
