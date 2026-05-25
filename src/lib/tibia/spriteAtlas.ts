function protocolBase(): string {
	const isWindows = typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent);
	return isWindows ? 'http://spr.localhost' : 'spr://localhost';
}

export interface AtlasParams {
	cols: number;
	start: number;
	count: number;
	sprPath: string;
	transparent: boolean;
}

export function atlasPngUrl({ cols, start, count, sprPath, transparent }: AtlasParams): string {
	const q = new URLSearchParams({
		path: sprPath,
		cols: String(cols),
		start: String(start),
		count: String(count),
		transparent: transparent ? '1' : '0'
	});
	return `${protocolBase()}/atlas.png?${q.toString()}`;
}

export function spritesBinUrl(sprPath: string, start: number, count: number, transparent: boolean): string {
	const q = new URLSearchParams({
		path: sprPath,
		start: String(start),
		count: String(count),
		transparent: transparent ? '1' : '0'
	});
	return `${protocolBase()}/sprites.bin?${q.toString()}`;
}

export async function loadAtlasBitmap(params: AtlasParams): Promise<ImageBitmap> {
	const res = await fetch(atlasPngUrl(params));
	if (!res.ok) {
		throw new Error(`atlas fetch failed (${res.status}): ${await res.text()}`);
	}
	const blob = await res.blob();
	return createImageBitmap(blob);
}

export function isAtlasEnabled(): boolean {
	return typeof window !== 'undefined' && (window as unknown as { __useAtlas?: boolean }).__useAtlas === true;
}
