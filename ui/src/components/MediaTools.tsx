import { Button, Input, Textarea } from "@ryu/blocks/companion/controls";
import { useMemo, useRef, useState } from "react";
import {
	bridgeStatus,
	generateCarousel,
	generateImage,
	generateVideo,
	pickFile,
} from "../bridge";
import type { CarouselSlide } from "../types";

interface MediaToolsProps {
	onCarousel: (slides: CarouselSlide[]) => void;
	onImage: (source: string) => void;
	selectedImageSource: string | null;
}

function removeLightBackground(source: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.addEventListener("load", () => {
			const canvas = document.createElement("canvas");
			canvas.width = image.naturalWidth;
			canvas.height = image.naturalHeight;
			const context = canvas.getContext("2d");
			if (!context) {
				reject(new Error("Canvas processing is not available."));
				return;
			}
			context.drawImage(image, 0, 0);
			const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
			for (let index = 0; index < pixels.data.length; index += 4) {
				const red = pixels.data[index] ?? 0;
				const green = pixels.data[index + 1] ?? 0;
				const blue = pixels.data[index + 2] ?? 0;
				if (red > 238 && green > 238 && blue > 238) {
					pixels.data[index + 3] = 0;
				}
			}
			context.putImageData(pixels, 0, 0);
			resolve(canvas.toDataURL("image/png"));
		});
		image.addEventListener("error", () =>
			reject(new Error("The image could not be processed."))
		);
		image.src = source;
	});
}

