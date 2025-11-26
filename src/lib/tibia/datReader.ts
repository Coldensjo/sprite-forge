/**
 * Tibia Metadata (.dat) File Reader
 * Based on Object Builder's MetadataReader classes
 */

import { ThingType, SPRITE_SIZE, ThingCategory, ClientVersion, createThingType, DAT_FILE_POSITIONS } from './types';

/**
 * Metadata flags for client versions 7.80 - 8.54 (MetadataFlags4)
 */
const MetadataFlags4 = {
	FLUID: 0x0c,
	GROUND: 0x00,
	ON_TOP: 0x03,
	WRITABLE: 0x09,
	HANGABLE: 0x12,
	VERTICAL: 0x13,
	MINI_MAP: 0x1d,
	ON_BOTTOM: 0x02,
	CONTAINER: 0x04,
	STACKABLE: 0x05,
	FORCE_USE: 0x06,
	MULTI_USE: 0x07,
	ROTATABLE: 0x15,
	HAS_LIGHT: 0x16,
	DONT_HIDE: 0x17,
	LENS_HELP: 0x1e,
	LAST_FLAG: 0xff,
	UNPASSABLE: 0x0d,
	UNMOVEABLE: 0x0e,
	PICKUPABLE: 0x11,
	HORIZONTAL: 0x14,
	HAS_OFFSET: 0x19,
	HAS_CHARGES: 0x08,
	FULL_GROUND: 0x1f,
	IGNORE_LOOK: 0x20,
	FLOOR_CHANGE: 0x18,
	LYING_OBJECT: 0x1b,
	GROUND_BORDER: 0x01,
	WRITABLE_ONCE: 0x0a,
	BLOCK_MISSILE: 0x0f,
	HAS_ELEVATION: 0x1a,
	BLOCK_PATHFIND: 0x10,
	ANIMATE_ALWAYS: 0x1c,
	FLUID_CONTAINER: 0x0b
} as const;

/**
 * Metadata flags for client versions 8.60 - 9.86 (MetadataFlags5)
 */
const MetadataFlags5 = {
	FLUID: 0x0b,
	CLOTH: 0x20,
	GROUND: 0x00,
	ON_TOP: 0x03,
	WRITABLE: 0x08,
	HANGABLE: 0x11,
	VERTICAL: 0x12,
	MINI_MAP: 0x1c,
	ON_BOTTOM: 0x02,
	CONTAINER: 0x04,
	STACKABLE: 0x05,
	FORCE_USE: 0x06,
	MULTI_USE: 0x07,
	ROTATABLE: 0x14,
	HAS_LIGHT: 0x15,
	DONT_HIDE: 0x16,
	LENS_HELP: 0x1d,
	LAST_FLAG: 0xff,
	UNPASSABLE: 0x0c,
	UNMOVEABLE: 0x0d,
	PICKUPABLE: 0x10,
	HORIZONTAL: 0x13,
	HAS_OFFSET: 0x18,
	TRANSLUCENT: 0x17,
	FULL_GROUND: 0x1e,
	IGNORE_LOOK: 0x1f,
	MARKET_ITEM: 0x21,
	LYING_OBJECT: 0x1a,
	GROUND_BORDER: 0x01,
	WRITABLE_ONCE: 0x09,
	BLOCK_MISSILE: 0x0e,
	HAS_ELEVATION: 0x19,
	BLOCK_PATHFIND: 0x0f,
	ANIMATE_ALWAYS: 0x1b,
	FLUID_CONTAINER: 0x0a
} as const;

/**
 * Metadata flags for client versions 10.10 - 10.56 (MetadataFlags6)
 */
