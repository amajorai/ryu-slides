import { Button } from "@ryu/blocks/companion/controls";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useRef } from "react";
import type { Layer, LayerPatch, Project } from "../types";

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

function layerStyle(layer: Layer, project: Project): CSSProperties {
	return {
		height: `${(layer.height / project.height) * 100}%`,
		left: `${(layer.x / project.width) * 100}%`,
		opacity: layer.opacity,
		position: "absolute",
		top: `${(layer.y / project.height) * 100}%`,
		transform: `rotate(${layer.rotation}deg)`,
		transformOrigin: "center",
		width: `${(layer.width / project.width) * 100}%`,
		zIndex: project.layers.findIndex((item) => item.id === layer.id) + 1,
	};
}

function contentStyle(layer: Layer, project: Project): CSSProperties {
	if (layer.type !== "text") {
		return {};
	}
	return {
		color: layer.color,
		fontSize: `${(layer.fontSize / project.width) * 100}cqw`,
		fontWeight: Number(layer.fontWeight),
		textAlign: layer.align,
	};
}

function LayerContent({ layer, project }: { layer: Layer; project: Project }) {
	switch (layer.type) {
		case "text":
			return <span style={contentStyle(layer, project)}>{layer.text}</span>;
		case "image":
			return (
				<img
					alt={layer.name}
					className="slides-layer-image"
					draggable={false}
					src={layer.source}
					style={{
						borderRadius: `${layer.borderRadius}px`,
						objectFit: layer.fit,
					}}
				/>
			);
		case "shape":
			return (
				<span
					aria-hidden="true"
					className="slides-layer-shape"
					style={{
						background: layer.fill,
						border: `${layer.strokeWidth}px solid ${layer.stroke}`,
						borderRadius:
							layer.shape === "ellipse" ? "50%" : `${layer.borderRadius}px`,
					}}
				/>
			);
	}
}

export function LayerCanvas({
	onPatch,
	onSelect,
	project,
	readOnly = false,
	selectedLayerId,
}: LayerCanvasProps) {
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

	return (
		<div
			aria-label={`${project.name} canvas`}
			className="slides-canvas"
			onPointerDown={() => {
				if (!readOnly) {
					onSelect(null);
				}
			}}
			ref={canvasRef}
			role="application"
			style={{
				aspectRatio: `${project.width} / ${project.height}`,
				background: project.background,
				containerType: "inline-size",
			}}
		>
			{project.layers.map((layer) => {
				if (!layer.visible) {
					return null;
				}
				const selected = selectedLayerId === layer.id;
				return (
					<div
						className={`slides-layer-node ${selected ? "is-selected" : ""} ${layer.locked ? "is-locked" : ""}`}
						key={layer.id}
						onClick={(event) => {
							event.stopPropagation();
							onSelect(layer.id);
						}}
						onPointerDown={(event) => beginInteraction(event, layer, "move")}
						style={layerStyle(layer, project)}
					>
						<LayerContent layer={layer} project={project} />
						{selected && !readOnly && !layer.locked ? (
							<>
								<Button
									aria-label={`Resize ${layer.name}`}
									className="slides-layer-handle slides-layer-resize"
									onPointerDown={(event) =>
										beginInteraction(event, layer, "resize")
									}
									type="button"
								/>
								<Button
									aria-label={`Rotate ${layer.name}`}
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
