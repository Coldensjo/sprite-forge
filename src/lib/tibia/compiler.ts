/**
 * Compiler for Tibia DAT and SPR files
 * Handles writing modified data back to files with version control
 */

import type { Sprite, TibiaData, ThingType } from './types';

import { invoke } from '@tauri-apps/api/core';

import { ThingCategory } from './types';
import { createCommit } from '../versionControl';

/**
 * Collect all items of a specific category from a map
 * PERFORMANCE OPTIMIZED: Only returns non-null things with their IDs
 * Rust will fill in the gaps with LAST_FLAG (0xFF)
 */
function collectThings(
	map: Map<number, ThingType>,
	category: ThingCategory
): { maxId: number; minId: number; things: ThingType[] } {
	// Determine ID range based on category
	const minId = category === 'item' ? 100 : 1;

	// Find the maximum ID in this category and collect non-null things
	let maxId = minId;
	const things: ThingType[] = [];

	for (const thing of map.values()) {
		if (thing.category === category) {
			things.push(thing);
			if (thing.id > maxId) {
				maxId = thing.id;
			}
		}
	}

	return { maxId, minId, things };
}

/**
 * Collect modified sprites based on changes in items
 */
function collectModifiedSprites(
	data: TibiaData,
	modifiedItems: Map<string, { id: number; data: ThingType; category: ThingCategory }>
): Map<number, Sprite> {
	const modifiedSprites = new Map<number, Sprite>();

	// For each modified item, collect its sprite IDs
	for (const item of modifiedItems.values()) {
		// Collect from main spriteIndex (usually Idle)
		if (item.data.spriteIndex) {
			for (const spriteId of item.data.spriteIndex) {
				if (!modifiedSprites.has(spriteId)) {
					const sprite = data.sprites.get(spriteId);
					if (sprite) {
						modifiedSprites.set(spriteId, sprite);
					}
				}
			}
		}

		// Collect from frameGroupsData (Walking, etc.)
		if (item.data.frameGroupsData) {
			for (const group of item.data.frameGroupsData) {
				if (group.spriteIndex) {
					for (const spriteId of group.spriteIndex) {
						if (!modifiedSprites.has(spriteId)) {
							const sprite = data.sprites.get(spriteId);
							if (sprite) {
								modifiedSprites.set(spriteId, sprite);
							}
						}
					}
				}
			}
		}
	}

	return modifiedSprites;
}

/**
 * Fix sprite index for a thing if it's missing or has wrong length
 * Fills missing sprites with 0 (empty sprite)
 * Also fixes frameGroupsData if present
 */
function fixSpriteIndex(thing: ThingType): void {
	const total = thing.width * thing.height * thing.patternX * thing.patternY * thing.patternZ * thing.frames * thing.layers;

	// Fix frame groups first (for outfits)
	if (thing.frameGroupsData && thing.frameGroupsData.length > 0) {
		for (const group of thing.frameGroupsData) {
			const groupTotal =
				group.width * group.height * group.layers * group.patternX * group.patternY * group.patternZ * group.frames;

			// Initialize spriteIndex if missing
			if (!group.spriteIndex) {
				group.spriteIndex = [];
			}

			// Fix sprite index length
			if (group.spriteIndex.length !== groupTotal) {
				console.warn(
					`Fixing frame group sprite index for ${thing.category} ${thing.id}: expected ${groupTotal} sprites but has ${group.spriteIndex.length}. Filling with empty sprites.`
				);
				group.spriteIndex = new Array(groupTotal).fill(0);
			}
		}
	}

	// Initialize spriteIndex if missing
	if (!thing.spriteIndex) {
		thing.spriteIndex = [];
	}

	// If spriteIndex is empty or wrong size, fix it
	if (thing.spriteIndex.length !== total) {
		console.warn(
			`Fixing sprite index for ${thing.category} ${thing.id}: expected ${total} sprites but has ${thing.spriteIndex.length}. Filling with empty sprites.`
		);

		// Resize to correct length, filling with 0 (empty sprite)
		thing.spriteIndex = new Array(total).fill(0);

		// If we had some sprites, try to preserve them
		// (This shouldn't happen in normal cases, but helps with partial data)
	}
}