const MetadataFlags6 = {
	FLUID: 0x0b,
	CLOTH: 0x21,
	GROUND: 0x00,
	ON_TOP: 0x03,
	USABLE: 0xfe,
	EXPIRE: 0x2a,
	PODIUM: 0x2c,
	WRITABLE: 0x08,
	HANGABLE: 0x12,
	VERTICAL: 0x13,
	MINI_MAP: 0x1d,
	WEAR_OUT: 0x28,
	DECO_KIT: 0x2d,
	ON_BOTTOM: 0x02,
	CONTAINER: 0x04,
	STACKABLE: 0x05,
	FORCE_USE: 0x06,
	MULTI_USE: 0x07,
	ROTATABLE: 0x15,
	HAS_LIGHT: 0x16,
	DONT_HIDE: 0x17,
	LENS_HELP: 0x1e,
	LAST_FLAG: 0xff,
	WRAPPABLE: 0x24,
	UNPASSABLE: 0x0c,
	UNMOVEABLE: 0x0d,
	PICKUPABLE: 0x11,
	HORIZONTAL: 0x14,
	HAS_OFFSET: 0x19,
	TOP_EFFECT: 0x26,
	EXPIRE_STOP: 0x2b,
	TRANSLUCENT: 0x18,
	FULL_GROUND: 0x1f,
	IGNORE_LOOK: 0x20,
	MARKET_ITEM: 0x22,
	UNWRAPPABLE: 0x25,
	CLOCK_EXPIRE: 0x29,
	LYING_OBJECT: 0x1b,
	GROUND_BORDER: 0x01,
	WRITABLE_ONCE: 0x09,
	BLOCK_MISSILE: 0x0e,
	HAS_ELEVATION: 0x1a,
	BLOCK_PATHFIND: 0x0f,
	ANIMATE_ALWAYS: 0x1c,
	DEFAULT_ACTION: 0x23,
	FLUID_CONTAINER: 0x0a,
	NO_MOVE_ANIMATION: 0x10,
	UPGRADE_CLASSIFICATION: 0x27
} as const;

/**
 * Helper class to read binary data from a buffer
 */
class BinaryReader {
	private buffer: Uint8Array;
	private position: number = 0;

	constructor(buffer: Uint8Array | ArrayBuffer) {
		this.buffer = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
	}

	setPosition(pos: number): void {
		this.position = pos;
	}

	getPosition(): number {
		return this.position;
	}

	readUInt8(): number {
		return this.buffer[this.position++];
	}

	readUInt16LE(): number {
		const value = this.buffer[this.position] | (this.buffer[this.position + 1] << 8);
		this.position += 2;
		return value;
	}

	readUInt32LE(): number {
		const value =
			(this.buffer[this.position] |
				(this.buffer[this.position + 1] << 8) |
				(this.buffer[this.position + 2] << 16) |
				(this.buffer[this.position + 3] << 24)) >>>
			0;
		this.position += 4;
		return value;
	}

	readInt8(): number {
		const value = this.buffer[this.position++];
		return value > 127 ? value - 256 : value;
	}

	readInt32LE(): number {
		const value =
			this.buffer[this.position] |
			(this.buffer[this.position + 1] << 8) |
			(this.buffer[this.position + 2] << 16) |
			(this.buffer[this.position + 3] << 24);
		this.position += 4;
		return value;
	}

	readString(length: number): string {
		const bytes = this.buffer.slice(this.position, this.position + length);
		this.position += length;

		// Decode as Latin-1 (ISO-8859-1)
		let str = '';
		for (let i = 0; i < bytes.length; i++) {
			str += String.fromCharCode(bytes[i]);
		}
		return str;
	}

	get bytesAvailable(): number {
		return this.buffer.length - this.position;
	}
}

/**
 * Get metadata flags based on client version
 * Based on Object Builder's version-to-reader mapping
 */
function getMetadataFlags(version?: ClientVersion) {
	if (!version) return MetadataFlags6;

	// Version 7.80 - 8.54: MetadataFlags4 (MetadataReader4 in Object Builder)
	if (version.value >= 780 && version.value <= 854) {
		return MetadataFlags4;
	}

	// Version 8.60 - 9.86: MetadataFlags5 (MetadataReader5 in Object Builder)
	if (version.value >= 860 && version.value <= 986) {
		return MetadataFlags5;
	}

	// Version 10.10+: MetadataFlags6 (MetadataReader6 in Object Builder)
	return MetadataFlags6;
}

/**
 * DAT File Reader
 */
export class DatReader {
	private reader: BinaryReader;
	private extended: boolean;
	private frameDurations: boolean;
	private metadataFlags: typeof MetadataFlags4 | typeof MetadataFlags5 | typeof MetadataFlags6;
	private version: number;

	constructor(buffer: Uint8Array | ArrayBuffer, extended: boolean, frameDurations: boolean, version?: ClientVersion) {
		this.reader = new BinaryReader(buffer);
		this.extended = extended;
		this.frameDurations = frameDurations;
		this.metadataFlags = getMetadataFlags(version);
		this.version = version?.value ?? 1098; // Default to 10.98
	}

