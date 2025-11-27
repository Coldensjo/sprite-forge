use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom, BufReader};
use std::sync::{Arc, Mutex};
use serde::Serialize;
use rayon::prelude::*;

/// Sprite size constants
const SPRITE_SIZE: usize = 32;
const SPRITE_PIXELS: usize = SPRITE_SIZE * SPRITE_SIZE; // 1024
const SPRITE_DATA_SIZE: usize = SPRITE_PIXELS * 4; // 4096 bytes (RGBA)

/// SPR file header information
#[derive(Debug, Clone, Serialize)]
pub struct SprHeader {
    pub signature: u32,
    pub sprite_count: u32,
    pub extended: bool,
}

/// Sprite data returned to frontend
#[derive(Debug, Clone, Serialize)]
pub struct SpriteData {
    pub id: u32,
    pub is_empty: bool,
    #[serde(with = "serde_bytes")]
    pub compressed_pixels: Vec<u8>,
}

/// SPR file reader that keeps file handle open
pub struct SprFileReader {
    file: BufReader<File>,
    header: SprHeader,
    header_size: u64,
}

impl SprFileReader {
    /// Open and read SPR file header
    pub fn open(path: &str, extended: bool) -> Result<Self, String> {
        let file = File::open(path)
            .map_err(|e| format!("Failed to open SPR file: {}", e))?;
        
        let mut reader = BufReader::new(file);

        // Read signature (4 bytes)
        let mut sig_buf = [0u8; 4];
        reader.read_exact(&mut sig_buf)
            .map_err(|e| format!("Failed to read signature: {}", e))?;
        let signature = u32::from_le_bytes(sig_buf);

        // Read sprite count (2 or 4 bytes depending on extended)
        let sprite_count = if extended {
            let mut count_buf = [0u8; 4];
            reader.read_exact(&mut count_buf)
                .map_err(|e| format!("Failed to read sprite count: {}", e))?;
            u32::from_le_bytes(count_buf)
        } else {
            let mut count_buf = [0u8; 2];
            reader.read_exact(&mut count_buf)
                .map_err(|e| format!("Failed to read sprite count: {}", e))?;
            u16::from_le_bytes(count_buf) as u32
        };

        let header_size = if extended { 8 } else { 6 };

        let header = SprHeader {
            signature,
            sprite_count,
            extended,
        };

        Ok(Self {
            file: reader,
            header,
            header_size,
        })
    }

    /// Read a specific sprite by ID (1-indexed)
    pub fn read_sprite(&mut self, id: u32) -> Result<SpriteData, String> {
        if id == 0 || id > self.header.sprite_count {
            return Err(format!(
                "Invalid sprite ID: {} (valid range: 1-{})",
                id, self.header.sprite_count
            ));
        }

        // Calculate address position (4 bytes per sprite address)
        let address_pos = self.header_size + ((id - 1) * 4) as u64;

        // Seek to address position
        self.file.seek(SeekFrom::Start(address_pos))
            .map_err(|e| format!("Failed to seek to address: {}", e))?;

        // Read sprite data address (4 bytes)
        let mut addr_buf = [0u8; 4];
        self.file.read_exact(&mut addr_buf)
            .map_err(|e| format!("Failed to read sprite address: {}", e))?;
        let address = u32::from_le_bytes(addr_buf);

        // If address is 0, sprite is empty
        if address == 0 {
            return Ok(SpriteData {
                id,
                is_empty: true,
                compressed_pixels: Vec::new(),
            });
        }

        // Seek to sprite data (skip 3 bytes RGB header)
        let data_start = address as u64 + 3;
        self.file.seek(SeekFrom::Start(data_start))
            .map_err(|e| format!("Failed to seek to sprite data: {}", e))?;

        // Read compressed data length (2 bytes)
        let mut len_buf = [0u8; 2];
        self.file.read_exact(&mut len_buf)
            .map_err(|e| format!("Failed to read data length: {}", e))?;
        let length = u16::from_le_bytes(len_buf);

        // If length is 0, sprite is empty
        if length == 0 {
            return Ok(SpriteData {
                id,
                is_empty: true,
                compressed_pixels: Vec::new(),
            });
        }

        // Read compressed pixel data
        let mut compressed_pixels = vec![0u8; length as usize];
        self.file.read_exact(&mut compressed_pixels)
            .map_err(|e| format!("Failed to read sprite data: {}", e))?;

        Ok(SpriteData {
            id,
            is_empty: false,
            compressed_pixels,
        })
    }

