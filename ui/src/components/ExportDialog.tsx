import { Button, Input } from "@ryu/blocks/companion/controls";
import { useState } from "react";

export type ExportMime = "image/jpeg" | "image/png" | "image/webp";

interface ExportDialogProps {
	onClose: () => void;
	onExport: (mime: ExportMime) => Promise<void>;
}

const FORMATS: Array<{ label: string; mime: ExportMime; note: string }> = [
	{
		label: "PNG",
		mime: "image/png",
		note: "Lossless, best for text and transparency.",
	},
	{ label: "JPEG", mime: "image/jpeg", note: "Small and broadly compatible." },
	{ label: "WebP", mime: "image/webp", note: "Compact modern image export." },
];

export function ExportDialog({ onClose, onExport }: ExportDialogProps) {
	const [format, setFormat] = useState<ExportMime>("image/png");
	const [exporting, setExporting] = useState(false);

	async function handleExport() {
		setExporting(true);
		try {
			await onExport(format);
			onClose();
		} finally {
			setExporting(false);
		}
	}

	return (
		<div className="slides-modal-backdrop" role="presentation">
			<section
				aria-label="Export project"
				aria-modal="true"
				className="slides-modal"
				role="dialog"
			>
				<div className="slides-modal-header">
					<div>
						<p className="slides-eyebrow">Take it with you</p>
						<h2>Export frame</h2>
					</div>
					<Button
						aria-label="Close export dialog"
						className="slides-icon-button"
						onClick={onClose}
						type="button"
					>
						×
					</Button>
				</div>
				<div className="slides-export-options">
					{FORMATS.map((item) => (
						<label
							className={`slides-export-option ${format === item.mime ? "is-selected" : ""}`}
							key={item.mime}
						>
							<Input
								checked={format === item.mime}
								name="export-format"
								onChange={() => setFormat(item.mime)}
								type="radio"
								value={item.mime}
							/>
							<span>
								<strong>{item.label}</strong>
								<small>{item.note}</small>
							</span>
						</label>
					))}
				</div>
				<div className="slides-modal-footer">
					<span className="slides-muted-copy">
						Animated GIF/APNG export is not available in this build.
					</span>
					<Button
						className="slides-primary-button"
						disabled={exporting}
						onClick={() => void handleExport()}
						type="button"
					>
						{exporting ? "Rendering…" : "Export"}
					</Button>
				</div>
			</section>
		</div>
	);
}