	/**
	 * Read file signature
	 */
	readSignature(): number {
		this.reader.setPosition(DAT_FILE_POSITIONS.SIGNATURE);
		return this.reader.readUInt32LE();
	}

	/**
	 * Read items count
	 */
	readItemsCount(): number {
		this.reader.setPosition(DAT_FILE_POSITIONS.ITEMS_COUNT);
		return this.reader.readUInt16LE();
	}

	/**
	 * Read outfits count
	 */
	readOutfitsCount(): number {
		this.reader.setPosition(DAT_FILE_POSITIONS.OUTFITS_COUNT);
		return this.reader.readUInt16LE();
	}

	/**
	 * Read effects count
	 */
	readEffectsCount(): number {
		this.reader.setPosition(DAT_FILE_POSITIONS.EFFECTS_COUNT);
		return this.reader.readUInt16LE();
	}

	/**
	 * Read missiles count
	 */
	readMissilesCount(): number {
		this.reader.setPosition(DAT_FILE_POSITIONS.MISSILES_COUNT);
		return this.reader.readUInt16LE();
	}

	/**
	 * Read thing properties from the current position
	 */
	readProperties(thing: ThingType): boolean {
		let flag = 0;

		const MetadataFlags = this.metadataFlags;

		while (flag < MetadataFlags.LAST_FLAG) {
			flag = this.reader.readUInt8();
			const origFlag = flag; // Keep for error reporting

			if (flag === MetadataFlags.LAST_FLAG) {
				return true;
			}

			switch (flag) {
				case MetadataFlags.GROUND:
					thing.isGround = true;
					thing.groundSpeed = this.reader.readUInt16LE();
					break;

				case MetadataFlags.GROUND_BORDER:
					thing.isGroundBorder = true;
					break;

				case MetadataFlags.ON_BOTTOM:
					thing.isOnBottom = true;
					break;

				case MetadataFlags.ON_TOP:
					thing.isOnTop = true;
					break;

				case MetadataFlags.CONTAINER:
					thing.isContainer = true;
					break;

				case MetadataFlags.STACKABLE:
					thing.stackable = true;
					break;

				case MetadataFlags.FORCE_USE:
					thing.forceUse = true;
					break;

				case MetadataFlags.MULTI_USE:
					thing.multiUse = true;
					break;

				case (MetadataFlags as typeof MetadataFlags4).HAS_CHARGES:
					if ('HAS_CHARGES' in MetadataFlags) {
						thing.hasCharges = true;
					}
					break;

				case MetadataFlags.WRITABLE:
					thing.writable = true;
					thing.maxTextLength = this.reader.readUInt16LE();
					break;

				case MetadataFlags.WRITABLE_ONCE:
					thing.writableOnce = true;
					thing.maxTextLength = this.reader.readUInt16LE();
					break;

				case MetadataFlags.FLUID_CONTAINER:
					thing.isFluidContainer = true;
					break;

				case MetadataFlags.FLUID:
					thing.isFluid = true;
					break;

				case MetadataFlags.UNPASSABLE:
					thing.isUnpassable = true;
					break;

				case MetadataFlags.UNMOVEABLE:
					thing.isUnmoveable = true;
					break;

				case MetadataFlags.BLOCK_MISSILE:
					thing.blockMissile = true;
					break;

				case MetadataFlags.BLOCK_PATHFIND:
					thing.blockPathfind = true;
					break;

				case (MetadataFlags as typeof MetadataFlags6).NO_MOVE_ANIMATION:
					if ('NO_MOVE_ANIMATION' in MetadataFlags) {
						thing.noMoveAnimation = true;
					}
					break;

				case MetadataFlags.PICKUPABLE:
					thing.pickupable = true;
					break;

				case MetadataFlags.HANGABLE:
					thing.hangable = true;
					break;

				case MetadataFlags.VERTICAL:
					thing.isVertical = true;
					break;

				case MetadataFlags.HORIZONTAL:
					thing.isHorizontal = true;
					break;

				case MetadataFlags.ROTATABLE:
					thing.rotatable = true;
					break;

				case MetadataFlags.HAS_LIGHT:
					thing.hasLight = true;
					thing.lightLevel = this.reader.readUInt16LE();
					thing.lightColor = this.reader.readUInt16LE();
					break;

				case MetadataFlags.DONT_HIDE:
					thing.dontHide = true;
					break;

				case (MetadataFlags as typeof MetadataFlags4).FLOOR_CHANGE:
					if ('FLOOR_CHANGE' in MetadataFlags) {
						thing.floorChange = true;
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).TRANSLUCENT:
					if ('TRANSLUCENT' in MetadataFlags) {
						thing.isTranslucent = true;
					}
					break;

				case MetadataFlags.HAS_OFFSET:
					thing.hasOffset = true;
					thing.offsetX = this.reader.readUInt16LE();
					thing.offsetY = this.reader.readUInt16LE();
					break;

				case MetadataFlags.HAS_ELEVATION:
					thing.hasElevation = true;
					thing.elevation = this.reader.readUInt16LE();
					break;

				case MetadataFlags.LYING_OBJECT:
					thing.isLyingObject = true;
					break;

				case MetadataFlags.ANIMATE_ALWAYS:
					thing.animateAlways = true;
					break;

				case MetadataFlags.MINI_MAP:
					thing.miniMap = true;
					thing.miniMapColor = this.reader.readUInt16LE();
					break;

				case MetadataFlags.LENS_HELP:
					thing.isLensHelp = true;
					thing.lensHelp = this.reader.readUInt16LE();
					break;

				case MetadataFlags.FULL_GROUND:
					thing.isFullGround = true;
					break;

				case MetadataFlags.IGNORE_LOOK:
					thing.ignoreLook = true;
					break;

				case (MetadataFlags as typeof MetadataFlags6).CLOTH:
					if ('CLOTH' in MetadataFlags) {
						thing.cloth = true;
						thing.clothSlot = this.reader.readUInt16LE();
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).MARKET_ITEM:
					if ('MARKET_ITEM' in MetadataFlags) {
						thing.isMarketItem = true;
						thing.marketCategory = this.reader.readUInt16LE();
						thing.marketTradeAs = this.reader.readUInt16LE();
						thing.marketShowAs = this.reader.readUInt16LE();
						const nameLength = this.reader.readUInt16LE();
						thing.marketName = this.reader.readString(nameLength);
						thing.marketRestrictProfession = this.reader.readUInt16LE();
						thing.marketRestrictLevel = this.reader.readUInt16LE();
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).DEFAULT_ACTION:
					if ('DEFAULT_ACTION' in MetadataFlags) {
						thing.hasDefaultAction = true;
						thing.defaultAction = this.reader.readUInt16LE();
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).USABLE:
					if ('USABLE' in MetadataFlags) {
						thing.usable = true;
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).WRAPPABLE:
					if ('WRAPPABLE' in MetadataFlags) {
						thing.wrappable = true;
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).UNWRAPPABLE:
					if ('UNWRAPPABLE' in MetadataFlags) {
						thing.unwrappable = true;
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).TOP_EFFECT:
					if ('TOP_EFFECT' in MetadataFlags) {
						thing.topEffect = true;
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).UPGRADE_CLASSIFICATION:
					if ('UPGRADE_CLASSIFICATION' in MetadataFlags) {
						thing.upgradeClassification = this.reader.readUInt16LE();
					}
					break;

				case (MetadataFlags as typeof MetadataFlags6).WEAR_OUT:
				case (MetadataFlags as typeof MetadataFlags6).CLOCK_EXPIRE:
				case (MetadataFlags as typeof MetadataFlags6).EXPIRE:
				case (MetadataFlags as typeof MetadataFlags6).EXPIRE_STOP:
				case (MetadataFlags as typeof MetadataFlags6).PODIUM:
				case (MetadataFlags as typeof MetadataFlags6).DECO_KIT:
					// Boolean flags not stored in ThingType yet
					break;

				default:
					// Unknown flag - log as warning but don't throw
					// OTClient silently ignores unknown flags (they're treated as boolean flags with no data)
					if (!thing.unknownFlags) {
						thing.unknownFlags = [];
					}
					thing.unknownFlags.push({ orig: origFlag, remapped: flag });
					console.warn(
						`Unknown flag 0x${flag.toString(16)} (orig: 0x${origFlag.toString(16)}) for ${thing.category} id ${thing.id}`
					);
					break;
			}
		}

		return true;
	}

