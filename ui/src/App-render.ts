import type { ExportMime } from "./components/ExportDialog.tsx";
import type { Project } from "./types.ts";

function loadCanvasImage(source: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => resolve(image));
		image.addEventListener("error", () =>
			reject(new Error("Image could not be rendered."))
		);
		image.src = source;
	});
}

export async function renderProject(
	project: Project,
	mime: ExportMime
): Promise<string> {
	const canvas = document.createElement("canvas");
	canvas.width = project.width;
	canvas.height = project.height;
	const context = canvas.getContext("2d");
	if (!context) {
		throw new Error("Canvas export is not available.");
	}
	context.fillStyle = project.background;
	context.fillRect(0, 0, project.width, project.height);
	const headingFont =
		getComputedStyle(document.documentElement)
			.getPropertyValue("--font-heading")
			.trim() || '"Geist Variable", sans-serif';

	for (const layer of project.layers) {
		if (!layer.visible || layer.opacity <= 0) {
			continue;
		}
		context.save();
		context.globalAlpha = layer.opacity;
		context.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
		context.rotate((layer.rotation * Math.PI) / 180);
		if (layer.type === "shape") {
			context.fillStyle = layer.fill;
			context.strokeStyle = layer.stroke;
			context.lineWidth = layer.strokeWidth;
			if (layer.shape === "ellipse") {
				context.beginPath();
				context.ellipse(
					0,
					0,
					layer.width / 2,
					layer.height / 2,
					0,
					0,
					Math.PI * 2
				);
				context.fill();
				if (layer.strokeWidth > 0) {
					context.stroke();
				}
			} else {
				context.fillRect(
					-layer.width / 2,
					-layer.height / 2,
					layer.width,
					layer.height
				);
				if (layer.strokeWidth > 0) {
					context.strokeRect(
						-layer.width / 2,
						-layer.height / 2,
						layer.width,
						layer.height
					);
				}
			}
		} else if (layer.type === "text") {
			context.fillStyle = layer.color;
			context.font = `${layer.fontWeight} ${layer.fontSize}px ${headingFont}`;
			context.textAlign = layer.align;
			context.textBaseline = "top";
			const lines = layer.text.split("\n");
			const textX =
				layer.align === "left"
					? -layer.width / 2
					: layer.align === "right"
						? layer.width / 2
						: 0;
			lines.forEach((line, index) =>
				context.fillText(
					line,
					textX,
					-layer.height / 2 + index * layer.fontSize * 1.2
				)
			);
		} else {
			try {
				const image = await loadCanvasImage(layer.source);
				context.drawImage(
					image,
					-layer.width / 2,
					-layer.height / 2,
					layer.width,
					layer.height
				);
			} catch {
				context.fillStyle = "#c7c9c1";
				context.fillRect(
					-layer.width / 2,
					-layer.height / 2,
					layer.width,
					layer.height
				);
			}
		}
		context.restore();
	}
	return canvas.toDataURL(mime, 0.92);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
	const anchor = document.createElement("a");
	anchor.download = filename;
	anchor.href = dataUrl;
	anchor.click();
}

export function downloadText(value: string, filename: string): void {
	const blob = new Blob([value], { type: "application/json" });
	const anchor = document.createElement("a");
	anchor.download = filename;
	anchor.href = URL.createObjectURL(blob);
	anchor.click();
	URL.revokeObjectURL(anchor.href);
}

export function safeFileName(value: string, fallback: string): string {
	return (
		value
			.trim()
			.toLowerCase()
			.replaceAll(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "") || fallback
	);
}
