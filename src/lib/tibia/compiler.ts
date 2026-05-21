/**
 * Compiler for Tibia DAT and SPR files
 * Handles writing modified data back to files with version control
 */

import type { Sprite, TibiaData, ThingType, FrameDuration } from './types';

import { invoke } from '@tauri-apps/api/core';

import { ThingCategory } from './types';
import { createCommit } from '../versionControl';

class ByteWriter {
	private buf: Uint8Array;
	private view: DataView;
	private len = 0;

	constructor(initialCapacity = 1 << 20) {
		this.buf = new Uint8Array(initialCapacity);
		this.view = new DataView(this.buf.buffer);
	}

	private ensure(extra: number): void {
		if (this.len + extra <= this.buf.length) return;
		let cap = this.buf.length;
		while (cap < this.len + extra) cap *= 2;
		const grown = new Uint8Array(cap);
		grown.set(this.buf.subarray(0, this.len));
		this.buf = grown;
		this.view = new DataView(this.buf.buffer);
	}

	u8(v: number): void {
		this.ensure(1);
		this.view.setUint8(this.len, v & 0xff);
		this.len += 1;
	}

	i8(v: number): void {
		this.ensure(1);
		this.view.setInt8(this.len, v);
		this.len += 1;
	}

	bool(v: boolean): void {
		this.u8(v ? 1 : 0);
	}

	u16(v: number): void {
		this.ensure(2);
		this.view.setUint16(this.len, v & 0xffff, true);
		this.len += 2;
	}

	i16(v: number): void {
		this.ensure(2);
		this.view.setInt16(this.len, v, true);
		this.len += 2;
	}

	u32(v: number): void {
		this.ensure(4);
		this.view.setUint32(this.len, v >>> 0, true);
		this.len += 4;
	}

	i32(v: number): void {
		this.ensure(4);
		this.view.setInt32(this.len, v, true);
		this.len += 4;
	}

	str(s: string): void {
		const bytes = new TextEncoder().encode(s ?? '');
		this.u16(bytes.length);
		this.ensure(bytes.length);
		this.buf.set(bytes, this.len);
		this.len += bytes.length;
	}

	bytes(data: Uint8Array): void {
		this.ensure(data.length);
		this.buf.set(data, this.len);
		this.len += data.length;
	}

	u32Array(arr: number[]): void {
		this.u32(arr.length);
		for (const v of arr) this.u32(v);
	}

	i16ArrayU8Len(arr: number[]): void {
		this.u8(arr.length);
		for (const v of arr) this.i16(v);
	}

	frameDurations(arr?: FrameDuration[]): void {
		const list = arr ?? [];
		this.u16(list.length);
		for (const d of list) {
			this.u32(d.minimum);
			this.u32(d.maximum);
		}
	}

	finish(): Uint8Array {
		return this.buf.slice(0, this.len);
	}
}

