/**
 * Tibia File Loader
 * Utilities for loading .dat and .spr files via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { logger, logError, EventCode } from '@/lib/debug';
import * as lz4 from 'lz4js';

import { loadDatFile } from './datReader';
import { decodeDatResponse } from './datDecoder';
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
 * DAT file header information (for preview before loading)
 */
export interface DatHeader {
	signature: number;
	itemsCount: number;
	outfitsCount: number;
	effectsCount: number;
	missilesCount: number;
	version: ClientVersion | null;
}

/**
 * SPR file header information (for preview before loading)
 */
export interface SprHeader {
	signature: number;
	extended: boolean;
	spriteCount: number;
}

/**
 * OTFI (Open Tibia File Information) data
 * Contains metadata about DAT/SPR files from .otfi configuration files
 */
export interface OtfiData {
	extended: boolean;
	transparency: boolean;
	frameDurations: boolean; // "frame-durations" in file
	frameGroups: boolean; // "frame-groups" in file
	metadataFile?: string;
	spritesFile?: string;
	spriteSize?: number;
	spriteDataSize?: number;
}

/**
 * Parse OTML format (simple YAML-like text format used by Object Builder)
 */
function parseOtml(content: string): Record<string, string> {
	const result: Record<string, string> = {};
	const lines = content.split('\n');

	for (const line of lines) {
		// Skip empty lines and root tags (e.g., "DatSpr")
		const trimmed = line.trim();
		if (!trimmed || !trimmed.includes(':')) continue;

		const colonIndex = trimmed.indexOf(':');
		const key = trimmed.substring(0, colonIndex).trim();
		const value = trimmed.substring(colonIndex + 1).trim();

		if (key && value) {
			result[key] = value;
		}
	}

	return result;
}

/**
 * Read OTFI file (Open Tibia File Information) from a folder
 * Tries multiple file patterns: Tibia.otfi, Tibia.dat.otfi
 * Returns null if file doesn't exist or can't be parsed
 */
export async function readOtfiFile(folderPath: string): Promise<OtfiData | null> {
	// Try different OTFI file naming patterns (Object Builder uses both)
	const patterns = [
		`${folderPath}\\Tibia.otfi`,
		`${folderPath}\\Tibia.dat.otfi`
	];

	for (const path of patterns) {
		try {
			const content = await invoke<string>('read_file_text', { path });

			const data = parseOtml(content);

			return {
				extended: data['extended'] === 'true',
				transparency: data['transparency'] === 'true',
				frameDurations: data['frame-durations'] === 'true',
				frameGroups: data['frame-groups'] === 'true',
				metadataFile: data['metadata-file'] || undefined,
				spritesFile: data['sprites-file'] || undefined,
				spriteSize: data['sprite-size'] ? parseInt(data['sprite-size'], 10) : undefined,
				spriteDataSize: data['sprite-data-size'] ? parseInt(data['sprite-data-size'], 10) : undefined
			};
		} catch {
			// File doesn't exist or can't be read - try next pattern
			continue;
		}
	}

	return null;
}

/**
 * Read DAT file header (first 12 bytes) for preview
 * This is fast and doesn't load the full file
 */
export async function readDatHeader(path: string): Promise<DatHeader> {
	// Only read first 12 bytes instead of entire file (SPR files can be 100MB+)
	const response = await invoke<Uint8Array | ArrayBuffer>('read_file_header', { path, bytes: 12 });

	// Normalize to Uint8Array (invoke can return either ArrayBuffer or Uint8Array)
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);

	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

	const signature = view.getUint32(0, true);
	const itemsCount = view.getUint16(4, true);
	const outfitsCount = view.getUint16(6, true);
	const effectsCount = view.getUint16(8, true);
	const missilesCount = view.getUint16(10, true);

	const version = detectVersionFromSignature(signature);

	return {
		signature,
		itemsCount,
		outfitsCount,
		effectsCount,
		missilesCount,
		version
	};
}

/**
 * Read SPR file header for preview
 * This is fast and doesn't load the full file
 */
export async function readSprHeader(path: string): Promise<SprHeader> {
	// Only read first 8 bytes instead of entire file (SPR files can be 100MB+)
	const response = await invoke<Uint8Array | ArrayBuffer>('read_file_header', { path, bytes: 8 });

	// Normalize to Uint8Array (invoke can return either ArrayBuffer or Uint8Array)
	const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);

	const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);

	const signature = view.getUint32(0, true);

	// Detect if extended format based on signature
	// Extended format uses 4-byte sprite count, non-extended uses 2-byte
	const version = detectVersionFromSignature(signature);
	const extended = version?.supportsExtended ?? false;

	let spriteCount: number;
	if (extended) {
		spriteCount = view.getUint32(4, true);
	} else {
		spriteCount = view.getUint16(4, true);
	}

	return {
		signature,
		extended,
		spriteCount
	};
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
 *
 * OPTIMIZED VERSION (Object Builder style):
 * - DAT parsing happens in Rust (fast native code)
 * - Binary IPC transfer (no JSON serialization overhead)
 * - Minimal sprite preloading (first 100 only for instant first page)
 * - Rest loaded on-demand as user navigates
 *
 * Expected performance: ~500ms total (vs 4-5s before)
 */
