import {
	backgroundForTheme,
	clamp,
	MAX_HISTORY,
	MAX_PROJECTS,
	makeId,
	slideLayout,
	slideTheme,
} from "./model-values.ts";
import type {
	Layer,
	LayerPatch,
	Project,
	ProjectPatch,
	ProjectSnapshot,
	SlideLayout,
	SlidesAction,
	SlidesState,
	SlideTheme,
} from "./types.ts";

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

export function themedLayers(
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

export function positionedLayers(
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

export {
	carouselIssueSummary,
	carouselPrompt,
	carouselSlidesToProjects,
	parseCarouselImport,
	parseCarouselResponse,
	parseCarouselText,
	placeholderImage,
	serializeCarouselDocument,
} from "./model-carousel.ts";
export {
	type CarouselDocumentMetadata,
	demoState,
	emptyState,
	type MakeProjectOptions,
	makeProject,
	normalizeState,
	serializeState,
} from "./model-storage.ts";
export { makeId } from "./model-values.ts";
