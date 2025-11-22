/**
 * Tibia Metadata (.dat) File Reader
 * Based on Object Builder's MetadataReader classes
 */

import {
  ThingType,
  ThingCategory,
  FrameDuration,
  DAT_FILE_POSITIONS,
  SPRITE_SIZE,
  createThingType,
  ClientVersion,
} from './types';

/**
 * Metadata flags for client versions 7.80 - 8.54 (MetadataFlags4)
 */
const MetadataFlags4 = {
  GROUND: 0x00,
  GROUND_BORDER: 0x01,
  ON_BOTTOM: 0x02,
  ON_TOP: 0x03,
  CONTAINER: 0x04,
  STACKABLE: 0x05,
  FORCE_USE: 0x06,
  MULTI_USE: 0x07,
  HAS_CHARGES: 0x08,
  WRITABLE: 0x09,
  WRITABLE_ONCE: 0x0a,
  FLUID_CONTAINER: 0x0b,
  FLUID: 0x0c,
  UNPASSABLE: 0x0d,
  UNMOVEABLE: 0x0e,
  BLOCK_MISSILE: 0x0f,
  BLOCK_PATHFIND: 0x10,
  PICKUPABLE: 0x11,
  HANGABLE: 0x12,
  VERTICAL: 0x13,
  HORIZONTAL: 0x14,
  ROTATABLE: 0x15,
  HAS_LIGHT: 0x16,
  DONT_HIDE: 0x17,
  FLOOR_CHANGE: 0x18,
  HAS_OFFSET: 0x19,
  HAS_ELEVATION: 0x1a,
  LYING_OBJECT: 0x1b,
  ANIMATE_ALWAYS: 0x1c,
  MINI_MAP: 0x1d,
  LENS_HELP: 0x1e,
  FULL_GROUND: 0x1f,
  IGNORE_LOOK: 0x20,
  LAST_FLAG: 0xff,
} as const;

/**
 * Metadata flags for client versions 8.60 - 9.86 (MetadataFlags5)
 */
const MetadataFlags5 = {
  GROUND: 0x00,
  GROUND_BORDER: 0x01,
  ON_BOTTOM: 0x02,
  ON_TOP: 0x03,
  CONTAINER: 0x04,
  STACKABLE: 0x05,
  FORCE_USE: 0x06,
  MULTI_USE: 0x07,
  WRITABLE: 0x08,
  WRITABLE_ONCE: 0x09,
  FLUID_CONTAINER: 0x0a,
  FLUID: 0x0b,
  UNPASSABLE: 0x0c,
  UNMOVEABLE: 0x0d,
  BLOCK_MISSILE: 0x0e,
  BLOCK_PATHFIND: 0x0f,
  PICKUPABLE: 0x10,
  HANGABLE: 0x11,
  VERTICAL: 0x12,
  HORIZONTAL: 0x13,
  ROTATABLE: 0x14,
  HAS_LIGHT: 0x15,
  DONT_HIDE: 0x16,
  TRANSLUCENT: 0x17,
  HAS_OFFSET: 0x18,
  HAS_ELEVATION: 0x19,
  LYING_OBJECT: 0x1a,
  ANIMATE_ALWAYS: 0x1b,
  MINI_MAP: 0x1c,
  LENS_HELP: 0x1d,
  FULL_GROUND: 0x1e,
  IGNORE_LOOK: 0x1f,
  CLOTH: 0x20,
  MARKET_ITEM: 0x21,
  LAST_FLAG: 0xff,
} as const;

/**
 * Metadata flags for client versions 10.10 - 10.56 (MetadataFlags6)
 */