export async function loadTibiaData(
	datPath: string,
	sprPath: string,
	version?: ClientVersion,
	transparency?: boolean,
	onProgress?: (stage: string, current: number, total: number) => void
): Promise<TibiaData> {
	const startTime = performance.now();

	// Step 1: Detect version from signature if not provided
	let detectedVersion = version;
	if (!detectedVersion) {
		if (onProgress) onProgress('Detecting version...', 0, 100);
		const signature = await readDatSignature(datPath);
		detectedVersion = detectVersionFromSignature(signature);
		if (!detectedVersion) {
			throw new Error(`Unknown DAT signature: 0x${signature.toString(16)}`);
		}
	}

	// Step 2: Parse DAT file
	// For version 10.10+ (1010+), use fast Rust parsing with binary IPC
	// For older versions, use TypeScript parsing (Rust doesn't support old flag formats yet)
	if (onProgress) onProgress('Loading DAT file...', 0, 100);

	let datData;
	const useRustParser = detectedVersion.value >= 1010;

	if (useRustParser) {
		// Fast path: Rust parsing with binary IPC (~200-400ms)
		console.log(`[loadTibiaData] Using Rust parser for version ${detectedVersion.value}`);
		let datResponse: ArrayBuffer | Uint8Array;
		try {
			datResponse = await invoke<ArrayBuffer | Uint8Array>('parse_dat_file_bin', { path: datPath });
		} catch (err) {
			console.error('[loadTibiaData] Failed to parse DAT file:', err);
			throw new Error(`Failed to parse DAT file: ${err}`);
		}

		// Handle both ArrayBuffer (from Response::new) and Uint8Array
		const datBuffer = datResponse instanceof Uint8Array
			? datResponse
			: new Uint8Array(datResponse);

		console.log(`[loadTibiaData] Received binary buffer: ${datBuffer.byteLength} bytes`);

		// Decode binary response to TypeScript objects (FAST - just memory reads)
		if (onProgress) onProgress('Processing metadata...', 50, 100);
		try {
			datData = decodeDatResponse(datBuffer);
		} catch (err) {
			console.error('[loadTibiaData] Failed to decode DAT response:', err);
			throw new Error(`Failed to decode DAT response: ${err}`);
		}
	} else {
		// Fallback: TypeScript parsing for older versions (supports MetadataFlags4/5)
		console.log(`[loadTibiaData] Using TypeScript parser for version ${detectedVersion.value}`);
		const buffer = await readBinaryFile(datPath);
		datData = await loadDatFile(
			buffer,
			detectedVersion.supportsExtended,
			detectedVersion.supportsFrameDurations,
			(current, total) => {
				if (onProgress) onProgress('Loading DAT file...', Math.floor((current / total) * 50), 100);
			},
			detectedVersion
		);
	}

	const datTime = performance.now();
	console.log(`[loadTibiaData] DAT parsing: ${(datTime - startTime).toFixed(0)}ms`);

	// Step 4: Open SPR file handle in Rust
	if (onProgress) onProgress('Opening SPR file...', 90, 100);
	const sprData = await loadTibiaSpr(sprPath, detectedVersion, transparency);

	// Step 5: Initialize sprites map and preload first 100 sprites
	// This ensures the first page renders instantly
	const sprites = new Map<number, Sprite>();

	try {
		if (onProgress) onProgress('Preloading sprites...', 95, 100);
		// Preload only first 100 sprites for instant first page render
		// Additional sprites load on-demand as user navigates
		await preloadSprites(
			sprPath,
			sprData.header.sprite_count,
			sprData.transparency,
			sprites,
			100, // Only 100 sprites - enough for first page
			(loaded, total) => {
				if (onProgress) onProgress('Preloading sprites...', 95 + Math.floor((loaded / total) * 5), 100);
			}
		);
	} catch (err) {
		logError('Failed to preload sprites', err);
	}

	const totalTime = performance.now();
	console.log(`[loadTibiaData] Total loading time: ${(totalTime - startTime).toFixed(0)}ms`);
	console.log(`[loadTibiaData] Items: ${datData.itemsCount}, Outfits: ${datData.outfitsCount}, Effects: ${datData.effectsCount}, Missiles: ${datData.missilesCount}`);

	// Done! Return immediately - app is ready to use
	if (onProgress) onProgress('Ready', 100, 100);

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
 * Calculate window-aligned sprite start (Object Builder style)
 * For sprite ID 5432 with windowSize=100, returns start=5400
 * For sprite ID 5432 with windowSize=500, returns start=5000
 */
export function getSpriteWindowStart(spriteId: number, windowSize: number = 100): number {
	return Math.floor(spriteId / windowSize) * windowSize;
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
/** Size of RGBA pixel data per sprite (32x32x4 = 4096 bytes) */
const SPRITE_DATA_SIZE = 4096;

/**
 * Parse binary RGBA sprite response from Rust
 * Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][CompressedLen: u32][CompressedData...][RGBA pixels: 4096 bytes])*
 *
 * This is the new optimized format where Rust handles decompression and
 * returns RGBA pixels ready for direct use with Canvas ImageData.
 * We also receive compressed pixels for saving back to SPR files.
 */
function parseRgbaSprites(response: Uint8Array | ArrayBuffer, transparency: boolean): Sprite[] {
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
		// Minimum size: ID(4) + IsEmpty(1) + CompressedLen(4) + RGBA(4096) = 4105 bytes
		if (offset + 9 > view.byteLength) break;

		const id = view.getUint32(offset, true);
		offset += 4;

		const isEmpty = view.getUint8(offset) === 1;
		offset += 1;

		// Read compressed pixels length
		const compressedLen = view.getUint32(offset, true);
		offset += 4;

		// Extract compressed pixels (for saving)
		let compressedPixels: Uint8Array;
		if (compressedLen > 0) {
			if (offset + compressedLen > view.byteLength) {
				console.error(`Parse error: sprite ${id} compressed length ${compressedLen} exceeds buffer`);
				break;
			}
			compressedPixels = buffer.slice(offset, offset + compressedLen);
			offset += compressedLen;
		} else {
			compressedPixels = new Uint8Array(0);
		}

		// Check we have room for RGBA pixels
		if (offset + SPRITE_DATA_SIZE > view.byteLength) {
			console.error(`Parse error: sprite ${id} RGBA data exceeds buffer`);
			break;
		}

		// Extract RGBA pixels (for rendering)
		const rgbaPixels = buffer.slice(offset, offset + SPRITE_DATA_SIZE);
		offset += SPRITE_DATA_SIZE;

		sprites.push({
			id,
			isEmpty,
			rgbaPixels,
			compressedPixels,
			transparent: transparency
		});
	}
	return sprites;
}

/**
 * Legacy parser for compressed sprite format
 * Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][Len: u32][Data...])*
 * @deprecated Use parseRgbaSprites with read_sprites_rgba command instead
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
			rgbaPixels: new Uint8Array(0), // Will need decompression
			transparent: transparency
		});
	}
	return sprites;
}

/** Default window size for sprite loading */
const DEFAULT_WINDOW_SIZE = 100;

/** Large window size for bulk preloading */
const LARGE_WINDOW_SIZE = 500;

/**
 * Load a sprite window around the given sprite ID
 * Object Builder style: aligned to window boundaries
 *
 * Uses the new RGBA protocol where Rust handles decompression,
 * returning RGBA pixels ready for direct Canvas rendering.
 *
 * @param windowSize - Size of the window to load (default 100, use 500 for preloading)
 */
export async function loadSpriteWindow(
	sprPath: string,
	spriteId: number,
	totalSprites: number,
	transparency: boolean,
	spriteCache: Map<number, Sprite>,
	windowSize: number = DEFAULT_WINDOW_SIZE
): Promise<void> {
	const WINDOW_SIZE = windowSize;

	// Calculate window boundaries (aligned to window size)
	const windowStart = getSpriteWindowStart(spriteId, WINDOW_SIZE);
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

		// Batch load window from Rust using new RGBA protocol
		// Rust handles decompression - returns ready-to-use RGBA pixels
		const response = await invoke<Uint8Array>('read_sprites_batch_rgba', {
			count,
			startId,
			transparent: transparency,
			path: sprPath
		});

		const batchedSprites = parseRgbaSprites(response, transparency);

		// Add to cache
		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}

		logger.log(EventCode.LOADER_ADDED, { rgba: true, sz: spriteCache.size, n: batchedSprites.length });

		// NO CACHE EVICTION - Object Builder pattern
		// Sprites are kept in memory for the entire session
		// This prevents race conditions where sprites are evicted before rendering
		// Modern systems can easily handle 50,000+ sprites (~200 MB)
	} catch (err) {
		logError(`Failed to load sprite window ${startId}-${endId}`, err);
	}
}

