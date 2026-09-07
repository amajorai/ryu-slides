interface RyuStorage {
	delete(input: { namespace?: string; key: string }): Promise<void>;
	get(input: { namespace?: string; key: string }): Promise<string | null>;
	set(input: { namespace?: string; key: string; value: string }): Promise<void>;
}

interface RyuUpload {
	data_url: string;
	mime_type: string;
	name: string;
	size: number;
}

interface RyuUi {
	uploadFile(input?: {
		accept?: string;
		multiple?: boolean;
	}): Promise<RyuUpload | RyuUpload[] | null>;
}

interface RyuModel {
	complete(input: {
		effort?: string;
		model?: string;
		prompt: string;
		provider?: string;
		system?: string;
	}): Promise<string>;
}

interface RyuMedia {
	image(input: {
		count?: number;
		model?: string;
		prompt: string;
		provider?: string;
		size?: string;
	}): Promise<unknown>;
	video(input: {
		model?: string;
		prompt: string;
		provider?: string;
	}): Promise<unknown>;
}

interface RyuBridge {
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

export {};
