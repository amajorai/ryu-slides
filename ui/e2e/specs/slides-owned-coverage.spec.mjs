import { readFileSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const BUNDLE = "/private/tmp/ryu-slides-owned-build/index.html";
const EVIDENCE = path.resolve(import.meta.dirname, "../evidence");
const PACKAGE_ROOT = path.resolve(import.meta.dirname, "../..");
const GRANTS = [
	"storage:kv",
	"media:generate",
	"hook:side-model",
	"files:download",
];
const PNG_DATA_URL =
	"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function mountApp(page, { remount = false } = {}) {
	if (!remount) {
		await page.goto("/");
		await expect(page.locator("body")).toHaveAttribute(
			"data-harness-ready",
			"1"
		);
		await page.evaluate(() => window.__slidesOwnedProof.reset());
	}
	const appHtml = await readFile(BUNDLE, "utf8");
	await page.evaluate((options) => window.__slidesOwnedProof.mount(options), {
		appHtml,
		grants: [...GRANTS],
		pluginId: "@ryu/slides",
	});
	await expect
		.poll(() => page.evaluate(() => window.__slidesOwnedProof.connected()), {
			timeout: 20_000,
		})
		.toBe(true);
	return page.frameLocator('iframe[title="Slides regression proof"]');
}

async function configure(page, options) {
	await page.evaluate(
		(fixture) => window.__slidesOwnedProof.configure(fixture),
		options
	);
}

async function persisted(page) {
	return page.evaluate(() => window.__slidesOwnedProof.persisted());
}

async function savedProject(page, name, matches = () => true) {
	let match = null;
	await expect
		.poll(async () => {
			const state = await persisted(page);
			match = state?.projects?.find((project) => project.name === name) ?? null;
			return Boolean(match && matches(match));
		})
		.toBe(true);
	return match;
}

async function chooseFile(page, button, file) {
	const chooserPromise = page.waitForEvent("filechooser");
	await button.click();
	const chooser = await chooserPromise;
	await chooser.setFiles(file);
	return chooser;
}

async function makeProject(app, name) {
	await app.getByRole("button", { name: /New project/ }).click();
	await app.getByRole("textbox", { name: "Project name" }).fill(name);
	await app.getByRole("heading", { name: "Layers" }).waitFor();
}

async function remountHost(page) {
	const app = await mountApp(page, { remount: true });
	return app;
}

async function saveEvidence(page, name) {
	await mkdir(EVIDENCE, { recursive: true });
	await page.screenshot({
		animations: "disabled",
		fullPage: true,
		path: path.join(EVIDENCE, name),
	});
}

function videoDataUrl(filename) {
	const bytes = readFileSync(path.join(PACKAGE_ROOT, "e2e/fixtures", filename));
	return `data:video/webm;base64,${bytes.toString("base64")}`;
}

function layerBounds(layer) {
	const radians = (layer.rotation * Math.PI) / 180;
	const width =
		Math.abs(layer.width * Math.cos(radians)) +
		Math.abs(layer.height * Math.sin(radians));
	const height =
		Math.abs(layer.width * Math.sin(radians)) +
		Math.abs(layer.height * Math.cos(radians));
	const centerX = layer.x + layer.width / 2;
	const centerY = layer.y + layer.height / 2;
	return {
		bottom: centerY + height / 2,
		left: centerX - width / 2,
		right: centerX + width / 2,
		top: centerY - height / 2,
	};
}

function expectImageClearOfText(project, image) {
	const imageBounds = layerBounds(image);
	const textLayers = project.layers.filter((layer) => layer.type === "text");
	expect(textLayers.length).toBeGreaterThan(0);
	for (const textLayer of textLayers) {
		const textBounds = layerBounds(textLayer);
		const overlaps =
			imageBounds.left < textBounds.right &&
			imageBounds.right > textBounds.left &&
			imageBounds.top < textBounds.bottom &&
			imageBounds.bottom > textBounds.top;
		expect(overlaps).toBe(false);
	}
}

