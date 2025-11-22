/**
 * Tibia File Loader
 * Utilities for loading .dat and .spr files via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { SpriteReader } from './spriteReader';
import { loadDatFile } from './datReader';
import { TibiaData, ClientVersion, CLIENT_VERSIONS, Sprite, ThingType } from './types';
import { logger, EventCode, logError } from '@/lib/debug';

/**
 * Read a binary file using Tauri (optimized for large files)
 */
async function readBinaryFile(path: string): Promise<Uint8Array> {
  // Tauri with serde_bytes returns binary data efficiently as Uint8Array
  const bytes = await invoke<Uint8Array>('read_file', { path });
  return bytes;
}

/**
 * Read only the signature from a DAT file (first 4 bytes)
 */
async function readDatSignature(path: string): Promise<number> {
  const buffer = await invoke<Uint8Array>('read_file', { path });

  if (buffer.length < 4) {
    throw new Error('DAT file is too small to contain a valid signature');
  }

  // Read signature as little-endian uint32
  const signature = (buffer[0] | (buffer[1] << 8) | (buffer[2] << 16) | (buffer[3] << 24)) >>> 0;
  return signature;
}

/**
 * Detect client version from signature
 */
export function detectVersionFromSignature(signature: number): ClientVersion | null {
  return CLIENT_VERSIONS.find((v) => v.datSignature === signature || v.sprSignature === signature) || null;
}

/**
 * Load Tibia .dat file
 */
export async function loadTibiaDat(
  path: string,
  version: ClientVersion,
  onProgress?: (current: number, total: number) => void
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
  const buffer = await readBinaryFile(path);
  const extended = version.supportsExtended;
  const frameDurations = version.supportsFrameDurations;

  return await loadDatFile(buffer, extended, frameDurations, onProgress, version);
}

/**
 * SPR Header returned from Rust
 */
interface SprHeader {
  signature: number;
  sprite_count: number;
  extended: boolean;
}

/**
 * Load Tibia .spr file (streaming mode - opens file in Rust backend)
 */
export async function loadTibiaSpr(
  path: string,
  version: ClientVersion
): Promise<{ path: string; header: SprHeader; transparency: boolean }> {
  const extended = version.supportsExtended;
  const transparency = version.supportsAlphaChannel;

  // Open SPR file in Rust backend (keeps file handle open)
  const header = await invoke<SprHeader>('open_spr_file', {
    path,
    extended
  });

  return {
    path,
    header,
    transparency,
  };
}

/**
 * Open file dialog and select .dat file
 */
export async function selectDatFile(): Promise<string | null> {
  const selected = await open({
    title: 'Select Tibia.dat file',
    multiple: false,
    filters: [
      {
        name: 'Tibia DAT Files',
        extensions: ['dat'],
      },
    ],
  });

  return selected as string | null;
}

/**
 * Open file dialog and select .spr file
 */
export async function selectSprFile(): Promise<string | null> {
  const selected = await open({
    title: 'Select Tibia.spr file',
    multiple: false,
    filters: [
      {
        name: 'Tibia SPR Files',
        extensions: ['spr'],
      },
    ],
  });

  return selected as string | null;
}

/**
 * Select folder containing Tibia.dat and Tibia.spr
 */
export async function selectTibiaFolder(): Promise<{ datPath: string; sprPath: string } | null> {
  const selected = await open({
    title: 'Select folder containing Tibia.dat and Tibia.spr',
    directory: true,
    multiple: false,
  });

  if (!selected || typeof selected !== 'string') {
    return null;
  }

  // Construct paths for Tibia.dat and Tibia.spr
  const datPath = `${selected}\\Tibia.dat`;
  const sprPath = `${selected}\\Tibia.spr`;

  return { datPath, sprPath };
}

/**
 * Load complete Tibia client data (.dat + .spr)
 */
