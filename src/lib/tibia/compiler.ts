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

	// Check for corrupt data in items
	for (let i = 0; i < itemsData.things.length; i++) {
		const item = itemsData.things[i];
		if (item) {
			const total = item.width * item.height * item.patternX * item.patternY * item.patternZ * item.frames * item.layers;
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

	// Check outfits
	for (let i = 0; i < outfitsData.things.length; i++) {
		const outfit = outfitsData.things[i];
		if (outfit) {
			const total =
				outfit.width * outfit.height * outfit.patternX * outfit.patternY * outfit.patternZ * outfit.frames * outfit.layers;
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
 */
export async function compileSprFile(path: string, data: TibiaData): Promise<void> {
	// Collect all sprites, filling gaps with empty sprites
	const sprites = [];
	for (let id = 1; id <= data.spritesCount; id++) {
		const sprite = data.sprites.get(id);
		if (sprite) {
			// Use compressedPixels if available, otherwise sprite wasn't modified
			// (Sprites loaded via RGBA don't have compressedPixels until modified)
			sprites.push({
				id: sprite.id,
				isEmpty: sprite.isEmpty,
				compressedPixels: sprite.compressedPixels || new Uint8Array(0)
			});
		} else {
			// Create empty sprite for deleted IDs
			sprites.push({
				id: id,
				isEmpty: true,
				compressedPixels: new Uint8Array(0)
			});
		}
	}

	// Invoke Rust command to write SPR file
	await invoke('write_spr', {
		path,
		sprites,
		extended: data.extended,
		signature: data.version.sprSignature
	});
}

/**
 * Update only specific sprites in an existing SPR file
 * More efficient than rewriting the entire file
 */
export async function updateSpritesInSpr(
	path: string,
	data: TibiaData,
	modifiedSprites: Map<number, Sprite>,
	spritesCount: number
): Promise<void> {
	// Convert sprites to the format expected by Rust
	// For deleted sprites (not in data.sprites), mark as empty
	const sprites = Array.from(modifiedSprites.keys()).map((id) => {
		const sprite = data.sprites.get(id);
		if (sprite) {
			return {
				id: sprite.id,
				isEmpty: sprite.isEmpty,
				compressedPixels: sprite.compressedPixels
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

	// Invoke Rust command to update specific sprites
	await invoke('update_spr_sprites', {
		path,
		sprites,
		spritesCount,
		extended: data.extended
	});
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
