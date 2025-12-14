use serde::Deserialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{Write, Read, Seek, SeekFrom};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpriteWrite {
    pub id: u32,
    pub is_empty: bool,
    #[serde(with = "serde_bytes")]
    pub compressed_pixels: Vec<u8>,
}

/// Write a complete SPR file
pub fn write_spr_file(
    path: &str,
    signature: u32,
    extended: bool,
    sprites: Vec<SpriteWrite>,
) -> Result<(), String> {
    let mut file = File::create(path).map_err(|e| format!("Failed to create SPR file: {}", e))?;

    let sprite_count = sprites.len() as u32;
    let header_size = if extended { 8 } else { 6 };

    // Write header
    file.write_all(&signature.to_le_bytes())
        .map_err(|e| format!("Failed to write signature: {}", e))?;

    if extended {
        file.write_all(&sprite_count.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    } else {
        if sprite_count > 0xFFFF {
            return Err("Sprite count exceeds non-extended format limit (65535)".to_string());
        }
        file.write_all(&(sprite_count as u16).to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    }

    // Calculate address table size and data start position
    let address_table_size = sprite_count * 4; // 4 bytes per address
    let data_start = header_size + address_table_size as u64;

    // Reserve space for address table (write zeros for now)
    let zero_addresses = vec![0u8; address_table_size as usize];
    file.write_all(&zero_addresses)
        .map_err(|e| format!("Failed to write address table placeholder: {}", e))?;

    // Write sprites and collect addresses
    let mut addresses = Vec::with_capacity(sprite_count as usize);
    let mut current_position = data_start;

    for sprite in sprites {
        if sprite.is_empty {
            // Empty sprite: address = 0
            addresses.push(0u32);
        } else {
            // Write sprite data
            addresses.push(current_position as u32);

            // CRITICAL: Write RGB header - this is the TRANSPARENCY COLOR (magenta: 0xFF, 0x00, 0xFF)
            // Object Builder writes: 0xFF (red), 0x00 (green), 0xFF (blue)
            file.write_all(&[0xFF, 0x00, 0xFF])
                .map_err(|e| format!("Failed to write sprite RGB header: {}", e))?;

            // Write compressed data length (2 bytes)
            let length = sprite.compressed_pixels.len();
            if length > 0xFFFF {
                return Err(format!("Sprite {} data too large ({})", sprite.id, length));
            }
            file.write_all(&(length as u16).to_le_bytes())
                .map_err(|e| format!("Failed to write sprite length: {}", e))?;

            // Write compressed pixel data
            file.write_all(&sprite.compressed_pixels)
                .map_err(|e| format!("Failed to write sprite data: {}", e))?;

            current_position += 3 + 2 + length as u64;
        }
    }

    // Go back and write the address table
    file.seek(SeekFrom::Start(header_size))
        .map_err(|e| format!("Failed to seek to address table: {}", e))?;

    for address in addresses {
        file.write_all(&address.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite address: {}", e))?;
    }

    Ok(())
}

/// Update specific sprites in an existing SPR file
/// This is more efficient than rewriting the entire file
pub fn update_sprites_in_spr(
    path: &str,
    extended: bool,
    sprites: Vec<SpriteWrite>,
    sprites_count: u32,
) -> Result<(), String> {
    // Open file for reading and writing
    let mut file = File::options()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| format!("Failed to open SPR file: {}", e))?;

    // Read header
    let header_size = if extended { 8 } else { 6 };

    file.seek(SeekFrom::Start(0))
        .map_err(|e| format!("Failed to seek to header: {}", e))?;

    let mut sig_buf = [0u8; 4];
    file.read_exact(&mut sig_buf)
        .map_err(|e| format!("Failed to read signature: {}", e))?;
    let _signature = u32::from_le_bytes(sig_buf);

    let existing_sprite_count = if extended {
        let mut count_buf = [0u8; 4];
        file.read_exact(&mut count_buf)
            .map_err(|e| format!("Failed to read sprite count: {}", e))?;
        u32::from_le_bytes(count_buf)
    } else {
        let mut count_buf = [0u8; 2];
        file.read_exact(&mut count_buf)
            .map_err(|e| format!("Failed to read sprite count: {}", e))?;
        u16::from_le_bytes(count_buf) as u32
    };

    // Update sprite count in header if changed
    if sprites_count != existing_sprite_count {
        file.seek(SeekFrom::Start(4))
            .map_err(|e| format!("Failed to seek to sprite count: {}", e))?;

        if extended {
            file.write_all(&sprites_count.to_le_bytes())
                .map_err(|e| format!("Failed to write new sprite count: {}", e))?;
        } else {
            if sprites_count > 0xFFFF {
                return Err("Sprite count exceeds non-extended format limit (65535)".to_string());
            }
            file.write_all(&(sprites_count as u16).to_le_bytes())
                .map_err(|e| format!("Failed to write new sprite count: {}", e))?;
        }
    }

    // Read entire address table (using the larger of the two counts to be safe)
    let max_count = std::cmp::max(existing_sprite_count, sprites_count);
    
    file.seek(SeekFrom::Start(header_size))
        .map_err(|e| format!("Failed to seek to address table: {}", e))?;

    // We only read what exists
    let mut address_table = vec![0u8; (existing_sprite_count * 4) as usize];
    file.read_exact(&mut address_table)
        .map_err(|e| format!("Failed to read address table: {}", e))?;

    // Get file end position
    let file_end = file.seek(SeekFrom::End(0))
        .map_err(|e| format!("Failed to seek to end: {}", e))?;

    // Create a map of sprite IDs to update
    let mut sprites_to_update: HashMap<u32, &SpriteWrite> = HashMap::new();
    
    for sprite in &sprites {
        if sprite.id == 0 {
            return Err("Sprite ID cannot be 0".to_string());
        }
        sprites_to_update.insert(sprite.id, sprite);
    }

    // CRITICAL: If sprite count changed, we CANNOT safely do an in-place update.
    // The address table size is (sprite_count * 4) bytes.
    // If we expand it, we'll corrupt the sprite data that follows it.
    // If we shrink it, addresses would be in the wrong positions.
    // Return an error so the caller can fall back to a full rewrite.
    if sprites_count != existing_sprite_count {
        return Err(format!(
            "FULL_REWRITE_REQUIRED: Sprite count changed from {} to {}. In-place update not safe.",
            existing_sprite_count,
            sprites_count
        ));
    }

    // Track which addresses we need to update
    let mut updated_addresses: HashMap<u32, u32> = HashMap::new();
    let mut current_write_position = file_end;

    // Process each sprite that needs updating
    for (&sprite_id, sprite_data) in &sprites_to_update {
        // Skip if sprite ID is beyond the new count (e.g. deleted from end)
        if sprite_id > sprites_count {
            continue;
        }

        if sprite_data.is_empty {
            // Update address to 0 (empty sprite)
            updated_addresses.insert(sprite_id, 0);
        } else {
            // Append new sprite data at the end of file
            file.seek(SeekFrom::Start(current_write_position))
                .map_err(|e| format!("Failed to seek to write position: {}", e))?;

            // CRITICAL: Write RGB header - transparency color (magenta: 0xFF, 0x00, 0xFF)
            file.write_all(&[0xFF, 0x00, 0xFF])
                .map_err(|e| format!("Failed to write sprite RGB header: {}", e))?;

            // Write compressed data length
            let length = sprite_data.compressed_pixels.len();
            if length > 0xFFFF {
                return Err(format!("Sprite {} data too large", sprite_id));
            }
            file.write_all(&(length as u16).to_le_bytes())
                .map_err(|e| format!("Failed to write sprite length: {}", e))?;

            // Write compressed pixel data
            file.write_all(&sprite_data.compressed_pixels)
                .map_err(|e| format!("Failed to write sprite data: {}", e))?;

            // Record the new address
            updated_addresses.insert(sprite_id, current_write_position as u32);
            current_write_position += 3 + 2 + length as u64;
        }
    }

    // Update the address table
    for (sprite_id, new_address) in updated_addresses {
        let address_offset = header_size + ((sprite_id - 1) * 4) as u64;

        file.seek(SeekFrom::Start(address_offset))
            .map_err(|e| format!("Failed to seek to address entry: {}", e))?;

        file.write_all(&new_address.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite address: {}", e))?;
    }

    // Flush to ensure data is written to disk
    file.flush()
        .map_err(|e| format!("Failed to flush SPR file: {}", e))?;

    Ok(())
}

/// Copy an SPR file to a new location, applying sprite modifications
/// This is the safest way to do a full recompile - it preserves all sprites
/// that weren't modified, while updating the ones that were.
pub fn copy_spr_with_modifications(
    source_path: &str,
    dest_path: &str,
    extended: bool,
    signature: u32,
    modifications: Vec<SpriteWrite>,
) -> Result<(), String> {
    // If source and dest are the same, use a temp file
    let same_file = source_path == dest_path;
    let temp_path = if same_file {
        format!("{}.tmp", dest_path)
    } else {
        dest_path.to_string()
    };
    
    // Open source file for reading
    let mut source = File::open(source_path)
        .map_err(|e| format!("Failed to open source SPR file: {}", e))?;
    
    // Read source header
    let header_size = if extended { 8 } else { 6 };
    
    source.seek(SeekFrom::Start(0))
        .map_err(|e| format!("Failed to seek in source: {}", e))?;
    
    let mut sig_buf = [0u8; 4];
    source.read_exact(&mut sig_buf)
        .map_err(|e| format!("Failed to read source signature: {}", e))?;
    
    let sprite_count = if extended {
        let mut count_buf = [0u8; 4];
        source.read_exact(&mut count_buf)
            .map_err(|e| format!("Failed to read sprite count: {}", e))?;
        u32::from_le_bytes(count_buf)
    } else {
        let mut count_buf = [0u8; 2];
        source.read_exact(&mut count_buf)
            .map_err(|e| format!("Failed to read sprite count: {}", e))?;
        u16::from_le_bytes(count_buf) as u32
    };
    
    // Read source address table
    let mut source_addresses = Vec::with_capacity(sprite_count as usize);
    for _ in 0..sprite_count {
        let mut addr_buf = [0u8; 4];
        source.read_exact(&mut addr_buf)
            .map_err(|e| format!("Failed to read address: {}", e))?;
        source_addresses.push(u32::from_le_bytes(addr_buf));
    }
    
    // Create modifications map for quick lookup
    let mut mods_map: std::collections::HashMap<u32, &SpriteWrite> = std::collections::HashMap::new();
    for sprite in &modifications {
        mods_map.insert(sprite.id, sprite);
    }
    
    // Create destination file (use temp path if same as source)
    let mut dest = File::create(&temp_path)
        .map_err(|e| format!("Failed to create dest SPR file: {}", e))?;
    
    // Write header
    dest.write_all(&signature.to_le_bytes())
        .map_err(|e| format!("Failed to write signature: {}", e))?;
    
    if extended {
        dest.write_all(&sprite_count.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    } else {
        dest.write_all(&(sprite_count as u16).to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    }
    
    // Reserve space for address table
    let address_table_size = sprite_count * 4;
    let data_start = header_size + address_table_size as u64;
    let zero_addresses = vec![0u8; address_table_size as usize];
    dest.write_all(&zero_addresses)
        .map_err(|e| format!("Failed to write address table placeholder: {}", e))?;
    
    // Write sprite data
    let mut new_addresses = Vec::with_capacity(sprite_count as usize);
    let mut current_position = data_start;
    
    for sprite_id in 1..=sprite_count {
        let source_address = source_addresses[(sprite_id - 1) as usize];
        
        // Check if we have a modification for this sprite
        if let Some(mod_sprite) = mods_map.get(&sprite_id) {
            if mod_sprite.is_empty {
                new_addresses.push(0u32);
            } else {
                new_addresses.push(current_position as u32);
                
                // Write RGB header (magenta transparency color)
                dest.write_all(&[0xFF, 0x00, 0xFF])
                    .map_err(|e| format!("Failed to write RGB header: {}", e))?;
                
                // Write length and data
                let length = mod_sprite.compressed_pixels.len();
                dest.write_all(&(length as u16).to_le_bytes())
                    .map_err(|e| format!("Failed to write sprite length: {}", e))?;
                
                dest.write_all(&mod_sprite.compressed_pixels)
                    .map_err(|e| format!("Failed to write sprite data: {}", e))?;
                
                current_position += 3 + 2 + length as u64;
            }
        } else if source_address == 0 {
            // Empty sprite in source
            new_addresses.push(0u32);
        } else {
            // Copy sprite from source
            new_addresses.push(current_position as u32);
            
            // Read sprite data from source
            source.seek(SeekFrom::Start(source_address as u64))
                .map_err(|e| format!("Failed to seek to source sprite: {}", e))?;
            
            // Read RGB header (3 bytes)
            let mut rgb = [0u8; 3];
            source.read_exact(&mut rgb)
                .map_err(|e| format!("Failed to read RGB header: {}", e))?;
            
            // Read length
            let mut len_buf = [0u8; 2];
            source.read_exact(&mut len_buf)
                .map_err(|e| format!("Failed to read sprite length: {}", e))?;
            let length = u16::from_le_bytes(len_buf) as usize;
            
            // Read pixel data
            let mut data = vec![0u8; length];
            if length > 0 {
                source.read_exact(&mut data)
                    .map_err(|e| format!("Failed to read sprite data: {}", e))?;
            }
            
            // Write to destination
            dest.write_all(&rgb)
                .map_err(|e| format!("Failed to write RGB header: {}", e))?;
            dest.write_all(&len_buf)
                .map_err(|e| format!("Failed to write sprite length: {}", e))?;
            dest.write_all(&data)
                .map_err(|e| format!("Failed to write sprite data: {}", e))?;
            
            current_position += 3 + 2 + length as u64;
        }
    }
    
    // Write address table
    dest.seek(SeekFrom::Start(header_size))
        .map_err(|e| format!("Failed to seek to address table: {}", e))?;
    
    for address in new_addresses {
        dest.write_all(&address.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite address: {}", e))?;
    }
    
    dest.flush()
        .map_err(|e| format!("Failed to flush dest file: {}", e))?;
    
    // Drop to close file handles before rename
    drop(source);
    drop(dest);
    
    // If we used a temp file, rename it to the destination
    if same_file {
        // Remove original first
        std::fs::remove_file(dest_path)
            .map_err(|e| format!("Failed to remove original file: {}", e))?;
        // Rename temp to destination
        std::fs::rename(&temp_path, dest_path)
            .map_err(|e| format!("Failed to rename temp file: {}", e))?;
    }
    
    Ok(())
}