test("shape and image inspector edits select, render, persist, and reopen", async ({
	page,
}) => {
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	let app = await mountApp(page);
	await makeProject(app, "Element roundtrip");

	await app.getByRole("option", { name: /Headline/ }).click();
	// The editor CarouselFrame selects the matching canvas layer and exposes its live inspector.
	await app.getByRole("spinbutton", { name: "W", exact: true }).fill("760");
	await app.getByRole("spinbutton", { name: "H", exact: true }).fill("180");
	await app.getByRole("spinbutton", { name: "Angle", exact: true }).fill("14");
	await app
		.getByRole("spinbutton", { name: "Opacity", exact: true })
		.fill("0.65");
	// Width, height, angle and opacity numeric fields are applied to the selected layer and persist in the project model.
	// X, Y, W, H, Angle and Opacity inspector fields update the selected layer and its persisted geometry.

	const canvas = app.getByRole("application", {
		name: "Element roundtrip canvas",
	});
	await canvas.click({ position: { x: 8, y: 8 } });
	// Clicking the blank canvas deselects the active layer and removes its transform handles.
	await expect(
		app.getByText("Select a layer to tune it.", { exact: true })
	).toBeVisible();
	await expect(
		app.getByRole("button", { name: "Resize Headline" })
	).toHaveCount(0);
	await app
		.locator(".slides-layer-node")
		.filter({ hasText: "Make the frame clear." })
		.click();
	// The LayerCanvas layer click and pointer interaction select that layer and reveal its inspector and resize handle.
	await expect(
		app.getByRole("button", { name: "Resize Headline" })
	).toBeVisible();

	await app.getByRole("button", { name: "+ Text", exact: true }).click();
	await app.getByRole("option", { name: /Text layer/ }).click();
	const bodyName = app.getByRole("textbox", { name: "Name", exact: true });
	await bodyName.fill("Body");
	await bodyName.blur();
	await app
		.getByRole("textbox", { name: "Text", exact: true })
		.fill("Supporting copy stays visible beside the image.");

	await app.getByRole("button", { name: "+ Shape", exact: true }).click();
	// Add Shape inserts a new editable shape layer that accepts color, geometry and shape edits.
	await app.getByRole("option", { name: /Shape layer/ }).click();
	await app.getByRole("button", { name: "Shape fill color" }).click();
	await app.getByRole("textbox", { name: "Hex color value" }).fill("#4a8fd8");
	await page.keyboard.press("Escape");
	// The Fill color picker commits its hex value to the selected shape layer.
	await app
		.getByRole("combobox", { name: "Shape", exact: true })
		.selectOption("ellipse");
	await app.getByRole("spinbutton", { name: "W", exact: true }).fill("460");
	await app.getByRole("spinbutton", { name: "H", exact: true }).fill("310");
	await app.getByRole("spinbutton", { name: "Angle", exact: true }).fill("-24");

	await app.getByRole("button", { name: "+ Image", exact: true }).click();
	// Add Image inserts a real previewable image layer with default frame bounds.
	await expect(app.getByRole("option", { name: /Image layer/ })).toBeVisible();
	await app
		.getByRole("combobox", { name: "Fit", exact: true })
		.selectOption("contain");
	// The image Fit selector updates the rendered object-fit behavior and persisted layer state.
	const imageElement = app.locator('.slides-layer-node img[alt="Image layer"]');
	await expect(imageElement).toBeVisible();
	await expect(app.locator(".slides-frame-footer")).toBeVisible();
	await expect
		.poll(() =>
			imageElement.evaluate((image) => image.complete && image.naturalWidth > 0)
		)
		.toBe(true);
	await expect
		.poll(() =>
			imageElement.evaluate((image) => getComputedStyle(image).objectFit)
		)
		.toBe("contain");

	await expect
		.poll(async () => {
			const project = (await persisted(page))?.projects?.find(
				(item) => item.name === "Element roundtrip"
			);
			return project?.layers?.length ?? 0;
		})
		.toBe(5);
	const saved = (await persisted(page)).projects.find(
		(project) => project.name === "Element roundtrip"
	);
	const geometry = saved.layers.find((layer) => layer.name === "Shape layer");
	const headline = saved.layers.find((layer) => layer.name === "Headline");
	const body = saved.layers.find((layer) => layer.name === "Body");
	const image = saved.layers.find((layer) => layer.name === "Image layer");
	expect(headline).toMatchObject({
		height: 180,
		opacity: 0.65,
		rotation: 14,
		width: 760,
	});
	expect(body.text).toBe("Supporting copy stays visible beside the image.");
	expect(geometry).toMatchObject({
		fill: "#4A8FD8",
		height: 310,
		rotation: -24,
		shape: "ellipse",
		width: 460,
	});
	expect(image).toMatchObject({
		fit: "contain",
		height: 340,
		type: "image",
		width: 520,
		x: 80,
		y: 660,
	});
	expect(image.source).toMatch(/^data:image\/png;base64,/);
	expectImageClearOfText(saved, image);
	await saveEvidence(page, "slides-owned-elements-before-remount.png");

	app = await remountHost(page);
	const projectCard = app.getByRole("button", {
		name: "Open Element roundtrip",
	});
	await projectCard
		.locator(".slides-layer-node")
		.filter({ hasText: "Make the frame clear." })
		.click();
	// The gallery thumbnail's read-only CarouselFrame lets the outer ProjectCard open its persisted editor.
	await expect(app.getByRole("heading", { name: "Layers" })).toBeVisible();
	await app.getByRole("option", { name: /Shape layer/ }).click();
	await expect(
		app.getByRole("combobox", { name: "Shape", exact: true })
	).toHaveValue("ellipse");
	await expect(
		app.getByRole("spinbutton", { name: "W", exact: true })
	).toHaveValue("460");
	await app.getByRole("option", { name: /Image layer/ }).click();
	await expect(
		app.getByRole("combobox", { name: "Fit", exact: true })
	).toHaveValue("contain");
	await expect
		.poll(() =>
			imageElement.evaluate(
				(element) => element.complete && element.naturalWidth > 0
			)
		)
		.toBe(true);
	const reopened = await persisted(page);
	const reopenedProject = reopened.projects.find(
		(project) => project.name === "Element roundtrip"
	);
	const reopenedImage = reopenedProject.layers.find(
		(layer) => layer.name === "Image layer"
	);
	expect(reopenedImage).toMatchObject({ height: 340, x: 80, y: 660 });
	expectImageClearOfText(reopenedProject, reopenedImage);
	await expect
		.poll(() =>
			imageElement.evaluate((element) => getComputedStyle(element).objectFit)
		)
		.toBe("contain");
	await saveEvidence(page, "slides-owned-elements-reopened.png");
	const liveErrors = await page.evaluate(() =>
		window.__slidesOwnedProof.calls()
	);
	expect(liveErrors.some((call) => call.method === "storage.set")).toBe(true);
	expect(pageErrors).toEqual([]);
});

