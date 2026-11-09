import { afterEach, describe, expect, test } from "bun:test";
import {
	type ActiveI18nRuntime,
	registerActiveI18nRuntime,
	unregisterActiveI18nRuntime,
} from "../../../../packages/i18n/src/active-locale.ts";
import { geometricLayer, imageLayer, textLayer } from "./App-layers.ts";
import { demoState, makeProject } from "./model.ts";
import type { Layer, Project } from "./types.ts";

const ENGLISH_SEEDS = [
	"Untitled project",
	"First frame",
	"Headline",
	"Make the frame clear.",
	"Signal shape",
	"Text layer",
	"New text",
	"Shape layer",
	"Image layer",
];

/** A host whose catalog gives every seed a distinct string in `locale`. */
function host(
	locale: string,
	direction: "ltr" | "rtl",
	prefix: string
): ActiveI18nRuntime {
	const seen = new Map<string, string>();
	return {
		direction,
		locale,
		translate: (_id, _values, fallback = "") => {
			const known = seen.get(fallback) ?? `${prefix}${seen.size + 1}`;
			seen.set(fallback, known);
			return known;
		},
	};
}

function seededText(project: Project, added: Layer[]): string[] {
	return [
		project.name,
		project.seriesTitle,
		...[...project.layers, ...added].flatMap((layer) => [
			layer.name,
			layer.type === "text" ? layer.text : "",
		]),
	];
}

let active: ActiveI18nRuntime | null = null;

afterEach(() => {
	if (active) {
		unregisterActiveI18nRuntime(active);
		active = null;
	}
});

describe("seeded Slides content follows the UI language", () => {
	for (const [locale, direction, prefix] of [
		["ja", "ltr", "見本"],
		["ar", "rtl", "نموذج"],
		["de", "ltr", "Muster"],
	] as const) {
		test(`new projects and layers carry no English seed under ${locale}`, () => {
			active = host(locale, direction, prefix);
			registerActiveI18nRuntime(active);
			const project = makeProject();
			const added = [
				textLayer(),
				geometricLayer(),
				imageLayer("data:image/png;base64,", project),
			];
			const seeded = [
				...seededText(project, added),
				...seededText(demoState().projects[0]!, []),
			].join("\n");
			for (const english of ENGLISH_SEEDS) {
				expect(seeded).not.toContain(english);
			}
			expect(project.name.startsWith(prefix)).toBe(true);
		});
	}

	test("English hosts keep the English seeds", () => {
		const project = makeProject();
		expect(project.name).toBe("Untitled project");
		expect(textLayer().text).toBe("New text");
		expect(demoState().projects[0]?.name).toBe("First frame");
	});

	test("an explicit project name is kept as given", () => {
		active = host("ja", "ltr", "見本");
		registerActiveI18nRuntime(active);
		expect(makeProject("Launch").name).toBe("Launch");
	});
});
