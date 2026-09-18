import { describe, expect, test } from "bun:test";
import {
	carouselSlidesToProjects,
	demoState,
	makeProject,
	normalizeState,
	parseCarouselImport,
	parseCarouselText,
	reduceSlidesState,
	serializeCarouselDocument,
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

	test("applies semantic roles and themes without resetting metadata-only edits", () => {
		const state = demoState();
		const project = state.projects[0];
		if (!project) {
			throw new Error("demo project missing");
		}
		const styled = reduceSlidesState(state, {
			patch: { layout: "cover", theme: "ai-engineer" },
			projectId: project.id,
			type: "update-project",
		});
		const styledProject = styled.projects[0];
		expect(styledProject?.layout).toBe("cover");
		expect(styledProject?.background).toBe("#171a18");
		const headlineX = styledProject?.layers[0]?.x;
		const renamed = reduceSlidesState(styled, {
			patch: { mark: "A series" },
			projectId: project.id,
			type: "update-project",
		});
		expect(renamed.projects[0]?.mark).toBe("A series");
		expect(renamed.projects[0]?.layers[0]?.x).toBe(headlineX);
	});

	test("round trips a carousel document and accepts external slide JSON", () => {
		const projects = carouselSlidesToProjects(
			[
				{ body: "Start here.", headline: "A promise", visualPrompt: "" },
				{
					body: "Take the next step.",
					headline: "A next step",
					visualPrompt: "",
				},
			],
			{ title: "A useful carousel" }
		);
		const inserted = projects.reduce(
			(state, project) =>
				reduceSlidesState(state, { project, type: "add-project" }),
			{ projects: [], trash: [], version: 1 } as SlidesState
		);
		const ordered = [...inserted.projects].sort(
			(left, right) => left.sequence - right.sequence
		);
		expect(ordered[0]?.layers[0]).toMatchObject({ text: "A promise" });
		expect(ordered[0]?.layers[1]).toMatchObject({ text: "Start here." });
		const exported = JSON.parse(
			serializeCarouselDocument(inserted.projects)
		) as {
			slides: Array<{ title: string }>;
		};
		expect(exported.slides[0]?.title).toBe("A promise");
		const restored = parseCarouselImport(
			serializeCarouselDocument(inserted.projects)
		);
		expect(restored).toHaveLength(2);
		expect(restored[0]?.layout).toBe("cover");
		expect(restored[1]?.layout).toBe("closing");
		const external = parseCarouselImport(
			JSON.stringify({
				title: "External",
				slides: [{ body: "Body", title: "Headline" }],
			})
		);
		expect(external[0]?.layers[0]?.type).toBe("text");
		expect(external[0]?.seriesTitle).toBe("External");
	});
});