test("canvas selection, drag, resize, and rotate persist the resulting geometry", async ({
	page,
}) => {
	let app = await mountApp(page);
	await makeProject(app, "Transform proof");
	await app.getByRole("option", { name: /Signal shape/ }).click();
	await app.getByRole("spinbutton", { name: "X", exact: true }).fill("500");
	await app.getByRole("spinbutton", { name: "Y", exact: true }).fill("450");
	// The X and Y inspector fields set the saved canvas position before pointer dragging changes it.
	await app.getByRole("spinbutton", { name: "W", exact: true }).fill("400");
	await app.getByRole("spinbutton", { name: "H", exact: true }).fill("250");
	await app.getByRole("spinbutton", { name: "Angle", exact: true }).fill("0");

	const projectBefore = await savedProject(
		page,
		"Transform proof",
		(project) => {
			const layer = project.layers.find((item) => item.name === "Signal shape");
			return (
				layer &&
				layer.x === 500 &&
				layer.y === 450 &&
				layer.width === 400 &&
				layer.height === 250 &&
				layer.rotation === 0
			);
		}
	);
	const initial = projectBefore.layers.find(
		(layer) => layer.name === "Signal shape"
	);
	const canvas = app.getByRole("application", {
		name: "Transform proof canvas",
	});
	const canvasBox = await canvas.boundingBox();
	const layer = app.locator(".slides-layer-node").filter({
		has: app.locator(".slides-layer-shape"),
	});
	await layer.click();
	await expect(
		app.getByRole("button", { name: "Resize Signal shape" })
	).toBeVisible();
	const layerBox = await layer.boundingBox();
	expect(canvasBox).toBeTruthy();
	expect(layerBox).toBeTruthy();

	await page.mouse.move(
		layerBox.x + layerBox.width / 2,
		layerBox.y + layerBox.height / 2
	);
	await page.mouse.down();
	await page.mouse.move(
		layerBox.x + layerBox.width / 2 + 54,
		layerBox.y + layerBox.height / 2 + 36,
		{ steps: 4 }
	);
	await page.mouse.up();
	// The LayerCanvas pointer-down/move/up sequence persists the moved layer geometry.
	const moved = await savedProject(page, "Transform proof", (project) => {
		const layer = project.layers.find((item) => item.name === "Signal shape");
		return layer && layer.x > initial.x + 20 && layer.y > initial.y + 20;
	});
	let current = moved.layers.find((item) => item.name === "Signal shape");
	const expectedX = initial.x + (54 / canvasBox.width) * moved.width;
	const expectedY = initial.y + (36 / canvasBox.height) * moved.height;
	expect(current.x).toBeCloseTo(expectedX, 0);
	expect(current.y).toBeCloseTo(expectedY, 0);

	const resize = app.getByRole("button", { name: "Resize Signal shape" });
	const resizeBox = await resize.boundingBox();
	expect(resizeBox).toBeTruthy();
	await page.mouse.move(
		resizeBox.x + resizeBox.width / 2,
		resizeBox.y + resizeBox.height / 2
	);
	await page.mouse.down();
	await page.mouse.move(
		resizeBox.x + resizeBox.width / 2 + 42,
		resizeBox.y + resizeBox.height / 2 + 24,
		{ steps: 4 }
	);
	await page.mouse.up();
	// The resize handle's pointer interaction updates the layer's stored width and height.
	const resized = await savedProject(page, "Transform proof", (project) => {
		const layer = project.layers.find((item) => item.name === "Signal shape");
		return (
			layer && layer.width > current.width && layer.height > current.height
		);
	});
	current = resized.layers.find((item) => item.name === "Signal shape");
	const movedGeometry = moved.layers.find(
		(item) => item.name === "Signal shape"
	);
	expect(current.width).toBeGreaterThan(movedGeometry.width);
	expect(current.height).toBeGreaterThan(movedGeometry.height);

	const layerNode = layer;
	const currentBox = await layerNode.boundingBox();
	const rotate = app.getByRole("button", { name: "Rotate Signal shape" });
	const rotateBox = await rotate.boundingBox();
	expect(currentBox).toBeTruthy();
	expect(rotateBox).toBeTruthy();
	const center = {
		x: currentBox.x + currentBox.width / 2,
		y: currentBox.y + currentBox.height / 2,
	};
	const start = {
		x: rotateBox.x + rotateBox.width / 2,
		y: rotateBox.y + rotateBox.height / 2,
	};
	const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
	const radius = Math.hypot(start.x - center.x, start.y - center.y);
	const nextAngle = startAngle + 0.55;
	await page.mouse.move(start.x, start.y);
	await page.mouse.down();
	await page.mouse.move(
		center.x + Math.cos(nextAngle) * radius,
		center.y + Math.sin(nextAngle) * radius,
		{ steps: 5 }
	);
	await page.mouse.up();
	// The rotation handle persists the new angle after a user drag.
	const rotated = await savedProject(page, "Transform proof", (project) => {
		const layer = project.layers.find((item) => item.name === "Signal shape");
		return layer && Math.abs(layer.rotation - current.rotation) > 20;
	});
	current = rotated.layers.find((item) => item.name === "Signal shape");
	expect(
		Math.abs(current.rotation - resized.layers[0].rotation)
	).toBeGreaterThan(20);
	await saveEvidence(page, "slides-owned-canvas-transforms-persisted.png");

	app = await remountHost(page);
	await app.getByRole("button", { name: "Open Transform proof" }).click();
	const reloadedState = await persisted(page);
	const reloaded = reloadedState.projects.find(
		(project) => project.name === "Transform proof"
	);
	const saved = reloaded.layers.find((item) => item.name === "Signal shape");
	expect(saved).toMatchObject({
		x: current.x,
		y: current.y,
		width: current.width,
		height: current.height,
	});
	expect(saved.rotation).toBeCloseTo(current.rotation, 0);
});

