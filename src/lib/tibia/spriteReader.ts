/**
 * Tibia Sprite (.spr) File Reader
 * Based on Object Builder's SpriteReader and Sprite classes
 */

import { Sprite, SPRITE_PIXELS, SPR_FILE_SIZES, SPRITE_DATA_SIZE, SPR_FILE_POSITIONS } from './types';

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
				rgbaPixels: new Uint8Array(4096), // Empty transparent pixels
				compressedPixels: new Uint8Array(0)
			};
		}

		// Skip the RGB color bytes (3 bytes) - these are always 0xFF, 0x00, 0xFF (magenta)
		const dataStart = address + 3;

		// Read the sprite data length (2 bytes)
		const length = readUInt16LE(this.buffer, dataStart);

		// Read the compressed pixel data
		const compressedPixels = this.buffer.slice(dataStart + 2, dataStart + 2 + length);

		// Decompress pixels for rgbaPixels
		const rgbaPixels = decompressPixels(compressedPixels, this.transparency);

		return {
			id,
			rgbaPixels,
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
		let currentChannels = channels;
		const bytesNeeded = coloredCount * currentChannels;

		if (readPos + bytesNeeded > compressedPixels.length) {
			// If we are in transparent mode (4 channels) but don't have enough data,
			// check if we have enough for 3 channels (RGB)
			if (transparent && readPos + coloredCount * 3 <= compressedPixels.length) {
				console.warn(
					`[decompressPixels] Fallback to 3 channels for sprite. Expected ${bytesNeeded} bytes, have ${compressedPixels.length - readPos}. Colored count: ${coloredCount}`
				);
				currentChannels = 3;
			} else {
				console.error(`[decompressPixels] Not enough data. Needed ${bytesNeeded}, have ${compressedPixels.length - readPos}`);
				break;
			}
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
			const alpha = currentChannels === 4 ? compressedPixels[readPos++] : 0xff;

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
 * Check if sprite pixels are completely empty (all transparent)
 *
 * @param pixels - RGBA pixel data (4096 bytes)
 * @returns True if all pixels are transparent
 */
export function isEmptyPixels(pixels: Uint8Array): boolean {
	if (pixels.length !== SPRITE_DATA_SIZE) {
		return true;
	}

	// Check alpha channel of all pixels (alpha is at position 3 in RGBA)
	for (let i = 0; i < SPRITE_PIXELS; i++) {
		if (pixels[i * 4 + 3] !== 0) {
			return false;
		}
	}

	return true;
}