	/**
	 * Read texture patterns (sprite layout information)
	 * For outfits in version 10.57+, this uses frame groups
	 */
	readTexturePatterns(thing: ThingType): boolean {
		// Check if this is an outfit with frame groups (idle animations)
		// Frame groups were introduced in version 10.57 (1057)
		const hasFrameGroups = thing.category === ThingCategory.OUTFIT && this.version >= 1057;
		const groupCount = hasFrameGroups ? this.reader.readUInt8() : 1;

		let totalSpritesCount = 0;

		for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
			// Read frame group type if this outfit has frame groups
			if (hasFrameGroups) {
				const frameGroupType = this.reader.readUInt8();
				// Store frame group type for later use (0 = idle, 1 = moving)
				if (!thing.frameGroups) {
					thing.frameGroups = [];
				}
				thing.frameGroups.push(frameGroupType);
			}

			// Read dimensions
			const width = this.reader.readUInt8();
			const height = this.reader.readUInt8();

			if (width === undefined || height === undefined) {
				throw new Error(`EOF reached while reading texture patterns for ${thing.category} ${thing.id}`);
			}

			let exactSize = SPRITE_SIZE;
			if (width > 1 || height > 1) {
				exactSize = this.reader.readUInt8();
			} else {
				exactSize = SPRITE_SIZE;
			}

			const layers = this.reader.readUInt8();
			const patternX = this.reader.readUInt8();
			const patternY = this.reader.readUInt8();
			const patternZ = this.reader.readUInt8();
			const frames = this.reader.readUInt8();

			// Only update thing properties if this is the first group (Idle)
			// This ensures we have consistent data for the first group, which is what Rust writes
			if (groupIndex === 0) {
				thing.width = width;
				thing.height = height;
				thing.exactSize = exactSize;
				thing.layers = layers;
				thing.patternX = patternX;
				thing.patternY = patternY;
				thing.patternZ = patternZ;
				thing.frames = frames;
			}

			if (frames > 1) {
				if (groupIndex === 0) {
					thing.isAnimation = true;
					thing.frameDurations = [];
				}

				if (this.frameDurations) {
					const animationMode = this.reader.readUInt8();
					const loopCount = this.reader.readInt32LE();
					const startFrame = this.reader.readInt8();

					if (groupIndex === 0) {
						thing.animationMode = animationMode;
						thing.loopCount = loopCount;
						thing.startFrame = startFrame;
					}

					for (let i = 0; i < frames; i++) {
						const minimum = this.reader.readUInt32LE();
						const maximum = this.reader.readUInt32LE();
						if (groupIndex === 0) {
							thing.frameDurations.push({ minimum, maximum });
						}
					}
				} else {
					// Use default duration for older versions
					if (groupIndex === 0) {
						const defaultDuration = getDefaultFrameDuration(thing.category);
						for (let i = 0; i < frames; i++) {
							thing.frameDurations.push({ minimum: defaultDuration, maximum: defaultDuration });
						}
					}
				}
			}

			// Calculate sprites for this group
			const groupTotalSprites = width * height * layers * patternX * patternY * patternZ * frames;

			if (totalSpritesCount + groupTotalSprites > 4096) {
				console.error(
					`${thing.category} ${thing.id} dimensions: width=${width}, height=${height}, layers=${layers}, ` +
						`patternX=${patternX}, patternY=${patternY}, patternZ=${patternZ}, frames=${frames}, ` +
						`groupTotal=${groupTotalSprites}, total=${totalSpritesCount + groupTotalSprites}`
				);
				if (thing.unknownFlags && thing.unknownFlags.length > 0) {
					console.error(`${thing.category} ${thing.id} had unknown flags:`, thing.unknownFlags);
				}
				throw new Error(`Thing ${thing.category} ${thing.id} has more than 4096 sprites`);
			}

			// Initialize sprite index array if this is the first group
			if (!thing.spriteIndex) {
				thing.spriteIndex = [];
			}

			// Read sprite IDs for this group
			// Object Builder uses extended (32-bit) sprite IDs when extended flag is set
			// even for outfits with frame groups
			const useExtendedSpriteIds = this.extended;

			for (let i = 0; i < groupTotalSprites; i++) {
				let spriteId: number;
				if (useExtendedSpriteIds) {
					spriteId = this.reader.readUInt32LE();
				} else {
					spriteId = this.reader.readUInt16LE();
				}

				// Only add sprites if this is the first group
				if (groupIndex === 0) {
					thing.spriteIndex.push(spriteId);
				}
			}

			totalSpritesCount += groupTotalSprites;
		}