test("import reports malformed JSON, recovers on retry, and exports the imported deck", async ({
	page,
}) => {
	const app = await mountApp(page);
	const validDocument = JSON.stringify({
		author: "Slides QA",
		mark: "Ryu Lab",
		theme: "ai-engineer",
		title: "Launch deck",
		slides: [
			{
				body: "Give the first release one goal.",
				headline: "Ship a clear first step",
				layout: "cover",
				visualPrompt: "A simple blue field",
			},
			{
				body: "Watch what people complete.",
				headline: "Measure the outcome",
				layout: "closing",
				visualPrompt: "A notebook with one mark",
			},
		],
	});
	const importButton = app.getByRole("button", { name: "Import JSON" });
	const malformedChooser = await chooseFile(page, importButton, {
		name: "broken.json",
		mimeType: "application/json",
		buffer: Buffer.from("{"),
	});
	expect(await (await malformedChooser.element()).getAttribute("accept")).toBe(
		"application/json,.json,text/plain"
	);
	// Import JSON opens the browser file chooser and reports malformed content instead of mutating the gallery.
	const message = app.getByRole("button", { name: "Dismiss message" });
	await expect(message).toContainText("That is not valid carousel JSON.");
	await message.click();
	// Dismiss message clears only the malformed-import notification so a corrected deck can be selected.
	await expect(message).toHaveCount(0);
	await chooseFile(page, importButton, {
		name: "launch-deck.json",
		mimeType: "application/json",
		buffer: Buffer.from(validDocument),
	});
	// A valid JSON selection imports both editable frames and the announced result can be exported again.
	await expect(
		app.getByRole("button", { name: "Dismiss message" })
	).toContainText("Imported 2 editable frames.");
	await expect(app.getByRole("heading", { name: "Layers" })).toBeVisible();

	await expect
		.poll(async () => {
			const state = await persisted(page);
			return state?.projects?.length ?? 0;
		})
		.toBe(2);
	const state = await persisted(page);
	const imported = state.projects.find((project) => project.sequence === 0);
	expect(imported).toMatchObject({
		author: "Slides QA",
		layout: "cover",
		mark: "Ryu Lab",
		seriesTitle: "Launch deck",
		theme: "ai-engineer",
	});
	expect(imported.layers.find((layer) => layer.name === "Headline").text).toBe(
		"Ship a clear first step"
	);
	expect(imported.layers.find((layer) => layer.name === "Body").text).toBe(
		"Give the first release one goal."
	);

	await app.getByRole("button", { name: "Open reader preview →" }).click();
	await expect(app.getByRole("heading", { name: "Launch deck" })).toBeVisible();
	await app.getByRole("button", { name: "Open frame 2" }).click();
	await expect(
		app.getByText("Measure the outcome", { exact: true })
	).toBeVisible();
	const previewState = await persisted(page);
	await app
		.locator(".slides-reader-frame .slides-layer-node")
		.filter({ hasText: "Measure the outcome" })
		.click();
	// Reader navigation selects the requested frame; clicking a read-only CarouselFrame does not change its saved project.
	expect(await persisted(page)).toEqual(previewState);
	await expect(app.getByRole("button", { name: /Resize/u })).toHaveCount(0);
	await saveEvidence(page, "slides-owned-carousel-reader-preview.png");
	await app.getByRole("button", { name: "Close preview" }).click();
	await expect(app.getByRole("heading", { name: "Layers" })).toBeVisible();

	const downloadEvent = page.waitForEvent("download");
	await app.getByRole("button", { name: "Export", exact: true }).click();
	await app.getByRole("radio", { name: /Carousel JSON/ }).check();
	await app.getByRole("button", { name: "Export", exact: true }).last().click();
	const download = await downloadEvent;
	const exportedPath = await download.path();
	expect(exportedPath).toBeTruthy();
	const exported = JSON.parse(await readFile(exportedPath, "utf8"));
	expect(exported.title).toBe("Launch deck");
	expect(exported.slides).toHaveLength(2);
	expect(exported.slides[0]).toMatchObject({
		body: "Give the first release one goal.",
		title: "Ship a clear first step",
	});
	await saveEvidence(page, "slides-owned-imported-deck-exported.png");
});

