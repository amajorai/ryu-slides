import { describe, expect, test } from "bun:test";
import {
	demoState,
	makeProject,
	normalizeState,
	parseCarouselText,
	reduceSlidesState,
	serializeState,
} from "./model";
import type { SlidesState } from "./types";

describe("Slides model", () => {
	test("adds, moves, and undoes a layer", () => {
		const initial = demoState();
		const project = initial.projects[0];
		if (!project) {
			throw new Error("demo project missing");
		}
		const added = reduceSlidesState(initial, {
			type: "add-layer",
			projectId: project.id,
			layer: {
				align: "left",
				color: "#ffffff",
				fontSize: 32,
				fontWeight: "500",
				height: 80,
				id: "layer-extra",
				locked: false,
				name: "Extra",
				opacity: 1,
				rotation: 0,
				text: "Extra",
				type: "text",
				visible: true,
				width: 240,
				x: 20,
				y: 20,
			},
		});
		expect(added.projects[0]?.layers).toHaveLength(3);
		const undone = reduceSlidesState(added, {
			type: "undo",
			projectId: project.id,
		});
		expect(undone.projects[0]?.layers).toHaveLength(2);
		const redone = reduceSlidesState(undone, {
			type: "redo",
			projectId: project.id,
		});
		expect(redone.projects[0]?.layers).toHaveLength(3);
	});

	test("round trips projects without editor history", () => {
		const state = {
			projects: [makeProject("Saved")],
			trash: [],
			version: 1,
		} satisfies SlidesState;
		const parsed = normalizeState(JSON.parse(serializeState(state)));
		expect(parsed.projects[0]?.name).toBe("Saved");
		expect(parsed.projects[0]?.history).toHaveLength(0);
	});

	test("parses fenced carousel JSON and clamps slide count", () => {
		const raw = `\`\`\`json\n{"slides":[${Array.from(
			{ length: 10 },
			(_, index) =>
				`{"headline":"${index}","body":"body","visualPrompt":"visual"}`
		).join(",")}] }\n\`\`\``;
		expect(parseCarouselText(raw)).toHaveLength(8);
	});

	test("moves a project to trash and restores it", () => {
		const state = demoState();
		const id = state.projects[0]?.id;
		if (!id) {
			throw new Error("demo project missing");
		}
		const trashed = reduceSlidesState(state, {
			type: "move-project-to-trash",
			id,
		});
		expect(trashed.projects).toHaveLength(0);
		expect(trashed.trash).toHaveLength(1);
		const restored = reduceSlidesState(trashed, {
			type: "restore-project",
			id,
		});
		expect(restored.projects).toHaveLength(1);
		expect(restored.trash).toHaveLength(0);
	});
});
