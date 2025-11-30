import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { loadSpriteIds } from './loader';
import { ThingType, TibiaData } from './types';

interface OptimizationResult {
	old_total: number;
	new_total: number;
	temp_path: string;
	remap_blob: number[]; // Rust returns Vec<u8> as array of numbers
	removed_count: number;
}

/**
 * Optimize sprites by removing duplicates and unused sprites
 * Uses Rust backend for performance
 */
export async function optimizeSprites(
	data: TibiaData,
	onProgress?: (message: string, current: number, total: number) => void
): Promise<{ oldTotal: number; newTotal: number; tempPath: string; removedCount: number }> {
	const steps = 4;
	let currentStep = 0;

	// 1. Collect used sprite IDs
	if (onProgress) onProgress('Scanning for used sprites...', currentStep++, steps);

	const usedIds = new Set<number>();

	const scanThingSprites = (thing: ThingType) => {
		if (thing.spriteIndex) {
			for (const id of thing.spriteIndex) usedIds.add(id);
		}
		if (thing.frameGroupsData) {
			for (const group of thing.frameGroupsData) {
				if (group.spriteIndex) {
					for (const id of group.spriteIndex) usedIds.add(id);
				}
			}
		}
	};

	for (const thing of data.items.values()) scanThingSprites(thing);
	for (const thing of data.outfits.values()) scanThingSprites(thing);
	for (const thing of data.effects.values()) scanThingSprites(thing);
	for (const thing of data.missiles.values()) scanThingSprites(thing);

	// 2. Call Rust optimizer
	if (onProgress) onProgress('Optimizing in backend...', currentStep++, steps);

	if (!data.sprPath) {
		throw new Error('No SPR file path available');
	}

	// Encode usedIds to binary (little-endian u32)
	const usedIdsArray = new Uint8Array(usedIds.size * 4);
	const view = new DataView(usedIdsArray.buffer);
	let offset = 0;
	for (const id of usedIds) {
		view.setUint32(offset, id, true);
		offset += 4;
	}

	// Listen for progress events from Rust
	const unlisten = await listen<string>('optimizer-progress', (event) => {
		if (onProgress) onProgress(event.payload, currentStep, steps);
	});

	try {
		const result = await invoke<OptimizationResult>('optimize_sprites_rust', {
			path: data.sprPath,
			extended: data.extended,
			usedIdsBlob: usedIdsArray
		});

		unlisten(); // Clean up listener

		// 3. Apply remapping
		if (onProgress) onProgress('Updating object references...', currentStep++, steps);

		// Decode remap blob
		const remap = new Map<number, number>();
		const remapView = new DataView(new Uint8Array(result.remap_blob).buffer);
		for (let i = 0; i < result.remap_blob.length; i += 8) {
			const oldId = remapView.getUint32(i, true);
			const newId = remapView.getUint32(i + 4, true);
			remap.set(oldId, newId);
		}

		const remapThingSprites = (thing: ThingType) => {
			if (thing.spriteIndex) {
				for (let i = 0; i < thing.spriteIndex.length; i++) {
					const oldId = thing.spriteIndex[i];
					if (remap.has(oldId)) {
						thing.spriteIndex[i] = remap.get(oldId)!;
					}
				}
			}

			if (thing.frameGroupsData) {
				for (const group of thing.frameGroupsData) {
					if (group.spriteIndex) {
						for (let i = 0; i < group.spriteIndex.length; i++) {
							const oldId = group.spriteIndex[i];
							if (remap.has(oldId)) {
								group.spriteIndex[i] = remap.get(oldId)!;
							}
						}
					}
				}
			}
		};

		for (const thing of data.items.values()) remapThingSprites(thing);
		for (const thing of data.outfits.values()) remapThingSprites(thing);
		for (const thing of data.effects.values()) remapThingSprites(thing);
		for (const thing of data.missiles.values()) remapThingSprites(thing);

		// 4. Update TibiaData to use new file
		if (onProgress) onProgress('Reloading sprites...', currentStep++, steps);

		// CRITICAL: Open the new temp file in the backend so we can read from it
		// The backend SprManager needs to have the file open before read_sprites commands work
		await invoke('open_spr_file', {
			path: result.temp_path,
			extended: data.extended
		});

		// DO NOT mutate data.sprPath here!
		// If we mutate it, the Context will see the new path when we call setData,
		// and it will try to close the NEW path instead of the OLD path.
		// data.sprPath = result.temp_path;

		// We can mutate cache as it doesn't affect file handles
		data.sprites.clear();

		// Preload first 100 sprites to ensure UI works
		await loadSpriteIds(
			result.temp_path,
			Array.from({ length: Math.min(100, result.new_total) }, (_, i) => i + 1),
			data.transparency,
			data.sprites
		);

		if (onProgress) onProgress('Optimization complete', steps, steps);

		return {
			oldTotal: result.old_total,
			newTotal: result.new_total,
			tempPath: result.temp_path,
			removedCount: result.removed_count
		};
	} catch (error) {
		unlisten();
		throw error;
	}
}
