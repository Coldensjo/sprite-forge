/**
 * Tibia Sprite (.spr) File Reader
 * Based on Object Builder's SpriteReader and Sprite classes
 */

import { Sprite, SPRITE_SIZE, SPRITE_PIXELS, SPR_FILE_SIZES, SPRITE_DATA_SIZE, SPR_FILE_POSITIONS } from './types';

/**
 * Reads a 32-bit unsigned integer from a buffer at the given position
 */
function readUInt32LE(buffer: Uint8Array, offset: number): number {
	return (buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24)) >>> 0;
}

/**
 * Reads a 16-bit unsigned integer from a buffer at the given position
 */
function readUInt16LE(buffer: Uint8Array, offset: number): number {
	return buffer[offset] | (buffer[offset + 1] << 8);
}

/**
 * Sprite Reader for .spr files
 */
export class SpriteReader {
	private buffer: Uint8Array;
	private extended: boolean;
	private transparency: boolean;
	private headerSize: number;
	private signature: number = 0;
	private count: number = 0;

	constructor(buffer: Uint8Array | ArrayBuffer, extended: boolean, transparency: boolean) {
		this.buffer = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
		this.extended = extended;
		this.transparency = transparency;
		this.headerSize = extended ? SPR_FILE_SIZES.HEADER_U32 : SPR_FILE_SIZES.HEADER_U16;
	}

	/**
	 * Read the sprite file signature
	 */
	readSignature(): number {
		this.signature = readUInt32LE(this.buffer, SPR_FILE_POSITIONS.SIGNATURE);
		return this.signature;
	}

	/**
	 * Read the sprite count from the file
	 */
	readSpriteCount(): number {
		if (this.extended) {
			this.count = readUInt32LE(this.buffer, SPR_FILE_POSITIONS.LENGTH);
		} else {
			this.count = readUInt16LE(this.buffer, SPR_FILE_POSITIONS.LENGTH);
		}
		return this.count;
	}

	/**
	 * Read a sprite by its ID
	 */
	readSprite(id: number): null | Sprite {
		// Calculate the position of the sprite address
		const addressPos = (id - 1) * SPR_FILE_SIZES.ADDRESS + this.headerSize;

		// Read the address where the sprite data is stored
		const address = readUInt32LE(this.buffer, addressPos);

		// If address is 0, the sprite is empty
		if (address === 0) {
			return {
				id,
				isEmpty: true,
				transparent: this.transparency,
				compressedPixels: new Uint8Array(0)
			};
		}

		// Skip the RGB color bytes (3 bytes) - these are always 0xFF, 0x00, 0xFF (magenta)
		const dataStart = address + 3;

		// Read the sprite data length (2 bytes)
		const length = readUInt16LE(this.buffer, dataStart);

		// Read the compressed pixel data
		const compressedPixels = this.buffer.slice(dataStart + 2, dataStart + 2 + length);

		return {
			id,
			compressedPixels,
			isEmpty: length === 0,
			transparent: this.transparency
		};
	}

	/**
	 * Check if a sprite is empty (has no pixel data)
	 */
	isEmptySprite(id: number): boolean {
		const addressPos = (id - 1) * SPR_FILE_SIZES.ADDRESS + this.headerSize;
		const address = readUInt32LE(this.buffer, addressPos);

		if (address === 0) {
			return true;
		}

		const dataStart = address + 3;
		const length = readUInt16LE(this.buffer, dataStart);
		return length === 0;
	}

	/**
	 * Get all sprite IDs in the file
	 */
	getAllSpriteIds(): number[] {
		const ids: number[] = [];
		for (let i = 1; i <= this.count; i++) {
			ids.push(i);
		}
		return ids;
	}

	/**
	 * Get non-empty sprite IDs
	 */
	getNonEmptySpriteIds(): number[] {
		const ids: number[] = [];
		for (let i = 1; i <= this.count; i++) {
			if (!this.isEmptySprite(i)) {
				ids.push(i);
			}
		}
		return ids;
	}

	/**
	 * Get sprite count
	 */
	getSpriteCount(): number {
		return this.count;
	}

	/**
	 * Get file signature
	 */
	getSignature(): number {
		return this.signature;
	}
}

