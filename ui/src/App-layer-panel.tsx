import { RyuAppList, RyuAppListItem } from "@ryu/blocks/companion/app-ui";
import { Button, Input, Textarea } from "@ryu/blocks/companion/controls";
import { ColorPickerPopover } from "@ryu/ui/components/color-picker.tsx";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import {
	geometricLayer,
	readFit,
	readGeometry,
	readTextAlign,
	textLayer,
} from "./App-layers.ts";
import type { Layer, LayerPatch, Project } from "./types.ts";

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

export function LayerPanel({
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
				<h2>Layers</h2>
			</div>
			<div className="slides-layer-actions">
				<Button
					onClick={() => onAddLayer(textLayer())}
					size="sm"
					type="button"
					variant="secondary"
				>
					+ Text
				</Button>
				<Button
					onClick={() => onAddLayer(geometricLayer())}
					size="sm"
					type="button"
					variant="secondary"
				>
					+ Shape
				</Button>
				<Button
					onClick={onAddImage}
					size="sm"
					type="button"
					variant="secondary"
				>
					+ Image
				</Button>
			</div>
			<RyuAppList aria-label="Project layers">
				{[...project.layers].reverse().map((layer) => (
					<RyuAppListItem
						accessories={
							<span
								aria-label={
									layer.locked ? "Locked" : layer.visible ? "Visible" : "Hidden"
								}
								className="slides-layer-state"
							>
								{layer.locked ? "⌑" : layer.visible ? "·" : "–"}
							</span>
						}
						icon={
							<span className={`slides-layer-glyph is-${layer.type}`}>
								{layer.type === "text"
									? "T"
									: layer.type === "image"
										? "◩"
										: "◇"}
							</span>
						}
						key={layer.id}
						onClick={() => onSelect(layer.id)}
						selected={selectedLayerId === layer.id}
						subtitle={layerDescription(layer)}
						title={layer.name}
					/>
				))}
			</RyuAppList>
			{selectedLayer ? (
				<div className="slides-inspector">
					<div className="slides-inspector-heading">
						<span>Inspector</span>
						<div>
							<Button
								aria-label="Move layer down"
								onClick={() => onMove("down")}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								↓
							</Button>
							<Button
								aria-label="Move layer up"
								onClick={() => onMove("up")}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								↑
							</Button>
							<Button
								aria-label="Duplicate layer"
								onClick={onDuplicate}
								size="icon-xs"
								type="button"
								variant="ghost"
							>
								＋
							</Button>
							<Button
								aria-label="Delete layer"
								onClick={onDelete}
								size="icon-xs"
								type="button"
								variant="destructive"
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
									<ColorPickerPopover
										onValueChange={(value) =>
											onPatch({ kind: "text", color: value })
										}
										triggerAriaLabel="Text color"
										triggerClassName="w-full justify-start"
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
								<ColorPickerPopover
									onValueChange={(value) =>
										onPatch({ kind: "shape", fill: value })
									}
									triggerAriaLabel="Shape fill color"
									triggerClassName="w-full justify-start"
									value={selectedLayer.fill}
								/>
							</label>
							<label className="slides-field">
								<span>Shape</span>
								<NativeSelect
									onChange={(event) =>
										onPatch({
											kind: "shape",
											shape: readGeometry(event.currentTarget.value),
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
							onClick={() =>
								onPatch({ kind: "visibility", visible: !selectedLayer.visible })
							}
							size="sm"
							type="button"
							variant="ghost"
						>
							{selectedLayer.visible ? "Hide" : "Show"}
						</Button>
						<Button
							onClick={() =>
								onPatch({ kind: "visibility", locked: !selectedLayer.locked })
							}
							size="sm"
							type="button"
							variant="ghost"
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
