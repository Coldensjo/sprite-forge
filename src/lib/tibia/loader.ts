/**
 * Tibia File Loader
 * Utilities for loading .dat and .spr files via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { logger, logError, EventCode } from '@/lib/debug';

import { loadDatFile } from './datReader';
import { SpriteReader } from './spriteReader';
import { Sprite, TibiaData, ThingType, ClientVersion, CLIENT_VERSIONS } from './types';

/**
 * Read a binary file using Tauri (optimized for large files)
 */
async function readBinaryFile(path: string): Promise<Uint8Array> {
	// Tauri with serde_bytes returns binary data efficiently as Uint8Array
	const bytes = await invoke<Uint8Array>('read_file', { path });
	return bytes;
}

/**
 * Read only the signature from a DAT file (first 4 bytes)
 */
async function readDatSignature(path: string): Promise<number> {
	const buffer = await invoke<Uint8Array>('read_file', { path });

	if (buffer.length < 4) {
		throw new Error('DAT file is too small to contain a valid signature');
	}

	// Read signature as little-endian uint32
	const signature = (buffer[0] | (buffer[1] << 8) | (buffer[2] << 16) | (buffer[3] << 24)) >>> 0;
	return signature;
}

/**
 * Detect client version from signature
 */
export function detectVersionFromSignature(signature: number): null | ClientVersion {
	return CLIENT_VERSIONS.find((v) => v.datSignature === signature || v.sprSignature === signature) || null;
}

/**
 * Load Tibia .dat file
 */
export async function loadTibiaDat(
	path: string,
	version: ClientVersion,
	onProgress?: (current: number, total: number) => void
): Promise<{
	signature: number;
	itemsCount: number;
	outfitsCount: number;
	effectsCount: number;
	missilesCount: number;
	items: Map<number, ThingType>;
	outfits: Map<number, ThingType>;
	effects: Map<number, ThingType>;
	missiles: Map<number, ThingType>;
}> {
	const buffer = await readBinaryFile(path);
	const extended = version.supportsExtended;
	const frameDurations = version.supportsFrameDurations;

	return await loadDatFile(buffer, extended, frameDurations, onProgress, version);
}

/**
 * SPR Header returned from Rust
 */
interface SprHeader {
	signature: number;
	extended: boolean;
	sprite_count: number;
}

/**
 * Load Tibia .spr file (streaming mode - opens file in Rust backend)
 */
export async function loadTibiaSpr(
	path: string,
	version: ClientVersion,
	enableTransparency?: boolean
): Promise<{ path: string; header: SprHeader; transparency: boolean }> {
	const extended = version.supportsExtended;
	// Use enableTransparency if provided, otherwise fallback to version's default
	const transparency = enableTransparency ?? version.supportsAlphaChannel;
	console.log(
		`[loadTibiaSpr] Loading ${path} with version ${version.label}. Transparency: ${transparency} (Requested: ${enableTransparency}, Default: ${version.supportsAlphaChannel})`
	);

	// Open SPR file in Rust backend (keeps file handle open)
	const header = await invoke<SprHeader>('open_spr_file', {
		path,
		extended
	});

	return {
		path,
		header,
		transparency
	};
}

/**
 * Open file dialog and select .dat file
 */
export async function selectDatFile(): Promise<null | string> {
	const selected = await open({
		multiple: false,
		title: 'Select Tibia.dat file',
		filters: [
			{
				extensions: ['dat'],
				name: 'Tibia DAT Files'
			}
		]
	});

	return selected as null | string;
}

/**
 * Open file dialog and select .spr file
 */
export async function selectSprFile(): Promise<null | string> {
	const selected = await open({
		multiple: false,
		title: 'Select Tibia.spr file',
		filters: [
			{
				extensions: ['spr'],
				name: 'Tibia SPR Files'
			}
		]
	});

	return selected as null | string;
}

/**
 * Select folder containing Tibia.dat and Tibia.spr
 */
export async function selectTibiaFolder(): Promise<null | { datPath: string; sprPath: string }> {
	const selected = await open({
		directory: true,
		multiple: false,
		title: 'Select folder containing Tibia.dat and Tibia.spr'
	});

	if (!selected || typeof selected !== 'string') {
		return null;
	}

	// Construct paths for Tibia.dat and Tibia.spr
	const datPath = `${selected}\\Tibia.dat`;
	const sprPath = `${selected}\\Tibia.spr`;

	return { datPath, sprPath };
}

/**
 * Load complete Tibia client data (.dat + .spr)
 */
