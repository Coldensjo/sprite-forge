/**
 * Tibia Data Structures
 * Based on Object Builder's ActionScript implementation
 */

// Thing Categories
export enum ThingCategory {
  ITEM = 'item',
  OUTFIT = 'outfit',
  EFFECT = 'effect',
  MISSILE = 'missile',
}

export const THING_CATEGORY_VALUES: Record<ThingCategory, number> = {
  [ThingCategory.ITEM]: 1,
  [ThingCategory.OUTFIT]: 2,
  [ThingCategory.EFFECT]: 3,
  [ThingCategory.MISSILE]: 4,
};

// Sprite Constants
export const SPRITE_SIZE = 32;
export const SPRITE_PIXELS = SPRITE_SIZE * SPRITE_SIZE; // 1024 pixels
export const SPRITE_DATA_SIZE = SPRITE_PIXELS * 4; // 4096 bytes (RGBA)

// File Positions
export const DAT_FILE_POSITIONS = {
  SIGNATURE: 0,
  ITEMS_COUNT: 4,
  OUTFITS_COUNT: 6,
  EFFECTS_COUNT: 8,
  MISSILES_COUNT: 10,
} as const;

export const SPR_FILE_POSITIONS = {
  SIGNATURE: 0,
  LENGTH: 4,
} as const;

export const SPR_FILE_SIZES = {
  HEADER_U16: 6, // 4 bytes signature + 2 bytes count
  HEADER_U32: 8, // 4 bytes signature + 4 bytes count
  ADDRESS: 4,    // 4 bytes per sprite address
} as const;

// Minimum IDs for each category
export const MIN_ITEM_ID = 100;
export const MIN_OUTFIT_ID = 1;
export const MIN_EFFECT_ID = 1;
export const MIN_MISSILE_ID = 1;

/**
 * Animation frame duration data
 */
export interface FrameDuration {
  minimum: number;
  maximum: number;
}

/**
 * Sprite data structure
 * Based on Object Builder's Sprite class with bitmap caching
 */
export interface Sprite {
  id: number;
  transparent: boolean;
  isEmpty: boolean;
  compressedPixels: Uint8Array;

  // Caching fields (like Object Builder's _bitmap field)
  pixels?: Uint8Array;        // Decompressed ARGB pixel data (4096 bytes) - cached after first decompress
  imageData?: ImageData;      // Canvas-ready ImageData - cached after first render
}

/**
 * Thing/Object type definition
 * Represents an item, outfit, effect, or missile
 */
export interface ThingType {
  id: number;
  category: ThingCategory;

  // Texture/Sprite layout
  width: number;
  height: number;
  exactSize: number;
  layers: number;
  patternX: number;
  patternY: number;
  patternZ: number;
  frames: number;
  spriteIndex: number[];

  // Ground properties
  isGround: boolean;
  groundSpeed: number;
  isGroundBorder: boolean;
  isOnBottom: boolean;
  isOnTop: boolean;

  // Container properties
  isContainer: boolean;
  stackable: boolean;
  forceUse: boolean;
  multiUse: boolean;

  // Writing properties
  writable: boolean;
  writableOnce: boolean;
  maxTextLength: number;

  // Fluid properties
  isFluidContainer: boolean;
  isFluid: boolean;

  // Movement properties
  isUnpassable: boolean;
  isUnmoveable: boolean;
  blockMissile: boolean;
  blockPathfind: boolean;
  noMoveAnimation: boolean;
  pickupable: boolean;

  // Positioning properties
  hangable: boolean;
  isVertical: boolean;
  isHorizontal: boolean;
  rotatable: boolean;

  // Light properties
  hasLight: boolean;
  lightLevel: number;
  lightColor: number;

  // Visual properties
  dontHide: boolean;
  isTranslucent: boolean;
  floorChange: boolean;

  // Offset properties
  hasOffset: boolean;
  offsetX: number;
  offsetY: number;

  // Elevation properties
  hasElevation: boolean;
  elevation: number;

