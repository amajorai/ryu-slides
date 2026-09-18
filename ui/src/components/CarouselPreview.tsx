import { Button } from "@ryu/blocks/companion/controls";
import { useEffect, useMemo, useState } from "react";
import type { Project } from "../types";
import { CarouselFrame } from "./CarouselFrame";

interface CarouselPreviewProps {
	onClose: () => void;
	projects: Project[];
	startProjectId: string;
}

function frameLabel(index: number, total: number): string {
	return `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
}

export function CarouselPreview({
	onClose,
	projects,
	startProjectId,
}: CarouselPreviewProps) {
	const start = projects.find((project) => project.id === startProjectId);
	const series = useMemo(
		() =>
			projects
				.filter((project) => project.seriesId === start?.seriesId)
				.sort(
					(left, right) =>
						left.sequence - right.sequence || left.createdAt - right.createdAt
				),
		[projects, start?.seriesId]
	);
	const fallback = start ?? projects[0];
	const [index, setIndex] = useState(() => {
		const found = series.findIndex((project) => project.id === startProjectId);
		return found >= 0 ? found : 0;
	});
	const project = series[index] ?? fallback;

	useEffect(() => {
		window.scrollTo(0, 0);
	}, []);

	if (!project || series.length === 0) {
		return null;
	}

	return (
		<main className="slides-preview-page">
			<header className="slides-preview-header">
				<div>
					<h1>{project.seriesTitle}</h1>
					<p className="slides-preview-subtitle">
						{series.length} frames · swipe-ready composition
					</p>
				</div>
				<Button onClick={onClose} type="button" variant="ghost">
					Close preview
				</Button>
			</header>
			<section aria-label="Carousel reader" className="slides-reader">
				<Button
					aria-label="Previous frame"
					disabled={index === 0}
					onClick={() => setIndex((value) => Math.max(0, value - 1))}
					size="icon-sm"
					type="button"
					variant="secondary"
				>
					←
				</Button>
				<div className="slides-reader-frame">
					<CarouselFrame
						index={index}
						onPatch={() => undefined}
						onSelect={() => undefined}
						project={project}
						readOnly
						selectedLayerId={null}
						total={series.length}
					/>
					<div className="slides-reader-meta">
						<span>{frameLabel(index, series.length)}</span>
						<span>{project.layout}</span>
					</div>
				</div>
				<Button
					aria-label="Next frame"
					disabled={index === series.length - 1}
					onClick={() =>
						setIndex((value) => Math.min(series.length - 1, value + 1))
					}
					size="icon-sm"
					type="button"
					variant="secondary"
				>
					→
				</Button>
			</section>
			<nav aria-label="Carousel frames" className="slides-reader-rail">
				{series.map((frame, frameIndex) => (
					<Button
						aria-current={frameIndex === index ? "page" : undefined}
						aria-label={`Open frame ${frameIndex + 1}`}
						key={frame.id}
						onClick={() => setIndex(frameIndex)}
						size="sm"
						type="button"
						variant={frameIndex === index ? "default" : "ghost"}
					>
						{String(frameIndex + 1).padStart(2, "0")}
					</Button>
				))}
			</nav>
		</main>
	);
}
