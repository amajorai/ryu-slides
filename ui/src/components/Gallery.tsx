import { Button, Input } from "@ryu/blocks/companion/controls";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { useMemo, useState } from "react";
import type { GallerySort, Project } from "../types";
import { LayerCanvas } from "./LayerCanvas";

interface GalleryProps {
	onCreate: () => void;
	onEmptyTrash: () => void;
	onOpen: (projectId: string) => void;
	onRestore: (projectId: string) => void;
	onTrash: (projectIds: string[]) => void;
	projects: Project[];
	trash: Project[];
}

function readGallerySort(value: string): GallerySort {
	return value === "created" || value === "name" ? value : "updated";
}

function ProjectCard({
	onOpen,
	project,
	selected,
	onToggle,
}: {
	onOpen: (projectId: string) => void;
	onToggle: (projectId: string) => void;
	project: Project;
	selected: boolean;
}) {
	return (
		<article className={`slides-project-card ${selected ? "is-selected" : ""}`}>
			<Button
				aria-label={`Open ${project.name}`}
				className="slides-project-preview"
				onClick={() => onOpen(project.id)}
				type="button"
			>
				<LayerCanvas
					onPatch={() => undefined}
					onSelect={() => undefined}
					project={project}
					readOnly
					selectedLayerId={null}
				/>
			</Button>
			<div className="slides-project-card-footer">
				<label className="slides-check-row">
					<Input
						aria-label={`Select ${project.name}`}
						checked={selected}
						onChange={() => onToggle(project.id)}
						type="checkbox"
					/>
					<span>
						<strong>{project.name}</strong>
						<small>
							{project.width} × {project.height}
						</small>
					</span>
				</label>
				<span className="slides-card-dot" />
			</div>
		</article>
	);
}

export function Gallery({
	onCreate,
	onEmptyTrash,
	onOpen,
	onRestore,
	onTrash,
	projects,
	trash,
}: GalleryProps) {
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<GallerySort>("updated");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [showTrash, setShowTrash] = useState(false);

	const visible = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return [...projects]
			.filter((project) => project.name.toLowerCase().includes(normalized))
			.sort((left, right) => {
				if (sort === "name") {
					return left.name.localeCompare(right.name);
				}
				if (sort === "created") {
					return right.createdAt - left.createdAt;
				}
				return right.updatedAt - left.updatedAt;
			});
	}, [projects, query, sort]);

	function toggleSelected(projectId: string) {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(projectId)) {
				next.delete(projectId);
			} else {
				next.add(projectId);
			}
			return next;
		});
	}

	function trashSelected() {
		const ids = [...selected];
		if (ids.length === 0) {
			return;
		}
		onTrash(ids);
		setSelected(new Set());
	}

	return (
		<main className="slides-page slides-gallery-page">
			<section className="slides-hero">
				<div>
					<p className="slides-eyebrow">Ryu / slides</p>
					<h1>Make the frame clear.</h1>
					<p className="slides-lede">
						A quiet local desk for thumbnails, visual slides, and the ideas that
						connect them.
					</p>
				</div>
				<Button
					className="slides-primary-button"
					onClick={onCreate}
					type="button"
				>
					New project <span aria-hidden="true">↗</span>
				</Button>
			</section>

			<section aria-label="Project gallery controls" className="slides-toolbar">
				<label className="slides-search">
					<span aria-hidden="true">⌕</span>
					<Input
						aria-label="Search projects"
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search projects"
						value={query}
					/>
				</label>
				<label className="slides-select-label">
					Sort
					<NativeSelect
						aria-label="Sort projects"
						onChange={(event) =>
							setSort(readGallerySort(event.currentTarget.value))
						}
						value={sort}
					>
						<NativeSelectOption value="updated">
							Recently edited
						</NativeSelectOption>
						<NativeSelectOption value="created">
							Recently created
						</NativeSelectOption>
						<NativeSelectOption value="name">Name</NativeSelectOption>
					</NativeSelect>
				</label>
				<Button
					className={`slides-quiet-button ${showTrash ? "is-active" : ""}`}
					onClick={() => setShowTrash((value) => !value)}
					type="button"
				>
					Trash <span className="slides-count-pill">{trash.length}</span>
				</Button>
				{selected.size > 0 ? (
					<Button
						className="slides-danger-button"
						onClick={trashSelected}
						type="button"
					>
						Move {selected.size} to trash
					</Button>
				) : null}
			</section>

			{showTrash ? (
				<section className="slides-trash-panel">
					<div>
						<p className="slides-eyebrow">Recently removed</p>
						<h2>Keep the rough drafts close.</h2>
					</div>
					<div className="slides-trash-actions">
						<span>
							{trash.length} project{trash.length === 1 ? "" : "s"}
						</span>
						<Button
							className="slides-quiet-button"
							disabled={trash.length === 0}
							onClick={onEmptyTrash}
							type="button"
						>
							Empty trash
						</Button>
					</div>
					{trash.length > 0 ? (
						<div className="slides-trash-list">
							{trash.map((project) => (
								<div className="slides-trash-row" key={project.id}>
									<span>{project.name}</span>
									<Button
										className="slides-small-button"
										onClick={() => onRestore(project.id)}
										type="button"
									>
										Restore
									</Button>
								</div>
							))}
						</div>
					) : (
						<p className="slides-muted-copy">Nothing is waiting here.</p>
					)}
				</section>
			) : null}

			{visible.length > 0 ? (
				<section aria-label="Projects" className="slides-project-grid">
					{visible.map((project) => (
						<ProjectCard
							key={project.id}
							onOpen={onOpen}
							onToggle={toggleSelected}
							project={project}
							selected={selected.has(project.id)}
						/>
					))}
				</section>
			) : (
				<section className="slides-empty-state">
					<span className="slides-empty-mark">✦</span>
					<h2>No project matches that search.</h2>
					<p>
						Start with a blank frame, then let the image and model bridges help
						when you want them.
					</p>
					<Button
						className="slides-secondary-button"
						onClick={onCreate}
						type="button"
					>
						Make a project
					</Button>
				</section>
			)}
		</main>
	);
}
