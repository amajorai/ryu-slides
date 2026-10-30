import { Button } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import { safeMediaUrl } from "@ryu/ui/lib/safe-media-url.ts";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef } from "react";
import type { Layer, LayerPatch, Project } from "../types.ts";

interface LayerCanvasStyle extends CSSProperties {
	"--slides-canvas-aspect-ratio"?: string;
	"--slides-canvas-background"?: string;
	"--slides-layer-font-size"?: string;
	"--slides-layer-font-weight"?: string;
	"--slides-layer-height"?: string;
	"--slides-layer-image-fit"?: string;
	"--slides-layer-image-radius"?: string;
	"--slides-layer-left"?: string;
	"--slides-layer-opacity"?: string;
	"--slides-layer-shape-border"?: string;
	"--slides-layer-shape-fill"?: string;
	"--slides-layer-shape-radius"?: string;
	"--slides-layer-text-align"?: string;
	"--slides-layer-text-color"?: string;
	"--slides-layer-top"?: string;
	"--slides-layer-transform"?: string;
	"--slides-layer-width"?: string;
	"--slides-layer-z-index"?: string;
}

interface LayerCanvasProps {
	onPatch: (layerId: string, patch: LayerPatch) => void;
	onSelect: (layerId: string | null) => void;
	project: Project;
	readOnly?: boolean;
	selectedLayerId: string | null;
}

type InteractionMode = "move" | "resize" | "rotate";

interface Interaction {
	layerId: string;
	mode: InteractionMode;
	startLayer: Layer;
	startX: number;
	startY: number;
}

function LayerContent({ layer, project }: { layer: Layer; project: Project }) {
	switch (layer.type) {
		case "text": {
			const textStyle: LayerCanvasStyle = {
				"--slides-layer-text-color": layer.color,
				"--slides-layer-font-size": `${(layer.fontSize / project.width) * 100}cqw`,
				"--slides-layer-font-weight": `${Number(layer.fontWeight)}`,
				"--slides-layer-text-align": layer.align,
			};
			return <span style={textStyle}>{layer.text}</span>;
		}
		case "image": {
			const imageStyle: LayerCanvasStyle = {
				"--slides-layer-image-radius": `${layer.borderRadius}px`,
				"--slides-layer-image-fit": layer.fit,
			};
			return (
				<img
					alt={layer.name}
					className="slides-layer-image"
					draggable={false}
					src={safeMediaUrl(layer.source) ?? undefined}
					style={imageStyle}
				/>
			);
		}
		case "shape": {
			const vectorStyle: LayerCanvasStyle = {
				"--slides-layer-shape-fill": layer.fill,
				"--slides-layer-shape-border": `${layer.strokeWidth}px solid ${layer.stroke}`,
				"--slides-layer-shape-radius":
					layer.shape === "ellipse" ? "50%" : `${layer.borderRadius}px`,
			};
			return (
				<span
					aria-hidden="true"
					className="slides-layer-shape"
					style={vectorStyle}
				/>
			);
		}
	}
}

const NUDGE_STEP = 1;
const NUDGE_LARGE_STEP = 10;

/** Arrow-key move for the selected layer, in project pixels; Shift moves 10. */
function getNudgeDelta(
	event: Pick<KeyboardEvent, "key" | "shiftKey">
): { x: number; y: number } | null {
	const step = event.shiftKey ? NUDGE_LARGE_STEP : NUDGE_STEP;
	switch (event.key) {
		case "ArrowLeft":
			return { x: -step, y: 0 };
		case "ArrowRight":
			return { x: step, y: 0 };
		case "ArrowUp":
			return { x: 0, y: -step };
		case "ArrowDown":
			return { x: 0, y: step };
		default:
			return null;
	}
}

