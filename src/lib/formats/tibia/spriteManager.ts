import type { Sprite, AssetData } from './types';

import { invoke } from '@tauri-apps/api/core';

import { isEmptyPixels } from './spriteReader';

async function compressPixelsRust(pixels: Uint8Array, transparent: boolean): Promise<Uint8Array> {
	const buf = new Uint8Array(4097);
	buf[0] = transparent ? 1 : 0;
	buf.set(pixels, 1);
	const result = await invoke<ArrayBuffer>('compress_sprite_rgba', buf);
	return result instanceof Uint8Array ? result : new Uint8Array(result);
}

export interface SpriteOperationResult {
	success: boolean;
	message?: string;
	spriteId?: number;
}

export async function addSprite(data: AssetData, pixels: Uint8Array): Promise<SpriteOperationResult> {
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	if (data.spritesCount >= maxSprites) {
		return {
			success: false,
			message: `Sprite limit reached (max: ${maxSprites})`
		};
	}

	if (pixels.length !== 4096) {
		return {
			success: false,
			message: `Invalid pixel data size: expected 4096 bytes, got ${pixels.length}`
		};
	}

	const newId = data.spritesCount + 1;

	try {
		const compressed = await compressPixelsRust(pixels, data.transparency);

		const sprite: Sprite = {
			id: newId,
			rgbaPixels: pixels,
			compressedPixels: compressed,
			isEmpty: isEmptyPixels(pixels),
			transparent: data.transparency
		};

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

export async function replaceSprite(data: AssetData, id: number, pixels: Uint8Array): Promise<SpriteOperationResult> {
	if (id === 0 || id > data.spritesCount) {
		return {
			success: false,
			message: `Invalid sprite ID: ${id} (valid range: 1-${data.spritesCount})`
		};
	}

	if (pixels.length !== 4096) {
		return {
			success: false,
			message: `Invalid pixel data size: expected 4096 bytes, got ${pixels.length}`
		};
	}

	try {
		const compressed = await compressPixelsRust(pixels, data.transparency);

		const sprite: Sprite = {
			id,
			rgbaPixels: pixels,
			compressedPixels: compressed,
			isEmpty: isEmptyPixels(pixels),
			transparent: data.transparency
		};

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

export async function removeSprite(data: AssetData, id: number): Promise<SpriteOperationResult> {
	if (id === 0 || id > data.spritesCount) {
		return {
			success: false,
			message: `Invalid sprite ID: ${id} (valid range: 1-${data.spritesCount})`
		};
	}

	if (id === 1) {
		return {
			success: false,
			message: 'Cannot remove sprite ID 1 (reserved blank sprite)'
		};
	}

	try {
		if (id === data.spritesCount) {
			data.sprites.delete(id);
			data.spritesCount--;

			console.log(`Removed last sprite ${id}, new count: ${data.spritesCount}`);

			return {
				spriteId: id,
				success: true
			};
		}

		const blankPixels = new Uint8Array(4096);
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

export function isSpriteStorageFull(data: AssetData): boolean {
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	return data.spritesCount >= maxSprites;
}

export function getRemainingCapacity(data: AssetData): number {
	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	return Math.max(0, maxSprites - data.spritesCount);
}

export async function addSpritesBatch(data: AssetData, pixelsArray: Uint8Array[]): Promise<SpriteOperationResult[]> {
	const results: SpriteOperationResult[] = [];

	const capacity = getRemainingCapacity(data);
	if (pixelsArray.length > capacity) {
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

	for (const pixels of pixelsArray) {
		const result = await addSprite(data, pixels);
		results.push(result);

		if (!result.success) {
			break;
		}
	}

	return results;
}

export function cloneSprite(data: AssetData, sourceId: number): SpriteOperationResult {
	const source = data.sprites.get(sourceId);
	if (!source) {
		return {
			success: false,
			message: `Source sprite ${sourceId} not found`
		};
	}

	const maxSprites = data.extended ? 0xffffffff : 0xfffe;
	if (data.spritesCount >= maxSprites) {
		return {
			success: false,
			message: `Sprite limit reached (max: ${maxSprites})`
		};
	}

	const newId = data.spritesCount + 1;

	const cloned: Sprite = {
		id: newId,
		isEmpty: source.isEmpty,
		transparent: source.transparent,
		compressedPixels: new Uint8Array(source.compressedPixels)
	};

	data.sprites.set(newId, cloned);
	data.spritesCount = newId;

	console.log(`Cloned sprite ${sourceId} to ${newId}`);

	return {
		success: true,
		spriteId: newId
	};
}
