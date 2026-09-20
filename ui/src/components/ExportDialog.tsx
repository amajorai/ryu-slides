import {
	Button,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@ryu/blocks/companion/controls";
import { RadioGroup, RadioGroupItem } from "@ryu/ui/components/radio-group.tsx";
import { useState } from "react";

export type ExportMime = "image/jpeg" | "image/png" | "image/webp";
export type ExportFormat = ExportMime | "application/json";

interface ExportDialogProps {
	onClose: () => void;
	onExport: (format: ExportFormat) => Promise<void>;
}

const FORMATS: Array<{ label: string; mime: ExportFormat; note: string }> = [
	{
		label: "PNG",
		mime: "image/png",
		note: "Lossless, best for text and transparency.",
	},
	{ label: "JPEG", mime: "image/jpeg", note: "Small and broadly compatible." },
	{ label: "WebP", mime: "image/webp", note: "Compact modern image export." },
	{
		label: "Carousel JSON",
		mime: "application/json",
		note: "Keeps frame roles, theme, copy, and editable layers.",
	},
];

export function ExportDialog({ onClose, onExport }: ExportDialogProps) {
	const [format, setFormat] = useState<ExportFormat>("image/png");
	const [exporting, setExporting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleExport() {
		setExporting(true);
		setError(null);
		try {
			await onExport(format);
			onClose();
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Export failed. Try again."
			);
		} finally {
			setExporting(false);
		}
	}

	return (
		<Dialog
			onOpenChange={(next) => {
				if (!(next || exporting)) {
					onClose();
				}
			}}
			open
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Export frame</DialogTitle>
					<DialogDescription>
						Choose an image format for the current frame.
					</DialogDescription>
				</DialogHeader>
				<RadioGroup
					aria-label="Image format"
					disabled={exporting}
					onValueChange={(value) => {
						if (FORMATS.some((item) => item.mime === value)) {
							setFormat(value as ExportFormat);
						}
					}}
					value={format}
				>
					{FORMATS.map((item) => (
						<label
							className="flex cursor-pointer items-start gap-3 py-2"
							key={item.mime}
						>
							<RadioGroupItem value={item.mime} />
							<span className="flex flex-col gap-1">
								<strong>{item.label}</strong>
								<small className="text-muted-foreground">{item.note}</small>
							</span>
						</label>
					))}
				</RadioGroup>
				{error ? (
					<p className="text-destructive" role="alert">
						{error}
					</p>
				) : null}
				<DialogFooter>
					<span className="text-muted-foreground text-xs">
						JSON is portable; image formats render the current frame.
					</span>
					<Button
						disabled={exporting}
						onClick={() => void handleExport()}
						type="button"
					>
						{exporting ? "Rendering…" : "Export"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
