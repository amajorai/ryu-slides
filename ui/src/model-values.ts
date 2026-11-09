import { z } from "zod";
import {
	type SlidesStoredRecord,
	type SlidesStoredValue,
	slidesStoredRecordSchema,
} from "./schemas.ts";
import type { SlideLayout, SlidesState, SlideTheme } from "./types.ts";

export const MAX_HISTORY = 50;

export const MAX_PROJECTS = 120;

export const DEFAULT_MARK = "Ryu / Slides";

export const DEFAULT_AUTHOR = "Ryu";

const DEFAULT_LAYOUT: SlideLayout = "content";

export const DEFAULT_THEME: SlideTheme = "editorial";

export function storedRecord(
	value: SlidesStoredValue | SlidesState
): SlidesStoredRecord | null {
	const parsed = slidesStoredRecordSchema.safeParse(value);
	if (parsed.success) {
		return parsed.data;
	}
	// The original local parser accepted JSON arrays as object-like values; they
	// have no named document fields, so retain its empty-object normalization.
	return Array.isArray(value) ? {} : null;
}

export function stringValue(
	value: SlidesStoredValue,
	fallback: string
): string {
	const parsed = z.string().safeParse(value);
	return parsed.success ? parsed.data : fallback;
}

export function numberValue(
	value: SlidesStoredValue,
	fallback: number
): number {
	const parsed = z.number().safeParse(value);
	return parsed.success && Number.isFinite(parsed.data)
		? parsed.data
		: fallback;
}

export function booleanValue(
	value: SlidesStoredValue,
	fallback: boolean
): boolean {
	const parsed = z.boolean().safeParse(value);
	return parsed.success ? parsed.data : fallback;
}

export function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function slideLayout(
	value: SlidesStoredValue,
	fallback = DEFAULT_LAYOUT
): SlideLayout {
	return value === "cover" || value === "note" || value === "closing"
		? value
		: value === "content"
			? value
			: fallback;
}

export function slideTheme(
	value: SlidesStoredValue,
	fallback = DEFAULT_THEME
): SlideTheme {
	return value === "ai-engineer" || value === "editorial" ? value : fallback;
}

export function backgroundForTheme(
	theme: SlideTheme,
	layout: SlideLayout
): string {
	if (theme === "ai-engineer") {
		return layout === "cover" || layout === "closing" ? "#171a18" : "#efeeea";
	}
	return "#f4f1e9";
}

export function makeId(prefix: string): string {
	const uuid = globalThis.crypto?.randomUUID?.();
	return uuid
		? `${prefix}-${uuid.slice(0, 8)}`
		: `${prefix}-${Date.now().toString(36)}`;
}
