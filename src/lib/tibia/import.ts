import { invoke } from '@tauri-apps/api/core';
import { logger, EventCode } from '@/lib/debug';
import { open } from '@tauri-apps/plugin-dialog';

import { parseImportResponse } from './loader';
import { ThingType, TibiaData } from './types';

export interface ImportResult {
	success: boolean;
	spriteIds?: number[];
	updatedThing?: ThingType;
}

/**
 * Import a sprite sheet into an object (item/outfit/effect/missile)
 *
 * Uses binary IPC to return both the updated ThingType and sprite data
 * in a single call, eliminating race conditions and ensuring sprites
 * are immediately available in the cache.
 */
export async function importObjectSheet(thing: ThingType, data: TibiaData, file?: File | string): Promise<ImportResult> {
	if (!data?.sprPath) {
		logger.log(EventCode.ERROR, { msg: 'Cannot import: no data loaded' });
		return { success: false };
	}

	// 1. Get image bytes
	let imageBytes: Uint8Array;

	try {
		if (file instanceof File) {
			// File object from drag & drop
			imageBytes = new Uint8Array(await file.arrayBuffer());
		} else if (typeof file === 'string') {
			// File path - read via Tauri
			const result = await invoke<Uint8Array>('read_file', { path: file });
			imageBytes = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayLike<number>);
		} else {
			// No file provided - open dialog
			const selected = await open({
				multiple: false,
				filters: [{ name: 'Image', extensions: ['png', 'bmp', 'jpg', 'jpeg'] }]
			});
			if (!selected || typeof selected !== 'string') {
				return { success: false };
			}
			const result = await invoke<Uint8Array>('read_file', { path: selected });
			imageBytes = result instanceof Uint8Array ? result : new Uint8Array(result as ArrayLike<number>);
		}
	} catch (e) {
		logger.log(EventCode.ERROR, { err: e, msg: 'Failed to read image file' });
		console.error('Failed to read image file:', e);
		return { success: false };
	}

	// 2. Calculate next sprite ID
	let nextId = data.spritesCount + 1;
	for (const id of data.sprites.keys()) {
		if (id >= nextId) nextId = id + 1;
	}

	console.log('Importing sprite sheet...', {
		thingId: thing.id,
		nextSpriteId: nextId,
		category: thing.category,
		imageSize: imageBytes.length
	});

	try {
		// 3. Single IPC call - returns binary response with ThingType + sprites
		const response = await invoke<ArrayBuffer>('import_object_sheet_binary', {
			thing,
			nextSpriteId: nextId,
			sprPath: data.sprPath,
			version: data.version.value, // Pass version so Rust knows if frame groups are supported
			transparent: data.transparency,
			imageBytes: Array.from(imageBytes)
		});

		// Convert to Uint8Array if needed
		const buffer = response instanceof Uint8Array ? response : new Uint8Array(response);

		// 4. Parse response (includes LZ4 decompression of sprites)
		const { sprites, updatedThing } = parseImportResponse(buffer, data.transparency);

		console.log('Import parsed:', {
			thingId: updatedThing.id,
			width: updatedThing.width,
			spriteCount: sprites.length,
			frames: updatedThing.frames,
			layers: updatedThing.layers,
			height: updatedThing.height,
			patternX: updatedThing.patternX,
			patternY: updatedThing.patternY,
			patternZ: updatedThing.patternZ,
			spriteIds: sprites.slice(0, 5).map((s) => s.id),
			// DEBUG: Full sprite index info
			spriteIndexLength: updatedThing.spriteIndex?.length,
			spriteIndexFirst20: updatedThing.spriteIndex?.slice(0, 20)
		});

		// 5. Populate sprite cache directly - no second IPC needed!
		let maxSpriteId = data.spritesCount;
		for (const sprite of sprites) {
			data.sprites.set(sprite.id, sprite);
			if (sprite.id > maxSpriteId) {
				maxSpriteId = sprite.id;
			}
		}

		// 5b. Update spritesCount so SpriteList shows the new sprites
		if (maxSpriteId > data.spritesCount) {
			data.spritesCount = maxSpriteId;
		}

		// 6. Update category map with new ThingType
		const categoryMap = {
			item: data.items,
			outfit: data.outfits,
			effect: data.effects,
			missile: data.missiles
		}[updatedThing.category];

		if (categoryMap?.has(thing.id)) {
			categoryMap.set(thing.id, updatedThing);
		}

		// 7. Also mutate the passed-in thing for immediate local updates
		Object.assign(thing, updatedThing);

		const spriteIds = sprites.map((s) => s.id);

		logger.log(EventCode.CANVAS_DRAW, {
			msg: 'Import complete',
			thingId: updatedThing.id,
			sprites: spriteIds.length
		});

		console.log('Import SUCCESS:', {
			thingId: updatedThing.id,
			cacheSize: data.sprites.size,
			spriteCount: spriteIds.length
		});

		return { spriteIds, updatedThing, success: true };
	} catch (err) {
		logger.log(EventCode.ERROR, { err, msg: 'Import failed' });
		console.error('Import failed:', err);
		return { success: false };
	}
}
