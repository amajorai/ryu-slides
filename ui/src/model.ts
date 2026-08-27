import type {
	CarouselSlide,
	Layer,
	LayerPatch,
	Project,
	ProjectSnapshot,
	ShapeLayer,
	SlidesAction,
	SlidesState,
	TextLayer,
} from "./types";

const MAX_HISTORY = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
	return typeof value === "boolean" ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function makeId(prefix: string): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	return uuid
		? `${prefix}-${uuid.slice(0, 8)}`
		: `${prefix}-${Date.now().toString(36)}`;
}

export function projectSnapshot(project: Project): ProjectSnapshot {
	return {
		background: project.background,
		height: project.height,
		layers: project.layers,
		name: project.name,
		width: project.width,
	};
}

function snapshotProject(project: Project, snapshot: ProjectSnapshot): Project {
	return {
		...project,
		...snapshot,
		updatedAt: Date.now(),
	};
}

function withHistory(project: Project, next: ProjectSnapshot): Project {
	const past = [...project.history, projectSnapshot(project)].slice(
		-MAX_HISTORY
	);
	return {
		...snapshotProject(project, next),
		future: [],
		history: past,
	};
}

function updateProject(
	state: SlidesState,
	projectId: string,
	updater: (project: Project) => Project
): SlidesState {
	return {
		...state,
		projects: state.projects.map((project) =>
			project.id === projectId ? updater(project) : project
		),
	};
}

function patchLayer(layer: Layer, patch: LayerPatch): Layer {
	if (patch.kind === "transform") {
		return {
			...layer,
			height: clamp(patch.height ?? layer.height, 16, 4000),
			name: patch.name ?? layer.name,
			opacity: clamp(patch.opacity ?? layer.opacity, 0, 1),
			rotation: patch.rotation ?? layer.rotation,
			width: clamp(patch.width ?? layer.width, 16, 4000),
			x: patch.x ?? layer.x,
			y: patch.y ?? layer.y,
		};
	}
	if (patch.kind === "visibility") {
		return {
			...layer,
			locked: patch.locked ?? layer.locked,
			visible: patch.visible ?? layer.visible,
		};
	}
	if (patch.kind === "text" && layer.type === "text") {
		return {
			...layer,
			align: patch.align ?? layer.align,
			color: patch.color ?? layer.color,
			fontSize: clamp(patch.fontSize ?? layer.fontSize, 8, 320),
			fontWeight: patch.fontWeight ?? layer.fontWeight,
			text: patch.text ?? layer.text,
		};
	}
	if (patch.kind === "image" && layer.type === "image") {
		return {
			...layer,
			borderRadius: clamp(patch.borderRadius ?? layer.borderRadius, 0, 240),
			fit: patch.fit ?? layer.fit,
			source: patch.source ?? layer.source,
		};
	}
	if (patch.kind === "shape" && layer.type === "shape") {
		return {
			...layer,
			borderRadius: clamp(patch.borderRadius ?? layer.borderRadius, 0, 240),
			fill: patch.fill ?? layer.fill,
			shape: patch.shape ?? layer.shape,
			stroke: patch.stroke ?? layer.stroke,
			strokeWidth: clamp(patch.strokeWidth ?? layer.strokeWidth, 0, 80),
		};
	}
	return layer;
}

function updateLayerProject(
	project: Project,
	layerId: string,
	patch: LayerPatch
): Project {
	const layers = project.layers.map((layer) =>
		layer.id === layerId ? patchLayer(layer, patch) : layer
	);
	return withHistory(project, { ...projectSnapshot(project), layers });
}

