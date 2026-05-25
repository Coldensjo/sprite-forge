/**
 * Sprite Management Functions
 * Based on Object Builder's SpriteStorage.as implementation
 *
 * Handles adding, removing, and replacing sprites in TibiaData
 */

import type { Sprite, TibiaData } from './types';

import { invoke } from '@tauri-apps/api/core';

import { isEmptyPixels } from './spriteReader';

/**
 * Compress RGBA pixels using Rust backend
 * @param pixels - RGBA pixel data (4096 bytes)
 * @param transparent - Whether to include alpha channel in output
 * @returns Compressed RLE data
 */
async function compressPixelsRust(pixels: Uint8Array, transparent: boolean): Promise<Uint8Array> {
	const buf = new Uint8Array(4097);
	buf[0] = transparent ? 1 : 0;
	buf.set(pixels, 1);
	const result = await invoke<ArrayBuffer>('compress_sprite_rgba', buf);
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}

/**
 * Result of a sprite operation
 */
export interface SpriteOperationResult {
	success: boolean;
	message?: string;
	spriteId?: number;
}

/**
 * Add a new sprite to the sprite storage
 * Reference: Object Builder SpriteStorage.as lines 158-171
 *
 * @param data - TibiaData instance to modify
 * @param pixels - RGBA pixel data (4096 bytes)
 * @returns Operation result with new sprite ID
 */