export async function loadTibiaData(
  datPath: string,
  sprPath: string,
  version?: ClientVersion,
  onProgress?: (stage: string, current: number, total: number) => void
): Promise<TibiaData> {
  // Detect version from signature if not provided
  let detectedVersion = version;
  if (!detectedVersion) {
    if (onProgress) onProgress('Detecting version...', 0, 100);
    const signature = await readDatSignature(datPath);
    detectedVersion = detectVersionFromSignature(signature);
    if (!detectedVersion) {
      throw new Error(`Unknown client version with signature 0x${signature.toString(16)}`);
    }
  }

  // Load DAT file with detected version
  if (onProgress) onProgress('Loading metadata...', 0, 100);

  const datData = await loadTibiaDat(datPath, detectedVersion, (current, total) => {
    if (onProgress) onProgress('Loading metadata...', current, total);
  });

  // Load SPR file (streaming mode - instant!)
  if (onProgress) onProgress('Opening sprite file...', 0, 100);
  const sprData = await loadTibiaSpr(sprPath, detectedVersion);

  // Build sprite map
  const sprites = new Map<number, Sprite>();

  // Load first 100-sprite window (Object Builder style: aligned to 100s)
  // This loads sprites 1-100 for instant first page display
  if (onProgress) onProgress('Loading initial sprites...', 0, 100);

  const WINDOW_SIZE = 100;
  const spriteCount = Math.min(WINDOW_SIZE, sprData.header.sprite_count);

  if (spriteCount > 0) {
    try {
      // Batch load first window from Rust using BINARY protocol
      const response = await invoke<Uint8Array>('read_sprites_batch_bin', {
        path: sprData.path,
        startId: 1,
        count: spriteCount,
      });

      const batchedSprites = parseBinarySprites(response, sprData.transparency);

      // Add to sprite map
      for (const sprite of batchedSprites) {
        sprites.set(sprite.id, sprite);
      }

      if (onProgress) onProgress('Loading initial sprites...', spriteCount, spriteCount);
    } catch (err) {
      logError('Failed to preload sprites', err);
    }
  }

  return {
    version: detectedVersion,
    extended: detectedVersion.supportsExtended,
    transparency: sprData.transparency,
    sprites,
    spritesCount: sprData.header.sprite_count,
    sprPath: sprData.path,
    items: datData.items,
    itemsCount: datData.itemsCount,
    outfits: datData.outfits,
    outfitsCount: datData.outfitsCount,
    effects: datData.effects,
    effectsCount: datData.effectsCount,
    missiles: datData.missiles,
    missilesCount: datData.missilesCount,
  };
}

/**
 * Calculate 100-aligned sprite window (Object Builder style)
 * For sprite ID 5432, returns start=5400
 */
export function getSpriteWindowStart(spriteId: number): number {
  return Math.floor(spriteId / 100) * 100;
}

/**
 * Load a 100-sprite window around the given sprite ID
 * Object Builder style: aligned to 100-sprite boundaries
 *
 * CACHE BEHAVIOR (Object Builder Pattern):
 * - Unlimited cache size - sprites are NEVER evicted during session
 * - All loaded sprites stay in memory until file is unloaded
 * - Modern systems can easily handle 50,000+ sprites (~200 MB)
 * - This matches Object Builder and OTClient behavior
 *
 * THREAD SAFETY:
 * - This function checks if window is already cached before loading
 * - Multiple concurrent calls for same window will skip redundant loads
 * - Safe to call in parallel for different windows
 */
/**
 * Helper to parse binary sprite response
 * Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][Len: u32][Data...])*
 */
function parseBinarySprites(response: Uint8Array | ArrayBuffer, transparency: boolean): Sprite[] {
  let view: DataView;
  let buffer: Uint8Array;

  if (response instanceof Uint8Array) {
    view = new DataView(response.buffer, response.byteOffset, response.byteLength);
    buffer = response;
  } else if (response instanceof ArrayBuffer) {
    view = new DataView(response);
    buffer = new Uint8Array(response);
  } else {
    console.error('Unexpected response type:', response);
    return [];
  }

  const sprites: Sprite[] = [];
  let offset = 0;

  // Safety check
  if (view.byteLength < 4) return [];

  const count = view.getUint32(offset, true);
  offset += 4;

  for (let i = 0; i < count; i++) {
    // Safety check
    if (offset + 9 > view.byteLength) break;

    const id = view.getUint32(offset, true);
    offset += 4;

    const isEmpty = view.getUint8(offset) === 1;
    offset += 1;

    const len = view.getUint32(offset, true);
    offset += 4;

    let compressedPixels: Uint8Array;
    if (len > 0) {
      if (offset + len > view.byteLength) {
        console.error(`Binary parse error: sprite ${id} length ${len} exceeds buffer`);
        compressedPixels = new Uint8Array(0);
        offset = view.byteLength; // Stop parsing
      } else {
        // Use slice to create a copy
        compressedPixels = buffer.slice(offset, offset + len);
        offset += len;
      }
    } else {
      compressedPixels = new Uint8Array(0);
    }

    sprites.push({
      id,
      isEmpty,
      transparent: transparency,
      compressedPixels,
    });
  }
  return sprites;
}

/**
 * Load a 100-sprite window around the given sprite ID
 * Object Builder style: aligned to 100-sprite boundaries
 */