    pub fn get_header(&self) -> &SprHeader {
        &self.header
    }
}

/// Global SPR file manager state
pub struct SprManager {
    readers: HashMap<String, SprFileReader>,
}

impl SprManager {
    pub fn new() -> Self {
        Self {
            readers: HashMap::new(),
        }
    }

    pub fn open_file(&mut self, path: String, extended: bool) -> Result<SprHeader, String> {
        let reader = SprFileReader::open(&path, extended)?;
        let header = reader.get_header().clone();
        self.readers.insert(path, reader);
        Ok(header)
    }

    pub fn read_sprite(&mut self, path: &str, id: u32) -> Result<SpriteData, String> {
        let reader = self.readers.get_mut(path)
            .ok_or_else(|| format!("SPR file not open: {}", path))?;
        reader.read_sprite(id)
    }

    pub fn close_file(&mut self, path: &str) -> Result<(), String> {
        // Remove the reader if it exists, silently succeed if not
        // This allows cleanup to be called safely even if file wasn't opened
        self.readers.remove(path);
        Ok(())
    }

    pub fn get_header(&self, path: &str) -> Result<SprHeader, String> {
        let reader = self.readers.get(path)
            .ok_or_else(|| format!("SPR file not open: {}", path))?;
        Ok(reader.get_header().clone())
    }

