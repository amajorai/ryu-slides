import { z } from "zod";
import {
	carouselPrompt,
	emptyState,
	normalizeState,
	parseCarouselResponse,
	serializeState,
} from "./model.ts";
import {
	type SlidesStoredValue,
	slidesStoredRecordSchema,
	slidesStoredValueSchema,
} from "./schemas.ts";
import type { CarouselParseResult, SlidesState } from "./types.ts";

const STORAGE_NAMESPACE = "slides";
const STORAGE_KEY = "state.v1";

function asDataUrl(
	value: SlidesStoredValue,
	prefix: "image" | "video"
): string | null {
	const text = z.string().safeParse(value);
	if (text.success && text.data.startsWith(`data:${prefix}/`)) {
		return text.data;
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = asDataUrl(item, prefix);
			if (found) {
				return found;
			}
		}
	}
	const record = slidesStoredRecordSchema.safeParse(value);
	if (record.success) {
		const url = z.string().safeParse(record.data.url);
		if (url.success && url.data.startsWith(`data:${prefix}/`)) {
			return url.data;
		}
		const images = record.data.images;
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
		image: z.function().safeParse(bridge?.media?.image).success,
		model: z.function().safeParse(bridge?.model?.complete).success,
		storage:
			z.function().safeParse(bridge?.storage?.get).success &&
			z.function().safeParse(bridge?.storage?.set).success,
		upload: z.function().safeParse(bridge?.ui?.uploadFile).success,
		video: z.function().safeParse(bridge?.media?.video).success,
	};
}

export async function loadState(): Promise<{
	mode: AppMode;
	state: SlidesState;
}> {
	const current = globalThis.window?.ryu;
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
				const parsed = slidesStoredValueSchema.parse(JSON.parse(value));
				return {
					mode: "live",
					state: slidesStoredRecordSchema.safeParse(parsed).success
						? normalizeState(parsed)
						: emptyState(),
				};
			}
		} catch {
			// A live storage failure must not fall back to preview data.
			throw new Error(
				"Slides storage could not be loaded. Reload before editing."
			);
		}
	}
	if (!current.storage?.get) {
		throw new Error("Slides storage is unavailable on this host.");
	}
	return { mode: "live", state: emptyState() };
}

export async function saveState(state: SlidesState): Promise<void> {
	const value = serializeState(state);
	const current = globalThis.window?.ryu;
	if (!current) {
		safeLocalStorageSet(`${STORAGE_NAMESPACE}:${STORAGE_KEY}`, value);
		return;
	}
	if (!current.storage?.set) {
		throw new Error("Slides storage is unavailable on this host.");
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
			const parsed = z.string().safeParse(reader.result);
			if (parsed.success) {
				resolve(parsed.data);
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

export function dataUrlToText(dataUrl: string): string {
	const separator = dataUrl.indexOf(",");
	if (separator < 0) {
		throw new Error("The selected file is not a readable data URL.");
	}
	const metadata = dataUrl.slice(0, separator);
	const payload = dataUrl.slice(separator + 1);
	if (metadata.includes(";base64")) {
		const bytes = atob(payload);
		const chunks: string[] = [];
		for (let index = 0; index < bytes.length; index += 8192) {
			chunks.push(bytes.slice(index, index + 8192));
		}
		return decodeURIComponent(
			chunks
				.join("")
				.split("")
				.map(
					(character) =>
						`%${character.charCodeAt(0).toString(16).padStart(2, "0")}`
				)
				.join("")
		);
	}
	return decodeURIComponent(payload);
}

export async function pickTextFile(): Promise<string | null> {
	const file = await pickFile("application/json,.json,text/plain");
	return file ? dataUrlToText(file.dataUrl) : null;
}

export async function pickFile(accept: string): Promise<PickedFile | null> {
	const hostPicker = window.ryu?.ui?.uploadFile;
	if (hostPicker) {
		const result = await hostPicker({ accept, multiple: false });
		const item = Array.isArray(result) ? result[0] : result;
		if (!(item && z.string().safeParse(item.data_url).success)) {
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
): Promise<CarouselParseResult> {
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
	// Missing headlines drop the slide and missing body/visual prompt stay
	// empty; the counts let the UI say so instead of inventing copy.
	return parseCarouselResponse(JSON.parse(raw), 8);
}