/**
 * Decompress sprite pixels from Tibia's RLE-like compression format
 *
 * Format:
 * - Alternates between transparent and colored pixel chunks
 * - Each chunk has a 2-byte count
 * - Transparent pixels: just count (no data)
 * - Colored pixels: RGB or RGBA bytes follow
 */
export function decompressPixels(compressedPixels: Uint8Array, transparent: boolean): Uint8Array {
	const pixels = new Uint8Array(SPRITE_DATA_SIZE);
	let writePos = 0;
	let readPos = 0;
	const channels = transparent ? 4 : 3;

	// Fixed: Ensure we have at least 4 bytes (2 uint16 counts) before reading
	while (readPos + 4 <= compressedPixels.length && writePos < SPRITE_DATA_SIZE) {
		// Read transparent pixels count
		const transparentCount = readUInt16LE(compressedPixels, readPos);
		readPos += 2;

		// Read colored pixels count
		const coloredCount = readUInt16LE(compressedPixels, readPos);
		readPos += 2;

		// Safety check: ensure we have enough bytes for colored pixel data
		const bytesNeeded = coloredCount * channels;
		if (readPos + bytesNeeded > compressedPixels.length) {
			break;
		}

		// Write transparent pixels (ARGB = 0x00000000)
		for (let i = 0; i < transparentCount && writePos < SPRITE_DATA_SIZE; i++) {
			pixels[writePos++] = 0x00; // Alpha
			pixels[writePos++] = 0x00; // Red
			pixels[writePos++] = 0x00; // Green
			pixels[writePos++] = 0x00; // Blue
		}

		// Write colored pixels
		for (let i = 0; i < coloredCount && writePos < SPRITE_DATA_SIZE; i++) {
			const red = compressedPixels[readPos++];
			const green = compressedPixels[readPos++];
			const blue = compressedPixels[readPos++];
			const alpha = transparent ? compressedPixels[readPos++] : 0xff;

			pixels[writePos++] = alpha; // Alpha
			pixels[writePos++] = red; // Red
			pixels[writePos++] = green; // Green
			pixels[writePos++] = blue; // Blue
		}
	}

	// Fill remaining pixels with transparent black
	while (writePos < SPRITE_DATA_SIZE) {
		pixels[writePos++] = 0x00;
		pixels[writePos++] = 0x00;
		pixels[writePos++] = 0x00;
		pixels[writePos++] = 0x00;
	}

	return pixels;
}

/**
 * Compress sprite pixels to Tibia's RLE-like compression format
 */
export function compressPixels(pixels: Uint8Array, transparent: boolean): Uint8Array {
	if (pixels.length !== SPRITE_DATA_SIZE) {
		throw new Error(`Invalid sprite pixels length: ${pixels.length}, expected ${SPRITE_DATA_SIZE}`);
	}

	const compressed: number[] = [];
	let index = 0;
	const length = SPRITE_PIXELS;

	while (index < length) {
		// Count transparent pixels
		let transparentCount = 0;
		while (index < length) {
			const offset = index * 4;
			const alpha = pixels[offset];
			const red = pixels[offset + 1];
			const green = pixels[offset + 2];
			const blue = pixels[offset + 3];

			const isTransparent = alpha === 0 && red === 0 && green === 0 && blue === 0;
			if (!isTransparent) break;

			transparentCount++;
			index++;
		}

		// Write transparent count
		compressed.push(transparentCount & 0xff);
		compressed.push((transparentCount >> 8) & 0xff);

		// Save position for colored count
		const coloredCountPos = compressed.length;
		compressed.push(0); // Placeholder for colored count low byte
		compressed.push(0); // Placeholder for colored count high byte

		// Count and write colored pixels
		let coloredCount = 0;
		while (index < length) {
			const offset = index * 4;
			const alpha = pixels[offset];
			const red = pixels[offset + 1];
			const green = pixels[offset + 2];
			const blue = pixels[offset + 3];

			const isTransparent = alpha === 0 && red === 0 && green === 0 && blue === 0;
			if (isTransparent) break;

			compressed.push(red);
			compressed.push(green);
			compressed.push(blue);
			if (transparent) {
				compressed.push(alpha);
			}

			coloredCount++;
			index++;
		}

		// Update colored count
		compressed[coloredCountPos] = coloredCount & 0xff;
		compressed[coloredCountPos + 1] = (coloredCount >> 8) & 0xff;
	}

	return new Uint8Array(compressed);
}