    /// Read multiple sprites at once (batch operation)
    pub fn read_sprites_batch(&mut self, path: &str, start_id: u32, count: u32) -> Result<Vec<SpriteData>, String> {
        let reader = self.readers.get_mut(path)
            .ok_or_else(|| format!("SPR file not open: {}", path))?;

        let max_id = reader.get_header().sprite_count;
        let end_id = (start_id + count - 1).min(max_id);
        
        if start_id > end_id {
            return Ok(Vec::new());
        }

        let actual_count = end_id - start_id + 1;
        let mut sprites = Vec::with_capacity(actual_count as usize);

        // OPTIMIZATION: Read all addresses in one go
        let start_offset = reader.header_size + ((start_id - 1) as u64 * 4);
        
        reader.file.seek(SeekFrom::Start(start_offset))
            .map_err(|e| format!("Failed to seek to address table: {}", e))?;

        let mut addresses_buf = vec![0u8; (actual_count * 4) as usize];
        reader.file.read_exact(&mut addresses_buf)
            .map_err(|e| format!("Failed to read address table: {}", e))?;

        // 1. Collect all valid addresses and find min/max file positions
        let mut valid_sprites = Vec::with_capacity(actual_count as usize);
        let mut min_pos = u64::MAX;
        let mut max_pos = 0;

        for i in 0..actual_count {
            let offset = (i * 4) as usize;
            let address = u32::from_le_bytes([
                addresses_buf[offset],
                addresses_buf[offset + 1],
                addresses_buf[offset + 2],
                addresses_buf[offset + 3],
            ]);

            if address != 0 {
                let pos = address as u64;
                if pos < min_pos { min_pos = pos; }
                // We don't know the length yet, but we know it starts here.
                // We'll update max_pos roughly or during the read.
                // For now, just track the start.
                if pos > max_pos { max_pos = pos; }
                
                valid_sprites.push((start_id + i, pos));
            } else {
                // Empty sprite
                sprites.push(SpriteData {
                    id: start_id + i,
                    is_empty: true,
                    compressed_pixels: Vec::new(),
                });
            }
        }

        if valid_sprites.is_empty() {
            return Ok(sprites);
        }

        // Sort by file position to read sequentially
        valid_sprites.sort_by_key(|k| k.1);

        // 2. Strategy Decision:
        // If the data is dense (file size of range < 2 * sum of individual reads), read the whole block.
        // Otherwise, read individually but sequentially.
        
        // Heuristic: If the span covers less than 10MB, just read it all. 
        // Most sprite pages are dense.
        let span_size = if valid_sprites.len() > 0 {
            // Estimate end of last sprite (address + 3 header + ~8KB max sprite size safety margin)
            (max_pos + 8192) - min_pos
        } else {
            0
        };

        // 10MB limit for bulk read
        if span_size < 10 * 1024 * 1024 {
            // BULK READ STRATEGY
            reader.file.seek(SeekFrom::Start(min_pos))
                .map_err(|e| format!("Failed to seek to data block: {}", e))?;

            let mut file_buf = vec![0u8; span_size as usize];
            // Read as much as possible, ignore EOF error if we try to read past it
            let bytes_read = reader.file.read(&mut file_buf)
                .map_err(|e| format!("Failed to read data block: {}", e))?;
            
            // Parse from memory buffer
            for (id, pos) in valid_sprites {
                let local_offset = (pos - min_pos) as usize;
                
                if local_offset + 5 > bytes_read {
                    // Should not happen if estimation is correct, but safety first
                    continue;
                }

                // Skip 3 bytes RGB (pos + 3)
                let len_offset = local_offset + 3;
                let length = u16::from_le_bytes([
                    file_buf[len_offset],
                    file_buf[len_offset + 1]
                ]);

                if length == 0 {
                    sprites.push(SpriteData { id, is_empty: true, compressed_pixels: Vec::new() });
                    continue;
                }

                let data_offset = len_offset + 2;
                let data_end = data_offset + length as usize;

                if data_end <= bytes_read {
                    sprites.push(SpriteData {
                        id,
                        is_empty: false,
                        compressed_pixels: file_buf[data_offset..data_end].to_vec(),
                    });
                }
            }
        } else {
            // SEQUENTIAL READ STRATEGY (Fallback for sparse data)
            // We already sorted valid_sprites by position, so seeks are forward-only
            let mut current_pos = reader.file.stream_position()
                .map_err(|e| format!("Failed to get stream pos: {}", e))?;

            for (id, pos) in valid_sprites {
                let target_pos = pos + 3; // Skip RGB
                
                if current_pos != target_pos {
                    reader.file.seek(SeekFrom::Start(target_pos))
                        .map_err(|e| format!("Failed to seek: {}", e))?;
                    current_pos = target_pos;
                }

                let mut len_buf = [0u8; 2];
                reader.file.read_exact(&mut len_buf)
                    .map_err(|e| format!("Failed to read length: {}", e))?;
                current_pos += 2;
                
                let length = u16::from_le_bytes(len_buf);

                if length == 0 {
                    sprites.push(SpriteData { id, is_empty: true, compressed_pixels: Vec::new() });
                    continue;
                }

                let mut pixels = vec![0u8; length as usize];
                reader.file.read_exact(&mut pixels)
                    .map_err(|e| format!("Failed to read pixels: {}", e))?;
                current_pos += length as u64;

                sprites.push(SpriteData {
                    id,
                    is_empty: false,
                    compressed_pixels: pixels,
                });
            }
        }

        Ok(sprites)
    }

