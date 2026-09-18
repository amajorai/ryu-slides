import { Button, Input } from "@ryu/blocks/companion/controls";
import { Card, CardFooter } from "@ryu/ui/components/card.tsx";
import { Checkbox } from "@ryu/ui/components/checkbox.tsx";
import { Item } from "@ryu/ui/components/item.tsx";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import { useMemo, useState } from "react";
import type { GallerySort, Project } from "../types";
import { CarouselFrame } from "./CarouselFrame";

interface GalleryProps {
	onCreate: () => void;
	onEmptyTrash: () => void;
	onFavorite: (projectId: string) => void;
	onImport: () => void;
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
	onFavorite,
	onOpen,
	project,
	selected,
	onToggle,
}: {
	onFavorite: (projectId: string) => void;
	onOpen: (projectId: string) => void;
	onToggle: (projectId: string) => void;
	project: Project;
	selected: boolean;
}) {
	return (
		<Card
			className={`slides-project-card gap-0 overflow-hidden py-0 ${selected ? "is-selected" : ""}`}
		>
			<Item
				aria-label={`Open ${project.name}`}
				className="slides-project-preview"
				onClick={() => onOpen(project.id)}
				render={<button type="button" />}
			>
				<CarouselFrame
					onPatch={() => undefined}
					onSelect={() => undefined}
					project={project}
					readOnly
					selectedLayerId={null}
					total={1}
				/>
			</Item>
			<CardFooter className="slides-project-card-footer">
				<label className="slides-check-row">
					<Checkbox
						aria-label={`Select ${project.name}`}
						checked={selected}
						onCheckedChange={() => onToggle(project.id)}
					/>
					<span className="slides-project-copy">
						<strong>{project.name}</strong>
						<small>
							{project.width} × {project.height}
						</small>
					</span>
				</label>
				<div className="slides-project-card-actions">
					<span className="slides-card-role">{project.layout}</span>
					<Button
						aria-label={`${project.favorite ? "Remove" : "Add"} ${project.name} favorite`}
						aria-pressed={project.favorite}
						onClick={() => onFavorite(project.id)}
						size="icon-xs"
						type="button"
						variant="ghost"
					>
						{project.favorite ? "★" : "☆"}
					</Button>
				</div>
			</CardFooter>
		</Card>
	);
}

export function Gallery({
	onCreate,
	onEmptyTrash,
	onFavorite,
	onImport,
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
	const [showFavorites, setShowFavorites] = useState(false);

	const visible = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		return [...projects]
			.filter((project) => {
				if (showFavorites && !project.favorite) {
					return false;
				}
				const searchable = [
					project.name,
					project.seriesTitle,
					project.mark,
					project.layout,
					...project.layers.flatMap((layer) =>
						layer.type === "text" ? [layer.text, layer.name] : [layer.name]
					),
				]
					.join(" ")
					.toLowerCase();
				return searchable.includes(normalized);
			})
			.sort((left, right) => {
				if (sort === "name") {
					return left.name.localeCompare(right.name);
				}
				if (sort === "created") {
					return right.createdAt - left.createdAt;
				}
				return right.updatedAt - left.updatedAt;
			});
	}, [projects, query, showFavorites, sort]);

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
			<section className="slides-page-heading">
				<div>
					<h1>Slides</h1>
				</div>
				<div className="slides-page-actions">
					<Button onClick={onImport} type="button" variant="secondary">
						Import JSON
					</Button>
					<Button onClick={onCreate} type="button" variant="default">
						New project <span aria-hidden="true">↗</span>
					</Button>
				</div>
			</section>

			<section aria-label="Project gallery controls" className="slides-toolbar">
				<Input
					aria-label="Search projects"
					className="w-full sm:max-w-sm"
					onChange={(event) => setQuery(event.currentTarget.value)}
					placeholder="Search projects"
					value={query}
				/>
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
					aria-pressed={showFavorites}
					onClick={() => setShowFavorites((value) => !value)}
					type="button"
					variant={showFavorites ? "secondary" : "ghost"}
				>
					Favorites{" "}
					<span className="slides-count-pill">
						{projects.filter((project) => project.favorite).length}
					</span>
				</Button>
				<Button
					aria-pressed={showTrash}
					onClick={() => setShowTrash((value) => !value)}
					type="button"
					variant={showTrash ? "secondary" : "ghost"}
				>
					Trash <span className="slides-count-pill">{trash.length}</span>
				</Button>
				{selected.size > 0 ? (
					<Button onClick={trashSelected} type="button" variant="destructive">
						Move {selected.size} to trash
					</Button>
				) : null}
			</section>

			{showTrash ? (
				<section className="slides-trash-panel">
					<div>
						<h2>Recently removed projects</h2>
					</div>
					<div className="slides-trash-actions">
						<span>
							{trash.length} project{trash.length === 1 ? "" : "s"}
						</span>
						<Button
							disabled={trash.length === 0}
							onClick={onEmptyTrash}
							size="sm"
							type="button"
							variant="ghost"
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
										onClick={() => onRestore(project.id)}
										size="sm"
										type="button"
										variant="secondary"
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
							onFavorite={onFavorite}
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
					<Button onClick={onCreate} type="button" variant="secondary">
						Make a project
					</Button>
				</section>
			)}
		</main>
	);
}
