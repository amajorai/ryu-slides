import { translate as tl } from "@ryu/i18n/core";
import { z } from "zod";
import { positionedLayers, themedLayers } from "./model.ts";
import { placeholderImage } from "./model-carousel.ts";
import {
	backgroundForTheme,
	booleanValue,
	clamp,
	DEFAULT_AUTHOR,
	DEFAULT_MARK,
	MAX_PROJECTS,
	makeId,
	numberValue,
	slideLayout,
	slideTheme,
	storedRecord,
	stringValue,
} from "./model-values.ts";
import type { SlidesStoredValue } from "./schemas.ts";
import type {
	GeometricLayer,
	Layer,
	Project,
	SlideLayout,
	SlidesState,
	SlideTheme,
	TextLayer,
} from "./types.ts";

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
		name: stringValue(stored.name, tl("Layer {0}", { 0: String(index + 1) })),
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
		name: stringValue(stored.name, tl("Project {0}", { 0: String(index + 1) })),
		sequence: numberValue(stored.sequence, index),
		seriesId: stringValue(stored.seriesId, id),
		seriesTitle: stringValue(
			stored.seriesTitle,
			stringValue(stored.name, tl("Project {0}", { 0: String(index + 1) }))
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
	name = tl("Untitled project"),
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
			name: tl("Headline"),
			opacity: 1,
			rotation: 0,
			text: tl("Make the frame clear."),
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
			name: tl("Signal shape"),
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
	return { projects: [makeProject(tl("First frame"))], trash: [], version: 1 };
}