export async function addSprite(data: TibiaData, pixels: Uint8Array): Promise<SpriteOperationResult> {
	// Check sprite limit
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	if (data.spritesCount >= maxSprites) {
		return {
			success: false,
			message: `Sprite limit reached (max: ${maxSprites})`
		};
	}

	// Validate pixel data size
	if (pixels.length !== 4096) {
		return {
			success: false,
			message: `Invalid pixel data size: expected 4096 bytes, got ${pixels.length}`
		};
	}

	// Allocate new sprite ID
	const newId = data.spritesCount + 1;

	try {
		// Compress pixels using Rust (accepts RGBA directly)
		const compressed = await compressPixelsRust(pixels, data.transparency);

		// Create sprite object
		const sprite: Sprite = {
			id: newId,
			rgbaPixels: pixels,
			compressedPixels: compressed,
			isEmpty: isEmptyPixels(pixels),
			transparent: data.transparency
		};

		// Add to cache
		data.sprites.set(newId, sprite);
		data.spritesCount = newId;

		console.log(`Added sprite ${newId} (compressed: ${compressed.length} bytes, empty: ${sprite.isEmpty})`);

		return {
			success: true,
			spriteId: newId
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to add sprite: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Replace an existing sprite's pixels
 * Reference: Object Builder SpriteStorage.as lines 188-209
 *
 * @param data - TibiaData instance to modify
 * @param id - Sprite ID to replace
 * @param pixels - New RGBA pixel data (4096 bytes)
 * @returns Operation result
 */
export async function replaceSprite(data: TibiaData, id: number, pixels: Uint8Array): Promise<SpriteOperationResult> {
	// Validate sprite ID
	if (id === 0 || id > data.spritesCount) {
		return {
			success: false,
			message: `Invalid sprite ID: ${id} (valid range: 1-${data.spritesCount})`
		};
	}

	// Validate pixel data size
	if (pixels.length !== 4096) {
		return {
			success: false,
			message: `Invalid pixel data size: expected 4096 bytes, got ${pixels.length}`
		};
	}

	try {
		// Compress new pixels using Rust (accepts RGBA directly)
		const compressed = await compressPixelsRust(pixels, data.transparency);

		// Create updated sprite
		const sprite: Sprite = {
			id,
			rgbaPixels: pixels,
			compressedPixels: compressed,
			isEmpty: isEmptyPixels(pixels),
			transparent: data.transparency
		};

		// Update in cache
		data.sprites.set(id, sprite);

		console.log(`Replaced sprite ${id} (compressed: ${compressed.length} bytes, empty: ${sprite.isEmpty})`);

		return {
			spriteId: id,
			success: true
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to replace sprite: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Remove a sprite (replaces with blank sprite unless it's the last one)
 * Reference: Object Builder SpriteStorage.as lines 683-700
 *
 * IMPORTANT: Object Builder does NOT actually delete sprites from the middle
 * of the sprite list! It replaces them with blank sprites to avoid
 * reindexing all items. Only the last sprite can be truly removed.
 *
 * @param data - TibiaData instance to modify
 * @param id - Sprite ID to remove
 * @returns Operation result
 */
export async function removeSprite(data: TibiaData, id: number): Promise<SpriteOperationResult> {
	// Validate sprite ID
	if (id === 0 || id > data.spritesCount) {
		return {
			success: false,
			message: `Invalid sprite ID: ${id} (valid range: 1-${data.spritesCount})`
		};
	}

	// Don't allow removing sprite ID 1 (reserved blank sprite)
	if (id === 1) {
		return {
			success: false,
			message: 'Cannot remove sprite ID 1 (reserved blank sprite)'
		};
	}

	try {
		// If this is the last sprite, truly delete it
		if (id === data.spritesCount) {
			data.sprites.delete(id);
			data.spritesCount--;

			console.log(`Removed last sprite ${id}, new count: ${data.spritesCount}`);

			return {
				spriteId: id,
				success: true
			};
		}

		// Otherwise, replace with blank sprite
		const blankPixels = new Uint8Array(4096); // All zeros = transparent
		const compressed = await compressPixelsRust(blankPixels, data.transparency);

		const blankSprite: Sprite = {
			id,
			isEmpty: true,
			rgbaPixels: blankPixels,
			compressedPixels: compressed,
			transparent: data.transparency
		};

		data.sprites.set(id, blankSprite);

		console.log(`Replaced sprite ${id} with blank sprite (not last sprite)`);

		return {
			spriteId: id,
			success: true
		};
	} catch (error) {
		return {
			success: false,
			message: `Failed to remove sprite: ${error instanceof Error ? error.message : String(error)}`
		};
	}
}

/**
 * Check if sprite storage is full
 *
 * @param data - TibiaData instance
 * @returns True if no more sprites can be added
 */
export function isSpriteStorageFull(data: TibiaData): boolean {
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	return data.spritesCount >= maxSprites;
}

/**
 * Get remaining sprite capacity
 *
 * @param data - TibiaData instance
 * @returns Number of sprites that can still be added
 */
export function getRemainingCapacity(data: TibiaData): number {
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	return Math.max(0, maxSprites - data.spritesCount);
}

/**
 * Add multiple sprites in a batch
 * More efficient than calling addSprite repeatedly
 *
 * @param data - TibiaData instance to modify
 * @param pixelsArray - Array of RGBA pixel data (4096 bytes each)
 * @returns Array of operation results with sprite IDs
 */
export async function addSpritesBatch(data: TibiaData, pixelsArray: Uint8Array[]): Promise<SpriteOperationResult[]> {
	const results: SpriteOperationResult[] = [];

	// Check if we have enough capacity
	const capacity = getRemainingCapacity(data);
	if (pixelsArray.length > capacity) {
		// Add partial results for overflow
		for (let i = 0; i < pixelsArray.length; i++) {
			if (i < capacity) {
				const result = await addSprite(data, pixelsArray[i]);
				results.push(result);
			} else {
				results.push({
					success: false,
					message: 'Sprite limit reached'
				});
			}
		}
		return results;
	}

	// Add all sprites
	for (const pixels of pixelsArray) {
		const result = await addSprite(data, pixels);
		results.push(result);

		// Stop on first error
		if (!result.success) {
			break;
		}
	}

	return results;
}

/**
 * Clone a sprite (creates a duplicate with a new ID)
 *
 * @param data - TibiaData instance
 * @param sourceId - ID of sprite to clone
 * @returns Operation result with new sprite ID
 */
export function cloneSprite(data: TibiaData, sourceId: number): SpriteOperationResult {
	// Get source sprite
	const source = data.sprites.get(sourceId);
	if (!source) {
		return {
			success: false,
			message: `Source sprite ${sourceId} not found`
		};
	}

	// Check sprite limit
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	if (data.spritesCount >= maxSprites) {
		return {
			success: false,
			message: `Sprite limit reached (max: ${maxSprites})`
		};
	}

	// Allocate new ID
	const newId = data.spritesCount + 1;

	// Create cloned sprite
	const cloned: Sprite = {
		id: newId,
		isEmpty: source.isEmpty,
		transparent: source.transparent,
		compressedPixels: new Uint8Array(source.compressedPixels) // Copy array
	};

	// Add to cache
	data.sprites.set(newId, cloned);
	data.spritesCount = newId;

	console.log(`Cloned sprite ${sourceId} to ${newId}`);

	return {
		success: true,
		spriteId: newId
	};
}
