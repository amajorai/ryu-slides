import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const mapUrl = new URL("./companion-interactions.json", import.meta.url);
const specUrl = new URL(
	"./specs/slides-owned-coverage.spec.mjs",
	import.meta.url
);

function namedTestBody(source, title) {
	const testStart = source.indexOf(["test(", JSON.stringify(title)].join(""));
	if (testStart < 0) {
		return "";
	}
	const nextTest = source.indexOf('\n\ntest("', testStart + 1);
	return source.slice(testStart, nextTest < 0 ? source.length : nextTest);
}

describe("Slides Companion interaction map", () => {
	test("maps the 26 unmapped census controls to named rendered assertions", async () => {
		const [mapSource, specSource] = await Promise.all([
			readFile(mapUrl, "utf8"),
			readFile(specUrl, "utf8"),
		]);
		const map = JSON.parse(mapSource);

		expect(map.package).toBe("slides");
		expect(map.scope).toBe("partial");
		expect(map.expectedRows).toBe(26);
		expect(map.assertions).toHaveLength(26);
		expect(
			new Set(
				map.assertions.map(({ row }) =>
					[row.source_file, row.line, row.component, row.tag].join(":")
				)
			).size
		).toBe(26);

		for (const assertion of map.assertions) {
			expect(
				specSource.includes(
					["test(", JSON.stringify(assertion.testTitle)].join("")
				)
			).toBe(true);
			expect(namedTestBody(specSource, assertion.testTitle)).toContain(
				assertion.assertionMarker
			);
		}
	});
});