export function reduceSlidesState(
	state: SlidesState,
	action: SlidesAction
): SlidesState {
	switch (action.type) {
		case "add-project":
			return { ...state, projects: [action.project, ...state.projects] };
		case "replace-project":
			return updateProject(state, action.project.id, () => action.project);
		case "move-project-to-trash": {
			const project = state.projects.find((item) => item.id === action.id);
			if (!project) {
				return state;
			}
			const trashed = { ...project, archivedAt: Date.now() };
			return {
				...state,
				projects: state.projects.filter((item) => item.id !== action.id),
				trash: [
					trashed,
					...state.trash.filter((item) => item.id !== action.id),
				],
			};
		}
		case "restore-project": {
			const project = state.trash.find((item) => item.id === action.id);
			if (!project) {
				return state;
			}
			return {
				...state,
				projects: [
					{ ...project, archivedAt: null, updatedAt: Date.now() },
					...state.projects,
				],
				trash: state.trash.filter((item) => item.id !== action.id),
			};
		}
		case "empty-trash":
			return { ...state, trash: [] };
		case "add-layer":
			return updateProject(state, action.projectId, (project) =>
				withHistory(project, {
					...projectSnapshot(project),
					layers: [...project.layers, action.layer],
				})
			);
		case "update-layer":
			return updateProject(state, action.projectId, (project) =>
				updateLayerProject(project, action.layerId, action.patch)
			);
		case "delete-layer":
			return updateProject(state, action.projectId, (project) =>
				withHistory(project, {
					...projectSnapshot(project),
					layers: project.layers.filter((layer) => layer.id !== action.layerId),
				})
			);
		case "duplicate-layer":
			return updateProject(state, action.projectId, (project) => {
				const source = project.layers.find(
					(layer) => layer.id === action.layerId
				);
				if (!source) {
					return project;
				}
				const copy: Layer = {
					...source,
					id: makeId("layer"),
					name: `${source.name} copy`,
					x: source.x + 32,
					y: source.y + 32,
				};
				const index = project.layers.findIndex(
					(layer) => layer.id === source.id
				);
				const layers = [...project.layers];
				layers.splice(index + 1, 0, copy);
				return withHistory(project, { ...projectSnapshot(project), layers });
			});
		case "move-layer":
			return updateProject(state, action.projectId, (project) => {
				const index = project.layers.findIndex(
					(layer) => layer.id === action.layerId
				);
				const nextIndex = action.direction === "up" ? index + 1 : index - 1;
				if (index < 0 || nextIndex < 0 || nextIndex >= project.layers.length) {
					return project;
				}
				const layers = [...project.layers];
				const [layer] = layers.splice(index, 1);
				if (!layer) {
					return project;
				}
				layers.splice(nextIndex, 0, layer);
				return withHistory(project, { ...projectSnapshot(project), layers });
			});
		case "undo":
			return updateProject(state, action.projectId, (project) => {
				const previous = project.history.at(-1);
				if (!previous) {
					return project;
				}
				return {
					...snapshotProject(project, previous),
					future: [projectSnapshot(project), ...project.future].slice(
						0,
						MAX_HISTORY
					),
					history: project.history.slice(0, -1),
				};
			});
		case "redo":
			return updateProject(state, action.projectId, (project) => {
				const next = project.future[0];
				if (!next) {
					return project;
				}
				return {
					...snapshotProject(project, next),
					future: project.future.slice(1),
					history: [...project.history, projectSnapshot(project)].slice(
						-MAX_HISTORY
					),
				};
			});
	}
}

function parseLayer(value: unknown, index: number): Layer | null {
	if (!isRecord(value)) {
		return null;
	}
	const type = value.type;
	const base = {
		height: clamp(numberValue(value.height, 180), 16, 4000),
		id: stringValue(value.id, `layer-${index}`),
		locked: booleanValue(value.locked, false),
		name: stringValue(value.name, `Layer ${index + 1}`),
		opacity: clamp(numberValue(value.opacity, 1), 0, 1),
		rotation: numberValue(value.rotation, 0),
		visible: booleanValue(value.visible, true),
		width: clamp(numberValue(value.width, 360), 16, 4000),
		x: numberValue(value.x, 80),
		y: numberValue(value.y, 80),
	};
	if (type === "text") {
		const fontWeight = value.fontWeight;
		const align = value.align;
		const layer: TextLayer = {
			...base,
			align: align === "center" || align === "right" ? align : "left",
			color: stringValue(value.color, "#171a18"),
			fontSize: clamp(numberValue(value.fontSize, 72), 8, 320),
			fontWeight:
				fontWeight === "500" || fontWeight === "700" || fontWeight === "800"
					? fontWeight
					: "400",
			text: stringValue(value.text, "New idea"),
			type: "text",
		};
		return layer;
	}
	if (type === "image") {
		return {
			...base,
			borderRadius: clamp(numberValue(value.borderRadius, 24), 0, 240),
			fit: value.fit === "contain" ? "contain" : "cover",
			source: stringValue(value.source, placeholderImage()),
			type: "image",
		};
	}
	if (type === "shape") {
		const shape: ShapeLayer = {
			...base,
			borderRadius: clamp(numberValue(value.borderRadius, 24), 0, 240),
			fill: stringValue(value.fill, "#e9f48b"),
			shape: value.shape === "ellipse" ? "ellipse" : "rectangle",
			stroke: stringValue(value.stroke, "transparent"),
			strokeWidth: clamp(numberValue(value.strokeWidth, 0), 0, 80),
			type: "shape",
		};
		return shape;
	}
	return null;
}