/**
 * Bulk preload sprites in the background
 * Loads multiple large windows to warm up the cache faster
 *
 * @param count - Number of sprites to preload (default 2000)
 */
export async function preloadSprites(
	sprPath: string,
	totalSprites: number,
	transparency: boolean,
	spriteCache: Map<number, Sprite>,
	count: number = 2000,
	onProgress?: (loaded: number, total: number) => void
): Promise<void> {
	const BATCH_SIZE = 500; // Load 500 sprites per batch
	const batches = Math.ceil(Math.min(count, totalSprites) / BATCH_SIZE);

	logger.log(EventCode.LOADER_READ, { preload: true, count, batches });

	for (let i = 0; i < batches; i++) {
		const startId = i * BATCH_SIZE + 1;
		const batchCount = Math.min(BATCH_SIZE, totalSprites - startId + 1);

		if (batchCount <= 0) break;

		try {
			const response = await invoke<Uint8Array>('read_sprites_batch_rgba', {
				count: batchCount,
				startId,
				transparent: transparency,
				path: sprPath
			});

			const batchedSprites = parseRgbaSprites(response, transparency);

			for (const sprite of batchedSprites) {
				spriteCache.set(sprite.id, sprite);
			}

			if (onProgress) {
				onProgress(Math.min((i + 1) * BATCH_SIZE, count), count);
			}
		} catch (err) {
			logError(`Failed to preload batch ${i + 1}/${batches}`, err);
			// Continue with next batch even if one fails
		}
	}

	logger.log(EventCode.LOADER_ADDED, { preload: true, sz: spriteCache.size });
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
 *
 * Uses the new RGBA protocol where Rust handles decompression,
 * returning RGBA pixels ready for direct Canvas rendering.
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
		// Load all unique IDs in one go using new RGBA protocol
		// Rust handles decompression - returns ready-to-use RGBA pixels
		const response = await invoke<Uint8Array>('read_sprites_rgba', {
			path: sprPath,
			ids: uniqueIds,
			transparent: transparency
		});

		const batchedSprites = parseRgbaSprites(response, transparency);

		// Add to cache
		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}

		logger.log(EventCode.LOADER_ADDED, {
			rgba: true,
			sz: spriteCache.size,
			n: batchedSprites.length
		});
	} catch (err) {
		logError(`Failed to load sprite list of ${uniqueIds.length} items`, err);
	}
}

