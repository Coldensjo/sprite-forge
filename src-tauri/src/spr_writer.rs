use serde::Deserialize;
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufReader, BufWriter, Write, Read, Seek, SeekFrom};

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpriteWrite {
    pub id: u32,
    pub is_empty: bool,
    #[serde(with = "serde_bytes")]
    pub compressed_pixels: Vec<u8>,
}

pub fn write_spr_file(
    path: &str,
    signature: u32,
    extended: bool,
    sprites: Vec<SpriteWrite>,
) -> Result<(), String> {
    let mut file = File::create(path).map_err(|e| format!("Failed to create SPR file: {}", e))?;

    let sprite_count = sprites.len() as u32;
    let header_size = if extended { 8 } else { 6 };

    file.write_all(&signature.to_le_bytes())
        .map_err(|e| format!("Failed to write signature: {}", e))?;

    if extended {
        file.write_all(&sprite_count.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    } else {
        if sprite_count > 0xFFFE {
            return Err("Sprite count exceeds non-extended format limit (65534); 0xFFFF is reserved".to_string());
        }
        file.write_all(&(sprite_count as u16).to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    }

    let address_table_size = sprite_count * 4;
    let data_start = header_size + address_table_size as u64;

    let zero_addresses = vec![0u8; address_table_size as usize];
    file.write_all(&zero_addresses)
        .map_err(|e| format!("Failed to write address table placeholder: {}", e))?;

    let mut addresses = Vec::with_capacity(sprite_count as usize);
    let mut current_position = data_start;

    for sprite in sprites {
        if sprite.is_empty {
            addresses.push(0u32);
        } else {
            addresses.push(current_position as u32);

            file.write_all(&[0xFF, 0x00, 0xFF])
                .map_err(|e| format!("Failed to write sprite RGB header: {}", e))?;

            let length = sprite.compressed_pixels.len();
            if length > 0xFFFF {
                return Err(format!("Sprite {} data too large ({})", sprite.id, length));
            }
            file.write_all(&(length as u16).to_le_bytes())
                .map_err(|e| format!("Failed to write sprite length: {}", e))?;

            file.write_all(&sprite.compressed_pixels)
                .map_err(|e| format!("Failed to write sprite data: {}", e))?;

            current_position += 3 + 2 + length as u64;
        }
    }

    file.seek(SeekFrom::Start(header_size))
        .map_err(|e| format!("Failed to seek to address table: {}", e))?;

    for address in addresses {
        file.write_all(&address.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite address: {}", e))?;
    }

    Ok(())
}

pub fn update_sprites_in_spr(
    path: &str,
    extended: bool,
    sprites: Vec<SpriteWrite>,
    sprites_count: u32,
) -> Result<(), String> {
    let mut file = File::options()
        .read(true)
        .write(true)
        .open(path)
        .map_err(|e| format!("Failed to open SPR file: {}", e))?;

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

    if sprites_count != existing_sprite_count {
        file.seek(SeekFrom::Start(4))
            .map_err(|e| format!("Failed to seek to sprite count: {}", e))?;

        if extended {
            file.write_all(&sprites_count.to_le_bytes())
                .map_err(|e| format!("Failed to write new sprite count: {}", e))?;
        } else {
            if sprites_count > 0xFFFE {
                return Err("Sprite count exceeds non-extended format limit (65534); 0xFFFF is reserved".to_string());
            }
            file.write_all(&(sprites_count as u16).to_le_bytes())
                .map_err(|e| format!("Failed to write new sprite count: {}", e))?;
        }
    }

    let max_count = std::cmp::max(existing_sprite_count, sprites_count);

    file.seek(SeekFrom::Start(header_size))
        .map_err(|e| format!("Failed to seek to address table: {}", e))?;

    let mut address_table = vec![0u8; (existing_sprite_count * 4) as usize];
    file.read_exact(&mut address_table)
        .map_err(|e| format!("Failed to read address table: {}", e))?;

    let file_end = file.seek(SeekFrom::End(0))
        .map_err(|e| format!("Failed to seek to end: {}", e))?;

    let mut sprites_to_update: HashMap<u32, &SpriteWrite> = HashMap::new();

    for sprite in &sprites {
        if sprite.id == 0 {
            return Err("Sprite ID cannot be 0".to_string());
        }
        sprites_to_update.insert(sprite.id, sprite);
    }

    if sprites_count != existing_sprite_count {
        return Err(format!(
            "FULL_REWRITE_REQUIRED: Sprite count changed from {} to {}. In-place update not safe.",
            existing_sprite_count,
            sprites_count
        ));
    }

    let mut updated_addresses: HashMap<u32, u32> = HashMap::new();
    let mut current_write_position = file_end;

    for (&sprite_id, sprite_data) in &sprites_to_update {
        if sprite_id > sprites_count {
            continue;
        }

        if sprite_data.is_empty {
            updated_addresses.insert(sprite_id, 0);
        } else {
            file.seek(SeekFrom::Start(current_write_position))
                .map_err(|e| format!("Failed to seek to write position: {}", e))?;

            file.write_all(&[0xFF, 0x00, 0xFF])
                .map_err(|e| format!("Failed to write sprite RGB header: {}", e))?;

            let length = sprite_data.compressed_pixels.len();
            if length > 0xFFFF {
                return Err(format!("Sprite {} data too large", sprite_id));
            }
            file.write_all(&(length as u16).to_le_bytes())
                .map_err(|e| format!("Failed to write sprite length: {}", e))?;

            file.write_all(&sprite_data.compressed_pixels)
                .map_err(|e| format!("Failed to write sprite data: {}", e))?;

            updated_addresses.insert(sprite_id, current_write_position as u32);
            current_write_position += 3 + 2 + length as u64;
        }
    }

    for (sprite_id, new_address) in updated_addresses {
        let address_offset = header_size + ((sprite_id - 1) * 4) as u64;

        file.seek(SeekFrom::Start(address_offset))
            .map_err(|e| format!("Failed to seek to address entry: {}", e))?;

        file.write_all(&new_address.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite address: {}", e))?;
    }

    file.flush()
        .map_err(|e| format!("Failed to flush SPR file: {}", e))?;

    Ok(())
}

pub fn copy_spr_with_modifications(
    source_path: &str,
    dest_path: &str,
    extended: bool,
    signature: u32,
    target_count: u32,
    modifications: Vec<SpriteWrite>,
) -> Result<(), String> {
    let same_file = source_path == dest_path;
    let temp_path = if same_file {
        format!("{}.tmp", dest_path)
    } else {
        dest_path.to_string()
    };

    let mut source = BufReader::new(
        File::open(source_path).map_err(|e| format!("Failed to open source SPR file: {}", e))?,
    );

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

    let mut source_addresses = Vec::with_capacity(sprite_count as usize);
    for _ in 0..sprite_count {
        let mut addr_buf = [0u8; 4];
        source.read_exact(&mut addr_buf)
            .map_err(|e| format!("Failed to read address: {}", e))?;
        source_addresses.push(u32::from_le_bytes(addr_buf));
    }

    let source_len = source
        .get_ref()
        .metadata()
        .map_err(|e| format!("Failed to stat source SPR file: {}", e))?
        .len();

    let mut mods_map: std::collections::HashMap<u32, &SpriteWrite> = std::collections::HashMap::new();
    for sprite in &modifications {
        mods_map.insert(sprite.id, sprite);
    }

    let mut dest = BufWriter::new(
        File::create(&temp_path).map_err(|e| format!("Failed to create dest SPR file: {}", e))?,
    );

    dest.write_all(&signature.to_le_bytes())
        .map_err(|e| format!("Failed to write signature: {}", e))?;

    if extended {
        dest.write_all(&target_count.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    } else {
        if target_count > 0xFFFE {
            return Err("Sprite count exceeds non-extended format limit (65534); 0xFFFF is reserved".to_string());
        }
        dest.write_all(&(target_count as u16).to_le_bytes())
            .map_err(|e| format!("Failed to write sprite count: {}", e))?;
    }

    let address_table_size = target_count * 4;
    let data_start = header_size + address_table_size as u64;
    let zero_addresses = vec![0u8; address_table_size as usize];
    dest.write_all(&zero_addresses)
        .map_err(|e| format!("Failed to write address table placeholder: {}", e))?;

    let mut new_addresses = Vec::with_capacity(target_count as usize);
    let mut current_position = data_start;
    let mut bad_addresses = 0u32;

    for sprite_id in 1..=target_count {
        let source_address = if sprite_id <= sprite_count {
            source_addresses[(sprite_id - 1) as usize]
        } else {
            0
        };

        if let Some(mod_sprite) = mods_map.get(&sprite_id) {
            if mod_sprite.is_empty {
                new_addresses.push(0u32);
            } else {
                new_addresses.push(current_position as u32);

                dest.write_all(&[0xFF, 0x00, 0xFF])
                    .map_err(|e| format!("Failed to write RGB header: {}", e))?;

                let length = mod_sprite.compressed_pixels.len();
                dest.write_all(&(length as u16).to_le_bytes())
                    .map_err(|e| format!("Failed to write sprite length: {}", e))?;

                dest.write_all(&mod_sprite.compressed_pixels)
                    .map_err(|e| format!("Failed to write sprite data: {}", e))?;

                current_position += 3 + 2 + length as u64;
            }
        } else if source_address == 0 {
            new_addresses.push(0u32);
        } else {
            if source_address as u64 + 5 > source_len {
                bad_addresses += 1;
                new_addresses.push(0u32);
                continue;
            }

            source.seek(SeekFrom::Start(source_address as u64))
                .map_err(|e| format!("Failed to seek to source sprite {}: {}", sprite_id, e))?;

            let mut rgb = [0u8; 3];
            source.read_exact(&mut rgb)
                .map_err(|e| format!("Failed to read RGB header for sprite {} at {}: {}", sprite_id, source_address, e))?;

            let mut len_buf = [0u8; 2];
            source.read_exact(&mut len_buf)
                .map_err(|e| format!("Failed to read length for sprite {} at {}: {}", sprite_id, source_address, e))?;
            let length = u16::from_le_bytes(len_buf) as usize;

            if source_address as u64 + 5 + length as u64 > source_len {
                bad_addresses += 1;
                new_addresses.push(0u32);
                continue;
            }

            let mut data = vec![0u8; length];
            if length > 0 {
                source.read_exact(&mut data)
                    .map_err(|e| format!("Failed to read data for sprite {} at {}: {}", sprite_id, source_address, e))?;
            }

            new_addresses.push(current_position as u32);
            dest.write_all(&rgb)
                .map_err(|e| format!("Failed to write RGB header: {}", e))?;
            dest.write_all(&len_buf)
                .map_err(|e| format!("Failed to write sprite length: {}", e))?;
            dest.write_all(&data)
                .map_err(|e| format!("Failed to write sprite data: {}", e))?;

            current_position += 3 + 2 + length as u64;
        }
    }

    if bad_addresses > 0 {
        eprintln!(
            "WARNING: {} source sprite(s) in '{}' had out-of-range/corrupt addresses and were written empty (header claims {} sprites, file is {} bytes)",
            bad_addresses, source_path, sprite_count, source_len
        );
    }

    dest.seek(SeekFrom::Start(header_size))
        .map_err(|e| format!("Failed to seek to address table: {}", e))?;

    for address in new_addresses {
        dest.write_all(&address.to_le_bytes())
            .map_err(|e| format!("Failed to write sprite address: {}", e))?;
    }

    dest.flush()
        .map_err(|e| format!("Failed to flush dest file: {}", e))?;

    drop(source);
    drop(dest);

    if same_file {
        std::fs::remove_file(dest_path)
            .map_err(|e| format!("Failed to remove original file: {}", e))?;
        std::fs::rename(&temp_path, dest_path)
            .map_err(|e| format!("Failed to rename temp file: {}", e))?;
    }

    Ok(())
}
