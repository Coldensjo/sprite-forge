import type { ThingType, TibiaData } from './types';

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

import { loadSpriteIds } from './loader';

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
		// Pack args as raw binary: [extended: u8][path: u16-len + UTF-8][used_ids_blob: rest]
		const pathBytes = new TextEncoder().encode(data.sprPath);
		const argsBuf = new Uint8Array(1 + 2 + pathBytes.length + usedIdsArray.length);
		const argsView = new DataView(argsBuf.buffer);
		argsView.setUint8(0, data.extended ? 1 : 0);
		argsView.setUint16(1, pathBytes.length, true);
		argsBuf.set(pathBytes, 3);
		argsBuf.set(usedIdsArray, 3 + pathBytes.length);

		const response = await invoke<ArrayBuffer>('optimize_sprites_rust', argsBuf);

		unlisten(); // Clean up listener

		// Parse binary response: [old_total: u32][new_total: u32][removed_count: u32][temp_path: u16-len + UTF-8][remap_blob: rest]
		const resultBytes = response instanceof Uint8Array ? response : new Uint8Array(response);
		const rv = new DataView(resultBytes.buffer, resultBytes.byteOffset, resultBytes.byteLength);
		let ro = 0;
		const oldTotal = rv.getUint32(ro, true);
		ro += 4;
		const newTotal = rv.getUint32(ro, true);
		ro += 4;
		const removedCount = rv.getUint32(ro, true);
		ro += 4;
		const pathLen = rv.getUint16(ro, true);
		ro += 2;
		const tempPath = new TextDecoder().decode(resultBytes.subarray(ro, ro + pathLen));
		ro += pathLen;
		const remapBytes = resultBytes.subarray(ro);

		// 3. Apply remapping
		if (onProgress) onProgress('Updating object references...', currentStep++, steps);

		// Decode remap blob (8 bytes per pair: u32 old, u32 new)
		const remap = new Map<number, number>();
		const remapView = new DataView(remapBytes.buffer, remapBytes.byteOffset, remapBytes.byteLength);
		for (let i = 0; i < remapBytes.length; i += 8) {
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
			path: tempPath,
			extended: data.extended
		});

		// DO NOT mutate data.sprPath here!
		// If we mutate it, the Context will see the new path when we call setData,
		// and it will try to close the NEW path instead of the OLD path.

		// We can mutate cache as it doesn't affect file handles
		data.sprites.clear();

		// Preload first 100 sprites to ensure UI works
		await loadSpriteIds(
			tempPath,
			Array.from({ length: Math.min(100, newTotal) }, (_, i) => i + 1),
			data.transparency,
			data.sprites
		);

		if (onProgress) onProgress('Optimization complete', steps, steps);

		return {
			oldTotal,
			newTotal,
			tempPath,
			removedCount
		};
	} catch (error) {
		unlisten();
		throw error;
	}
}