/**
 * Compile DAT file
 * CRITICAL: Always writes ALL items/outfits/effects/missiles, not just modified ones!
 *
 * PERFORMANCE NOTE: This function currently sends data via JSON serialization (violates RULE #1)
 * - Current: Sends ~6000 ThingType objects as JSON (~60% payload reduction from original 11,604)
 * - TODO: Encode to binary buffer using DataView for 10-100x performance improvement
 * - See CLAUDE.md "RULE #1: NEVER USE JSON FOR TAURI IPC" for implementation guide
 */
export async function compileDatFile(path: string, data: TibiaData): Promise<void> {
	// Collect all items from each category
	const itemsData = collectThings(data.items, ThingCategory.ITEM);
	const outfitsData = collectThings(data.outfits, ThingCategory.OUTFIT);
	const effectsData = collectThings(data.effects, ThingCategory.EFFECT);
	const missilesData = collectThings(data.missiles, ThingCategory.MISSILE);

	// Fix and validate items
	for (let i = 0; i < itemsData.things.length; i++) {
		const item = itemsData.things[i];
		if (item) {
			const total = item.width * item.height * item.patternX * item.patternY * item.patternZ * item.frames * item.layers;

			// Fix sprite index if needed
			if (total > 0) {
				fixSpriteIndex(item);
			}

			// Check for corrupt data
			if (total > 4096 || total === 0) {
				console.error(`CORRUPT ITEM at index ${i}:`, {
					id: item.id,
					width: item.width,
					height: item.height,
					frames: item.frames,
					layers: item.layers,
					totalSprites: total,
					category: item.category,
					patternX: item.patternX,
					patternY: item.patternY,
					patternZ: item.patternZ,
					spriteIndexLength: item.spriteIndex?.length || 0
				});
			}
		}
	}

	// Fix and validate outfits
	for (let i = 0; i < outfitsData.things.length; i++) {
		const outfit = outfitsData.things[i];
		if (outfit) {
			const total =
				outfit.width * outfit.height * outfit.patternX * outfit.patternY * outfit.patternZ * outfit.frames * outfit.layers;

			// Fix sprite index if needed
			if (total > 0) {
				fixSpriteIndex(outfit);
			}

			// Check for corrupt data
			if (total > 4096 || total === 0) {
				console.error(`CORRUPT OUTFIT at index ${i}:`, {
					id: outfit.id,
					width: outfit.width,
					totalSprites: total,
					height: outfit.height,
					frames: outfit.frames,
					layers: outfit.layers,
					category: outfit.category,
					patternX: outfit.patternX,
					patternY: outfit.patternY,
					patternZ: outfit.patternZ,
					spriteIndexLength: outfit.spriteIndex?.length || 0
				});
			}
		}
	}

	// Fix and validate effects
	for (let i = 0; i < effectsData.things.length; i++) {
		const effect = effectsData.things[i];
		if (effect) {
			const total =
				effect.width * effect.height * effect.patternX * effect.patternY * effect.patternZ * effect.frames * effect.layers;
			if (total > 0) {
				fixSpriteIndex(effect);
			}
		}
	}

	// Fix and validate missiles
	for (let i = 0; i < missilesData.things.length; i++) {
		const missile = missilesData.things[i];
		if (missile) {
			const total =
				missile.width * missile.height * missile.patternX * missile.patternY * missile.patternZ * missile.frames * missile.layers;
			if (total > 0) {
				fixSpriteIndex(missile);
			}
		}
	}

	// CRITICAL: Header counts must be the MAX ID, not array length!
	// This matches Object Builder's behavior where _itemsCount is the maximum item ID
	// PERFORMANCE: Only send non-null things, Rust fills in the gaps
	await invoke('write_dat', {
		path,
		extended: data.extended,
		items: itemsData.things,
		version: data.version.value,
		itemsMinId: itemsData.minId,
		itemsMaxId: itemsData.maxId,
		outfits: outfitsData.things,
		effects: effectsData.things,
		missiles: missilesData.things,
		outfitsMinId: outfitsData.minId,
		outfitsMaxId: outfitsData.maxId,
		effectsMinId: effectsData.minId,
		effectsMaxId: effectsData.maxId,
		missilesMinId: missilesData.minId,
		missilesMaxId: missilesData.maxId,
		signature: data.version.datSignature,
		frameDurations: data.version.supportsFrameDurations
	});
}

