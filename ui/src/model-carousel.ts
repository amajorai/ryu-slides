import { translate as tl } from "@ryu/i18n/core";
import { z } from "zod";
import { positionedLayers, themedLayers } from "./model.ts";
import {
	type CarouselDocumentMetadata,
	makeProject,
	normalizeState,
} from "./model-storage.ts";
import {
	DEFAULT_AUTHOR,
	DEFAULT_MARK,
	DEFAULT_THEME,
	makeId,
	slideLayout,
	slideTheme,
	storedRecord,
	stringValue,
} from "./model-values.ts";
import { type SlidesStoredValue, slidesStoredValueSchema } from "./schemas.ts";
import type {
	CarouselImportResult,
	CarouselParseResult,
	CarouselSlide,
	Project,
	TextLayer,
} from "./types.ts";

export function placeholderImage(): string {
	const svg =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420"><rect width="640" height="420" fill="#171a18"/><circle cx="500" cy="100" r="150" fill="#e9f48b"/><path d="M0 310C160 220 280 360 640 245V420H0Z" fill="#5f7659"/><text x="42" y="92" fill="#f4f1e9" font-family="Geist Variable, Geist, sans-serif" font-size="32" font-weight="500">SLIDES</text></svg>';
	return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function trimmedString(value: SlidesStoredValue): string {
	const parsed = z.string().safeParse(value);
	return parsed.success ? parsed.data.trim() : "";
}

export function parseCarouselResponse(
	value: SlidesStoredValue,
	maxSlides = 8
): CarouselParseResult {
	const result: CarouselParseResult = { dropped: 0, incomplete: 0, slides: [] };
	const stored = storedRecord(value);
	if (!(stored && Array.isArray(stored.slides))) {
		return result;
	}
	for (const rawSlide of stored.slides) {
		if (result.slides.length >= maxSlides) {
			break;
		}
		const slide = storedRecord(rawSlide);
		if (!slide) {
			result.dropped += 1;
			continue;
		}
		const headline =
			trimmedString(slide.headline) || trimmedString(slide.title);
		if (!headline) {
			result.dropped += 1;
			continue;
		}
		const body = trimmedString(slide.body);
		const visualPrompt = trimmedString(slide.visualPrompt);
		if (!(body && visualPrompt)) {
			result.incomplete += 1;
		}
		const parsedSlide: CarouselSlide = { body, headline, visualPrompt };
		if (slide.layout === undefined) {
			result.slides.push(parsedSlide);
		} else {
			const withLayout: CarouselSlide = {
				body,
				headline,
				layout: slideLayout(slide.layout, "content"),
				visualPrompt,
			};
			result.slides.push(withLayout);
		}
	}
	return result;
}

/**
 * Describe slides the parser skipped or left partly empty, so the UI can tell
 * the user instead of silently filling gaps. Returns "" when nothing is missing.
 */
export function carouselIssueSummary({
	dropped,
	incomplete,
}: Pick<CarouselParseResult, "dropped" | "incomplete">): string {
	if (dropped > 0 && incomplete > 0) {
		return tl(
			"{dropped, plural, one {# slide without a headline was skipped} other {# slides without a headline were skipped}}; {incomplete, plural, one {# frame is missing a body or visual prompt} other {# frames are missing a body or visual prompt}}.",
			{ dropped, incomplete }
		);
	}
	if (dropped > 0) {
		return tl(
			"{dropped, plural, one {# slide without a headline was skipped} other {# slides without a headline were skipped}}.",
			{ dropped }
		);
	}
	if (incomplete > 0) {
		return tl(
			"{incomplete, plural, one {# frame is missing a body or visual prompt} other {# frames are missing a body or visual prompt}}.",
			{ incomplete }
		);
	}
	return "";
}

export function carouselSlidesToProjects(
	slides: CarouselSlide[],
	metadata: CarouselDocumentMetadata = {}
): Project[] {
	const bounded = slides.slice(0, 50);
	const title = metadata.title?.trim() || "Imported carousel";
	const seriesId = metadata.seriesId ?? makeId("series");
	return bounded.map((slide, index) => {
		const layout =
			slide.layout ??
			(index === 0
				? "cover"
				: index === bounded.length - 1
					? "closing"
					: "content");
		const project = makeProject(
			`${title} ${String(index + 1).padStart(2, "0")}`,
			{
				author: metadata.author,
				layout,
				mark: metadata.mark,
				seriesId,
				seriesTitle: title,
				sequence: index,
				theme: metadata.theme,
			}
		);
		const supportingText: TextLayer = {
			align: "left",
			color: "#171a18",
			fontSize: 34,
			fontWeight: "400",
			height: 140,
			id: makeId("layer"),
			locked: false,
			name: "Body",
			opacity: 1,
			rotation: 0,
			text: slide.body,
			type: "text",
			visible: true,
			width: 720,
			x: 110,
			y: 430,
		};
		const importedLayers = [...project.layers];
		importedLayers.splice(1, 0, supportingText);
		let textIndex = 0;
		const layers = positionedLayers(
			themedLayers(importedLayers, project.theme, layout),
			layout,
			project.width
		).map((layer) => {
			if (layer.type !== "text") {
				return layer;
			}
			const text = textIndex === 0 ? slide.headline : slide.body;
			textIndex += 1;
			return { ...layer, text };
		});
		const createdAt = project.createdAt + index;
		return { ...project, createdAt, layers, updatedAt: createdAt };
	});
}

function projectHeadline(project: Project): string {
	return (
		project.layers.find((layer): layer is TextLayer => layer.type === "text")
			?.text ?? project.name
	);
}

function projectBody(project: Project): string {
	const textLayers = project.layers.filter(
		(layer): layer is TextLayer => layer.type === "text"
	);
	return textLayers[1]?.text ?? "";
}

export function serializeCarouselDocument(projects: Project[]): string {
	const ordered = [...projects].sort(
		(left, right) =>
			left.sequence - right.sequence || left.createdAt - right.createdAt
	);
	const first = ordered[0];
	const stripHistory = (project: Project) => ({
		...project,
		future: [],
		history: [],
	});
	return JSON.stringify(
		{
			app: "@ryu/slides",
			author: first?.author ?? DEFAULT_AUTHOR,
			mark: first?.mark ?? DEFAULT_MARK,
			projects: ordered.map(stripHistory),
			theme: first?.theme ?? DEFAULT_THEME,
			title: first?.seriesTitle ?? first?.name ?? "Untitled carousel",
			version: 1,
			slides: ordered.map((project) => ({
				body: projectBody(project),
				id: project.id,
				layout: project.layout,
				sequence: project.sequence,
				title: projectHeadline(project),
			})),
		},
		null,
		2
	);
}

export function parseCarouselImport(raw: string): CarouselImportResult {
	let value: SlidesStoredValue;
	try {
		value = slidesStoredValueSchema.parse(JSON.parse(raw));
	} catch {
		throw new Error("That is not valid carousel JSON.");
	}
	const stored = storedRecord(value);
	if (!stored) {
		throw new Error("The carousel document must be a JSON object.");
	}
	if (Array.isArray(stored.projects)) {
		const imported = normalizeState({
			projects: stored.projects,
			trash: [],
		}).projects;
		if (imported.length > 0) {
			return { dropped: 0, incomplete: 0, projects: imported };
		}
	}
	if (Array.isArray(stored.slides)) {
		const { dropped, incomplete, slides } = parseCarouselResponse(stored, 50);
		if (slides.length > 0) {
			const projects = carouselSlidesToProjects(slides, {
				author: stringValue(stored.author, DEFAULT_AUTHOR),
				mark: stringValue(stored.mark, DEFAULT_MARK),
				theme: slideTheme(stored.theme),
				title: stringValue(stored.title, "Imported carousel"),
			});
			return { dropped, incomplete, projects };
		}
	}
	throw new Error("The carousel document has no usable projects or slides.");
}

export function parseCarouselText(raw: string): CarouselParseResult {
	const trimmed = raw
		.trim()
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "");
	const start = trimmed.indexOf("{");
	const end = trimmed.lastIndexOf("}");
	if (start < 0 || end <= start) {
		return { dropped: 0, incomplete: 0, slides: [] };
	}
	try {
		return parseCarouselResponse(JSON.parse(trimmed.slice(start, end + 1)));
	} catch {
		return { dropped: 0, incomplete: 0, slides: [] };
	}
}

export function carouselPrompt(topic: string, count: number): string {
	return [
		"Return JSON only with this shape: {slides:[{headline:string,body:string,visualPrompt:string}]}.",
		`Create ${count} concise visual slides for: ${topic.trim() || "a useful idea"}.`,
		"Keep each headline short, each body actionable, and each visualPrompt safe for an image model.",
	].join("\n");
}