  // Misc properties
  isLyingObject: boolean;
  animateAlways: boolean;
  miniMap: boolean;
  miniMapColor: number;
  isLensHelp: boolean;
  lensHelp: number;
  isFullGround: boolean;
  ignoreLook: boolean;

  // Cloth properties
  cloth: boolean;
  clothSlot: number;

  // Market properties
  isMarketItem: boolean;
  marketName: string;
  marketCategory: number;
  marketTradeAs: number;
  marketShowAs: number;
  marketRestrictProfession: number;
  marketRestrictLevel: number;

  // Action properties
  hasDefaultAction: boolean;
  defaultAction: number;
  wrappable: boolean;
  unwrappable: boolean;
  topEffect: boolean;
  usable: boolean;
  hasCharges: boolean;

  // Animation properties
  isAnimation: boolean;
  animationMode: number;
  loopCount: number;
  startFrame: number;
  frameDurations: FrameDuration[];
}

export enum MarketCategory {
  Armors = 1,
  Amulets = 2,
  Boots = 3,
  Containers = 4,
  Decoration = 5,
  Food = 6,
  Helmets_Hats = 7,
  Legs = 8,
  Others = 9,
  Potions = 10,
  Rings = 11,
  Runes = 12,
  Shields = 13,
  Tools = 14,
  Valuables = 15,
  Ammunition = 16,
  Axes = 17,
  Clubs = 18,
  Distance = 19,
  Swords = 20,
  Wands_Rods = 21,
  Premium_Scrolls = 22,
  Tibia_Coins = 23,
  Creature_Products = 24,
}

/**
 * Client version information
 */
export interface ClientVersion {
  value: number;
  label: string;
  datSignature: number;
  sprSignature: number;
  supportsExtended: boolean;
  supportsFrameDurations: boolean;
  supportsAlphaChannel: boolean; // RGBA (4 bytes) vs RGB (3 bytes) per pixel
}

/**
 * Loaded Tibia client data
 */
export interface TibiaData {
  version: ClientVersion;
  extended: boolean;
  transparency: boolean;

  // Sprites
  sprites: Map<number, Sprite>;
  spritesCount: number;
  sprPath?: string; // Path to SPR file for streaming from Rust

  // Things
  items: Map<number, ThingType>;
  itemsCount: number;
  outfits: Map<number, ThingType>;
  outfitsCount: number;
  effects: Map<number, ThingType>;
  effectsCount: number;
  missiles: Map<number, ThingType>;
  missilesCount: number;
}

/**
 * Check if a sprite ID is valid
 * Valid sprite IDs are from 1 to spritesCount (inclusive)
 * Sprite ID 0 is always invalid (sprites start at 1)
 */
export function isValidSpriteId(spriteId: number, spritesCount?: number): boolean {
  if (spriteId <= 0) return false;
  if (spritesCount !== undefined && spriteId > spritesCount) return false;
  return true;
}

/**
 * Calculate texture index for pattern/frame/layer combination
 * Based on Object Builder's ThingType.getTextureIndex() (ThingType.as lines 146-154)
 *
 * A "texture" is one complete pattern variant (width × height sprites)
 * This calculates which texture in the sprite sheet grid
 *
 * Formula: ((((frame % frames) * patternZ + pz) * patternY + py) *
 *           patternX + px) * layers + layer
 *
 * @param thing - The ThingType containing sprite layout information
 * @param layer - Layer index (0 to thing.layers-1)
 * @param patternX - Pattern X index (0 to thing.patternX-1)
 * @param patternY - Pattern Y index (0 to thing.patternY-1)
 * @param patternZ - Pattern Z index (0 to thing.patternZ-1)
 * @param frame - Frame index (0 to thing.frames-1)
 * @returns Texture index for calculating grid position
 */
export function getTextureIndex(
  thing: ThingType,
  layer: number,
  patternX: number,
  patternY: number,
  patternZ: number,
  frame: number
): number {
  return ((((frame % thing.frames) *
    thing.patternZ + patternZ) *
    thing.patternY + patternY) *
    thing.patternX + patternX) *
    thing.layers + layer;
}