/**
 * Compile SPR file (full write)
 * This copies the original SPR file while applying any sprite modifications.
 * This is essential because most sprites are lazy-loaded and not in memory.
 */
export async function compileSprFile(path: string, data: TibiaData): Promise<void> {
	// Collect only the sprites that are in the cache (modified ones)
	// Unmodified sprites will be copied from the original file by Rust
	const modifications = [];
	for (const sprite of data.sprites.values()) {
		if (sprite.compressedPixels && sprite.compressedPixels.length > 0) {
			modifications.push({
				id: sprite.id,
				isEmpty: sprite.isEmpty,
				compressedPixels: sprite.compressedPixels
			});
		}
	}

	// Use the new Rust command that copies from source + applies modifications
	await invoke('copy_spr_file_with_mods', {
		modifications,
		destPath: path,
		extended: data.extended,
		sourcePath: data.sprPath,
		signature: data.version.sprSignature
	});
}

/**
 * Encode sprites into a binary buffer for efficient IPC transfer
 * Binary format: [Count: u32] + for each sprite: [ID: u32][IsEmpty: u8][Len: u32][Data...]
 *
 * This follows CLAUDE.md RULE #1: Never use JSON for large data transfers
 */
function encodeSpritesForUpdate(sprites: Array<{ id: number; isEmpty: boolean; compressedPixels: Uint8Array }>): Uint8Array {
	// Calculate total buffer size
	let totalSize = 4; // sprite count (u32)
	for (const sprite of sprites) {
		totalSize += 4 + 1 + 4; // id (u32) + isEmpty (u8) + compressedLen (u32)
		if (!sprite.isEmpty && sprite.compressedPixels?.length > 0) {
			totalSize += sprite.compressedPixels.length;
		}
	}

	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);
	const bytes = new Uint8Array(buffer);
	let offset = 0;

	// Write sprite count
	view.setUint32(offset, sprites.length, true); // little-endian
	offset += 4;

	// Write each sprite
	for (const sprite of sprites) {
		// ID (u32)
		view.setUint32(offset, sprite.id, true);
		offset += 4;

		// IsEmpty (u8)
		view.setUint8(offset, sprite.isEmpty ? 1 : 0);
		offset += 1;

		// Compressed length (u32)
		const len = sprite.isEmpty ? 0 : (sprite.compressedPixels?.length ?? 0);
		view.setUint32(offset, len, true);
		offset += 4;

		// Compressed pixels (if not empty)
		if (len > 0) {
			bytes.set(sprite.compressedPixels, offset);
			offset += len;
		}
	}

	return bytes;
}

/**
 * Update only specific sprites in an existing SPR file
 * More efficient than rewriting the entire file
 *
 * PERFORMANCE: Uses binary IPC buffer for fast transfer (single call, no batching needed)
 *
 * NOTE: If sprite count changes, this will fail and fall back to full rewrite automatically.
 */