/**
 * Check if sprite pixels are completely empty (all transparent)
 *
 * @param pixels - ARGB pixel data (4096 bytes)
 * @returns True if all pixels are transparent
 */
export function isEmptyPixels(pixels: Uint8Array): boolean {
	if (pixels.length !== SPRITE_DATA_SIZE) {
		return true;
	}

	// Check alpha channel of all pixels
	for (let i = 0; i < SPRITE_PIXELS; i++) {
		if (pixels[i * 4] !== 0) {
			return false;
		}
	}

	return true;
}

/**
 * Convert RGBA ImageData to ARGB format used by sprites
 *
 * @param imageData - Canvas ImageData (RGBA format)
 * @returns ARGB pixel data (4096 bytes)
 */
export function imageDataToARGB(imageData: ImageData): Uint8Array {
	if (imageData.width !== 32 || imageData.height !== 32) {
		throw new Error('ImageData must be 32x32 pixels');
	}

	const argb = new Uint8Array(SPRITE_DATA_SIZE);
	const rgba = imageData.data;

	for (let i = 0; i < SPRITE_PIXELS; i++) {
		const rgbaOffset = i * 4;
		const argbOffset = i * 4;

		// Convert RGBA to ARGB
		argb[argbOffset] = rgba[rgbaOffset + 3]; // A
		argb[argbOffset + 1] = rgba[rgbaOffset]; // R
		argb[argbOffset + 2] = rgba[rgbaOffset + 1]; // G
		argb[argbOffset + 3] = rgba[rgbaOffset + 2]; // B
	}

	return argb;
}

/**
 * Convert ARGB pixel data to RGBA ImageData for canvas rendering
 *
 * @param argb - ARGB pixel data (4096 bytes)
 * @returns Canvas ImageData (RGBA format)
 */
export function argbToImageData(argb: Uint8Array): ImageData {
	if (argb.length !== SPRITE_DATA_SIZE) {
		throw new Error(`Invalid ARGB data size: expected ${SPRITE_DATA_SIZE}, got ${argb.length}`);
	}

	const imageData = new ImageData(32, 32);
	const rgba = imageData.data;

	for (let i = 0; i < SPRITE_PIXELS; i++) {
		const argbOffset = i * 4;
		const rgbaOffset = i * 4;

		// Convert ARGB to RGBA
		rgba[rgbaOffset] = argb[argbOffset + 1]; // R
		rgba[rgbaOffset + 1] = argb[argbOffset + 2]; // G
		rgba[rgbaOffset + 2] = argb[argbOffset + 3]; // B
		rgba[rgbaOffset + 3] = argb[argbOffset]; // A
	}

	return imageData;
}

/**
 * Create blank ARGB pixel data (all transparent)
 *
 * @returns Blank ARGB pixel data (4096 bytes)
 */
export function createBlankPixels(): Uint8Array {
	return new Uint8Array(SPRITE_DATA_SIZE);
}

/**
 * Convert decompressed sprite pixels to an ImageData object for canvas rendering
 */
export function spriteToImageData(sprite: Sprite): ImageData {
	const pixels = sprite.pixels || decompressPixels(sprite.compressedPixels, sprite.transparent);
	const imageData = new ImageData(SPRITE_SIZE, SPRITE_SIZE);

	// Copy ARGB to RGBA format (browser standard)
	for (let i = 0; i < SPRITE_PIXELS; i++) {
		const srcOffset = i * 4;
		const alpha = pixels[srcOffset];
		const red = pixels[srcOffset + 1];
		const green = pixels[srcOffset + 2];
		const blue = pixels[srcOffset + 3];

		const dstOffset = i * 4;
		imageData.data[dstOffset] = red;
		imageData.data[dstOffset + 1] = green;
		imageData.data[dstOffset + 2] = blue;
		imageData.data[dstOffset + 3] = alpha;
	}

	return imageData;
}
