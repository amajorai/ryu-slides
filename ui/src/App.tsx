import { Button, Input, Textarea } from "@ryu/blocks/companion/controls";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { useCallback, useEffect, useState } from "react";
import { loadState, saveState } from "./bridge";
import { ExportDialog, type ExportMime } from "./components/ExportDialog";
import { Gallery } from "./components/Gallery";
import { LayerCanvas } from "./components/LayerCanvas";
import { MediaTools } from "./components/MediaTools";
import { demoState, makeId, makeProject, reduceSlidesState } from "./model";
import type {
	CarouselSlide,
	ImageLayer,
	Layer,
	LayerPatch,
	Project,
	ShapeLayer,
	SlidesAction,
	SlidesState,
	TextLayer,
} from "./types";
import "./slides.css";

type View = "gallery" | "editor";

function textLayer(): TextLayer {
	return {
		align: "left",
		color: "#171a18",
		fontSize: 64,
		fontWeight: "700",
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

function shapeLayer(): ShapeLayer {
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

function imageLayer(source: string): ImageLayer {
	return {
		borderRadius: 28,
		fit: "cover",
		height: 420,
		id: makeId("layer"),
		locked: false,
		name: "Image layer",
		opacity: 1,
		rotation: 0,
		source,
		type: "image",
		visible: true,
		width: 520,
		x: 650,
		y: 120,
	};
}

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

async function renderProject(
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

function downloadDataUrl(dataUrl: string, filename: string): void {
	const anchor = document.createElement("a");
	anchor.download = filename;
	anchor.href = dataUrl;
	anchor.click();
}

function layerDescription(layer: Layer): string {
	if (layer.type === "text") {
		return layer.text || "Empty text";
	}
	if (layer.type === "image") {
		return "Image visual";
	}
	return layer.shape === "ellipse" ? "Ellipse" : "Rectangle";
}

interface LayerPanelProps {
	onAddImage: () => void;
	onAddLayer: (layer: Layer) => void;
	onDelete: () => void;
	onDuplicate: () => void;
	onMove: (direction: "up" | "down") => void;
	onPatch: (patch: LayerPatch) => void;
	onSelect: (layerId: string) => void;
	project: Project;
	selectedLayer: Layer | null;
	selectedLayerId: string | null;
}

function LayerPanel({
	onAddImage,
	onAddLayer,
	onDelete,
	onDuplicate,
	onMove,
	onPatch,
	onSelect,
	project,
	selectedLayer,
	selectedLayerId,
}: LayerPanelProps) {
	return (
		<aside className="slides-layer-panel">
			<div className="slides-panel-heading">
				<p className="slides-eyebrow">Build the frame</p>
				<h2>Layers</h2>
			</div>
			<div className="slides-layer-actions">
				<Button
					className="slides-small-button"
					onClick={() => onAddLayer(textLayer())}
					type="button"
				>
					+ Text
				</Button>
				<Button
					className="slides-small-button"
					onClick={() => onAddLayer(shapeLayer())}
					type="button"
				>
					+ Shape
				</Button>
				<Button
					className="slides-small-button"
					onClick={onAddImage}
					type="button"
				>
					+ Image
				</Button>
			</div>
			<div aria-label="Project layers" className="slides-layer-list">
				{[...project.layers].reverse().map((layer) => (
					<Button
						className={`slides-layer-row ${selectedLayerId === layer.id ? "is-selected" : ""}`}
						key={layer.id}
						onClick={() => onSelect(layer.id)}
						type="button"
					>
						<span className={`slides-layer-glyph is-${layer.type}`}>
							{layer.type === "text" ? "T" : layer.type === "image" ? "◩" : "◇"}
						</span>
						<span>
							<strong>{layer.name}</strong>
							<small>{layerDescription(layer)}</small>
						</span>
						<span className="slides-layer-state">
							{layer.locked ? "⌑" : layer.visible ? "·" : "–"}
						</span>
					</Button>
				))}
			</div>
			{selectedLayer ? (
				<div className="slides-inspector">
					<div className="slides-inspector-heading">
						<span>Inspector</span>
						<div>
							<Button
								aria-label="Move layer down"
								className="slides-mini-icon-button"
								onClick={() => onMove("down")}
								type="button"
							>
								↓
							</Button>
							<Button
								aria-label="Move layer up"
								className="slides-mini-icon-button"
								onClick={() => onMove("up")}
								type="button"
							>
								↑
							</Button>
							<Button
								aria-label="Duplicate layer"
								className="slides-mini-icon-button"
								onClick={onDuplicate}
								type="button"
							>
								＋
							</Button>
							<Button
								aria-label="Delete layer"
								className="slides-mini-icon-button is-danger"
								onClick={onDelete}
								type="button"
							>
								×
							</Button>
						</div>
					</div>
					<label className="slides-field">
						<span>Name</span>
						<Input
							defaultValue={selectedLayer.name}
							key={`${selectedLayer.id}-name`}
							onBlur={(event) => onRename(onPatch, event.currentTarget.value)}
						/>
					</label>
					<div className="slides-field-grid">
						<NumberField
							label="X"
							onChange={(value) => onPatch({ kind: "transform", x: value })}
							value={selectedLayer.x}
						/>
						<NumberField
							label="Y"
							onChange={(value) => onPatch({ kind: "transform", y: value })}
							value={selectedLayer.y}
						/>
						<NumberField
							label="W"
							onChange={(value) => onPatch({ kind: "transform", width: value })}
							value={selectedLayer.width}
						/>
						<NumberField
							label="H"
							onChange={(value) =>
								onPatch({ kind: "transform", height: value })
							}
							value={selectedLayer.height}
						/>
						<NumberField
							label="Angle"
							onChange={(value) =>
								onPatch({ kind: "transform", rotation: value })
							}
							value={Math.round(selectedLayer.rotation)}
						/>
						<NumberField
							label="Opacity"
							max={1}
							min={0}
							onChange={(value) =>
								onPatch({ kind: "transform", opacity: value })
							}
							step={0.05}
							value={selectedLayer.opacity}
						/>
					</div>
					{selectedLayer.type === "text" ? (
						<>
							<label className="slides-field">
								<span>Text</span>
								<Textarea
									onChange={(event) =>
										onPatch({ kind: "text", text: event.currentTarget.value })
									}
									rows={3}
									value={selectedLayer.text}
								/>
							</label>
							<div className="slides-field-grid">
								<label className="slides-field">
									<span>Color</span>
									<Input
										onChange={(event) =>
											onPatch({
												kind: "text",
												color: event.currentTarget.value,
											})
										}
										type="color"
										value={selectedLayer.color}
									/>
								</label>
								<NumberField
									label="Size"
									onChange={(value) =>
										onPatch({ kind: "text", fontSize: value })
									}
									value={selectedLayer.fontSize}
								/>
							</div>
							<label className="slides-field">
								<span>Align</span>
								<NativeSelect
									onChange={(event) =>
										onPatch({
											kind: "text",
											align: readTextAlign(event.currentTarget.value),
										})
									}
									value={selectedLayer.align}
								>
									<NativeSelectOption value="left">Left</NativeSelectOption>
									<NativeSelectOption value="center">Center</NativeSelectOption>
									<NativeSelectOption value="right">Right</NativeSelectOption>
								</NativeSelect>
							</label>
						</>
					) : null}
					{selectedLayer.type === "shape" ? (
						<div className="slides-field-grid">
							<label className="slides-field">
								<span>Fill</span>
								<Input
									onChange={(event) =>
										onPatch({ kind: "shape", fill: event.currentTarget.value })
									}
									type="color"
									value={selectedLayer.fill}
								/>
							</label>
							<label className="slides-field">
								<span>Shape</span>
								<NativeSelect
									onChange={(event) =>
										onPatch({
											kind: "shape",
											shape: readShape(event.currentTarget.value),
										})
									}
									value={selectedLayer.shape}
								>
									<NativeSelectOption value="rectangle">
										Rectangle
									</NativeSelectOption>
									<NativeSelectOption value="ellipse">
										Ellipse
									</NativeSelectOption>
								</NativeSelect>
							</label>
						</div>
					) : null}
					{selectedLayer.type === "image" ? (
						<label className="slides-field">
							<span>Fit</span>
							<NativeSelect
								onChange={(event) =>
									onPatch({
										kind: "image",
										fit: readFit(event.currentTarget.value),
									})
								}
								value={selectedLayer.fit}
							>
								<NativeSelectOption value="cover">Cover</NativeSelectOption>
								<NativeSelectOption value="contain">Contain</NativeSelectOption>
							</NativeSelect>
						</label>
					) : null}
					<div className="slides-toggle-row">
						<Button
							className="slides-quiet-button"
							onClick={() =>
								onPatch({ kind: "visibility", visible: !selectedLayer.visible })
							}
							type="button"
						>
							{selectedLayer.visible ? "Hide" : "Show"}
						</Button>
						<Button
							className="slides-quiet-button"
							onClick={() =>
								onPatch({ kind: "visibility", locked: !selectedLayer.locked })
							}
							type="button"
						>
							{selectedLayer.locked ? "Unlock" : "Lock"}
						</Button>
					</div>
				</div>
			) : (
				<p className="slides-muted-copy slides-inspector-empty">
					Select a layer to tune it.
				</p>
			)}
		</aside>
	);
}

function onRename(onPatch: (patch: LayerPatch) => void, name: string) {
	if (name.trim()) {
		onPatch({ kind: "transform", name: name.trim() });
	}
}

function readTextAlign(value: string): TextLayer["align"] {
	return value === "center" || value === "right" ? value : "left";
}

function readShape(value: string): ShapeLayer["shape"] {
	return value === "ellipse" ? "ellipse" : "rectangle";
}

function readFit(value: string): ImageLayer["fit"] {
	return value === "contain" ? "contain" : "cover";
}

function NumberField({
	label,
	max,
	min,
	onChange,
	step = 1,
	value,
}: {
	label: string;
	max?: number;
	min?: number;
	onChange: (value: number) => void;
	step?: number;
	value: number;
}) {
	return (
		<label className="slides-field">
			<span>{label}</span>
			<Input
				max={max}
				min={min}
				onChange={(event) => onChange(Number(event.currentTarget.value))}
				step={step}
				type="number"
				value={value}
			/>
		</label>
	);
}

function Editor({
	activeProject,
	onBack,
	onCarousel,
	onExport,
	onImage,
	onProjectChange,
	onRedo,
	onUndo,
	selectedImageSource,
	selectedLayer,
	selectedLayerId,
	onAction,
	onSelectLayer,
}: {
	activeProject: Project;
	onAction: (action: SlidesAction) => void;
	onBack: () => void;
	onCarousel: (slides: CarouselSlide[]) => void;
	onExport: () => void;
	onImage: (source: string) => void;
	onProjectChange: (project: Project) => void;
	onRedo: () => void;
	onSelectLayer: (layerId: string | null) => void;
	onUndo: () => void;
	selectedImageSource: string | null;
	selectedLayer: Layer | null;
	selectedLayerId: string | null;
}) {
	const patchSelected = useCallback(
		(patch: LayerPatch) => {
			if (!selectedLayerId) {
				return;
			}
			onAction({
				layerId: selectedLayerId,
				patch,
				projectId: activeProject.id,
				type: "update-layer",
			});
		},
		[activeProject.id, onAction, selectedLayerId]
	);

	function addImage() {
		onImage(
			"data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 420'%3E%3Crect width='640' height='420' fill='%235f7659'/%3E%3Ccircle cx='500' cy='100' r='150' fill='%23e9f48b'/%3E%3C/svg%3E"
		);
	}

	return (
		<main className="slides-editor-page">
			<header className="slides-editor-header">
				<div className="slides-editor-title">
					<Button className="slides-back-button" onClick={onBack} type="button">
						← Gallery
					</Button>
					<span className="slides-divider" />
					<Input
						aria-label="Project name"
						onChange={(event) =>
							onProjectChange({
								...activeProject,
								name: event.currentTarget.value,
								updatedAt: Date.now(),
							})
						}
						value={activeProject.name}
					/>
				</div>
				<div className="slides-editor-actions">
					<Button
						aria-label="Undo"
						className="slides-icon-button"
						disabled={activeProject.history.length === 0}
						onClick={onUndo}
						type="button"
					>
						↶
					</Button>
					<Button
						aria-label="Redo"
						className="slides-icon-button"
						disabled={activeProject.future.length === 0}
						onClick={onRedo}
						type="button"
					>
						↷
					</Button>
					<Button
						className="slides-secondary-button"
						onClick={onExport}
						type="button"
					>
						Export
					</Button>
				</div>
			</header>
			<div className="slides-editor-layout">
				<LayerPanel
					onAddImage={addImage}
					onAddLayer={(layer) =>
						onAction({ layer, projectId: activeProject.id, type: "add-layer" })
					}
					onDelete={() =>
						selectedLayerId &&
						onAction({
							layerId: selectedLayerId,
							projectId: activeProject.id,
							type: "delete-layer",
						})
					}
					onDuplicate={() =>
						selectedLayerId &&
						onAction({
							layerId: selectedLayerId,
							projectId: activeProject.id,
							type: "duplicate-layer",
						})
					}
					onMove={(direction) =>
						selectedLayerId &&
						onAction({
							direction,
							layerId: selectedLayerId,
							projectId: activeProject.id,
							type: "move-layer",
						})
					}
					onPatch={patchSelected}
					onSelect={onSelectLayer}
					project={activeProject}
					selectedLayer={selectedLayer}
					selectedLayerId={selectedLayerId}
				/>
				<section className="slides-canvas-column">
					<div className="slides-canvas-toolbar">
						<span>
							{activeProject.width} × {activeProject.height}
						</span>
						<span>{activeProject.layers.length} layers</span>
					</div>
					<div className="slides-canvas-wrap">
						<LayerCanvas
							onPatch={(layerId, patch) => {
								onAction({
									layerId,
									patch,
									projectId: activeProject.id,
									type: "update-layer",
								});
							}}
							onSelect={onSelectLayer}
							project={activeProject}
							selectedLayerId={selectedLayerId}
						/>
					</div>
					<p className="slides-canvas-hint">
						Drag a selected layer. Use the lower handle to resize and the upper
						handle to rotate.
					</p>
				</section>
				<MediaTools
					onCarousel={onCarousel}
					onImage={onImage}
					selectedImageSource={selectedImageSource}
				/>
			</div>
		</main>
	);
}

export default function App() {
	const [state, setState] = useState<SlidesState>(demoState);
	const [loaded, setLoaded] = useState(false);
	const [view, setView] = useState<View>("gallery");
	const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [showExport, setShowExport] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		void loadState()
			.then((next) => {
				setState(next);
				setActiveProjectId(next.projects[0]?.id ?? null);
			})
			.finally(() => setLoaded(true));
	}, []);

	useEffect(() => {
		if (!loaded) {
			return;
		}
		const timer = window.setTimeout(() => {
			void saveState(state).catch(() =>
				setMessage("The local save could not be completed.")
			);
		}, 350);
		return () => window.clearTimeout(timer);
	}, [loaded, state]);

	const activeProject =
		state.projects.find((project) => project.id === activeProjectId) ?? null;
	const selectedLayer =
		activeProject?.layers.find((layer) => layer.id === selectedLayerId) ?? null;
	const selectedImageSource =
		selectedLayer?.type === "image" ? selectedLayer.source : null;

	const dispatch = useCallback((action: SlidesAction) => {
		setState((current) => reduceSlidesState(current, action));
	}, []);

	const createProject = useCallback(() => {
		const project = makeProject();
		dispatch({ project, type: "add-project" });
		setActiveProjectId(project.id);
		setSelectedLayerId(project.layers[0]?.id ?? null);
		setView("editor");
	}, [dispatch]);

	function openProject(projectId: string) {
		const project = state.projects.find((item) => item.id === projectId);
		if (!project) {
			return;
		}
		setActiveProjectId(project.id);
		setSelectedLayerId(project.layers[0]?.id ?? null);
		setView("editor");
	}

	function updateActiveProject(project: Project) {
		setState((current) => ({
			...current,
			projects: current.projects.map((item) =>
				item.id === project.id ? project : item
			),
		}));
	}

	function handleImage(source: string) {
		if (activeProject && selectedLayer?.type === "image") {
			dispatch({
				layerId: selectedLayer.id,
				patch: { kind: "image", source },
				projectId: activeProject.id,
				type: "update-layer",
			});
			return;
		}
		if (!activeProject) {
			return;
		}
		const layer = imageLayer(source);
		dispatch({ layer, projectId: activeProject.id, type: "add-layer" });
		setSelectedLayerId(layer.id);
	}

	function handleCarousel(slides: CarouselSlide[]) {
		const created = slides.map((slide, index) => {
			const project = makeProject(
				`Carousel ${String(index + 1).padStart(2, "0")}`
			);
			const headline = project.layers.find(
				(layer): layer is TextLayer => layer.type === "text"
			);
			const supporting = textLayer();
			return {
				...project,
				layers: project.layers
					.map((layer) =>
						headline && layer.id === headline.id
							? { ...layer, text: slide.headline }
							: layer
					)
					.concat({
						...supporting,
						height: 260,
						name: "Supporting copy",
						text: slide.body,
						width: 920,
						x: 120,
						y: 430,
					}),
			};
		});
		setState((current) =>
			created.reduce(
				(next, project) =>
					reduceSlidesState(next, { project, type: "add-project" }),
				current
			)
		);
		const first = created[0];
		if (first) {
			setActiveProjectId(first.id);
			setSelectedLayerId(first.layers[0]?.id ?? null);
			setView("editor");
		}
		setMessage(`${created.length} carousel frames added to the gallery.`);
	}

	function moveProjectsToTrash(projectIds: string[]) {
		for (const projectId of projectIds) {
			dispatch({ id: projectId, type: "move-project-to-trash" });
		}
		if (activeProjectId && projectIds.includes(activeProjectId)) {
			setActiveProjectId(null);
			setSelectedLayerId(null);
			setView("gallery");
		}
	}

	async function exportActive(mime: ExportMime) {
		if (!activeProject) {
			return;
		}
		const dataUrl = await renderProject(activeProject, mime);
		const extension =
			mime === "image/jpeg" ? "jpg" : (mime.split("/")[1] ?? "png");
		downloadDataUrl(
			dataUrl,
			`${activeProject.name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-") || "slides"}.${extension}`
		);
		setMessage(
			`Exported ${extension.toUpperCase()} from ${activeProject.name}.`
		);
	}

	if (!loaded) {
		return <div className="slides-loading">Opening Slides…</div>;
	}

	return (
		<div className="slides-app">
			{view === "gallery" ? (
				<Gallery
					onCreate={createProject}
					onEmptyTrash={() => dispatch({ type: "empty-trash" })}
					onOpen={openProject}
					onRestore={(id) => dispatch({ id, type: "restore-project" })}
					onTrash={moveProjectsToTrash}
					projects={state.projects}
					trash={state.trash}
				/>
			) : activeProject ? (
				<Editor
					activeProject={activeProject}
					onAction={dispatch}
					onBack={() => {
						setView("gallery");
						setSelectedLayerId(null);
					}}
					onCarousel={handleCarousel}
					onExport={() => setShowExport(true)}
					onImage={handleImage}
					onProjectChange={updateActiveProject}
					onRedo={() => dispatch({ projectId: activeProject.id, type: "redo" })}
					onSelectLayer={setSelectedLayerId}
					onUndo={() => dispatch({ projectId: activeProject.id, type: "undo" })}
					selectedImageSource={selectedImageSource}
					selectedLayer={selectedLayer}
					selectedLayerId={selectedLayerId}
				/>
			) : (
				<Gallery
					onCreate={createProject}
					onEmptyTrash={() => dispatch({ type: "empty-trash" })}
					onOpen={openProject}
					onRestore={(id) => dispatch({ id, type: "restore-project" })}
					onTrash={moveProjectsToTrash}
					projects={state.projects}
					trash={state.trash}
				/>
			)}
			{showExport ? (
				<ExportDialog
					onClose={() => setShowExport(false)}
					onExport={exportActive}
				/>
			) : null}
			{message ? (
				<Button
					aria-label="Dismiss message"
					className="slides-toast"
					onClick={() => setMessage(null)}
					type="button"
				>
					{message}
				</Button>
			) : null}
		</div>
	);
}