const MetadataFlags6 = {
  GROUND: 0x00,
  GROUND_BORDER: 0x01,
  ON_BOTTOM: 0x02,
  ON_TOP: 0x03,
  CONTAINER: 0x04,
  STACKABLE: 0x05,
  FORCE_USE: 0x06,
  MULTI_USE: 0x07,
  WRITABLE: 0x08,
  WRITABLE_ONCE: 0x09,
  FLUID_CONTAINER: 0x0a,
  FLUID: 0x0b,
  UNPASSABLE: 0x0c,
  UNMOVEABLE: 0x0d,
  BLOCK_MISSILE: 0x0e,
  BLOCK_PATHFIND: 0x0f,
  NO_MOVE_ANIMATION: 0x10,
  PICKUPABLE: 0x11,
  HANGABLE: 0x12,
  VERTICAL: 0x13,
  HORIZONTAL: 0x14,
  ROTATABLE: 0x15,
  HAS_LIGHT: 0x16,
  DONT_HIDE: 0x17,
  TRANSLUCENT: 0x18,
  HAS_OFFSET: 0x19,
  HAS_ELEVATION: 0x1a,
  LYING_OBJECT: 0x1b,
  ANIMATE_ALWAYS: 0x1c,
  MINI_MAP: 0x1d,
  LENS_HELP: 0x1e,
  FULL_GROUND: 0x1f,
  IGNORE_LOOK: 0x20,
  CLOTH: 0x21,
  MARKET_ITEM: 0x22,
  DEFAULT_ACTION: 0x23,
  USABLE: 0xfe,
  LAST_FLAG: 0xff,
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

  constructor(buffer: Uint8Array | ArrayBuffer, extended: boolean, frameDurations: boolean, version?: ClientVersion) {
    this.reader = new BinaryReader(buffer);
    this.extended = extended;
    this.frameDurations = frameDurations;
    this.metadataFlags = getMetadataFlags(version);
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
    let previousFlag = 0;
    const MetadataFlags = this.metadataFlags;

    while (flag < MetadataFlags.LAST_FLAG) {
      previousFlag = flag;
      flag = this.reader.readUInt8();

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

        default:
          throw new Error(
            `Unknown flag 0x${flag.toString(16)} after 0x${previousFlag.toString(16)} for ${thing.category} id ${thing.id}`
          );
      }
    }

    return true;
  }

  /**
   * Read texture patterns (sprite layout information)
   */
  readTexturePatterns(thing: ThingType): boolean {
    thing.width = this.reader.readUInt8();
    thing.height = this.reader.readUInt8();

    if (thing.width > 1 || thing.height > 1) {
      thing.exactSize = this.reader.readUInt8();
    } else {
      thing.exactSize = SPRITE_SIZE;
    }

    thing.layers = this.reader.readUInt8();
    thing.patternX = this.reader.readUInt8();
    thing.patternY = this.reader.readUInt8();
    thing.patternZ = this.reader.readUInt8();
    thing.frames = this.reader.readUInt8();

    if (thing.frames > 1) {
      thing.isAnimation = true;
      thing.frameDurations = [];

      if (this.frameDurations) {
        thing.animationMode = this.reader.readUInt8();
        thing.loopCount = this.reader.readInt32LE();
        thing.startFrame = this.reader.readInt8();

        for (let i = 0; i < thing.frames; i++) {
          const minimum = this.reader.readUInt32LE();
          const maximum = this.reader.readUInt32LE();
          thing.frameDurations.push({ minimum, maximum });
        }
      } else {
        // Use default duration for older versions
        const defaultDuration = getDefaultFrameDuration(thing.category);
        for (let i = 0; i < thing.frames; i++) {
          thing.frameDurations.push({ minimum: defaultDuration, maximum: defaultDuration });
        }
      }
    }

    // Read sprite indices
    const totalSprites = getTotalSprites(thing);
    if (totalSprites > 4096) {
      throw new Error(`Thing ${thing.category} ${thing.id} has more than 4096 sprites`);
    }

    thing.spriteIndex = [];
    for (let i = 0; i < totalSprites; i++) {
      if (this.extended) {
        thing.spriteIndex.push(this.reader.readUInt32LE());
      } else {
        thing.spriteIndex.push(this.reader.readUInt16LE());
      }
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
 * Calculate total sprites for a thing
 */
function getTotalSprites(thing: ThingType): number {
  return (
    thing.width * thing.height * thing.patternX * thing.patternY * thing.patternZ * thing.frames * thing.layers
  );
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
  items: Map<number, ThingType>;
  itemsCount: number;
  outfits: Map<number, ThingType>;
  outfitsCount: number;
  effects: Map<number, ThingType>;
  effectsCount: number;
  missiles: Map<number, ThingType>;
  missilesCount: number;
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
      await new Promise(resolve => setTimeout(resolve, 0));
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
      await new Promise(resolve => setTimeout(resolve, 0));
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
      await new Promise(resolve => setTimeout(resolve, 0));
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
      await new Promise(resolve => setTimeout(resolve, 0));
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
    signature,
    items,
    itemsCount,
    outfits,
    outfitsCount,
    effects,
    effectsCount,
    missiles,
    missilesCount,
  };
}