    /// Read a list of specific sprite IDs efficiently
    pub fn read_sprites_list(&mut self, path: &str, ids: Vec<u32>) -> Result<Vec<SpriteData>, String> {
        let reader = self.readers.get_mut(path)
            .ok_or_else(|| format!("SPR file not open: {}", path))?;

        if ids.is_empty() {
            return Ok(Vec::new());
        }

        // Remove duplicates and sort
        let mut sorted_ids = ids.clone();
        sorted_ids.sort_unstable();
        sorted_ids.dedup();

        // Filter valid IDs
        let max_id = reader.get_header().sprite_count;
        sorted_ids.retain(|&id| id > 0 && id <= max_id);

        if sorted_ids.is_empty() {
            return Ok(Vec::new());
        }

        let mut sprites = Vec::with_capacity(sorted_ids.len());

        // OPTIMIZATION: Read all addresses for the requested IDs
        // We can't read a single block of addresses because they might be scattered.
        // However, we can group them into chunks if they are close.
        
        // Group IDs into chunks where gaps are small (< 100 IDs)
        let mut chunks: Vec<Vec<u32>> = Vec::new();
        let mut current_chunk: Vec<u32> = Vec::new();
        
        for &id in &sorted_ids {
            if current_chunk.is_empty() {
                current_chunk.push(id);
            } else {
                let last_id = *current_chunk.last().unwrap();
                if id - last_id < 100 {
                    current_chunk.push(id);
                } else {
                    chunks.push(current_chunk);
                    current_chunk = vec![id];
                }
            }
        }
        if !current_chunk.is_empty() {
            chunks.push(current_chunk);
        }

        // Process each chunk
        for chunk in chunks {
            if chunk.is_empty() { continue; }
            
            let start_id = chunk[0];
            let end_id = *chunk.last().unwrap();
            let count = end_id - start_id + 1;

            // Read addresses for this chunk
            let start_offset = reader.header_size + ((start_id - 1) as u64 * 4);
            
            reader.file.seek(SeekFrom::Start(start_offset))
                .map_err(|e| format!("Failed to seek to address table: {}", e))?;

            let mut addresses_buf = vec![0u8; (count * 4) as usize];
            reader.file.read_exact(&mut addresses_buf)
                .map_err(|e| format!("Failed to read address table: {}", e))?;

            // Collect valid file positions
            let mut valid_sprites = Vec::with_capacity(chunk.len());
            
            for &id in &chunk {
                let offset_idx = (id - start_id) as usize;
                let offset = offset_idx * 4;
                
                let address = u32::from_le_bytes([
                    addresses_buf[offset],
                    addresses_buf[offset + 1],
                    addresses_buf[offset + 2],
                    addresses_buf[offset + 3],
                ]);

                if address != 0 {
                    valid_sprites.push((id, address as u64));
                } else {
                    sprites.push(SpriteData {
                        id,
                        is_empty: true,
                        compressed_pixels: Vec::new(),
                    });
                }
            }

            if valid_sprites.is_empty() {
                continue;
            }

            // Sort by file position
            valid_sprites.sort_by_key(|k| k.1);

            // Read sprite data
            // Use the same logic as batch read: if dense, read block; if sparse, read individually
            let min_pos = valid_sprites.first().unwrap().1;
            let max_pos = valid_sprites.last().unwrap().1;
            
            // Estimate span size (max_pos + ~8KB - min_pos)
            let span_size = (max_pos + 8192) - min_pos;

            // If span is reasonable (< 5MB) and density is high enough, read bulk
            // Density check: if we are reading > 20% of the span, it's worth reading the whole thing
            // to avoid seeks.
            // Average sprite size ~500 bytes.
            let estimated_data_size = valid_sprites.len() as u64 * 500;
            
            if span_size < 5 * 1024 * 1024 && (estimated_data_size * 5 > span_size || valid_sprites.len() > 50) {
                 // BULK READ
                reader.file.seek(SeekFrom::Start(min_pos))
                    .map_err(|e| format!("Failed to seek to data block: {}", e))?;

                let mut file_buf = vec![0u8; span_size as usize];
                let bytes_read = reader.file.read(&mut file_buf)
                    .map_err(|e| format!("Failed to read data block: {}", e))?;

                for (id, pos) in valid_sprites {
                    let local_offset = (pos - min_pos) as usize;
                    
                    if local_offset + 5 > bytes_read { continue; }

                    let len_offset = local_offset + 3; // Skip RGB
                    let length = u16::from_le_bytes([
                        file_buf[len_offset],
                        file_buf[len_offset + 1]
                    ]);

                    if length == 0 {
                        sprites.push(SpriteData { id, is_empty: true, compressed_pixels: Vec::new() });
                        continue;
                    }

                    let data_offset = len_offset + 2;
                    let data_end = data_offset + length as usize;

                    if data_end <= bytes_read {
                        sprites.push(SpriteData {
                            id,
                            is_empty: false,
                            compressed_pixels: file_buf[data_offset..data_end].to_vec(),
                        });
                    }
                }
            } else {
                // SEQUENTIAL READ
                let mut current_pos = reader.file.stream_position()
                    .map_err(|e| format!("Failed to get stream pos: {}", e))?;

                for (id, pos) in valid_sprites {
                    let target_pos = pos + 3; // Skip RGB
                    
                    if current_pos != target_pos {
                        reader.file.seek(SeekFrom::Start(target_pos))
                            .map_err(|e| format!("Failed to seek: {}", e))?;
                        current_pos = target_pos;
                    }

                    let mut len_buf = [0u8; 2];
                    reader.file.read_exact(&mut len_buf)
                        .map_err(|e| format!("Failed to read length: {}", e))?;
                    current_pos += 2;
                    
                    let length = u16::from_le_bytes(len_buf);

                    if length == 0 {
                        sprites.push(SpriteData { id, is_empty: true, compressed_pixels: Vec::new() });
                        continue;
                    }

                    let mut pixels = vec![0u8; length as usize];
                    reader.file.read_exact(&mut pixels)
                        .map_err(|e| format!("Failed to read pixels: {}", e))?;
                    current_pos += length as u64;

                    sprites.push(SpriteData {
                        id,
                        is_empty: false,
                        compressed_pixels: pixels,
                    });
                }
            }
        }

        Ok(sprites)
    }

