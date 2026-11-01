import { makeId } from "./model.ts";
import type {
	GeometricLayer,
	ImageLayer,
	Project,
	TextLayer,
} from "./types.ts";

export function textLayer(): TextLayer {
	return {
		align: "left",
		color: "#171a18",
		fontSize: 64,
		fontWeight: "500",
		height: 150,
		id: makeId("layer"),
		locked: false,
		name: "Text layer",
		opacity: 1,
		rotation: 0,
		text: "New text",
		type: "text",
		visible: true,
		width: 620,
		x: 120,
		y: 480,
	};
}

export function geometricLayer(): GeometricLayer {
	return {
		borderRadius: 24,
		fill: "#3c6ff0",
		height: 240,
		id: makeId("layer"),
		locked: false,
		name: "Shape layer",
		opacity: 1,
		rotation: 0,
		shape: "rectangle",
		stroke: "transparent",
		strokeWidth: 0,
		type: "shape",
		visible: true,
		width: 360,
		x: 760,
		y: 680,
	};
}

export function imageLayer(source: string, project: Project): ImageLayer {
	const width = Math.min(520, project.width);
	const height = Math.min(340, Math.max(1, project.height - 80));
	return {
		borderRadius: 28,
		fit: "cover",
		height,
		id: makeId("layer"),
		locked: false,
		name: "Image layer",
		opacity: 1,
		rotation: 0,
		source,
		type: "image",
		visible: true,
		width,
		x: Math.min(80, project.width - width),
		y: Math.max(0, project.height - height - 80),
	};
}

export function rekeyImportedProjects(
	projects: Project[],
	existingIds: Set<string>
): Project[] {
	const seriesIds = new Map<string, string>();
	return projects.map((project) => {
		let id = project.id;
		while (existingIds.has(id)) {
			id = makeId("project");
		}
		existingIds.add(id);
		const seriesId = seriesIds.get(project.seriesId) ?? makeId("series");
		seriesIds.set(project.seriesId, seriesId);
		return {
			...project,
			id,
			layers: project.layers.map((layer) => ({
				...layer,
				id: makeId("layer"),
			})),
			seriesId,
		};
	});
}

export function starterVisualDataUrl(): string {
	const canvas = document.createElement("canvas");
	canvas.width = 640;
	canvas.height = 420;
	const context = canvas.getContext("2d");
	if (!context) {
		return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
	}
	context.fillStyle = "#5f7659";
	context.fillRect(0, 0, canvas.width, canvas.height);
	context.beginPath();
	context.arc(500, 100, 150, 0, Math.PI * 2);
	context.fillStyle = "#e9f48b";
	context.fill();
	return canvas.toDataURL("image/png");
}

export function readTextAlign(value: string): TextLayer["align"] {
	return value === "center" || value === "right" ? value : "left";
}

export function readGeometry(value: string): GeometricLayer["shape"] {
	return value === "ellipse" ? "ellipse" : "rectangle";
}

export function readFit(value: string): ImageLayer["fit"] {
	return value === "contain" ? "contain" : "cover";
}
