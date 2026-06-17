import { Sprite, SPRITE_PIXELS, SPR_FILE_SIZES, SPRITE_DATA_SIZE, SPR_FILE_POSITIONS } from './types';

function readUInt32LE(buffer: Uint8Array, offset: number): number {
	return (buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16) | (buffer[offset + 3] << 24)) >>> 0;
}

function readUInt16LE(buffer: Uint8Array, offset: number): number {
	return buffer[offset] | (buffer[offset + 1] << 8);
}

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

	readSignature(): number {
		this.signature = readUInt32LE(this.buffer, SPR_FILE_POSITIONS.SIGNATURE);
		return this.signature;
	}

	readSpriteCount(): number {
		if (this.extended) {
			this.count = readUInt32LE(this.buffer, SPR_FILE_POSITIONS.LENGTH);
		} else {
			this.count = readUInt16LE(this.buffer, SPR_FILE_POSITIONS.LENGTH);
		}
		return this.count;
	}

	readSprite(id: number): null | Sprite {
		const addressPos = (id - 1) * SPR_FILE_SIZES.ADDRESS + this.headerSize;

		const address = readUInt32LE(this.buffer, addressPos);

		if (address === 0) {
			return {
				id,
				isEmpty: true,
				transparent: this.transparency,
				rgbaPixels: new Uint8Array(4096),
				compressedPixels: new Uint8Array(0)
			};
		}

		const dataStart = address + 3;

		const length = readUInt16LE(this.buffer, dataStart);

		const compressedPixels = this.buffer.slice(dataStart + 2, dataStart + 2 + length);

		const rgbaPixels = decompressPixels(compressedPixels, this.transparency);

		return {
			id,
			rgbaPixels,
			compressedPixels,
			isEmpty: length === 0,
			transparent: this.transparency
		};
	}

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

	getAllSpriteIds(): number[] {
		const ids: number[] = [];
		for (let i = 1; i <= this.count; i++) {
			ids.push(i);
		}
		return ids;
	}

	getNonEmptySpriteIds(): number[] {
		const ids: number[] = [];
		for (let i = 1; i <= this.count; i++) {
			if (!this.isEmptySprite(i)) {
				ids.push(i);
			}
		}
		return ids;
	}

	getSpriteCount(): number {
		return this.count;
	}

	getSignature(): number {
		return this.signature;
	}
}

export function decompressPixels(compressedPixels: Uint8Array, transparent: boolean): Uint8Array {
	const pixels = new Uint8Array(SPRITE_DATA_SIZE);
	let writePos = 0;
	let readPos = 0;
	const channels = transparent ? 4 : 3;

	while (readPos + 4 <= compressedPixels.length && writePos < SPRITE_DATA_SIZE) {
		const transparentCount = readUInt16LE(compressedPixels, readPos);
		readPos += 2;

		const coloredCount = readUInt16LE(compressedPixels, readPos);
		readPos += 2;

		let currentChannels = channels;
		const bytesNeeded = coloredCount * currentChannels;

		if (readPos + bytesNeeded > compressedPixels.length) {
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

		for (let i = 0; i < transparentCount && writePos < SPRITE_DATA_SIZE; i++) {
			pixels[writePos++] = 0x00;
			pixels[writePos++] = 0x00;
			pixels[writePos++] = 0x00;
			pixels[writePos++] = 0x00;
		}

		for (let i = 0; i < coloredCount && writePos < SPRITE_DATA_SIZE; i++) {
			const red = compressedPixels[readPos++];
			const green = compressedPixels[readPos++];
			const blue = compressedPixels[readPos++];
			const alpha = currentChannels === 4 ? compressedPixels[readPos++] : 0xff;

			pixels[writePos++] = alpha;
			pixels[writePos++] = red;
			pixels[writePos++] = green;
			pixels[writePos++] = blue;
		}
	}

	while (writePos < SPRITE_DATA_SIZE) {
		pixels[writePos++] = 0x00;
		pixels[writePos++] = 0x00;
		pixels[writePos++] = 0x00;
		pixels[writePos++] = 0x00;
	}

	return pixels;
}

export function isEmptyPixels(pixels: Uint8Array): boolean {
	if (pixels.length !== SPRITE_DATA_SIZE) {
		return true;
	}

	for (let i = 0; i < SPRITE_PIXELS; i++) {
		if (pixels[i * 4 + 3] !== 0) {
			return false;
		}
	}

	return true;
}
