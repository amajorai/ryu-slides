import type { RyuMedia, RyuModel, RyuStorage, RyuUi } from "./ryu.d.ts";
import { slidesStateSchema } from "./schemas.ts";

type StorageWriteInput = Parameters<RyuStorage["set"]>[0];
type UploadInput = Parameters<RyuUi["uploadFile"]>[0];
type MediaInput =
	| Parameters<RyuMedia["image"]>[0]
	| Parameters<RyuMedia["video"]>[0]
	| Parameters<RyuModel["complete"]>[0];

import { afterEach, describe, expect, test } from "bun:test";
import {
	bridgeStatus,
	generateCarousel,
	generateImage,
	generateVideo,
	loadState,
	pickFile,
	saveState,
} from "./bridge.ts";
import { makeProject, projectSnapshot } from "./model.ts";

afterEach(() => {
	Object.assign(globalThis, { window: undefined });
});

describe("Slides storage boundary", () => {
	test("uses an empty node-owned gallery when host storage has no state", async () => {
		Object.assign(globalThis, {
			window: {
				ryu: {
					storage: {
						get: () => Promise.resolve(null),
					},
				},
			},
		});

		const loaded = await loadState();

		expect(loaded.mode).toBe("live");
		expect(loaded.state.projects).toEqual([]);
		expect(loaded.state.trash).toEqual([]);
	});

	test("does not fall back to preview data after live storage fails", async () => {
		Object.assign(globalThis, {
			window: {
				ryu: {
					storage: {
						get: () => Promise.reject(new Error("storage unavailable")),
					},
				},
			},
		});

		await expect(loadState()).rejects.toThrow("storage could not be loaded");
	});

	test("does not turn malformed live JSON into the demo project", async () => {
		Object.assign(globalThis, {
			window: {
				ryu: {
					storage: {
						get: () => Promise.resolve("null"),
					},
				},
			},
		});

		const loaded = await loadState();

		expect(loaded.mode).toBe("live");
		expect(loaded.state.projects).toEqual([]);
		expect(loaded.state.trash).toEqual([]);
	});

	test("writes the exact normalized state through host storage and surfaces refusal", async () => {
		const writes: StorageWriteInput[] = [];
		Object.assign(globalThis, {
			window: {
				ryu: {
					storage: {
						get: () => Promise.resolve(null),
						set: (input: StorageWriteInput) => {
							writes.push(input);
							return Promise.resolve();
						},
					},
				},
			},
		});
		const project = makeProject("Persisted");
		project.history = [projectSnapshot(project)];
		await saveState({ projects: [project], trash: [], version: 1 });

		expect(writes).toHaveLength(1);
		expect(writes[0]).toMatchObject({ key: "state.v1", namespace: "slides" });
		const write = writes[0];
		if (!write) {
			throw new Error("Storage write was not recorded");
		}
		const value = slidesStateSchema.parse(JSON.parse(write.value));
		expect(value.projects[0]?.name).toBe("Persisted");
		expect(value.projects[0]?.history).toEqual([]);
		expect(value.projects[0]?.future).toEqual([]);

		Object.assign(globalThis, { window: { ryu: {} } });
		await expect(
			saveState({ projects: [project], trash: [], version: 1 })
		).rejects.toThrow("storage is unavailable");
	});

	test("uses the host picker exactly and preserves cancellation", async () => {
		const calls: UploadInput[] = [];
		Object.assign(globalThis, {
			window: {
				ryu: {
					ui: {
						uploadFile: (input: UploadInput) => {
							calls.push(input);
							return Promise.resolve([
								{
									data_url: "data:image/png;base64,AA==",
									mime_type: "image/png",
									name: "frame.png",
									size: 1,
								},
							]);
						},
					},
				},
			},
		});

		await expect(pickFile("image/*")).resolves.toEqual({
			dataUrl: "data:image/png;base64,AA==",
			mimeType: "image/png",
			name: "frame.png",
		});
		expect(calls).toEqual([{ accept: "image/*", multiple: false }]);

		Object.assign(globalThis, {
			window: {
				ryu: { ui: { uploadFile: () => Promise.resolve(null) } },
			},
		});
		await expect(pickFile("video/*")).resolves.toBeNull();
	});

	test("dispatches media and model calls with bounded production parameters", async () => {
		const calls: Array<{ input: MediaInput; method: string }> = [];
		Object.assign(globalThis, {
			window: {
				ryu: {
					media: {
						image: (input: Parameters<RyuMedia["image"]>[0]) => {
							calls.push({ input, method: "image" });
							return Promise.resolve({
								images: [{ url: "data:image/png;base64,AA==" }],
							});
						},
						video: (input: Parameters<RyuMedia["video"]>[0]) => {
							calls.push({ input, method: "video" });
							return Promise.resolve({ url: "data:video/webm;base64,AA==" });
						},
					},
					model: {
						complete: (input: Parameters<RyuModel["complete"]>[0]) => {
							calls.push({ input, method: "complete" });
							return Promise.resolve(
								'{"slides":[{"headline":"One","body":"Body","visualPrompt":"Blue"}]}'
							);
						},
					},
				},
			},
		});

		await expect(generateImage("blue room")).resolves.toBe(
			"data:image/png;base64,AA=="
		);
		await expect(generateVideo("slow pan")).resolves.toBe(
			"data:video/webm;base64,AA=="
		);
		await expect(generateCarousel("safe systems", 1)).resolves.toMatchObject({
			dropped: 0,
			incomplete: 0,
			slides: [{ headline: "One" }],
		});
		expect(calls[0]).toEqual({
			input: { count: 1, prompt: "blue room", size: "1280x1080" },
			method: "image",
		});
		expect(calls[1]).toEqual({
			input: { prompt: "slow pan" },
			method: "video",
		});
		expect(calls[2]?.method).toBe("complete");
		expect(calls[2]?.input).toMatchObject({ effort: "medium" });
		expect(bridgeStatus()).toEqual({
			image: true,
			model: true,
			storage: false,
			upload: false,
			video: true,
		});
	});
});