export function LayerCanvas({
	onPatch,
	onSelect,
	project,
	readOnly = false,
	selectedLayerId,
}: LayerCanvasProps) {
	const tl = useLiteralMessages();
	const canvasRef = useRef<HTMLDivElement | null>(null);
	const interactionRef = useRef<Interaction | null>(null);

	useEffect(() => {
		const handleMove = (event: PointerEvent) => {
			const interaction = interactionRef.current;
			const canvas = canvasRef.current;
			if (!(interaction && canvas)) {
				return;
			}
			const rect = canvas.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				return;
			}
			const dx =
				((event.clientX - interaction.startX) / rect.width) * project.width;
			const dy =
				((event.clientY - interaction.startY) / rect.height) * project.height;
			const layer = interaction.startLayer;
			if (interaction.mode === "move") {
				onPatch(layer.id, {
					kind: "transform",
					x: Math.max(0, layer.x + dx),
					y: Math.max(0, layer.y + dy),
				});
				return;
			}
			if (interaction.mode === "resize") {
				onPatch(layer.id, {
					kind: "transform",
					height: Math.max(16, layer.height + dy),
					width: Math.max(16, layer.width + dx),
				});
				return;
			}
			const centerX =
				rect.left + ((layer.x + layer.width / 2) / project.width) * rect.width;
			const centerY =
				rect.top +
				((layer.y + layer.height / 2) / project.height) * rect.height;
			const startAngle = Math.atan2(
				interaction.startY - centerY,
				interaction.startX - centerX
			);
			const currentAngle = Math.atan2(
				event.clientY - centerY,
				event.clientX - centerX
			);
			const degrees = (currentAngle - startAngle) * (180 / Math.PI);
			onPatch(layer.id, {
				kind: "transform",
				rotation: layer.rotation + degrees,
			});
		};

		const handleUp = () => {
			interactionRef.current = null;
		};

		window.addEventListener("pointermove", handleMove);
		window.addEventListener("pointerup", handleUp);
		return () => {
			window.removeEventListener("pointermove", handleMove);
			window.removeEventListener("pointerup", handleUp);
		};
	}, [onPatch, project.height, project.width]);

	function beginInteraction(
		event: ReactPointerEvent<HTMLDivElement | HTMLButtonElement>,
		layer: Layer,
		mode: InteractionMode
	) {
		if (readOnly || layer.locked) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		interactionRef.current = {
			layerId: layer.id,
			mode,
			startLayer: layer,
			startX: event.clientX,
			startY: event.clientY,
		};
	}

	const canvasStyleValue: LayerCanvasStyle = {
		"--slides-canvas-aspect-ratio": `${project.width} / ${project.height}`,
		"--slides-canvas-background": project.background,
	};
	return (
		<div
			aria-label={tl("{projectName} canvas", { projectName: project.name })}
			className="slides-canvas"
			onPointerDown={() => {
				if (!readOnly) {
					onSelect(null);
				}
			}}
			ref={canvasRef}
			role="application"
			style={canvasStyleValue}
		>
			{project.layers.map((layer) => {
				if (!layer.visible) {
					return null;
				}
				const selected = selectedLayerId === layer.id;
				const nodeStyle: LayerCanvasStyle = {
					"--slides-layer-height": `${(layer.height / project.height) * 100}%`,
					"--slides-layer-left": `${(layer.x / project.width) * 100}%`,
					"--slides-layer-opacity": `${layer.opacity}`,
					"--slides-layer-top": `${(layer.y / project.height) * 100}%`,
					"--slides-layer-transform": `rotate(${layer.rotation}deg)`,
					"--slides-layer-width": `${(layer.width / project.width) * 100}%`,
					"--slides-layer-z-index": `${project.layers.findIndex((item) => item.id === layer.id) + 1}`,
				};
				return (
					<div
						className={`slides-layer-node ${selected ? "is-selected" : ""} ${layer.locked ? "is-locked" : ""}`}
						key={layer.id}
						onClick={(event) => {
							event.stopPropagation();
							onSelect(layer.id);
						}}
						onPointerDown={(event) => beginInteraction(event, layer, "move")}
						style={nodeStyle}
					>
						<LayerContent layer={layer} project={project} />
						{/* Native button over the layer: Enter/Space select it (the click
						    bubbles to the node), arrows nudge the selected layer, and a
						    pointer press still bubbles to the node to start the drag. */}
						{readOnly ? null : (
							<button
								aria-label={tl("Select {layerName}", { layerName: layer.name })}
								aria-pressed={selected}
								className="slides-layer-select"
								onKeyDown={(event) => {
									if (!selected || layer.locked) {
										return;
									}
									const delta = getNudgeDelta(event);
									if (!delta) {
										return;
									}
									event.preventDefault();
									onPatch(layer.id, {
										kind: "transform",
										x: Math.max(0, layer.x + delta.x),
										y: Math.max(0, layer.y + delta.y),
									});
								}}
								type="button"
							/>
						)}
						{selected && !readOnly && !layer.locked ? (
							<>
								<Button
									aria-label={tl("Resize {layerName}", {
										layerName: layer.name,
									})}
									className="slides-layer-handle slides-layer-resize"
									onPointerDown={(event) =>
										beginInteraction(event, layer, "resize")
									}
									type="button"
								/>
								<Button
									aria-label={tl("Rotate {layerName}", {
										layerName: layer.name,
									})}
									className="slides-layer-handle slides-layer-rotate"
									onPointerDown={(event) =>
										beginInteraction(event, layer, "rotate")
									}
									type="button"
								/>
							</>
						) : null}
					</div>
				);
			})}
		</div>
	);
}
