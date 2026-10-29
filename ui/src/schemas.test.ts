import { describe, expect, test } from "bun:test";
import { makeProject, normalizeState, projectSnapshot } from "./model.ts";
import {
	slideLayerSchema,
	slideProjectSchema,
	slidesStateSchema,
	slidesStoredRecordSchema,
} from "./schemas.ts";

describe("Slides native document contracts", () => {
	test("retains complete native document, project, layer and history identity", () => {
		const project = makeProject("Native");
		project.history = [projectSnapshot(project)];
		const state = { projects: [project], trash: [], version: 1 };
		const parsed = slidesStateSchema.parse(state);
		expect(Object.is(parsed, state)).toBe(true);
		expect(Object.is(parsed.projects, state.projects)).toBe(true);
		expect(Object.is(slideProjectSchema.parse(project), project)).toBe(true);
		expect(Object.is(parsed.projects[0]?.history[0], project.history[0])).toBe(
			true
		);
		const layer = project.layers[0];
		expect(Object.is(slideLayerSchema.parse(layer), layer)).toBe(true);
	});
	test("requires actual complete published records and finite selections", () => {
		const project = makeProject("Native");
		expect(
			slideProjectSchema.safeParse({ ...project, theme: "unknown" }).success
		).toBe(false);
		expect(
			slideProjectSchema.safeParse({ ...project, width: "1280" }).success
		).toBe(false);
		expect(
			slidesStateSchema.safeParse({
				projects: [project],
				trash: [],
				version: 2,
			}).success
		).toBe(false);
		expect(
			slideLayerSchema.safeParse({
				...project.layers[0],
				type: "text",
				align: "justify",
			}).success
		).toBe(false);
	});
	test("preserves actual legacy field defaults, limits and malformed-entry accounting", () => {
		const parsed = normalizeState({
			projects: [
				{
					id: "legacy",
					layers: [
						{ type: "text", fontWeight: "700", width: -1, opacity: 5 },
						{ type: "other" },
					],
				},
			],
			trash: [],
		});
		expect(parsed.projects[0]?.id).toBe("legacy");
		expect(parsed.projects[0]?.width).toBe(1280);
		expect(parsed.projects[0]?.layers).toHaveLength(1);
		expect(parsed.projects[0]?.layers[0]).toMatchObject({
			fontWeight: "500",
			width: 16,
			opacity: 1,
		});
		expect(parsed.projects[0]?.history).toEqual([]);
	});
	test("retains and validates original nested JSON keys including own prototype entries", () => {
		const native = JSON.parse(
			'{"__proto__":{"native":true},"nested":{"__proto__":[null,false,"value"]}}'
		);
		const parsed = slidesStoredRecordSchema.parse(native);
		expect(Object.is(parsed, native)).toBe(true);
		expect(Object.hasOwn(parsed, "__proto__")).toBe(true);
		expect(Object.is(parsed.nested, native.nested)).toBe(true);
		const malformed = JSON.parse('{"nested":{"__proto__":null}}');
		Object.defineProperty(malformed.nested, "__proto__", {
			value: () => "not JSON",
			configurable: true,
			enumerable: true,
		});
		expect(slidesStoredRecordSchema.safeParse(malformed).success).toBe(false);
	});
});
