import { Button, Input, Switch } from "@ryu/blocks/companion/controls";
import {
	NativeSelect,
	NativeSelectOption,
} from "@ryu/ui/components/native-select.tsx";
import type { Project, ProjectPatch } from "../types";

interface CarouselSettingsProps {
	onPatch: (patch: ProjectPatch) => void;
	onPreview: () => void;
	project: Project;
}

export function CarouselSettings({
	onPatch,
	onPreview,
	project,
}: CarouselSettingsProps) {
	return (
		<div className="slides-tool-card slides-style-card">
			<div className="slides-card-heading">
				<span className="slides-tool-index">00</span>
				<div>
					<strong>Carousel design</strong>
					<small>Give every frame a role and a recognisable voice.</small>
				</div>
			</div>
			<label className="slides-field">
				<span>Frame role</span>
				<NativeSelect
					aria-label="Frame role"
					onChange={(event) =>
						onPatch({
							layout:
								event.currentTarget.value === "cover" ||
								event.currentTarget.value === "note" ||
								event.currentTarget.value === "closing"
									? event.currentTarget.value
									: "content",
						})
					}
					value={project.layout}
				>
					<NativeSelectOption value="cover">Cover · promise</NativeSelectOption>
					<NativeSelectOption value="content">
						Content · teach
					</NativeSelectOption>
					<NativeSelectOption value="note">Note · emphasise</NativeSelectOption>
					<NativeSelectOption value="closing">
						Closing · next step
					</NativeSelectOption>
				</NativeSelect>
			</label>
			<label className="slides-field">
				<span>Carousel theme</span>
				<NativeSelect
					aria-label="Carousel theme"
					onChange={(event) =>
						onPatch({
							theme:
								event.currentTarget.value === "ai-engineer"
									? "ai-engineer"
									: "editorial",
						})
					}
					value={project.theme}
				>
					<NativeSelectOption value="editorial">Editorial</NativeSelectOption>
					<NativeSelectOption value="ai-engineer">
						AI Engineer
					</NativeSelectOption>
				</NativeSelect>
			</label>
			<label className="slides-field">
				<span>Series title</span>
				<Input
					aria-label="Series title"
					defaultValue={project.seriesTitle}
					key={`${project.id}-series-title-${project.seriesTitle}`}
					onBlur={(event) => {
						const value = event.currentTarget.value.trim();
						if (value) {
							onPatch({ seriesTitle: value });
						}
					}}
				/>
			</label>
			<div className="slides-field-grid">
				<label className="slides-field">
					<span>Series mark</span>
					<Input
						aria-label="Series mark"
						defaultValue={project.mark}
						key={`${project.id}-mark-${project.mark}`}
						onBlur={(event) =>
							onPatch({
								mark: event.currentTarget.value.trim() || "Ryu / Slides",
							})
						}
					/>
				</label>
				<label className="slides-field">
					<span>Author</span>
					<Input
						aria-label="Author"
						defaultValue={project.author}
						key={`${project.id}-author-${project.author}`}
						onBlur={(event) =>
							onPatch({ author: event.currentTarget.value.trim() || "Ryu" })
						}
					/>
				</label>
			</div>
			<div className="slides-toggle-grid">
				<label className="slides-switch-row">
					<Switch
						checked={project.showHeader}
						onCheckedChange={(checked) => onPatch({ showHeader: checked })}
					/>
					<span>Header</span>
				</label>
				<label className="slides-switch-row">
					<Switch
						checked={project.showFooter}
						onCheckedChange={(checked) => onPatch({ showFooter: checked })}
					/>
					<span>Footer</span>
				</label>
			</div>
			<Button onClick={onPreview} type="button" variant="secondary">
				Open reader preview →
			</Button>
		</div>
	);
}