/**
 * Calculate sprite index within spriteIndex array based on pattern/frame/layer
 * Based on Object Builder's ThingType.getSpriteIndex() (ThingType.as lines 156-171)
 *
 * Formula: ((((((frame % frames) * patternZ + pz) * patternY + py) *
 *           patternX + px) * layers + layer) * height + h) * width + w
 *
 * @param thing - The ThingType containing sprite layout information
 * @param width - Width index (0 to thing.width-1)
 * @param height - Height index (0 to thing.height-1)
 * @param layer - Layer index (0 to thing.layers-1)
 * @param patternX - Pattern X index (0 to thing.patternX-1)
 * @param patternY - Pattern Y index (0 to thing.patternY-1)
 * @param patternZ - Pattern Z index (0 to thing.patternZ-1)
 * @param frame - Frame index (0 to thing.frames-1)
 * @returns Index into thing.spriteIndex array
 */
export function getSpriteIndex(
  thing: ThingType,
  width: number,
  height: number,
  layer: number,
  patternX: number,
  patternY: number,
  patternZ: number,
  frame: number
): number {
  return ((((((frame % thing.frames) *
    thing.patternZ + patternZ) *
    thing.patternY + patternY) *
    thing.patternX + patternX) *
    thing.layers + layer) *
    thing.height + height) *
    thing.width + width;
}

/**
 * Helper function to create an empty ThingType
 */
export function createThingType(id: number, category: ThingCategory): ThingType {
  const thing: ThingType = {
    id,
    category,
    width: 1,
    height: 1,
    exactSize: SPRITE_SIZE,
    layers: 1,
    patternX: 1,
    patternY: 1,
    patternZ: 1,
    frames: 1,
    spriteIndex: [],
    isGround: false,
    groundSpeed: 0,
    isGroundBorder: false,
    isOnBottom: false,
    isOnTop: false,
    isContainer: false,
    stackable: false,
    forceUse: false,
    multiUse: false,
    writable: false,
    writableOnce: false,
    maxTextLength: 0,
    isFluidContainer: false,
    isFluid: false,
    isUnpassable: false,
    isUnmoveable: false,
    blockMissile: false,
    blockPathfind: false,
    noMoveAnimation: false,
    pickupable: false,
    hangable: false,
    isVertical: false,
    isHorizontal: false,
    rotatable: false,
    hasLight: false,
    lightLevel: 0,
    lightColor: 0,
    dontHide: false,
    isTranslucent: false,
    floorChange: false,
    hasOffset: false,
    offsetX: 0,
    offsetY: 0,
    hasElevation: false,
    elevation: 0,
    isLyingObject: false,
    animateAlways: false,
    miniMap: false,
    miniMapColor: 0,
    isLensHelp: false,
    lensHelp: 0,
    isFullGround: false,
    ignoreLook: false,
    cloth: false,
    clothSlot: 0,
    isMarketItem: false,
    marketName: '',
    marketCategory: 0,
    marketTradeAs: 0,
    marketShowAs: 0,
    marketRestrictProfession: 0,
    marketRestrictLevel: 0,
    hasDefaultAction: false,
    defaultAction: 0,
    wrappable: false,
    unwrappable: false,
    topEffect: false,
    usable: false,
    hasCharges: false,
    isAnimation: false,
    animationMode: 0,
    loopCount: 0,
    startFrame: 0,
    frameDurations: [],
  };

  // Set category-specific defaults
  if (category === ThingCategory.OUTFIT) {
    thing.patternX = 4; // 4 directions
    thing.frames = 3;   // 3 animation frames
    thing.isAnimation = true;
  } else if (category === ThingCategory.MISSILE) {
    thing.patternX = 3;
    thing.patternY = 3;
  }

  return thing;
}

/**
 * Known client versions with signatures
 * Based on Object Builder's versions.xml
 */