/**
 * Load specific sprite IDs using LZ4 compression for faster IPC transfer
 * This reduces transfer size by ~5x (7-8MB -> 1.5MB for outfit pages)
 *
 * Use this for loading large numbers of sprites (>100) for better performance.
 * For small batches (<100), use loadSpriteIds which has less overhead.
 */
export async function loadSpriteIdsLz4(
	sprPath: string,
	spriteIds: number[],
	transparency: boolean,
	spriteCache: Map<number, Sprite>
): Promise<void> {
	// Filter out IDs that are already cached or invalid
	const uncachedIds = spriteIds.filter((id) => id > 0 && !spriteCache.has(id));

	if (uncachedIds.length === 0) {
		logger.log(EventCode.LOADER_CACHED, { n: spriteIds.length, lz4: true });
		return; // All sprites already cached
	}

	// Remove duplicates
	const uniqueIds = [...new Set(uncachedIds)];

	logger.log(EventCode.LOADER_READ, {
		method: 'lz4',
		total: uniqueIds.length,
		ids: uniqueIds.slice(0, 5)
	});

	try {
		// Load with LZ4 compression for faster IPC transfer
		const compressedResponse = await invoke<Uint8Array>('read_sprites_rgba_lz4', {
			path: sprPath,
			ids: uniqueIds,
			transparent: transparency
		});

		// Handle ArrayBuffer response
		const compressedBuffer = compressedResponse instanceof Uint8Array
			? compressedResponse
			: new Uint8Array(compressedResponse);

		// Decompress LZ4 (lz4_flex prepends uncompressed size as 4-byte little-endian)
		const decompressed = lz4.decompress(compressedBuffer);

		logger.log(EventCode.LOADER_READ, {
			lz4: true,
			compressed: compressedBuffer.byteLength,
			decompressed: decompressed.byteLength,
			ratio: (compressedBuffer.byteLength / decompressed.byteLength * 100).toFixed(1) + '%'
		});

		const batchedSprites = parseRgbaSprites(decompressed, transparency);

		// Add to cache
		for (const sprite of batchedSprites) {
			spriteCache.set(sprite.id, sprite);
		}

		logger.log(EventCode.LOADER_ADDED, {
			lz4: true,
			sz: spriteCache.size,
			n: batchedSprites.length
		});
	} catch (err) {
		logError(`Failed to load sprite list (LZ4) of ${uniqueIds.length} items`, err);
		// Fallback to uncompressed method
		await loadSpriteIds(sprPath, spriteIds, transparency, spriteCache);
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
