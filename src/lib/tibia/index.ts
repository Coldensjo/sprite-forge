/**
 * Tibia File Format Library
 * Exports readers for .dat and .spr files
 */

export * from './types';
export * from './loader';
export * from './outfit';
export * from './compiler';
export * from './datReader';
export * from './optimizer';
export * from './datDecoder';
export * from './spriteReader';
export * from './spriteManager';

export { exportObjectSheet } from './export';

// Export binary decoder for DAT files
export { decodeDatResponse } from './datDecoder';

// Export header types
export type { OtfiData, DatHeader, SprHeader } from './loader';
export { importObjectSheet, type ImportResult } from './import';
// Explicitly export loader functions
export {
	readOtfiFile,
	loadSpriteIds,
	readDatHeader,
	readSprHeader,
	preloadSprites,
	loadSpriteIdsLz4,
	loadSpriteWindow
} from './loader';