export async function loadTibiaData(
	datPath: string,
	sprPath: string,
	version?: ClientVersion,
	transparency?: boolean,
	onProgress?: (stage: string, current: number, total: number) => void
): Promise<TibiaData> {
	// Detect version from signature if not provided
	let detectedVersion = version;
	if (!detectedVersion) {
		if (onProgress) onProgress('Detecting version...', 0, 100);
		const signature = await readDatSignature(datPath);
		detectedVersion = detectVersionFromSignature(signature);
		if (!detectedVersion) {
			throw new Error(`Unknown DAT signature: 0x${signature.toString(16)}`);
		}
	}

	if (onProgress) onProgress('Loading DAT file...', 0, 100);

	// Load DAT file
	const datData = await loadTibiaDat(datPath, detectedVersion, (current, total) => {
		if (onProgress) onProgress('Parsing DAT items...', current, total);
	});

	if (onProgress) onProgress('Opening SPR file...', 0, 100);

	// Load SPR file (streaming)
	const sprData = await loadTibiaSpr(sprPath, detectedVersion, transparency);

	// Initialize sprites map
	const sprites = new Map<number, Sprite>();

	// Preload first 100 sprites to warm up cache
	try {
		if (onProgress) onProgress('Preloading sprites...', 0, 100);
		await loadSpriteWindow(sprPath, 1, sprData.header.sprite_count, sprData.transparency, sprites);
	} catch (err) {
		logError('Failed to preload sprites', err);
	}

	return {
		sprites,
		datPath,
		items: datData.items,
		sprPath: sprData.path,
		version: detectedVersion,
		outfits: datData.outfits,
		effects: datData.effects,
		missiles: datData.missiles,
		itemsCount: datData.itemsCount,
		transparency: sprData.transparency,
		outfitsCount: datData.outfitsCount,
		effectsCount: datData.effectsCount,
		missilesCount: datData.missilesCount,
		spritesCount: sprData.header.sprite_count,
		extended: detectedVersion.supportsExtended
	};
}

/**
 * Calculate 100-aligned sprite window (Object Builder style)
 * For sprite ID 5432, returns start=5400
 */
export function getSpriteWindowStart(spriteId: number): number {
	return Math.floor(spriteId / 100) * 100;
}

/**
 * Load a 100-sprite window around the given sprite ID
 * Object Builder style: aligned to 100-sprite boundaries
 *
 * CACHE BEHAVIOR (Object Builder Pattern):
 * - Unlimited cache size - sprites are NEVER evicted during session
 * - All loaded sprites stay in memory until file is unloaded
 * - Modern systems can easily handle 50,000+ sprites (~200 MB)
 * - This matches Object Builder and OTClient behavior
 *
 * THREAD SAFETY:
 * - This function checks if window is already cached before loading
 * - Multiple concurrent calls for same window will skip redundant loads
 * - Safe to call in parallel for different windows
 */
/**
 * Helper to parse binary sprite response
 * Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][Len: u32][Data...])*
 */
function parseBinarySprites(response: Uint8Array | ArrayBuffer, transparency: boolean): Sprite[] {
	let view: DataView;
	let buffer: Uint8Array;

	if (response instanceof Uint8Array) {
		view = new DataView(response.buffer, response.byteOffset, response.byteLength);
		buffer = response;
	} else if (response instanceof ArrayBuffer) {
		view = new DataView(response);
		buffer = new Uint8Array(response);
	} else {
		console.error('Unexpected response type:', response);
		return [];
	}

	const sprites: Sprite[] = [];
	let offset = 0;

	// Safety check
	if (view.byteLength < 4) return [];

	const count = view.getUint32(offset, true);
	offset += 4;

	for (let i = 0; i < count; i++) {
		// Safety check
		if (offset + 9 > view.byteLength) break;

		const id = view.getUint32(offset, true);
		offset += 4;

		const isEmpty = view.getUint8(offset) === 1;
		offset += 1;

		const len = view.getUint32(offset, true);
		offset += 4;

		let compressedPixels: Uint8Array;
		if (len > 0) {
			if (offset + len > view.byteLength) {
				console.error(`Binary parse error: sprite ${id} length ${len} exceeds buffer`);
				compressedPixels = new Uint8Array(0);
				offset = view.byteLength; // Stop parsing
			} else {
				// Use slice to create a copy
				compressedPixels = buffer.slice(offset, offset + len);
				offset += len;
			}
		} else {
			compressedPixels = new Uint8Array(0);
		}

		sprites.push({
			id,
			isEmpty,
			compressedPixels,
			transparent: transparency
		});
	}
	return sprites;
}

