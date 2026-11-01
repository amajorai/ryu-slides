import { z } from "zod";
import {
	type SlidesStoredRecord,
	type SlidesStoredValue,
	slidesStoredRecordSchema,
	slidesStoredValueSchema,
} from "./schemas.ts";
import type {
	CarouselImportResult,
	CarouselParseResult,
	CarouselSlide,
	GeometricLayer,
	Layer,
	LayerPatch,
	Project,
	ProjectPatch,
	ProjectSnapshot,
	SlideLayout,
	SlidesAction,
	SlidesState,
	SlideTheme,
	TextLayer,
} from "./types.ts";

const MAX_HISTORY = 50;
const MAX_PROJECTS = 120;
const DEFAULT_MARK = "Ryu / Slides";
const DEFAULT_AUTHOR = "Ryu";
const DEFAULT_LAYOUT: SlideLayout = "content";
const DEFAULT_THEME: SlideTheme = "editorial";

function storedRecord(
	value: SlidesStoredValue | SlidesState
): SlidesStoredRecord | null {
	const parsed = slidesStoredRecordSchema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}
	// The original local parser accepted JSON arrays as object-like values; they
	// have no named document fields, so retain its empty-object normalization.
	return Array.isArray(value) ? {} : null;
}

function stringValue(value: SlidesStoredValue, fallback: string): string {
	const parsed = z.string().safeParse(value);
	return parsed.success ? parsed.data : fallback;
}

function numberValue(value: SlidesStoredValue, fallback: number): number {
	const parsed = z.number().safeParse(value);
	return parsed.success && Number.isFinite(parsed.data)
		? parsed.data
		: fallback;
}

function booleanValue(value: SlidesStoredValue, fallback: boolean): boolean {
	const parsed = z.boolean().safeParse(value);
	return parsed.success ? parsed.data : fallback;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function slideLayout(
	value: SlidesStoredValue,
	fallback = DEFAULT_LAYOUT
): SlideLayout {
	return value === "cover" || value === "note" || value === "closing"
		? value
		: value === "content"
			? value
			: fallback;
}

function slideTheme(
	value: SlidesStoredValue,
	fallback = DEFAULT_THEME
): SlideTheme {
	return value === "ai-engineer" || value === "editorial" ? value : fallback;
}

function backgroundForTheme(theme: SlideTheme, layout: SlideLayout): string {
	if (theme === "ai-engineer") {
		return layout === "cover" || layout === "closing" ? "#171a18" : "#efeeea";
	}
	return "#f4f1e9";
}

export function makeId(prefix: string): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	return uuid
		? `${prefix}-${uuid.slice(0, 8)}`
		: `${prefix}-${Date.now().toString(36)}`;
}