		return true;
	}

	/**
	 * Read a complete thing type
	 */
	readThingType(id: number, category: ThingCategory): ThingType {
		const thing = createThingType(id, category);
		this.readProperties(thing);
		this.readTexturePatterns(thing);
		return thing;
	}

	/**
	 * Get current read position
	 */
	getPosition(): number {
		return this.reader.getPosition();
	}

	/**
	 * Set read position
	 */
	setPosition(pos: number): void {
		this.reader.setPosition(pos);
	}

	/**
	 * Get bytes available
	 */
	get bytesAvailable(): number {
		return this.reader.bytesAvailable;
	}
}

/**
 * Get default frame duration based on category
 */
function getDefaultFrameDuration(category: ThingCategory): number {
	// Default animation durations (in milliseconds)
	switch (category) {
		case ThingCategory.OUTFIT:
			return 300;
		case ThingCategory.EFFECT:
			return 75;
		case ThingCategory.MISSILE:
			return 150;
		default:
			return 500;
	}
}

/**
 * Load complete Tibia metadata file (async with batched processing)
 */
export async function loadDatFile(
	buffer: Uint8Array | ArrayBuffer,
	extended: boolean,
	frameDurations: boolean,
	onProgress?: (current: number, total: number) => void,
	version?: ClientVersion
): Promise<{
	signature: number;
	itemsCount: number;
	outfitsCount: number;
	effectsCount: number;
	missilesCount: number;
	items: Map<number, ThingType>;
	outfits: Map<number, ThingType>;
	effects: Map<number, ThingType>;
	missiles: Map<number, ThingType>;
}> {
	const reader = new DatReader(buffer, extended, frameDurations, version);

	// Read counts
	const signature = reader.readSignature();
	const itemsCount = reader.readItemsCount();
	const outfitsCount = reader.readOutfitsCount();
	const effectsCount = reader.readEffectsCount();
	const missilesCount = reader.readMissilesCount();

	const totalThings = itemsCount + outfitsCount + effectsCount + missilesCount;
	let currentThing = 0;

	// Batch size for yielding to event loop
	const BATCH_SIZE = 250;
	const PROGRESS_UPDATE_INTERVAL = 50;

	// Position reader after header
	reader.setPosition(12);

	// Load items (start from ID 100)
	const items = new Map<number, ThingType>();
	for (let id = 100; id <= itemsCount; id++) {
		items.set(id, reader.readThingType(id, ThingCategory.ITEM));
		currentThing++;

		// Yield to event loop every BATCH_SIZE items
		if (currentThing % BATCH_SIZE === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		// Update progress every PROGRESS_UPDATE_INTERVAL items
		if (onProgress && currentThing % PROGRESS_UPDATE_INTERVAL === 0) {
			onProgress(currentThing, totalThings);
		}
	}

	// Load outfits (start from ID 1)
	const outfits = new Map<number, ThingType>();
	for (let id = 1; id <= outfitsCount; id++) {
		outfits.set(id, reader.readThingType(id, ThingCategory.OUTFIT));
		currentThing++;

		if (currentThing % BATCH_SIZE === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		if (onProgress && currentThing % PROGRESS_UPDATE_INTERVAL === 0) {
			onProgress(currentThing, totalThings);
		}
	}

	// Load effects (start from ID 1)
	const effects = new Map<number, ThingType>();
	for (let id = 1; id <= effectsCount; id++) {
		effects.set(id, reader.readThingType(id, ThingCategory.EFFECT));
		currentThing++;

		if (currentThing % BATCH_SIZE === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		if (onProgress && currentThing % PROGRESS_UPDATE_INTERVAL === 0) {
			onProgress(currentThing, totalThings);
		}
	}

	// Load missiles (start from ID 1)
	const missiles = new Map<number, ThingType>();
	for (let id = 1; id <= missilesCount; id++) {
		missiles.set(id, reader.readThingType(id, ThingCategory.MISSILE));
		currentThing++;

		if (currentThing % BATCH_SIZE === 0) {
			await new Promise((resolve) => setTimeout(resolve, 0));
		}

		if (onProgress && currentThing % PROGRESS_UPDATE_INTERVAL === 0) {
			onProgress(currentThing, totalThings);
		}
	}

	// Final progress update
	if (onProgress) {
		onProgress(totalThings, totalThings);
	}

	return {
		items,
		outfits,
		effects,
		missiles,
		signature,
		itemsCount,
		outfitsCount,
		effectsCount,
		missilesCount
	};
}
