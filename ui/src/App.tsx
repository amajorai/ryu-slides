import { RyuAppEmpty } from "@ryu/blocks/companion/app-ui";
import { Button } from "@ryu/blocks/companion/controls";
import { useLiteralMessages } from "@ryu/i18n/react";
import { useCallback, useEffect, useState } from "react";
import { Editor } from "./App-editor.tsx";
import { imageLayer, rekeyImportedProjects } from "./App-layers.ts";
import {
	downloadDataUrl,
	downloadText,
	renderProject,
	safeFileName,
} from "./App-render.ts";
import { type AppMode, loadState, pickTextFile, saveState } from "./bridge.ts";
import { CarouselPreview } from "./components/CarouselPreview.tsx";
import {
	ExportDialog,
	type ExportFormat,
	type ExportMime,
} from "./components/ExportDialog.tsx";
import { Gallery } from "./components/Gallery.tsx";
import {
	carouselIssueSummary,
	carouselSlidesToProjects,
	emptyState,
	makeProject,
	parseCarouselImport,
	reduceSlidesState,
	serializeCarouselDocument,
} from "./model.ts";
import type {
	CarouselParseResult,
	Project,
	ProjectPatch,
	SlidesAction,
	SlidesState,
} from "./types.ts";
import "./slides.css";

type View = "gallery" | "editor" | "preview";

export default function App() {
	const tl = useLiteralMessages();
	const [state, setState] = useState<SlidesState>(emptyState);
	const [loaded, setLoaded] = useState(false);
	const [mode, setMode] = useState<AppMode>("live");
	const [view, setView] = useState<View>("gallery");
	const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
	const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
	const [showExport, setShowExport] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	useEffect(() => {
		void loadState()
			.then((loaded) => {
				setMode(loaded.mode);
				setState(loaded.state);
				setActiveProjectId(loaded.state.projects[0]?.id ?? null);
				setLoaded(true);
			})
			.catch(() =>
				setMessage("Slides storage could not be loaded. Reload before editing.")
			);
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
		const layer = imageLayer(source, activeProject);
		dispatch({ layer, projectId: activeProject.id, type: "add-layer" });
		setSelectedLayerId(layer.id);
	}

	function handleCarousel(result: CarouselParseResult) {
		const created = carouselSlidesToProjects(result.slides, {
			mark: "Ryu / Slides",
			title: "Generated carousel",
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
		setMessage(
			[
				`${created.length} carousel frame${created.length === 1 ? "" : "s"} added to the gallery.`,
				carouselIssueSummary(result),
			]
				.filter(Boolean)
				.join(" ")
		);
	}

	async function importCarousel() {
		try {
			const raw = await pickTextFile();
			if (!raw) {
				return;
			}
			const parsed = parseCarouselImport(raw);
			const imported = rekeyImportedProjects(
				parsed.projects,
				new Set(
					[...state.projects, ...state.trash].map((project) => project.id)
				)
			);
			if (imported.length === 0) {
				throw new Error("The carousel document has no usable frames.");
			}
			setState((current) =>
				imported.reduce(
					(next, project) =>
						reduceSlidesState(next, { project, type: "add-project" }),
					current
				)
			);
			const first = imported[0];
			if (first) {
				setActiveProjectId(first.id);
				setSelectedLayerId(first.layers[0]?.id ?? null);
				setView("editor");
			}
			setMessage(
				[
					`Imported ${imported.length} editable frame${imported.length === 1 ? "" : "s"}.`,
					carouselIssueSummary(parsed),
				]
					.filter(Boolean)
					.join(" ")
			);
		} catch (error) {
			setMessage(
				error instanceof Error
					? error.message
					: "The carousel could not be imported."
			);
		}
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

	async function exportActive(format: ExportFormat) {
		if (!activeProject) {
			return;
		}
		if (format === "application/json") {
			const series = state.projects
				.filter((project) => project.seriesId === activeProject.seriesId)
				.sort((left, right) => left.createdAt - right.createdAt);
			downloadText(
				serializeCarouselDocument(series.length > 0 ? series : [activeProject]),
				`${safeFileName(activeProject.seriesTitle, "carousel")}.json`
			);
			setMessage(
				tl("Exported editable JSON for {seriesTitle}.", {
					seriesTitle: activeProject.seriesTitle,
				})
			);
			return;
		}
		const mime: ExportMime = format;
		const dataUrl = await renderProject(activeProject, mime);
		const extension =
			mime === "image/jpeg" ? "jpg" : (mime.split("/")[1] ?? "png");
		downloadDataUrl(
			dataUrl,
			`${safeFileName(activeProject.name, "slides")}.${extension}`
		);
		setMessage(
			tl("Exported {format} from {name}.", {
				format: extension.toUpperCase(),
				name: activeProject.name,
			})
		);
	}

	if (!loaded) {
		return message ? (
			<RyuAppEmpty description={message} title="Slides storage unavailable" />
		) : (
			<div className="slides-loading">Opening Slides…</div>
		);
	}

	return (
		<div className="slides-app">
			{mode === "demo" ? (
				<div
					className="slides-preview-boundary"
					data-testid="slides-demo-banner"
					role="status"
				>
					Preview data · this browser workspace is local and is not node-owned.
				</div>
			) : null}
			{view === "gallery" ? (
				<Gallery
					onCreate={createProject}
					onEmptyTrash={() => dispatch({ type: "empty-trash" })}
					onFavorite={(projectId) =>
						dispatch({ projectId, type: "toggle-favorite" })
					}
					onImport={() => void importCarousel()}
					onOpen={openProject}
					onRestore={(id) => dispatch({ id, type: "restore-project" })}
					onTrash={moveProjectsToTrash}
					projects={state.projects}
					trash={state.trash}
				/>
			) : view === "preview" && activeProject ? (
				<CarouselPreview
					onClose={() => setView("editor")}
					projects={state.projects}
					startProjectId={activeProject.id}
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
					onPreview={() => setView("preview")}
					onProjectChange={updateActiveProject}
					onProjectPatch={(patch: ProjectPatch) =>
						dispatch({
							patch,
							projectId: activeProject.id,
							type: "update-project",
						})
					}
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
					onFavorite={(projectId) =>
						dispatch({ projectId, type: "toggle-favorite" })
					}
					onImport={() => void importCarousel()}
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
