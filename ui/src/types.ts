export type LayerKind = "text" | "image" | "shape";

export type SlideLayout = "cover" | "content" | "note" | "closing";

export type SlideTheme = "editorial" | "ai-engineer";

export interface LayerBase {
	height: number;
	id: string;
	locked: boolean;
	name: string;
	opacity: number;
	rotation: number;
	visible: boolean;
	width: number;
	x: number;
	y: number;
}

export interface TextLayer extends LayerBase {
	align: "left" | "center" | "right";
	color: string;
	fontSize: number;
	fontWeight: "400" | "500";
	text: string;
	type: "text";
}

export interface ImageLayer extends LayerBase {
	borderRadius: number;
	fit: "cover" | "contain";
	source: string;
	type: "image";
}

export interface ShapeLayer extends LayerBase {
	borderRadius: number;
	fill: string;
	shape: "rectangle" | "ellipse";
	stroke: string;
	strokeWidth: number;
	type: "shape";
}

export type Layer = TextLayer | ImageLayer | ShapeLayer;

export interface ProjectSnapshot {
	author: string;
	background: string;
	favorite: boolean;
	height: number;
	layers: Layer[];
	layout: SlideLayout;
	mark: string;
	name: string;
	sequence: number;
	seriesId: string;
	seriesTitle: string;
	showFooter: boolean;
	showHeader: boolean;
	theme: SlideTheme;
	width: number;
}

export interface Project extends ProjectSnapshot {
	archivedAt: number | null;
	createdAt: number;
	future: ProjectSnapshot[];
	history: ProjectSnapshot[];
	id: string;
	updatedAt: number;
}

export type GallerySort = "updated" | "created" | "name";

export interface SlidesState {
	projects: Project[];
	trash: Project[];
	version: 1;
}

export interface TransformPatch {
	height?: number;
	kind: "transform";
	name?: string;
	opacity?: number;
	rotation?: number;
	width?: number;
	x?: number;
	y?: number;
}

export type ProjectPatch = Partial<
	Pick<
		ProjectSnapshot,
		| "author"
		| "background"
		| "layout"
		| "mark"
		| "name"
		| "seriesTitle"
		| "showFooter"
		| "showHeader"
		| "theme"
	>
>;

export type LayerPatch =
	| TransformPatch
	| { kind: "visibility"; visible?: boolean; locked?: boolean }
	| {
			kind: "text";
			text?: string;
			color?: string;
			fontSize?: number;
			fontWeight?: TextLayer["fontWeight"];
			align?: TextLayer["align"];
	  }
	| {
			kind: "image";
			source?: string;
			fit?: ImageLayer["fit"];
			borderRadius?: number;
	  }
	| {
			kind: "shape";
			shape?: ShapeLayer["shape"];
			fill?: string;
			stroke?: string;
			strokeWidth?: number;
			borderRadius?: number;
	  };

export type SlidesAction =
	| { type: "add-project"; project: Project }
	| { type: "update-project"; patch: ProjectPatch; projectId: string }
	| { type: "toggle-favorite"; projectId: string }
	| { type: "replace-project"; project: Project }
	| { type: "move-project-to-trash"; id: string }
	| { type: "restore-project"; id: string }
	| { type: "empty-trash" }
	| { type: "add-layer"; projectId: string; layer: Layer }
	| {
			type: "update-layer";
			projectId: string;
			layerId: string;
			patch: LayerPatch;
	  }
	| { type: "delete-layer"; projectId: string; layerId: string }
	| { type: "duplicate-layer"; projectId: string; layerId: string }
	| {
			type: "move-layer";
			projectId: string;
			layerId: string;
			direction: "up" | "down";
	  }
	| { type: "undo"; projectId: string }
	| { type: "redo"; projectId: string };

export interface CarouselSlide {
	body: string;
	headline: string;
	layout?: SlideLayout;
	visualPrompt: string;
}