export function MediaTools({
	onCarousel,
	onImage,
	selectedImageSource,
}: MediaToolsProps) {
	const [imagePrompt, setImagePrompt] = useState(
		"An editorial desk with one clear idea"
	);
	const [carouselTopic, setCarouselTopic] = useState(
		"A practical idea worth saving"
	);
	const [carouselCount, setCarouselCount] = useState(5);
	const [videoSource, setVideoSource] = useState<string | null>(null);
	const [videoDuration, setVideoDuration] = useState(0);
	const [videoTime, setVideoTime] = useState(0);
	const [busy, setBusy] = useState<string | null>(null);
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const status = useMemo(() => bridgeStatus(), []);

	async function handleImageUpload() {
		setBusy("Opening image picker…");
		try {
			const file = await pickFile("image/*");
			if (file) {
				onImage(file.dataUrl);
			}
		} catch (error) {
			setBusy(
				error instanceof Error
					? error.message
					: "The image could not be uploaded."
			);
			return;
		}
		setBusy(null);
	}

	async function handleImageGeneration() {
		setBusy("Generating image…");
		try {
			const source = await generateImage(imagePrompt);
			if (!source) {
				throw new Error("The image engine returned no image.");
			}
			onImage(source);
			setBusy(null);
		} catch (error) {
			setBusy(
				error instanceof Error ? error.message : "Image generation failed."
			);
		}
	}

	async function handleVideoGeneration() {
		setBusy("Generating video…");
		try {
			const source = await generateVideo(imagePrompt);
			if (!source) {
				throw new Error("The video engine returned no video.");
			}
			setVideoSource(source);
			setBusy(null);
		} catch (error) {
			setBusy(
				error instanceof Error ? error.message : "Video generation failed."
			);
		}
	}

	async function handleVideoUpload() {
		setBusy("Opening video picker…");
		try {
			const file = await pickFile("video/*");
			if (file) {
				setVideoSource(file.dataUrl);
			}
			setBusy(null);
		} catch (error) {
			setBusy(
				error instanceof Error
					? error.message
					: "The video could not be uploaded."
			);
		}
	}

	function captureFrame() {
		const video = videoRef.current;
		if (!(video && video.videoWidth > 0 && video.videoHeight > 0)) {
			return;
		}
		const canvas = document.createElement("canvas");
		canvas.width = video.videoWidth;
		canvas.height = video.videoHeight;
		const context = canvas.getContext("2d");
		if (!context) {
			return;
		}
		context.drawImage(video, 0, 0);
		onImage(canvas.toDataURL("image/png"));
	}

	async function handleCarousel() {
		setBusy("Drafting carousel…");
		try {
			const slides = await generateCarousel(carouselTopic, carouselCount);
			if (slides.length === 0) {
				throw new Error("The model returned no usable slides.");
			}
			onCarousel(slides);
			setBusy(null);
		} catch (error) {
			setBusy(
				error instanceof Error ? error.message : "Carousel generation failed."
			);
		}
	}

	async function handleBackgroundRemoval() {
		if (!selectedImageSource) {
			return;
		}
		setBusy("Removing light background…");
		try {
			const source = await removeLightBackground(selectedImageSource);
			onImage(source);
			setBusy(null);
		} catch (error) {
			setBusy(
				error instanceof Error ? error.message : "Background removal failed."
			);
		}
	}

	return (
		<section aria-label="Media tools" className="slides-tools-panel">
			<div className="slides-panel-heading">
				<p className="slides-eyebrow">Ryu tools</p>
				<h2>Bring in the signal.</h2>
			</div>

			<div className="slides-tool-card">
				<div className="slides-card-heading">
					<span className="slides-tool-index">01</span>
					<div>
						<strong>Image source</strong>
						<small>Upload, generate, or capture.</small>
					</div>
				</div>
				<label className="slides-field">
					<span>Prompt</span>
					<Textarea
						onChange={(event) => setImagePrompt(event.currentTarget.value)}
						rows={3}
						value={imagePrompt}
					/>
				</label>
				<div className="slides-button-row">
					<Button
						className="slides-secondary-button"
						onClick={() => void handleImageUpload()}
						type="button"
					>
						Upload
					</Button>
					<Button
						className="slides-primary-button"
						disabled={!status.image || busy !== null}
						onClick={() => void handleImageGeneration()}
						type="button"
					>
						Generate
					</Button>
				</div>
				<Button
					className="slides-text-button"
					disabled={!selectedImageSource || busy !== null}
					onClick={() => void handleBackgroundRemoval()}
					type="button"
				>
					Remove light background
				</Button>
			</div>

			<div className="slides-tool-card">
				<div className="slides-card-heading">
					<span className="slides-tool-index">02</span>
					<div>
						<strong>Video frames</strong>
						<small>Scrub a local video and keep the moment.</small>
					</div>
				</div>
				<Button
					className="slides-secondary-button slides-full-button"
					onClick={() => void handleVideoUpload()}
					type="button"
				>
					Choose video
				</Button>
				{videoSource ? (
					<>
						<video
							className="slides-video-preview"
							controls
							onLoadedMetadata={(event) =>
								setVideoDuration(event.currentTarget.duration)
							}
							onTimeUpdate={(event) =>
								setVideoTime(event.currentTarget.currentTime)
							}
							ref={videoRef}
							src={videoSource}
						/>
						<Input
							aria-label="Video position"
							className="slides-range"
							max={videoDuration || 1}
							min={0}
							onChange={(event) => {
								const time = Number(event.currentTarget.value);
								setVideoTime(time);
								if (videoRef.current) {
									videoRef.current.currentTime = time;
								}
							}}
							step={0.01}
							type="range"
							value={videoTime}
						/>
						<Button
							className="slides-primary-button slides-full-button"
							onClick={captureFrame}
							type="button"
						>
							Capture current frame
						</Button>
						<Button
							className="slides-text-button"
							disabled={!status.video || busy !== null}
							onClick={() => void handleVideoGeneration()}
							type="button"
						>
							Generate a Ryu video clip
						</Button>
					</>
				) : null}
			</div>

			<div className="slides-tool-card">
				<div className="slides-card-heading">
					<span className="slides-tool-index">03</span>
					<div>
						<strong>Carousel draft</strong>
						<small>Turn one idea into a sequence of frames.</small>
					</div>
				</div>
				<label className="slides-field">
					<span>Topic</span>
					<Input
						onChange={(event) => setCarouselTopic(event.currentTarget.value)}
						value={carouselTopic}
					/>
				</label>
				<label className="slides-field">
					<span>Frames</span>
					<Input
						max={8}
						min={3}
						onChange={(event) =>
							setCarouselCount(Number(event.currentTarget.value))
						}
						type="number"
						value={carouselCount}
					/>
				</label>
				<Button
					className="slides-primary-button slides-full-button"
					disabled={!status.model || busy !== null}
					onClick={() => void handleCarousel()}
					type="button"
				>
					Draft carousel
				</Button>
			</div>

			<div className="slides-capability-card">
				<span className="slides-pulse-dot" />
				<div>
					<strong>{busy ?? "Ready for a local edit."}</strong>
					<small>
						{status.model ? "Model" : "No model"} ·{" "}
						{status.image ? "Image" : "No image"} ·{" "}
						{status.upload ? "Upload" : "Browser picker"}
					</small>
				</div>
			</div>
		</section>
	);
}