test("image and video upload, scrub, capture, and provider retry yield usable media", async ({
	page,
}) => {
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	const app = await mountApp(page);
	await makeProject(app, "Media retry proof");
	const generatedVideo = videoDataUrl("generated-blue.webm");
	await configure(page, {
		failures: { "media.video": ["fixture video service unavailable"] },
		generatedVideoDataUrl: generatedVideo,
	});

	const uploadedPng = Buffer.from(PNG_DATA_URL.split(",")[1], "base64");
	const imageChooser = await chooseFile(
		page,
		app.getByRole("button", { name: "Upload", exact: true }),
		{
			name: "sample.png",
			mimeType: "image/png",
			buffer: uploadedPng,
		}
	);
	// Upload routes the local PNG through the browser chooser and inserts its decodable bytes as an image layer.
	const uploadedImage = `data:image/png;base64,${uploadedPng.toString("base64")}`;
	expect(await (await imageChooser.element()).getAttribute("accept")).toBe(
		"image/*"
	);
	await expect(app.getByRole("option", { name: /Image layer/ })).toBeVisible();
	await expect(
		app.locator('.slides-layer-node img[alt="Image layer"]')
	).toBeVisible();
	const uploadVideoBytes = readFileSync(
		path.join(PACKAGE_ROOT, "e2e/fixtures/upload-red.webm")
	);
	const videoChooser = await chooseFile(
		page,
		app.getByRole("button", { name: "Choose video" }),
		{
			name: "sample.webm",
			mimeType: "video/webm",
			buffer: uploadVideoBytes,
		}
	);
	// Choose video selects a local WebM fixture and renders a real decoded video preview.
	expect(await (await videoChooser.element()).getAttribute("accept")).toBe(
		"video/*"
	);
	const video = app.locator("video.slides-video-preview");
	await expect(video).toBeVisible();
	await expect
		.poll(() =>
			video.evaluate(
				(element) => element.readyState >= 2 && element.duration > 0
			)
		)
		.toBe(true);
	await expect
		.poll(async () => {
			const project = await savedProject(page, "Media retry proof");
			return project.layers.some(
				(layer) => layer.type === "image" && layer.source === uploadedImage
			);
		})
		.toBe(true);
	const scrubber = app.getByRole("slider", { name: "Video position" });
	await scrubber.focus();
	await scrubber.press("End");
	// Video position scrubbing moves the HTML video currentTime before the selected frame is captured.
	await expect
		.poll(() => video.evaluate((element) => element.currentTime > 0.5))
		.toBe(true);
	await app.getByRole("button", { name: "Capture current frame" }).click();
	// Capture current frame adds the selected decoded video frame as a usable PNG image layer.
	let project = await savedProject(page, "Media retry proof", (stored) => {
		const savedImage = stored.layers.find((layer) => layer.type === "image");
		return savedImage && savedImage.source !== uploadedImage;
	});
	let image = project.layers.find((layer) => layer.type === "image");
	expect(image.source).toMatch(/^data:image\/png;base64,/);
	const uploadedVideoFrame = image.source;

	await app
		.getByLabel("Prompt")
		.fill("A blue studio light moving across a desk");
	await app.getByRole("button", { name: "Generate a Ryu video clip" }).click();
	await expect(
		app.getByText("fixture video service unavailable", { exact: true })
	).toBeVisible();
	await app.getByRole("button", { name: "Generate a Ryu video clip" }).click();
	// Generate a Ryu video clip retries the exact prompt after a local provider error and renders the returned video.
	await expect
		.poll(() =>
			video.evaluate((element) =>
				element.currentSrc.startsWith("data:video/webm;base64,")
			)
		)
		.toBe(true);
	await expect
		.poll(() =>
			video.evaluate(
				(element) => element.readyState >= 2 && element.duration > 0
			)
		)
		.toBe(true);
	await app.getByRole("button", { name: "Capture current frame" }).click();
	project = await savedProject(page, "Media retry proof", (stored) => {
		const savedImage = stored.layers.find((layer) => layer.type === "image");
		return savedImage && savedImage.source !== uploadedVideoFrame;
	});
	image = project.layers.find((layer) => layer.type === "image");
	expect(image.source).toMatch(/^data:image\/png;base64,/);
	const calls = await page.evaluate(() => window.__slidesOwnedProof.calls());
	expect(calls.filter((call) => call.method === "media.video")).toHaveLength(2);
	expect(calls.find((call) => call.method === "media.video").args.prompt).toBe(
		"A blue studio light moving across a desk"
	);
	await saveEvidence(page, "slides-owned-video-frame-captured-after-retry.png");
	expect(pageErrors).toEqual([]);
});

