/**
 * Tibia Data Structures
 * Based on Object Builder's ActionScript implementation
 */

// Thing Categories
export enum ThingCategory {
	ITEM = 'item',
	OUTFIT = 'outfit',
	EFFECT = 'effect',
	MISSILE = 'missile'
}

export const THING_CATEGORY_VALUES: Record<ThingCategory, number> = {
	[ThingCategory.ITEM]: 1,
	[ThingCategory.OUTFIT]: 2,
	[ThingCategory.EFFECT]: 3,
	[ThingCategory.MISSILE]: 4
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
	MISSILES_COUNT: 10
} as const;

export const SPR_FILE_POSITIONS = {
	LENGTH: 4,
	SIGNATURE: 0
} as const;

export const SPR_FILE_SIZES = {
	ADDRESS: 4, // 4 bytes per sprite address
	HEADER_U16: 6, // 4 bytes signature + 2 bytes count
	HEADER_U32: 8 // 4 bytes signature + 4 bytes count
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
 *
 * With the new RGBA optimization, sprites now store pre-decompressed RGBA pixels
 * directly from Rust, eliminating JavaScript decompression overhead.
 */
export interface Sprite {
	id: number;
	isEmpty: boolean;
	transparent: boolean;

	// RGBA pixel data (4096 bytes) - pre-decompressed by Rust
	// This is in RGBA format, ready for direct use with ImageData
	rgbaPixels: Uint8Array;

	// Canvas-ready ImageData - cached after first render
	imageData?: ImageData;

	// Legacy fields for compatibility (kept for writing sprites back)
	pixels?: Uint8Array; // ARGB format (used by outfit blending and sprite writing)
	compressedPixels?: Uint8Array; // Original compressed data (optional, for writing)
}

/**
 * Thing/Object type definition
 * Represents an item, outfit, effect, or missile
 */
export interface ThingType {
	id: number;
	// Texture/Sprite layout
	width: number;
	height: number;
	layers: number;
	frames: number;
	// Cloth properties
	cloth: boolean;
	offsetX: number;
	offsetY: number;
	usable: boolean;
	patternX: number;

	patternY: number;
	patternZ: number;
	isOnTop: boolean;
	isFluid: boolean;
	miniMap: boolean;

	lensHelp: number;
	exactSize: number;
	// Ground properties
	isGround: boolean;
	forceUse: boolean;

	multiUse: boolean;
	// Writing properties
	writable: boolean;
	// Positioning properties
	hangable: boolean;

	// Light properties
	hasLight: boolean;
	// Visual properties
	dontHide: boolean;
	elevation: number;
	clothSlot: number;

	loopCount: number;
	stackable: boolean;
	rotatable: boolean;
	lightLevel: number;
	lightColor: number;
	// Offset properties
	hasOffset: boolean;

	marketName: string;
	wrappable: boolean;
	topEffect: boolean;
	startFrame: number;
	groundSpeed: number;

	isOnBottom: boolean;
	pickupable: boolean;
	isVertical: boolean;

	isLensHelp: boolean;
	ignoreLook: boolean;
	hasCharges: boolean;

	// Container properties
	isContainer: boolean;
	floorChange: boolean;
	miniMapColor: number;

	marketShowAs: number;
	unwrappable: boolean;

	// Animation properties
	isAnimation: boolean;
	spriteIndex: number[];
	writableOnce: boolean;
	maxTextLength: number;
	// Movement properties
	isUnpassable: boolean;
	isUnmoveable: boolean;
	blockMissile: boolean;
	isHorizontal: boolean;

	// Elevation properties
	hasElevation: boolean;
	isFullGround: boolean;

	// Market properties
	isMarketItem: boolean;
	marketTradeAs: number;
	defaultAction: number;
	animationMode: number;
	blockPathfind: boolean;
	isTranslucent: boolean;
	// Misc properties
	isLyingObject: boolean;

	animateAlways: boolean;
	marketCategory: number;
	frameGroups?: number[]; // For outfits with idle animations (10.57+)
	category: ThingCategory;
	isGroundBorder: boolean;
	noMoveAnimation: boolean;
	// Fluid properties
	isFluidContainer: boolean;

	// Action properties
	hasDefaultAction: boolean;
	// Helper properties
	texturePatterns?: number[];
	marketRestrictLevel: number;
	upgradeClassification?: number;
	frameDurations: FrameDuration[];
	marketRestrictProfession: number;
	unknownFlags?: Array<{ orig: number; remapped: number }>; // For debugging
}

export enum MarketCategory {
	Food = 6,
	Legs = 8,
	Boots = 3,
	Axes = 17,
	Armors = 1,
	Others = 9,
	Rings = 11,
	Runes = 12,
	Tools = 14,
	Clubs = 18,
	Amulets = 2,
	Swords = 20,
	Potions = 10,
	Shields = 13,
	Distance = 19,
	Containers = 4,
	Decoration = 5,
	Valuables = 15,
	Ammunition = 16,
	Wands_Rods = 21,
	Helmets_Hats = 7,
	Tibia_Coins = 23,
	Premium_Scrolls = 22,
	Creature_Products = 24
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
	supportsAlphaChannel: boolean; // RGBA (4 bytes) vs RGB (3 bytes) per pixel
	supportsFrameDurations: boolean;
}

/**
 * Loaded Tibia client data
 */
export interface TibiaData {
	datPath?: string; // Path to DAT file
	sprPath?: string; // Path to SPR file for streaming from Rust
	extended: boolean;
	itemsCount: number;

	spritesCount: number;
	outfitsCount: number;
	effectsCount: number;

	transparency: boolean;
	missilesCount: number;
	version: ClientVersion;
	// Sprites
	sprites: Map<number, Sprite>;
	// Things
	items: Map<number, ThingType>;
	outfits: Map<number, ThingType>;
	effects: Map<number, ThingType>;
	missiles: Map<number, ThingType>;
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
	return (
		((((frame % thing.frames) * thing.patternZ + patternZ) * thing.patternY + patternY) * thing.patternX + patternX) *
			thing.layers +
		layer
	);
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
	return (
		((((((frame % thing.frames) * thing.patternZ + patternZ) * thing.patternY + patternY) * thing.patternX + patternX) *
			thing.layers +
			layer) *
			thing.height +
			height) *
			thing.width +
		width
	);
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
		layers: 1,
		frames: 1,
		offsetX: 0,
		offsetY: 0,
		patternX: 1,
		patternY: 1,
		patternZ: 1,
		lensHelp: 0,
		elevation: 0,
		cloth: false,
		clothSlot: 0,
		loopCount: 0,
		lightLevel: 0,
		lightColor: 0,
		usable: false,
		startFrame: 0,
		groundSpeed: 0,
		isOnTop: false,
		isFluid: false,
		miniMap: false,
		marketName: '',
		spriteIndex: [],
		isGround: false,
		forceUse: false,
		multiUse: false,
		writable: false,
		hangable: false,
		hasLight: false,
		dontHide: false,
		miniMapColor: 0,
		marketShowAs: 0,
		stackable: false,
		maxTextLength: 0,
		rotatable: false,
		hasOffset: false,
		marketTradeAs: 0,
		defaultAction: 0,
		wrappable: false,
		topEffect: false,
		animationMode: 0,
		isOnBottom: false,
		pickupable: false,
		isVertical: false,
		isLensHelp: false,
		ignoreLook: false,
		marketCategory: 0,
		hasCharges: false,
		isContainer: false,
		floorChange: false,
		unwrappable: false,
		isAnimation: false,
		frameDurations: [],
		writableOnce: false,
		isUnpassable: false,
		isUnmoveable: false,
		blockMissile: false,
		isHorizontal: false,
		hasElevation: false,
		isFullGround: false,
		isMarketItem: false,
		blockPathfind: false,
		isTranslucent: false,
		isLyingObject: false,
		animateAlways: false,
		isGroundBorder: false,
		exactSize: SPRITE_SIZE,
		noMoveAnimation: false,
		marketRestrictLevel: 0,
		isFluidContainer: false,
		hasDefaultAction: false,
		marketRestrictProfession: 0
	};

	// Set category-specific defaults
	if (category === ThingCategory.OUTFIT) {
		thing.patternX = 4; // 4 directions
		thing.frames = 3; // 3 animation frames
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
	{
		value: 710,
		label: '7.10',
		supportsExtended: false,
		datSignature: 0x3dff4b2a,
		sprSignature: 0x3dff4aeb,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 730,
		label: '7.30',
		supportsExtended: false,
		datSignature: 0x411a6233,
		sprSignature: 0x411a6279,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 740,
		label: '7.40',
		supportsExtended: false,
		datSignature: 0x41bf619c,
		sprSignature: 0x41b9ea86,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 750,
		label: '7.50',
		supportsExtended: false,
		datSignature: 0x42f81973,
		sprSignature: 0x42f81949,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 755,
		label: '7.55',
		supportsExtended: false,
		datSignature: 0x437b2b8f,
		sprSignature: 0x434f9cde,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 760,
		label: '7.60',
		supportsExtended: false,
		datSignature: 0x439d5a33,
		sprSignature: 0x439852be,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 770,
		label: '7.70',
		supportsExtended: false,
		datSignature: 0x439d5a33,
		sprSignature: 0x439852be,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 780,
		label: '7.80',
		supportsExtended: false,
		datSignature: 0x44ce4743,
		sprSignature: 0x44ce4206,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 790,
		label: '7.90',
		supportsExtended: false,
		datSignature: 0x457d854e,
		sprSignature: 0x457957c8,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 792,
		label: '7.92',
		supportsExtended: false,
		datSignature: 0x459e7b73,
		sprSignature: 0x45880fe8,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 800,
		label: '8.00',
		supportsExtended: false,
		datSignature: 0x467fd7e6,
		sprSignature: 0x467f9e74,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 810,
		label: '8.10',
		supportsExtended: false,
		datSignature: 0x475d3747,
		sprSignature: 0x475d0b01,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 811,
		label: '8.11',
		supportsExtended: false,
		datSignature: 0x47f60e37,
		sprSignature: 0x47ebb9b2,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 820,
		label: '8.20',
		supportsExtended: false,
		datSignature: 0x486905aa,
		sprSignature: 0x4868ecc9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 830,
		label: '8.30',
		supportsExtended: false,
		datSignature: 0x48da1fb6,
		sprSignature: 0x48c8e712,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 840,
		label: '8.40',
		supportsExtended: false,
		datSignature: 0x493d607a,
		sprSignature: 0x493d4e7c,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 841,
		label: '8.41',
		supportsExtended: false,
		datSignature: 0x49b7cc19,
		sprSignature: 0x49b140ea,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 842,
		label: '8.42',
		supportsExtended: false,
		datSignature: 0x49c233c9,
		sprSignature: 0x49b140ea,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 850,
		label: '8.50',
		supportsExtended: false,
		datSignature: 0x4ae97492,
		sprSignature: 0x4acb5230,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 854,
		label: '8.54',
		supportsExtended: false,
		datSignature: 0x4b28b89e,
		sprSignature: 0x4b1e2c87,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 855,
		label: '8.55',
		supportsExtended: false,
		datSignature: 0x4b98ff53,
		sprSignature: 0x4b913871,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 860,
		label: '8.60',
		supportsExtended: false,
		datSignature: 0x4c28b721,
		sprSignature: 0x4c220594,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 860,
		label: '8.60 v2',
		supportsExtended: false,
		datSignature: 0x4c2c7993,
		sprSignature: 0x4c220594,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 861,
		label: '8.61',
		supportsExtended: false,
		datSignature: 0x4c6a4cbc,
		sprSignature: 0x4c63f145,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 862,
		label: '8.62',
		supportsExtended: false,
		datSignature: 0x4c973450,
		sprSignature: 0x4c63f145,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 870,
		label: '8.70',
		supportsExtended: false,
		datSignature: 0x4cfe22c5,
		sprSignature: 0x4cfd078a,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 960,
		label: '9.60',
		supportsExtended: true,
		datSignature: 0x4ffa74cc,
		sprSignature: 0x4ffa74f9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 980,
		label: '9.80',
		supportsExtended: true,
		datSignature: 0x50c70674,
		sprSignature: 0x50c70753,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 986,
		label: '9.86',
		supportsExtended: true,
		datSignature: 0x5170e904,
		sprSignature: 0x5170e96f,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1010,
		label: '10.10',
		supportsExtended: true,
		datSignature: 0x51e3f8c3,
		sprSignature: 0x51e3f8e9,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1020,
		label: '10.20',
		supportsExtended: true,
		datSignature: 0x5236f129,
		sprSignature: 0x5236f14f,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1030,
		label: '10.30',
		supportsExtended: true,
		datSignature: 0x52a59036,
		sprSignature: 0x52a5905f,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1038,
		label: '10.38',
		supportsExtended: true,
		datSignature: 0x5333c199,
		sprSignature: 0x5333c1c3,
		supportsAlphaChannel: false,
		supportsFrameDurations: false
	},
	{
		value: 1050,
		label: '10.50',
		supportsExtended: true,
		datSignature: 0x53b6460e,
		sprSignature: 0x53b64639,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1056,
		label: '10.56',
		supportsExtended: true,
		datSignature: 0x542143b0,
		sprSignature: 0x542143de,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	},
	{
		value: 1098,
		label: '10.98',
		datSignature: 0x42a3,
		supportsExtended: true,
		sprSignature: 0x57bbd603,
		supportsAlphaChannel: false,
		supportsFrameDurations: true
	}
];