    /// Read a list of sprites and return them as a compact binary buffer
    /// Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][Len: u32][Data...])*
    pub fn read_sprites_list_binary(&mut self, path: &str, ids: Vec<u32>) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_list(path, ids)?;
        Ok(Self::pack_sprites(sprites))
    }

    /// Read a batch of sprites and return them as a compact binary buffer
    pub fn read_sprites_batch_binary(&mut self, path: &str, start_id: u32, count: u32) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_batch(path, start_id, count)?;
        Ok(Self::pack_sprites(sprites))
    }

    /// Read a single sprite and return it as a compact binary buffer (list of 1)
    pub fn read_sprite_binary(&mut self, path: &str, id: u32) -> Result<Vec<u8>, String> {
        let sprite = self.read_sprite(path, id)?;
        Ok(Self::pack_sprites(vec![sprite]))
    }

    /// Helper to pack sprites into binary format
    fn pack_sprites(sprites: Vec<SpriteData>) -> Vec<u8> {
        let total_pixel_bytes: usize = sprites.iter().map(|s| s.compressed_pixels.len()).sum();
        let metadata_bytes = sprites.len() * (4 + 1 + 4); // ID(4) + Empty(1) + Len(4)
        let header_bytes = 4; // Count(4)

        let mut buffer = Vec::with_capacity(header_bytes + metadata_bytes + total_pixel_bytes);

        // Write Count
        buffer.extend_from_slice(&(sprites.len() as u32).to_le_bytes());

        for sprite in sprites {
            // Write ID
            buffer.extend_from_slice(&sprite.id.to_le_bytes());

            // Write IsEmpty
            buffer.push(if sprite.is_empty { 1 } else { 0 });

            // Write Length
            buffer.extend_from_slice(&(sprite.compressed_pixels.len() as u32).to_le_bytes());

            // Write Data
            buffer.extend_from_slice(&sprite.compressed_pixels);
        }
        buffer
    }

    /// Read sprites and return decompressed RGBA pixels
    /// Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][RGBA pixels: 4096 bytes])*
    /// Each sprite is exactly 4096 bytes (32x32x4 RGBA)
    pub fn read_sprites_rgba(&mut self, path: &str, ids: Vec<u32>, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_list(path, ids)?;
        Ok(Self::pack_sprites_rgba(sprites, transparent))
    }

    /// Read a batch of sprites and return decompressed RGBA pixels
    pub fn read_sprites_batch_rgba(&mut self, path: &str, start_id: u32, count: u32, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_batch(path, start_id, count)?;
        Ok(Self::pack_sprites_rgba(sprites, transparent))
    }

    /// Read sprites and return LZ4-compressed RGBA pixels for faster IPC transfer
    /// The RGBA data is first decompressed from Tibia's RLE format, then LZ4 compressed
    /// This reduces IPC transfer size by ~5x (7-8MB -> 1.5MB for outfit pages)
    pub fn read_sprites_rgba_lz4(&mut self, path: &str, ids: Vec<u32>, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_list(path, ids)?;
        Ok(Self::pack_sprites_rgba_lz4(sprites, transparent))
    }

    /// Read a batch of sprites and return LZ4-compressed RGBA pixels
    pub fn read_sprites_batch_rgba_lz4(&mut self, path: &str, start_id: u32, count: u32, transparent: bool) -> Result<Vec<u8>, String> {
        let sprites = self.read_sprites_batch(path, start_id, count)?;
        Ok(Self::pack_sprites_rgba_lz4(sprites, transparent))
    }

    /// Pack sprites with RGBA pixels and then LZ4 compress for fast IPC transfer
    /// LZ4 is very fast to decompress (~2GB/s) while providing ~5x compression on RGBA data
    fn pack_sprites_rgba_lz4(sprites: Vec<SpriteData>, transparent: bool) -> Vec<u8> {
        // First, pack to uncompressed RGBA format
        let uncompressed = Self::pack_sprites_rgba(sprites, transparent);

        // Then compress with LZ4 (prepend size for decompression)
        lz4_flex::compress_prepend_size(&uncompressed)
    }

    /// Helper to pack sprites with decompressed RGBA pixels
    /// Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][CompressedLen: u32][CompressedData...][RGBA pixels: 4096 bytes])*
    ///
    /// We include both compressed data (for saving) and RGBA pixels (for rendering)
    /// Uses parallel processing with rayon for faster decompression
    fn pack_sprites_rgba(sprites: Vec<SpriteData>, transparent: bool) -> Vec<u8> {
        // Step 1: Decompress all sprites in parallel
        // Each thread decompresses its own sprites independently
        let decompressed: Vec<(SpriteData, Vec<u8>)> = sprites
            .into_par_iter()
            .map(|sprite| {
                let rgba = decompress_to_rgba(&sprite.compressed_pixels, transparent);
                (sprite, rgba)
            })
            .collect();

        // Step 2: Calculate total buffer size
        let header_bytes = 4; // Count(4)
        let total_compressed: usize = decompressed.iter()
            .map(|(s, _)| s.compressed_pixels.len())
            .sum();
        // ID(4) + Empty(1) + CompressedLen(4) + compressed_data + RGBA(4096) per sprite
        let total_size = header_bytes
            + decompressed.len() * (4 + 1 + 4 + SPRITE_DATA_SIZE)
            + total_compressed;

        let mut buffer = Vec::with_capacity(total_size);

        // Step 3: Write header
        buffer.extend_from_slice(&(decompressed.len() as u32).to_le_bytes());

        // Step 4: Write all sprite data sequentially (fast memory copy)
        for (sprite, rgba) in decompressed {
            // Write ID
            buffer.extend_from_slice(&sprite.id.to_le_bytes());

            // Write IsEmpty
            buffer.push(if sprite.is_empty { 1 } else { 0 });

            // Write Compressed Pixels Length
            buffer.extend_from_slice(&(sprite.compressed_pixels.len() as u32).to_le_bytes());

            // Write Compressed Pixels Data (for saving back to file)
            buffer.extend_from_slice(&sprite.compressed_pixels);

            // Write RGBA pixels (already decompressed in parallel)
            buffer.extend_from_slice(&rgba);
        }
        buffer
    }
}