/**
 * Load a 100-sprite window around the given sprite ID
 * Object Builder style: aligned to 100-sprite boundaries
 */
export async function loadSpriteWindow(
	sprPath: string,
	spriteId: number,
	totalSprites: number,
	transparency: boolean,
	spriteCache: Map<number, Sprite>
): Promise<void> {
	const WINDOW_SIZE = 100;

	// Calculate window boundaries (aligned to 100s)
	const windowStart = getSpriteWindowStart(spriteId);
	const startId = Math.max(1, windowStart);
	const endId = Math.min(startId + WINDOW_SIZE - 1, totalSprites);
	const count = endId - startId + 1;

	// Check if we already have this window cached
	let allCached = true;
	for (let id = startId; id <= endId; id++) {
		if (!spriteCache.has(id)) {
			allCached = false;
			break;
		}
	}

	logger.log(EventCode.LOADER_WINDOW, { e: endId, s: startId, req: spriteId, cached: allCached, sz: spriteCache.size });

	if (allCached) {
		logger.log(EventCode.LOADER_CACHED, { e: endId, s: startId });
		return; // Window already loaded
	}

	try {
		logger.log(EventCode.LOADER_READ, { e: endId, n: count, s: startId });

		// Batch load window from Rust using BINARY protocol
		const response = await invoke<Uint8Array>('read_sprites_batch_bin', {
			count,
			startId,
			path: sprPath
		});

		const batchedSprites = parseBinarySprites(response, transparency);

		// Add to cache
		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}

		logger.log(EventCode.LOADER_ADDED, { bin: true, sz: spriteCache.size, n: batchedSprites.length });

		// NO CACHE EVICTION - Object Builder pattern
		// Sprites are kept in memory for the entire session
		// This prevents race conditions where sprites are evicted before rendering
		// Modern systems can easily handle 50,000+ sprites (~200 MB)
	} catch (err) {
		logError(`Failed to load sprite window ${startId}-${endId}`, err);
	}
}

/**
 * Load specific sprite IDs (handles non-consecutive IDs efficiently)
 * Groups consecutive IDs into ranges and uses batch loading
 *
 * IMPORTANT: This is the CORRECT way to load sprites for items/outfits
 * - Loads ONLY the sprites actually used by the item
 * - Handles non-consecutive sprite IDs (e.g., different animation frames)
 * - Groups consecutive IDs into ranges for efficient batch loading
 * - Skips already cached sprites
 */
export async function loadSpriteIds(
	sprPath: string,
	spriteIds: number[],
	transparency: boolean,
	spriteCache: Map<number, Sprite>
): Promise<void> {
	// Filter out IDs that are already cached or invalid
	const uncachedIds = spriteIds.filter((id) => id > 0 && !spriteCache.has(id));

	if (uncachedIds.length === 0) {
		logger.log(EventCode.LOADER_CACHED, { n: spriteIds.length });
		return; // All sprites already cached
	}

	// Remove duplicates
	const uniqueIds = [...new Set(uncachedIds)];

	logger.log(EventCode.LOADER_READ, {
		method: 'list',
		total: uniqueIds.length,
		ids: uniqueIds.slice(0, 5)
	});

	try {
		// Load all unique IDs in one go using the new optimized BINARY command
		const response = await invoke<Uint8Array>('read_sprites_list_bin', {
			path: sprPath,
			ids: uniqueIds
		});

		const batchedSprites = parseBinarySprites(response, transparency);

		// Add to cache
		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}

		logger.log(EventCode.LOADER_ADDED, {
			bin: true,
			sz: spriteCache.size,
			n: batchedSprites.length
		});
	} catch (err) {
		logError(`Failed to load sprite list of ${uniqueIds.length} items`, err);
	}
}

/**
 * Helper to get sprite from reader (with caching)
 * @deprecated Use TibiaDataContext.getSprite instead
 */
export function getSpriteFromReader(reader: SpriteReader, spriteCache: Map<number, Sprite>, id: number): null | Sprite {
	// Check cache first
	if (spriteCache.has(id)) {
		return spriteCache.get(id)!;
	}

	// This function is synchronous and relies on the old reader.
	// We should ideally deprecate it or make it async to use IPC.
	// But for now, we leave it as is since it's marked deprecated.
	// The new architecture uses loadSpriteIds / loadSpriteWindow which are async.

	const sprite = reader.readSprite(id);
	if (sprite) {
		spriteCache.set(id, sprite);
	}

	return sprite;
}