export async function loadSpriteWindow(
  sprPath: string,
  spriteId: number,
  totalSprites: number,
  transparency: boolean,
  spriteCache: Map<number, Sprite>
): Promise<void> {
  const WINDOW_SIZE = 100;

  // Calculate window boundaries (aligned to 100s)
  const windowStart = getSpriteWindowStart(spriteId);
  const startId = Math.max(1, windowStart);
  const endId = Math.min(startId + WINDOW_SIZE - 1, totalSprites);
  const count = endId - startId + 1;

  // Check if we already have this window cached
  let allCached = true;
  for (let id = startId; id <= endId; id++) {
    if (!spriteCache.has(id)) {
      allCached = false;
      break;
    }
  }

  logger.log(EventCode.LOADER_WINDOW, { s: startId, e: endId, req: spriteId, sz: spriteCache.size, cached: allCached });

  if (allCached) {
    logger.log(EventCode.LOADER_CACHED, { s: startId, e: endId });
    return; // Window already loaded
  }

  try {
    logger.log(EventCode.LOADER_READ, { s: startId, e: endId, n: count });

    // Batch load window from Rust using BINARY protocol
    const response = await invoke<Uint8Array>('read_sprites_batch_bin', {
      path: sprPath,
      startId,
      count,
    });

    const batchedSprites = parseBinarySprites(response, transparency);

    // Add to cache
    for (const sprite of batchedSprites) {
      spriteCache.set(sprite.id, sprite);
    }

    logger.log(EventCode.LOADER_ADDED, { n: batchedSprites.length, sz: spriteCache.size, bin: true });

    // NO CACHE EVICTION - Object Builder pattern
    // Sprites are kept in memory for the entire session
    // This prevents race conditions where sprites are evicted before rendering
    // Modern systems can easily handle 50,000+ sprites (~200 MB)
  } catch (err) {
    logError(`Failed to load sprite window ${startId}-${endId}`, err);
  }
}

/**
 * Load specific sprite IDs (handles non-consecutive IDs efficiently)
 * Groups consecutive IDs into ranges and uses batch loading
 *
 * IMPORTANT: This is the CORRECT way to load sprites for items/outfits
 * - Loads ONLY the sprites actually used by the item
 * - Handles non-consecutive sprite IDs (e.g., different animation frames)
 * - Groups consecutive IDs into ranges for efficient batch loading
 * - Skips already cached sprites
 */
export async function loadSpriteIds(
  sprPath: string,
  spriteIds: number[],
  transparency: boolean,
  spriteCache: Map<number, Sprite>
): Promise<void> {
  // Filter out IDs that are already cached or invalid
  const uncachedIds = spriteIds.filter(id => id > 0 && !spriteCache.has(id));

  if (uncachedIds.length === 0) {
    logger.log(EventCode.LOADER_CACHED, { n: spriteIds.length });
    return; // All sprites already cached
  }

  // Remove duplicates
  const uniqueIds = [...new Set(uncachedIds)];

  logger.log(EventCode.LOADER_READ, {
    ids: uniqueIds.slice(0, 5),
    total: uniqueIds.length,
    method: 'list'
  });

  try {
    // Load all unique IDs in one go using the new optimized BINARY command
    const response = await invoke<Uint8Array>('read_sprites_list_bin', {
      path: sprPath,
      ids: uniqueIds,
    });

    const batchedSprites = parseBinarySprites(response, transparency);

    // Add to cache
    for (const sprite of batchedSprites) {
      spriteCache.set(sprite.id, sprite);
    }

    logger.log(EventCode.LOADER_ADDED, {
      n: batchedSprites.length,
      sz: spriteCache.size,
      bin: true
    });
  } catch (err) {
    logError(`Failed to load sprite list of ${uniqueIds.length} items`, err);
  }
}

/**
 * Helper to get sprite from reader (with caching)
 * @deprecated Use TibiaDataContext.getSprite instead
 */
export function getSpriteFromReader(
  reader: SpriteReader,
  spriteCache: Map<number, Sprite>,
  id: number
): Sprite | null {
  // Check cache first
  if (spriteCache.has(id)) {
    return spriteCache.get(id)!;
  }

  // This function is synchronous and relies on the old reader.
  // We should ideally deprecate it or make it async to use IPC.
  // But for now, we leave it as is since it's marked deprecated.
  // The new architecture uses loadSpriteIds / loadSpriteWindow which are async.

  const sprite = reader.readSprite(id);
  if (sprite) {
    spriteCache.set(id, sprite);
  }

  return sprite;
}
