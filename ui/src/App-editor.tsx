import { Button, Input } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import { useCallback } from "react";
import { LayerPanel } from "./App-layer-panel.tsx";
import { starterVisualDataUrl } from "./App-layers.ts";
import { CarouselFrame } from "./components/CarouselFrame.tsx";
import { MediaTools } from "./components/MediaTools.tsx";
import type {
	CarouselParseResult,
	Layer,
	LayerPatch,
	Project,
	ProjectPatch,
	SlidesAction,
} from "./types.ts";

export function Editor({
	activeProject,
	onBack,
	onCarousel,
	onExport,
	onImage,
	onProjectChange,
	onProjectPatch,
	onPreview,
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
	onCarousel: (result: CarouselParseResult) => void;
	onExport: () => void;
	onImage: (source: string) => void;
	onProjectChange: (project: Project) => void;
	onProjectPatch: (patch: ProjectPatch) => void;
	onPreview: () => void;
	onRedo: () => void;
	onSelectLayer: (layerId: string | null) => void;
	onUndo: () => void;
	selectedImageSource: string | null;
	selectedLayer: Layer | null;
	selectedLayerId: string | null;
}) {
	const tl = useLiteralMessages();
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
		onImage(starterVisualDataUrl());
	}

	return (
		<main className="slides-editor-page">
			<header className="slides-editor-header">
				<div className="slides-editor-title">
					<Button onClick={onBack} size="sm" type="button" variant="ghost">
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
						disabled={activeProject.history.length === 0}
						onClick={onUndo}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						↶
					</Button>
					<Button
						aria-label="Redo"
						disabled={activeProject.future.length === 0}
						onClick={onRedo}
						size="icon-sm"
						type="button"
						variant="ghost"
					>
						↷
					</Button>
					<Button onClick={onExport} type="button" variant="secondary">
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
						<span>
							{tl("{count} layers", {
								count: String(activeProject.layers.length),
							})}
						</span>
					</div>
					<div className="slides-canvas-wrap">
						<CarouselFrame
							index={0}
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
							total={1}
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
					onPreview={onPreview}
					onProjectPatch={onProjectPatch}
					project={activeProject}
					selectedImageSource={selectedImageSource}
				/>
			</div>
		</main>
	);
}