export const CLIENT_VERSIONS: ClientVersion[] = [
  { value: 710, label: '7.10', datSignature: 0x3DFF4B2A, sprSignature: 0x3DFF4AEB, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 730, label: '7.30', datSignature: 0x411A6233, sprSignature: 0x411A6279, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 740, label: '7.40', datSignature: 0x41BF619C, sprSignature: 0x41B9EA86, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 750, label: '7.50', datSignature: 0x42F81973, sprSignature: 0x42F81949, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 755, label: '7.55', datSignature: 0x437B2B8F, sprSignature: 0x434F9CDE, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 760, label: '7.60', datSignature: 0x439D5A33, sprSignature: 0x439852BE, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 770, label: '7.70', datSignature: 0x439D5A33, sprSignature: 0x439852BE, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 780, label: '7.80', datSignature: 0x44CE4743, sprSignature: 0x44CE4206, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 790, label: '7.90', datSignature: 0x457D854E, sprSignature: 0x457957C8, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 792, label: '7.92', datSignature: 0x459E7B73, sprSignature: 0x45880FE8, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 800, label: '8.00', datSignature: 0x467FD7E6, sprSignature: 0x467F9E74, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 810, label: '8.10', datSignature: 0x475D3747, sprSignature: 0x475D0B01, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 811, label: '8.11', datSignature: 0x47F60E37, sprSignature: 0x47EBB9B2, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 820, label: '8.20', datSignature: 0x486905AA, sprSignature: 0x4868ECC9, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 830, label: '8.30', datSignature: 0x48DA1FB6, sprSignature: 0x48C8E712, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 840, label: '8.40', datSignature: 0x493D607A, sprSignature: 0x493D4E7C, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 841, label: '8.41', datSignature: 0x49B7CC19, sprSignature: 0x49B140EA, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 842, label: '8.42', datSignature: 0x49C233C9, sprSignature: 0x49B140EA, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 850, label: '8.50', datSignature: 0x4AE97492, sprSignature: 0x4ACB5230, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 854, label: '8.54', datSignature: 0x4B28B89E, sprSignature: 0x4B1E2C87, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 855, label: '8.55', datSignature: 0x4B98FF53, sprSignature: 0x4B913871, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 860, label: '8.60', datSignature: 0x4C28B721, sprSignature: 0x4C220594, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 860, label: '8.60 v2', datSignature: 0x4C2C7993, sprSignature: 0x4C220594, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 861, label: '8.61', datSignature: 0x4C6A4CBC, sprSignature: 0x4C63F145, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 862, label: '8.62', datSignature: 0x4C973450, sprSignature: 0x4C63F145, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 870, label: '8.70', datSignature: 0x4CFE22C5, sprSignature: 0x4CFD078A, supportsExtended: false, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 960, label: '9.60', datSignature: 0x4FFA74CC, sprSignature: 0x4FFA74F9, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 980, label: '9.80', datSignature: 0x50C70674, sprSignature: 0x50C70753, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 986, label: '9.86', datSignature: 0x5170E904, sprSignature: 0x5170E96F, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 1010, label: '10.10', datSignature: 0x51E3F8C3, sprSignature: 0x51E3F8E9, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 1020, label: '10.20', datSignature: 0x5236F129, sprSignature: 0x5236F14F, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 1030, label: '10.30', datSignature: 0x52A59036, sprSignature: 0x52A5905F, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 1038, label: '10.38', datSignature: 0x5333C199, sprSignature: 0x5333C1C3, supportsExtended: true, supportsFrameDurations: false, supportsAlphaChannel: false },
  { value: 1050, label: '10.50', datSignature: 0x53B6460E, sprSignature: 0x53B64639, supportsExtended: true, supportsFrameDurations: true, supportsAlphaChannel: false },
  { value: 1056, label: '10.56', datSignature: 0x542143B0, sprSignature: 0x542143DE, supportsExtended: true, supportsFrameDurations: true, supportsAlphaChannel: false },
];