export function projectSnapshot(project: Project): ProjectSnapshot {
	return {
		author: project.author,
		background: project.background,
		height: project.height,
		layers: project.layers,
		layout: project.layout,
		mark: project.mark,
		name: project.name,
		sequence: project.sequence,
		seriesId: project.seriesId,
		seriesTitle: project.seriesTitle,
		showFooter: project.showFooter,
		showHeader: project.showHeader,
		theme: project.theme,
		width: project.width,
		favorite: project.favorite,
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

function themedLayers(
	layers: Layer[],
	theme: SlideTheme,
	layout: SlideLayout
): Layer[] {
	const darkFrame =
		theme === "ai-engineer" && (layout === "cover" || layout === "closing");
	const textColor = darkFrame ? "#f4f1e9" : "#171a18";
	return layers.map((layer) =>
		layer.type === "text" ? { ...layer, color: textColor } : layer
	);
}

function positionedLayers(
	layers: Layer[],
	layout: SlideLayout,
	width: number
): Layer[] {
	let textIndex = 0;
	return layers.map((layer) => {
		if (layer.type !== "text") {
			return layer;
		}
		const isHeadline = textIndex === 0;
		textIndex += 1;
		const centered =
			layout === "cover" || layout === "note" || layout === "closing";
		const headline = {
			cover: { fontSize: 100, height: 260, width: width - 180, x: 90, y: 170 },
			content: {
				fontSize: 76,
				height: 230,
				width: width - 220,
				x: 110,
				y: 135,
			},
			note: { fontSize: 82, height: 250, width: width - 220, x: 110, y: 370 },
			closing: { fontSize: 96, height: 250, width: width - 180, x: 90, y: 290 },
		}[layout];
		const supporting = {
			cover: { fontSize: 34, height: 180, width: width - 260, x: 130, y: 540 },
			content: {
				fontSize: 34,
				height: 220,
				width: width - 240,
				x: 120,
				y: 440,
			},
			note: { fontSize: 30, height: 160, width: width - 280, x: 140, y: 720 },
			closing: {
				fontSize: 34,
				height: 180,
				width: width - 260,
				x: 130,
				y: 585,
			},
		}[layout];
		const position = isHeadline ? headline : supporting;
		return {
			...layer,
			align: centered ? "center" : "left",
			fontSize: position.fontSize,
			height: position.height,
			width: position.width,
			x: position.x,
			y: position.y,
		};
	});
}

function applyProjectStyle(
	project: Project,
	patch: ProjectPatch,
	withUndo = true
): Project {
	const nextLayout = slideLayout(patch.layout ?? project.layout);
	const nextTheme = slideTheme(patch.theme ?? project.theme);
	const layoutChanged =
		patch.layout !== undefined && nextLayout !== project.layout;
	const themeChanged = patch.theme !== undefined && nextTheme !== project.theme;
	const nextLayers = layoutChanged
		? positionedLayers(
				themedLayers(project.layers, nextTheme, nextLayout),
				nextLayout,
				project.width
			)
		: themeChanged
			? themedLayers(project.layers, nextTheme, nextLayout)
			: project.layers;
	const nextSnapshot: ProjectSnapshot = {
		...projectSnapshot(project),
		...patch,
		background:
			patch.background ??
			(layoutChanged || themeChanged
				? backgroundForTheme(nextTheme, nextLayout)
				: project.background),
		layout: nextLayout,
		theme: nextTheme,
		layers: nextLayers,
	};
	return withUndo
		? withHistory(project, nextSnapshot)
		: snapshotProject(project, nextSnapshot);
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
			return {
				...state,
				projects: [action.project, ...state.projects].slice(0, MAX_PROJECTS),
			};
		case "update-project":
			return updateProject(state, action.projectId, (project) =>
				applyProjectStyle(project, action.patch)
			);
		case "toggle-favorite":
			return updateProject(state, action.projectId, (project) => ({
				...project,
				favorite: !project.favorite,
				updatedAt: Date.now(),
			}));
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

function parseLayer(value: SlidesStoredValue, index: number): Layer | null {
	const stored = storedRecord(value);
	if (!stored) {
		return null;
	}
	const type = stored.type;
	const base = {
		height: clamp(numberValue(stored.height, 180), 16, 4000),
		id: stringValue(stored.id, `layer-${index}`),
		locked: booleanValue(stored.locked, false),
		name: stringValue(stored.name, `Layer ${index + 1}`),
		opacity: clamp(numberValue(stored.opacity, 1), 0, 1),
		rotation: numberValue(stored.rotation, 0),
		visible: booleanValue(stored.visible, true),
		width: clamp(numberValue(stored.width, 360), 16, 4000),
		x: numberValue(stored.x, 80),
		y: numberValue(stored.y, 80),
	};
	if (type === "text") {
		const fontWeight = stored.fontWeight;
		const align = stored.align;
		const normalizedFontWeight: TextLayer["fontWeight"] =
			z.string().safeParse(fontWeight).success && Number(fontWeight) >= 500
				? "500"
				: "400";
		const layer: TextLayer = {
			...base,
			align: align === "center" || align === "right" ? align : "left",
			color: stringValue(stored.color, "#171a18"),
			fontSize: clamp(numberValue(stored.fontSize, 72), 8, 320),
			fontWeight: normalizedFontWeight,
			text: stringValue(stored.text, "New idea"),
			type: "text",
		};
		return layer;
	}
	if (type === "image") {
		return {
			...base,
			borderRadius: clamp(numberValue(stored.borderRadius, 24), 0, 240),
			fit: stored.fit === "contain" ? "contain" : "cover",
			source: stringValue(stored.source, placeholderImage()),
			type: "image",
		};
	}
	if (type === "shape") {
		const geometry: GeometricLayer = {
			...base,
			borderRadius: clamp(numberValue(stored.borderRadius, 24), 0, 240),
			fill: stringValue(stored.fill, "#e9f48b"),
			shape: stored.shape === "ellipse" ? "ellipse" : "rectangle",
			stroke: stringValue(stored.stroke, "transparent"),
			strokeWidth: clamp(numberValue(stored.strokeWidth, 0), 0, 80),
			type: "shape",
		};
		return geometry;
	}
	return null;
}

function parseProject(value: SlidesStoredValue, index: number): Project | null {
	const stored = storedRecord(value);
	if (!stored) {
		return null;
	}
	const rawLayers = Array.isArray(stored.layers) ? stored.layers : [];
	const layers = rawLayers
		.map((layer, layerIndex) => parseLayer(layer, layerIndex))
		.filter((layer): layer is Layer => layer !== null);
	const createdAt = numberValue(stored.createdAt, Date.now());
	const id = stringValue(stored.id, `project-${index}`);
	const layout = slideLayout(stored.layout);
	const theme = slideTheme(stored.theme);
	return {
		author: stringValue(stored.author, DEFAULT_AUTHOR),
		archivedAt:
			stored.archivedAt === null
				? null
				: numberValue(stored.archivedAt, 0) || null,
		background: stringValue(stored.background, "#f4f1e9"),
		createdAt,
		future: [],
		height: clamp(numberValue(stored.height, 1080), 240, 4000),
		history: [],
		id,
		layers,
		layout,
		mark: stringValue(stored.mark, DEFAULT_MARK),
		name: stringValue(stored.name, `Project ${index + 1}`),
		sequence: numberValue(stored.sequence, index),
		seriesId: stringValue(stored.seriesId, id),
		seriesTitle: stringValue(
			stored.seriesTitle,
			stringValue(stored.name, `Project ${index + 1}`)
		),
		showFooter: booleanValue(stored.showFooter, true),
		showHeader: booleanValue(stored.showHeader, true),
		theme,
		updatedAt: numberValue(stored.updatedAt, createdAt),
		width: clamp(numberValue(stored.width, 1280), 240, 4000),
		favorite: booleanValue(stored.favorite, false),
	};
}

export function normalizeState(
	value: SlidesStoredValue | SlidesState
): SlidesState {
	const stored = storedRecord(value);
	if (!stored) {
		return demoState();
	}
	const projects = Array.isArray(stored.projects)
		? stored.projects
				.slice(0, MAX_PROJECTS)
				.map((project, index) => parseProject(project, index))
				.filter(
					(project): project is Project =>
						project !== null && project.archivedAt === null
				)
		: [];
	const trash = Array.isArray(stored.trash)
		? stored.trash
				.slice(0, MAX_PROJECTS)
				.map((project, index) => parseProject(project, index))
				.filter((project): project is Project => project !== null)
		: [];
	return { projects, trash, version: 1 };
}

/** Empty node-owned state. The sample project is reserved for standalone preview mode. */
export function emptyState(): SlidesState {
	return { projects: [], trash: [], version: 1 };
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

export interface MakeProjectOptions {
	author?: string;
	layout?: SlideLayout;
	mark?: string;
	sequence?: number;
	seriesId?: string;
	seriesTitle?: string;
	showFooter?: boolean;
	showHeader?: boolean;
	theme?: SlideTheme;
}

export interface CarouselDocumentMetadata {
	author?: string;
	mark?: string;
	seriesId?: string;
	theme?: SlideTheme;
	title?: string;
}

export function makeProject(
	name = "Untitled project",
	options: MakeProjectOptions = {}
): Project {
	const now = Date.now();
	const id = makeId("project");
	const layout = slideLayout(options.layout);
	const theme = slideTheme(options.theme);
	const width = 1280;
	const baseLayers: Layer[] = [
		{
			align: "left",
			color: "#171a18",
			fontSize: 92,
			fontWeight: "500",
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
	];
	return {
		author: options.author ?? DEFAULT_AUTHOR,
		archivedAt: null,
		background: backgroundForTheme(theme, layout),
		createdAt: now,
		future: [],
		height: 1080,
		history: [],
		id,
		layers: positionedLayers(
			themedLayers(baseLayers, theme, layout),
			layout,
			width
		),
		layout,
		mark: options.mark ?? DEFAULT_MARK,
		name,
		sequence: options.sequence ?? 0,
		seriesId: options.seriesId ?? makeId("series"),
		seriesTitle: options.seriesTitle ?? name,
		showFooter: options.showFooter ?? true,
		showHeader: options.showHeader ?? true,
		theme,
		updatedAt: now,
		width,
		favorite: false,
	};
}

export function demoState(): SlidesState {
	return { projects: [makeProject("First frame")], trash: [], version: 1 };
}

export function placeholderImage(): string {
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" fill="#171a18"/><circle cx="500" cy="100" r="150" fill="#e9f48b"/><path d="M0 310C160 220 280 360 640 245V420H0Z" fill="#5f7659"/><text x="42" y="92" fill="#f4f1e9" font-family="Geist Variable, Geist, sans-serif" font-size="32" font-weight="500">SLIDES</text></svg>';
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function trimmedString(value: SlidesStoredValue): string {
	const parsed = z.string().safeParse(value);
	return parsed.success ? parsed.data.trim() : "";
}

export function parseCarouselResponse(
	value: SlidesStoredValue,
	maxSlides = 8
): CarouselParseResult {
	const result: CarouselParseResult = { dropped: 0, incomplete: 0, slides: [] };
	const stored = storedRecord(value);
	if (!(stored && Array.isArray(stored.slides))) {
		return result;
	}
	for (const rawSlide of stored.slides) {
		if (result.slides.length >= maxSlides) {
			break;
		}
		const slide = storedRecord(rawSlide);
		if (!slide) {
			result.dropped += 1;
			continue;
		}
		const headline =
			trimmedString(slide.headline) || trimmedString(slide.title);
		if (!headline) {
			result.dropped += 1;
			continue;
		}
		const body = trimmedString(slide.body);
		const visualPrompt = trimmedString(slide.visualPrompt);
		if (!(body && visualPrompt)) {
			result.incomplete += 1;
		}
		const parsedSlide: CarouselSlide = { body, headline, visualPrompt };
		if (slide.layout === undefined) {
			result.slides.push(parsedSlide);
		} else {
			const withLayout: CarouselSlide = {
				body,
				headline,
				layout: slideLayout(slide.layout, "content"),
				visualPrompt,
			};
			result.slides.push(withLayout);
		}
	}
	return result;
}

/**
 * Describe slides the parser skipped or left partly empty, so the UI can tell
 * the user instead of silently filling gaps. Returns "" when nothing is missing.
 */
export function carouselIssueSummary({
	dropped,
	incomplete,
}: Pick<CarouselParseResult, "dropped" | "incomplete">): string {
	const parts: string[] = [];
	if (dropped > 0) {
		parts.push(
			`${dropped} slide${dropped === 1 ? "" : "s"} without a headline ${dropped === 1 ? "was" : "were"} skipped`
		);
	}
	if (incomplete > 0) {
		parts.push(
			`${incomplete} ${incomplete === 1 ? "frame is" : "frames are"} missing a body or visual prompt`
		);
	}
	return parts.length > 0 ? `${parts.join("; ")}.` : "";
}

export function carouselSlidesToProjects(
	slides: CarouselSlide[],
	metadata: CarouselDocumentMetadata = {}
): Project[] {
	const bounded = slides.slice(0, 50);
	const title = metadata.title?.trim() || "Imported carousel";
	const seriesId = metadata.seriesId ?? makeId("series");
	return bounded.map((slide, index) => {
		const layout =
			slide.layout ??
			(index === 0
				? "cover"
				: index === bounded.length - 1
					? "closing"
					: "content");
		const project = makeProject(
			`${title} ${String(index + 1).padStart(2, "0")}`,
			{
				author: metadata.author,
				layout,
				mark: metadata.mark,
				seriesId,
				seriesTitle: title,
				sequence: index,
				theme: metadata.theme,
			}
		);
		const supportingText: TextLayer = {
			align: "left",
			color: "#171a18",
			fontSize: 34,
			fontWeight: "400",
			height: 140,
			id: makeId("layer"),
			locked: false,
			name: "Body",
			opacity: 1,
			rotation: 0,
			text: slide.body,
			type: "text",
			visible: true,
			width: 720,
			x: 110,
			y: 430,
		};
		const importedLayers = [...project.layers];
		importedLayers.splice(1, 0, supportingText);
		let textIndex = 0;
		const layers = positionedLayers(
			themedLayers(importedLayers, project.theme, layout),
			layout,
			project.width
		).map((layer) => {
			if (layer.type !== "text") {
				return layer;
			}
			const text = textIndex === 0 ? slide.headline : slide.body;
			textIndex += 1;
			return { ...layer, text };
		});
		const createdAt = project.createdAt + index;
		return { ...project, createdAt, layers, updatedAt: createdAt };
	});
}

function projectHeadline(project: Project): string {
	return (
		project.layers.find((layer): layer is TextLayer => layer.type === "text")
			?.text ?? project.name
	);
}

function projectBody(project: Project): string {
	const textLayers = project.layers.filter(
		(layer): layer is TextLayer => layer.type === "text"
	);
	return textLayers[1]?.text ?? "";
}

export function serializeCarouselDocument(projects: Project[]): string {
	const ordered = [...projects].sort(
		(left, right) =>
			left.sequence - right.sequence || left.createdAt - right.createdAt
	);
	const first = ordered[0];
	const stripHistory = (project: Project) => ({
		...project,
		future: [],
		history: [],
	});
	return JSON.stringify(
		{
			app: "@ryu/slides",
			author: first?.author ?? DEFAULT_AUTHOR,
			mark: first?.mark ?? DEFAULT_MARK,
			projects: ordered.map(stripHistory),
			theme: first?.theme ?? DEFAULT_THEME,
			title: first?.seriesTitle ?? first?.name ?? "Untitled carousel",
			version: 1,
			slides: ordered.map((project) => ({
				body: projectBody(project),
				id: project.id,
				layout: project.layout,
				sequence: project.sequence,
				title: projectHeadline(project),
			})),
		},
		null,
		2
	);
}

export function parseCarouselImport(raw: string): CarouselImportResult {
	let value: SlidesStoredValue;
	try {
		value = slidesStoredValueSchema.parse(JSON.parse(raw));
	} catch {
		throw new Error("That is not valid carousel JSON.");
	}
	const stored = storedRecord(value);
	if (!stored) {
		throw new Error("The carousel document must be a JSON object.");
	}
	if (Array.isArray(stored.projects)) {
		const imported = normalizeState({
			projects: stored.projects,
			trash: [],
		}).projects;
		if (imported.length > 0) {
			return { dropped: 0, incomplete: 0, projects: imported };
		}
	}
	if (Array.isArray(stored.slides)) {
		const { dropped, incomplete, slides } = parseCarouselResponse(stored, 50);
		if (slides.length > 0) {
			const projects = carouselSlidesToProjects(slides, {
				author: stringValue(stored.author, DEFAULT_AUTHOR),
				mark: stringValue(stored.mark, DEFAULT_MARK),
				theme: slideTheme(stored.theme),
				title: stringValue(stored.title, "Imported carousel"),
			});
			return { dropped, incomplete, projects };
		}
	}
	throw new Error("The carousel document has no usable projects or slides.");
}

export function parseCarouselText(raw: string): CarouselParseResult {
	const trimmed = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start < 0 || end <= start) {
		return { dropped: 0, incomplete: 0, slides: [] };
	}
	try {
		return parseCarouselResponse(JSON.parse(trimmed.slice(start, end + 1)));
	} catch {
		return { dropped: 0, incomplete: 0, slides: [] };
	}
}

export function carouselPrompt(topic: string, count: number): string {
	return [
		"Return JSON only with this shape: {slides:[{headline:string,body:string,visualPrompt:string}]}.",
		`Create ${count} concise visual slides for: ${topic.trim() || "a useful idea"}.`,
		"Keep each headline short, each body actionable, and each visualPrompt safe for an image model.",
	].join("\n");
}