export async function updateSpritesInSpr(
	path: string,
	data: TibiaData,
	modifiedSprites: Map<number, Sprite>,
	spritesCount: number
): Promise<void> {
	// Convert sprites to the format for binary encoding
	// For deleted sprites (not in data.sprites), mark as empty
	const allSprites = Array.from(modifiedSprites.keys()).map((id) => {
		const sprite = data.sprites.get(id);
		if (sprite) {
			return {
				id: sprite.id,
				isEmpty: sprite.isEmpty,
				compressedPixels: sprite.compressedPixels ?? new Uint8Array(0)
			};
		} else {
			// Sprite was deleted - write as empty
			return {
				id: id,
				isEmpty: true,
				compressedPixels: new Uint8Array(0)
			};
		}
	});

	// Encode sprites to binary buffer
	const buffer = encodeSpritesForUpdate(allSprites);

	try {
		// Single IPC call with binary buffer - no batching needed
		await invoke('update_spr_sprites_bin', {
			path,
			spritesCount,
			extended: data.extended,
			buffer: Array.from(buffer) // Tauri expects array for Vec<u8>
		});
	} catch (error) {
		// If Rust returns FULL_REWRITE_REQUIRED error, fall back to full rewrite
		if (error instanceof Error && error.message.includes('FULL_REWRITE_REQUIRED')) {
			console.log('Sprite count changed, falling back to full SPR rewrite...');
			await compileSprFile(path, data);
		} else if (typeof error === 'string' && error.includes('FULL_REWRITE_REQUIRED')) {
			console.log('Sprite count changed, falling back to full SPR rewrite...');
			await compileSprFile(path, data);
		} else {
			throw error;
		}
	}
}

/**
 * Main compile function that handles the complete compilation workflow
 */
export async function compileFiles(
	data: TibiaData,
	datPath: string,
	sprPath: string,
	modifiedItems: Map<string, { id: number; data: ThingType; category: ThingCategory }>,
	directlyModifiedSprites: Map<number, Sprite>,
	onProgress?: (stage: string, current: number, total: number) => void
): Promise<void> {
	const startTime = Date.now();

	try {
		// Step 1: Collect modified sprites
		if (onProgress) onProgress('Collecting modified sprites...', 0, 4);
		const modifiedSpritesFromItems = collectModifiedSprites(data, modifiedItems);

		// Merge directly modified sprites with sprites from modified items
		const modifiedSprites = new Map([...modifiedSpritesFromItems, ...directlyModifiedSprites]);

		// Step 2: Create version control commit
		if (onProgress) onProgress('Creating version control commit...', 1, 4);
		const commitMessage = `Compile: ${modifiedItems.size} items, ${modifiedSprites.size} sprites modified`;
		await createCommit(commitMessage, modifiedItems, modifiedSprites);

		// Step 3: Compile DAT file
		// IMPORTANT: Do NOT pass modifiedItemIds - we must write ALL items, not just modified ones!
		if (onProgress) onProgress('Writing DAT file...', 2, 4);
		await compileDatFile(datPath, data);

		// Step 4: Update SPR file (only modified sprites)
		// Uses binary IPC for fast single-call transfer
		if (onProgress) onProgress('Updating SPR file...', 3, 4);
		if (modifiedSprites.size > 0) {
			await updateSpritesInSpr(sprPath, data, modifiedSprites, data.spritesCount);
		}

		// Complete
		if (onProgress) onProgress('Compile complete', 4, 4);

		const duration = Date.now() - startTime;
		console.log(`Compile complete in ${duration}ms: ${modifiedItems.size} items, ${modifiedSprites.size} sprites`);
	} catch (error) {
		console.error('Compile failed:', error);
		throw error;
	}
}

/**
 * Full recompile (write entire files)
 * Use this when doing major changes or when incremental update is not possible
 */
export async function fullRecompile(
	data: TibiaData,
	datPath: string,
	sprPath: string,
	onProgress?: (stage: string, current: number, total: number) => void
): Promise<void> {
	const startTime = Date.now();

	try {
		// Step 1: Compile DAT file
		if (onProgress) onProgress('Writing DAT file...', 0, 2);
		await compileDatFile(datPath, data);

		// Step 2: Compile SPR file
		if (onProgress) onProgress('Writing SPR file...', 1, 2);
		await compileSprFile(sprPath, data);

		// Complete
		if (onProgress) onProgress('Full recompile complete', 2, 2);

		const duration = Date.now() - startTime;
		console.log(`Full recompile complete in ${duration}ms`);
	} catch (error) {
		console.error('Full recompile failed:', error);
		throw error;
	}
}