function parseProject(value: unknown, index: number): Project | null {
	if (!isRecord(value)) {
		return null;
	}
	const rawLayers = Array.isArray(value.layers) ? value.layers : [];
	const layers = rawLayers
		.map((layer, layerIndex) => parseLayer(layer, layerIndex))
		.filter((layer): layer is Layer => layer !== null);
	const createdAt = numberValue(value.createdAt, Date.now());
	return {
		archivedAt:
			value.archivedAt === null
				? null
				: numberValue(value.archivedAt, 0) || null,
		background: stringValue(value.background, "#f4f1e9"),
		createdAt,
		future: [],
		height: clamp(numberValue(value.height, 1080), 240, 4000),
		history: [],
		id: stringValue(value.id, `project-${index}`),
		layers,
		name: stringValue(value.name, `Project ${index + 1}`),
		updatedAt: numberValue(value.updatedAt, createdAt),
		width: clamp(numberValue(value.width, 1280), 240, 4000),
	};
}

export function normalizeState(value: unknown): SlidesState {
	if (!isRecord(value)) {
		return demoState();
	}
	const projects = Array.isArray(value.projects)
		? value.projects
				.map((project, index) => parseProject(project, index))
				.filter(
					(project): project is Project =>
						project !== null && project.archivedAt === null
				)
		: [];
	const trash = Array.isArray(value.trash)
		? value.trash
				.map((project, index) => parseProject(project, index))
				.filter((project): project is Project => project !== null)
		: [];
	return { projects, trash, version: 1 };
}

export function serializeState(state: SlidesState): string {
	const stripHistory = (project: Project) => ({
		...project,
		future: [],
		history: [],
	});
	return JSON.stringify({
		projects: state.projects.map(stripHistory),
		trash: state.trash.map(stripHistory),
		version: 1,
	});
}

export function makeProject(name = "Untitled project"): Project {
	const now = Date.now();
	return {
		archivedAt: null,
		background: "#f4f1e9",
		createdAt: now,
		future: [],
		height: 1080,
		history: [],
		id: makeId("project"),
		layers: [
			{
				align: "left",
				color: "#171a18",
				fontSize: 92,
				fontWeight: "800",
				height: 220,
				id: makeId("layer"),
				locked: false,
				name: "Headline",
				opacity: 1,
				rotation: 0,
				text: "Make the frame clear.",
				type: "text",
				visible: true,
				width: 980,
				x: 110,
				y: 180,
			},
			{
				borderRadius: 40,
				fill: "#e9f48b",
				height: 260,
				id: makeId("layer"),
				locked: false,
				name: "Signal shape",
				opacity: 1,
				rotation: -8,
				shape: "ellipse",
				stroke: "transparent",
				strokeWidth: 0,
				type: "shape",
				visible: true,
				width: 320,
				x: 840,
				y: 630,
			},
		],
		name,
		updatedAt: now,
		width: 1280,
	};
}

export function demoState(): SlidesState {
	return { projects: [makeProject("First frame")], trash: [], version: 1 };
}

export function placeholderImage(): string {
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" fill="#171a18"/><circle cx="500" cy="100" r="150" fill="#e9f48b"/><path d="M0 310C160 220 280 360 640 245V420H0Z" fill="#5f7659"/><text x="42" y="92" fill="#f4f1e9" font-family="Arial" font-size="32" font-weight="700">SLIDES</text></svg>';
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function parseCarouselResponse(value: unknown): CarouselSlide[] {
	if (!(isRecord(value) && Array.isArray(value.slides))) {
		return [];
	}
	return value.slides
		.filter(isRecord)
		.map((slide) => ({
			body: stringValue(slide.body, "A useful next step."),
			headline: stringValue(slide.headline, "A clearer idea"),
			visualPrompt: stringValue(slide.visualPrompt, "Editorial still life"),
		}))
		.slice(0, 8);
}

export function parseCarouselText(raw: string): CarouselSlide[] {
	const trimmed = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start < 0 || end <= start) {
		return [];
	}
	try {
		return parseCarouselResponse(JSON.parse(trimmed.slice(start, end + 1)));
	} catch {
		return [];
	}
}

export function carouselPrompt(topic: string, count: number): string {
	return [
		"Return JSON only with this shape: {slides:[{headline:string,body:string,visualPrompt:string}]}.",
		`Create ${count} concise visual slides for: ${topic.trim() || "a useful idea"}.`,
		"Keep each headline short, each body actionable, and each visualPrompt safe for an image model.",
	].join("\n");
}
