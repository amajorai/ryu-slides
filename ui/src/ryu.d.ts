import type { SlidesStoredValue } from "./schemas.ts";
export interface RyuStorage {
	delete(input: { namespace?: string; key: string }): Promise<void>;
	get(input: { namespace?: string; key: string }): Promise<string | null>;
	set(input: { namespace?: string; key: string; value: string }): Promise<void>;
}

export interface RyuUpload {
	data_url: string;
	mime_type: string;
	name: string;
	size: number;
}

export interface RyuUi {
	uploadFile(input?: {
		accept?: string;
		multiple?: boolean;
	}): Promise<RyuUpload | RyuUpload[] | null>;
}

export interface RyuModel {
	complete(input: {
		effort?: string;
		model?: string;
		prompt: string;
		provider?: string;
		system?: string;
	}): Promise<string>;
}

export interface RyuMedia {
	image(input: {
		count?: number;
		model?: string;
		prompt: string;
		provider?: string;
		size?: string;
	}): Promise<SlidesStoredValue>;
	video(input: {
		model?: string;
		prompt: string;
		provider?: string;
	}): Promise<SlidesStoredValue>;
}

export interface RyuBridge {
	media?: RyuMedia;
	model?: RyuModel;
	storage?: RyuStorage;
	ui?: RyuUi;
}

declare global {
	interface Window {
		ryu?: RyuBridge;
	}
}