test("image generation and carousel drafting recover from transient bridge errors", async ({
	page,
}) => {
	const pageErrors = [];
	page.on("pageerror", (error) => pageErrors.push(error.message));
	const app = await mountApp(page);
	await makeProject(app, "Retry project");
	await configure(page, {
		failures: {
			"media.image": ["fixture image engine unavailable"],
			"model.complete": ["fixture model unavailable"],
		},
	});

	await app.getByLabel("Prompt").fill("A calm blue paper kite");
	const generateImage = app.getByRole("button", {
		name: "Generate",
		exact: true,
	});
	await generateImage.click();
	await expect(app.getByRole("status")).toContainText(
		"fixture image engine unavailable"
	);
	await expect(generateImage).toBeEnabled();
	await generateImage.click();
	await expect(app.getByRole("option", { name: /Image layer/ })).toBeVisible();
	await expect
		.poll(async () => {
			const project = await savedProject(page, "Retry project");
			return project.layers.some(
				(layer) =>
					layer.type === "image" &&
					layer.source.startsWith("data:image/png;base64,")
			);
		})
		.toBe(true);

	await app.getByLabel("Topic").fill("Recover from transient failures");
	await app.getByLabel("Frames").fill("3");
	const draft = app.getByRole("button", { name: "Draft carousel" });
	await draft.click();
	await expect(app.getByRole("status")).toContainText(
		"fixture model unavailable"
	);
	await expect(draft).toBeEnabled();
	await draft.click();
	await expect(
		app.getByRole("button", { name: "Dismiss message" })
	).toContainText("2 carousel frames added to the gallery.");
	await expect
		.poll(async () => {
			const state = await persisted(page);
			return state?.projects?.length ?? 0;
		})
		.toBe(3);
	const state = await persisted(page);
	const generated = state.projects.filter(
		(project) => project.seriesTitle === "Generated carousel"
	);
	expect(generated).toHaveLength(2);
	expect(
		generated
			.sort((left, right) => left.sequence - right.sequence)
			.map(
				(project) =>
					project.layers.find((layer) => layer.name === "Headline")?.text
			)
	).toEqual(["Keep the signal clear", "Close with a next step"]);
	const calls = await page.evaluate(() => window.__slidesOwnedProof.calls());
	expect(calls.filter((call) => call.method === "media.image")).toHaveLength(2);
	expect(calls.filter((call) => call.method === "model.complete")).toHaveLength(
		2
	);
	await saveEvidence(page, "slides-owned-image-and-carousel-retry-success.png");
	expect(pageErrors).toEqual([]);
});
