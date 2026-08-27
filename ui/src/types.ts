export type LayerKind = "text" | "image" | "shape";

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
	fontWeight: "400" | "500" | "700" | "800";
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
	background: string;
	height: number;
	layers: Layer[];
	name: string;
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
	visualPrompt: string;
}
