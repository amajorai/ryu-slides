import type { LayerPatch, Project } from "../types";
import { LayerCanvas } from "./LayerCanvas";

interface CarouselFrameProps {
	index?: number;
	onPatch: (layerId: string, patch: LayerPatch) => void;
	onSelect: (layerId: string | null) => void;
	project: Project;
	readOnly?: boolean;
	selectedLayerId: string | null;
	total?: number;
}

function pageNumber(value: number): string {
	return String(value + 1).padStart(2, "0");
}

export function CarouselFrame({
	onPatch,
	onSelect,
	project,
	readOnly = false,
	selectedLayerId,
	index = 0,
	total = 1,
}: CarouselFrameProps) {
	return (
		<figure
			aria-label={`${project.name}, frame ${index + 1} of ${total}`}
			className={`slides-frame slides-theme-${project.theme} slides-layout-${project.layout}`}
			data-slide-role={project.layout}
		>
			<LayerCanvas
				onPatch={onPatch}
				onSelect={onSelect}
				project={project}
				readOnly={readOnly}
				selectedLayerId={selectedLayerId}
			/>
			{project.showHeader ? (
				<header className="slides-frame-header">
					<span>{project.mark}</span>
					<span>{pageNumber(index)}</span>
				</header>
			) : null}
			{project.showFooter ? (
				<footer className="slides-frame-footer">
					<span>{project.author}</span>
					{index < total - 1 ? (
						<span className="slides-frame-arrow">→</span>
					) : null}
				</footer>
			) : null}
		</figure>
	);
}