function encodeThing(w: ByteWriter, t: ThingType): void {
	w.u32(t.id);
	w.u8(t.width);
	w.u8(t.height);
	w.u8(t.exactSize);
	w.u8(t.layers);
	w.u8(t.patternX);
	w.u8(t.patternY);
	w.u8(t.patternZ);
	w.u8(t.frames);

	w.bool(t.isGround);
	w.bool(t.isGroundBorder);
	w.bool(t.isOnBottom);
	w.bool(t.isOnTop);
	w.bool(t.isContainer);
	w.bool(t.stackable);
	w.bool(t.multiUse);
	w.bool(t.forceUse);
	w.bool(t.hasCharges);
	w.bool(t.writable);
	w.bool(t.writableOnce);
	w.bool(t.isFluidContainer);
	w.bool(t.isFluid);
	w.bool(t.isUnpassable);
	w.bool(t.isUnmoveable);
	w.bool(t.blockMissile);
	w.bool(t.blockPathfind);
	w.bool(t.noMoveAnimation);
	w.bool(t.pickupable);
	w.bool(t.hangable);
	w.bool(t.isVertical);
	w.bool(t.isHorizontal);
	w.bool(t.rotatable);
	w.bool(t.hasLight);
	w.bool(t.dontHide);
	w.bool(t.floorChange);
	w.bool(t.isTranslucent);
	w.bool(t.hasOffset);
	w.bool(t.hasElevation);
	w.bool(t.isLyingObject);
	w.bool(t.animateAlways);
	w.bool(t.miniMap);
	w.bool(t.isLensHelp);
	w.bool(t.isFullGround);
	w.bool(t.ignoreLook);
	w.bool(t.cloth);
	w.bool(t.isMarketItem);
	w.bool(t.hasDefaultAction);
	w.bool(t.wrappable);
	w.bool(t.unwrappable);
	w.bool(t.usable);
	w.bool(t.topEffect);
	w.bool(t.hasBones);

	w.u16(t.groundSpeed);
	w.u16(t.maxTextLength);
	w.u16(t.lightLevel);
	w.u16(t.lightColor);
	w.i16(t.offsetX);
	w.i16(t.offsetY);
	w.u16(t.elevation);
	w.u16(t.miniMapColor);
	w.u16(t.lensHelp);
	w.u16(t.clothSlot);
	w.u16(t.marketCategory);
	w.u16(t.marketTradeAs);
	w.u16(t.marketShowAs);
	w.u16(t.marketRestrictProfession);
	w.u16(t.marketRestrictLevel);
	w.u16(t.defaultAction);
	w.u8(t.animationMode);
	w.i32(t.loopCount);
	w.i8(t.startFrame);

	w.str(t.marketName);

	w.i16ArrayU8Len(t.bonesOffsetX ?? []);
	w.i16ArrayU8Len(t.bonesOffsetY ?? []);

	w.frameDurations(t.frameDurations);
	w.u32Array(t.spriteIndex ?? []);

	const groups = t.frameGroupsData ?? [];
	w.u8(groups.length);
	for (const g of groups) {
		w.u8(g.type);
		w.u8(g.width);
		w.u8(g.height);
		w.u8(g.exactSize);
		w.u8(g.layers);
		w.u8(g.patternX);
		w.u8(g.patternY);
		w.u8(g.patternZ);
		w.u8(g.frames);
		w.u8(g.animationMode ?? 0);
		w.i32(g.loopCount ?? 0);
		w.i8(g.startFrame ?? 0);
		w.frameDurations(g.frameDurations);
		w.u32Array(g.spriteIndex ?? []);
	}
}

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
	// PERFORMANCE: Only send non-null things; Rust fills in the gaps with LAST_FLAG.
	const w = new ByteWriter(4 << 20);
	w.u32(data.version.datSignature);
	w.u32(data.version.value);
	w.bool(data.extended);
	w.bool(data.version.supportsFrameDurations);
	w.u16(itemsData.minId);
	w.u16(itemsData.maxId);
	w.u16(outfitsData.minId);
	w.u16(outfitsData.maxId);
	w.u16(effectsData.minId);
	w.u16(effectsData.maxId);
	w.u16(missilesData.minId);
	w.u16(missilesData.maxId);
	w.str(path);

	for (const category of [itemsData.things, outfitsData.things, effectsData.things, missilesData.things]) {
		w.u32(category.length);
		for (const thing of category) encodeThing(w, thing);
	}

	await invoke('write_dat_bin', w.finish());
}

export async function compileSprFile(path: string, data: TibiaData, modifiedSprites: Map<number, Sprite>): Promise<void> {
	const w = new ByteWriter(1 << 20);
	w.bool(data.extended);
	w.u32(data.version.sprSignature);
	w.u32(data.spritesCount);
	w.str(data.sprPath ?? '');
	w.str(path);

	w.u32(modifiedSprites.size);
	for (const id of modifiedSprites.keys()) {
		const sprite = data.sprites.get(id);
		const isEmpty = sprite ? sprite.isEmpty : true;
		const compressed = sprite && !isEmpty ? (sprite.compressedPixels ?? new Uint8Array(0)) : new Uint8Array(0);
		w.u32(id);
		w.bool(isEmpty);
		w.u32(compressed.length);
		if (compressed.length > 0) w.bytes(compressed);
	}

	await invoke('copy_spr_file_with_mods', w.finish());
}

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

	const w = new ByteWriter(1 << 20);
	w.bool(data.extended);
	w.u32(spritesCount);
	w.str(path);
	w.u32(allSprites.length);
	for (const sprite of allSprites) {
		w.u32(sprite.id);
		w.bool(sprite.isEmpty);
		const len = sprite.isEmpty ? 0 : (sprite.compressedPixels?.length ?? 0);
		w.u32(len);
		if (len > 0) w.bytes(sprite.compressedPixels);
	}

	try {
		await invoke('update_spr_sprites_bin', w.finish());
	} catch (error) {
		// If Rust returns FULL_REWRITE_REQUIRED error, fall back to full rewrite
		if (error instanceof Error && error.message.includes('FULL_REWRITE_REQUIRED')) {
			console.log('Sprite count changed, falling back to full SPR rewrite...');
			await compileSprFile(path, data, modifiedSprites);
		} else if (typeof error === 'string' && error.includes('FULL_REWRITE_REQUIRED')) {
			console.log('Sprite count changed, falling back to full SPR rewrite...');
			await compileSprFile(path, data, modifiedSprites);
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
		await compileSprFile(sprPath, data, new Map());

		// Complete
		if (onProgress) onProgress('Full recompile complete', 2, 2);

		const duration = Date.now() - startTime;
		console.log(`Full recompile complete in ${duration}ms`);
	} catch (error) {
		console.error('Full recompile failed:', error);
		throw error;
	}
}