/// Decompress Tibia's RLE-compressed sprite data directly to RGBA format
/// This is the Rust implementation of the TypeScript decompressPixels function
///
/// Format:
/// - Alternates between transparent and colored pixel chunks
/// - Each chunk has a 2-byte count (little-endian u16)
/// - Transparent pixels: just count (no data)
/// - Colored pixels: RGB or RGBA bytes follow (depending on transparent flag)
///
/// Output: 4096 bytes of RGBA data (32x32 pixels, 4 bytes per pixel)
fn decompress_to_rgba(compressed: &[u8], transparent: bool) -> Vec<u8> {
    let mut pixels = vec![0u8; SPRITE_DATA_SIZE];
    let mut write_pos = 0;
    let mut read_pos = 0;
    let channels = if transparent { 4 } else { 3 };

    // Process chunks until we run out of data or fill the buffer
    while read_pos + 4 <= compressed.len() && write_pos < SPRITE_DATA_SIZE {
        // Read transparent pixels count (2 bytes, little-endian)
        let transparent_count = u16::from_le_bytes([
            compressed[read_pos],
            compressed[read_pos + 1]
        ]) as usize;
        read_pos += 2;

        // Read colored pixels count (2 bytes, little-endian)
        let colored_count = u16::from_le_bytes([
            compressed[read_pos],
            compressed[read_pos + 1]
        ]) as usize;
        read_pos += 2;

        // Determine actual channels to read (fallback to 3 if not enough data for 4)
        let mut current_channels = channels;
        let bytes_needed = colored_count * current_channels;

        if read_pos + bytes_needed > compressed.len() {
            // Fallback: if we expected 4 channels but don't have enough data, try 3
            if transparent && read_pos + colored_count * 3 <= compressed.len() {
                current_channels = 3;
            } else {
                // Not enough data, stop processing
                break;
            }
        }

        // Write transparent pixels (RGBA = 0x00000000)
        for _ in 0..transparent_count {
            if write_pos >= SPRITE_DATA_SIZE {
                break;
            }
            pixels[write_pos] = 0;     // R
            pixels[write_pos + 1] = 0; // G
            pixels[write_pos + 2] = 0; // B
            pixels[write_pos + 3] = 0; // A
            write_pos += 4;
        }

        // Write colored pixels (convert from RGB/RGBA to RGBA)
        for _ in 0..colored_count {
            if write_pos >= SPRITE_DATA_SIZE {
                break;
            }

            let red = compressed[read_pos];
            let green = compressed[read_pos + 1];
            let blue = compressed[read_pos + 2];
            read_pos += 3;

            let alpha = if current_channels == 4 {
                let a = compressed[read_pos];
                read_pos += 1;
                a
            } else {
                0xFF
            };

            // Write as RGBA (canvas native format)
            pixels[write_pos] = red;       // R
            pixels[write_pos + 1] = green; // G
            pixels[write_pos + 2] = blue;  // B
            pixels[write_pos + 3] = alpha; // A
            write_pos += 4;
        }
    }

    // Remaining pixels are already initialized to 0 (transparent black)
    pixels
}

/// Type alias for thread-safe SPR manager
pub type SprManagerState = Arc<Mutex<SprManager>>;
