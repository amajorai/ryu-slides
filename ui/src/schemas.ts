import { z } from "zod";
import type { Layer, Project, ProjectSnapshot, SlidesState } from "./types.ts";

// Local saved documents and model JSON remain unbounded here. Existing model
// normalizers own their field defaults, history limits, and canvas clamps.
export type SlidesStoredValue =
	| null
	| boolean
	| number
	| string
	| undefined
	| SlidesStoredValue[]
	| { [key: string]: SlidesStoredValue };
export interface SlidesStoredRecord {
	[key: string]: SlidesStoredValue;
}
export const slidesStoredValueSchema: z.ZodType<SlidesStoredValue> = z.lazy(
	() =>
		z.union([
			z.null(),
			z.boolean(),
			z.string(),
			z.number(),
			z.nan(),
			z.literal(Number.POSITIVE_INFINITY),
			z.literal(Number.NEGATIVE_INFINITY),
			z.undefined(),
			z.array(slidesStoredValueSchema),
			slidesStoredRecordSchema,
		])
);
export const slidesStoredRecordSchema: z.ZodType<SlidesStoredRecord> =
	z.custom<SlidesStoredRecord>((value) => {
		const record = z
			.record(z.string(), slidesStoredValueSchema)
			.safeParse(value);
		if (!record.success) {
			return false;
		}
		const prototypeEntry = Object.getOwnPropertyDescriptor(value, "__proto__");
		return (
			!prototypeEntry ||
			slidesStoredValueSchema.safeParse(prototypeEntry.value).success
		);
	});
export const slideLayoutSchema = z.enum([
	"cover",
	"content",
	"note",
	"closing",
]);
export const slideThemeSchema = z.enum(["editorial", "ai-engineer"]);
const layerBase = {
	height: z.number(),
	id: z.string(),
	locked: z.boolean(),
	name: z.string(),
	opacity: z.number(),
	rotation: z.number(),
	visible: z.boolean(),
	width: z.number(),
	x: z.number(),
	y: z.number(),
};
function nativeRecord<Schema extends z.ZodType>(schema: Schema) {
	return z.custom<z.output<Schema>>((value) => schema.safeParse(value).success);
}
export const slideLayerSchema = nativeRecord(
	z.discriminatedUnion("type", [
		z.object({
			...layerBase,
			align: z.enum(["left", "center", "right"]),
			color: z.string(),
			fontSize: z.number(),
			fontWeight: z.enum(["400", "500"]),
			text: z.string(),
			type: z.literal("text"),
		}),
		z.object({
			...layerBase,
			borderRadius: z.number(),
			fit: z.enum(["cover", "contain"]),
			source: z.string(),
			type: z.literal("image"),
		}),
		z.object({
			...layerBase,
			borderRadius: z.number(),
			fill: z.string(),
			shape: z.enum(["rectangle", "ellipse"]),
			stroke: z.string(),
			strokeWidth: z.number(),
			type: z.literal("shape"),
		}),
	])
) satisfies z.ZodType<Layer>;
const projectSnapshotFields = {
	author: z.string(),
	background: z.string(),
	favorite: z.boolean(),
	height: z.number(),
	layers: z.array(slideLayerSchema),
	layout: slideLayoutSchema,
	mark: z.string(),
	name: z.string(),
	sequence: z.number(),
	seriesId: z.string(),
	seriesTitle: z.string(),
	showFooter: z.boolean(),
	showHeader: z.boolean(),
	theme: slideThemeSchema,
	width: z.number(),
};
export const projectSnapshotSchema = nativeRecord(
	z.object(projectSnapshotFields)
) satisfies z.ZodType<ProjectSnapshot>;
export const slideProjectSchema = nativeRecord(
	z.object({
		...projectSnapshotFields,
		archivedAt: z.number().nullable(),
		createdAt: z.number(),
		future: z.array(projectSnapshotSchema),
		history: z.array(projectSnapshotSchema),
		id: z.string(),
		updatedAt: z.number(),
	})
) satisfies z.ZodType<Project>;
export const slidesStateSchema = nativeRecord(
	z.object({
		projects: z.array(slideProjectSchema),
		trash: z.array(slideProjectSchema),
		version: z.literal(1),
	})
) satisfies z.ZodType<SlidesState>;
