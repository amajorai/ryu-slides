import { afterEach, describe, expect, test } from "bun:test";
import { loadState } from "./bridge";

afterEach(() => {
	(globalThis as { window?: unknown }).window = undefined;
});

describe("Slides storage boundary", () => {
	test("uses an empty node-owned gallery when host storage has no state", async () => {
		(globalThis as { window?: unknown }).window = {
			ryu: {
				storage: {
					get: () => Promise.resolve(null),
				},
			},
		};

		const loaded = await loadState();

		expect(loaded.mode).toBe("live");
		expect(loaded.state.projects).toEqual([]);
		expect(loaded.state.trash).toEqual([]);
	});

	test("does not fall back to preview data after live storage fails", async () => {
		(globalThis as { window?: unknown }).window = {
			ryu: {
				storage: {
					get: () => Promise.reject(new Error("storage unavailable")),
				},
			},
		};

		const loaded = await loadState();

		expect(loaded.mode).toBe("live");
		expect(loaded.state.projects).toEqual([]);
	});
});
