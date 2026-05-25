use std::collections::{HashMap, HashSet};
use sha1::{Sha1, Digest};
use crate::spr_manager::{SprManagerState, SprFileReader};
use crate::spr_writer::SpriteWrite;

/// Request body (raw binary):
///   [extended: u8][path: u16-len + UTF-8][used_ids_blob: rest (4 bytes per u32 LE)]
///
/// Response body:
///   [old_total: u32 LE][new_total: u32 LE][removed_count: u32 LE]
///   [temp_path: u16-len + UTF-8][remap_blob: rest (8 bytes per pair)]
#[tauri::command]
pub async fn optimize_sprites_rust(
    app: tauri::AppHandle,
    request: tauri::ipc::Request<'_>,
    _spr_state: tauri::State<'_, SprManagerState>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("optimize_sprites_rust expects a raw binary payload".to_string()),
    };
    if bytes.len() < 3 {
        return Err("optimize_sprites_rust payload too small".to_string());
    }
    let extended = bytes[0] != 0;
    let path_len = u16::from_le_bytes([bytes[1], bytes[2]]) as usize;
    if bytes.len() < 3 + path_len {
        return Err("optimize_sprites_rust payload truncated at path".to_string());
    }
    let path = String::from_utf8_lossy(&bytes[3..3 + path_len]).into_owned();
    let used_ids_blob: Vec<u8> = bytes[3 + path_len..].to_vec();
    // 1. Read all sprites using a local reader (avoids locking the shared manager)
    // We run this in a blocking task to avoid blocking the async runtime
    let path_clone = path.clone();
    let used_ids_blob_clone = used_ids_blob.clone();
    
    let app_handle = app.clone();
    
    let (remap_blob, removed_count, old_total, new_total, temp_path) = tauri::async_runtime::spawn_blocking(move || {
        use tauri::Emitter;
        
        // Open a separate reader
        let mut reader = SprFileReader::open(&path_clone, extended)
            .map_err(|e| format!("Failed to open SPR file: {}", e))?;
            
        let header = reader.get_header();
        let old_total = header.sprite_count;
        let signature = header.signature;
        
        // Convert blob back to HashSet<u32>
        let used_set: HashSet<u32> = used_ids_blob_clone
            .chunks_exact(4)
            .map(|chunk| u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
            .collect();

        let mut hashes: HashMap<String, u32> = HashMap::new();
        let mut remap: HashMap<u32, u32> = HashMap::new();
        let mut unique_sprites: HashMap<u32, Vec<u8>> = HashMap::new();
        
        // 2. Hash sprites
        for id in 1..=old_total {
            if id % 1000 == 0 {
                let _ = app_handle.emit("optimizer-progress", format!("Hashing sprites: {}/{}", id, old_total));
            }
            
            let sprite = match reader.read_sprite(id) {
                Ok(s) => s,
                Err(_) => {
                    remap.insert(id, id);
                    continue;
                }
            };
            
            if sprite.is_empty {
                let hash = "empty".to_string();
                if let Some(&canonical_id) = hashes.get(&hash) {
                    remap.insert(id, canonical_id);
                } else {
                    hashes.insert(hash, id);
                    remap.insert(id, id);
                    unique_sprites.insert(id, Vec::new());
                }
                continue;
            }
            
            let mut hasher = Sha1::new();
            hasher.update(&sprite.compressed_pixels);
            let result = hasher.finalize();
            let hash = format!("{:x}", result);
            
            if let Some(&canonical_id) = hashes.get(&hash) {
                remap.insert(id, canonical_id);
            } else {
                hashes.insert(hash, id);
                remap.insert(id, id);
                unique_sprites.insert(id, sprite.compressed_pixels);
            }
        }
        
        // 3. Filter used sprites
        let _ = app_handle.emit("optimizer-progress", "Filtering unused sprites...");
        
        let mut final_remap: HashMap<u32, u32> = HashMap::new();
        let mut new_sprites: Vec<(u32, Vec<u8>)> = Vec::new();
        let mut new_id_counter = 1;
        
        let mut used_canonical_ids: HashSet<u32> = HashSet::new();
        for old_id in &used_set {
            if let Some(&canonical) = remap.get(old_id) {
                used_canonical_ids.insert(canonical);
            }
        }
        
        let mut canonical_to_new: HashMap<u32, u32> = HashMap::new();
        
        for id in 1..=old_total {
            // Check if this ID is a canonical sprite (it exists in unique_sprites) AND it is used
            if unique_sprites.contains_key(&id) && used_canonical_ids.contains(&id) {
                let new_id = new_id_counter;
                new_id_counter += 1;
                
                canonical_to_new.insert(id, new_id);
                
                if let Some(pixels) = unique_sprites.get(&id) {
                    new_sprites.push((new_id, pixels.clone()));
                }
            }
        }
        
        for id in 1..=old_total {
            if let Some(&canonical) = remap.get(&id) {
                if let Some(&new_id) = canonical_to_new.get(&canonical) {
                    final_remap.insert(id, new_id);
                }
            }
        }
        
        // 4. Write to TEMP file
        let _ = app_handle.emit("optimizer-progress", "Writing optimized file...");
        
        // Create a NamedTempFile to ensure we have a unique path and can persist it
        let temp_file = tempfile::Builder::new()
            .prefix("tibia_opt_")
            .suffix(".spr")
            .tempfile()
            .map_err(|e| format!("Failed to create temp file: {}", e))?;
            
        let _temp_path_str = temp_file.path().to_string_lossy().to_string();
        
        let sprites_to_write: Vec<SpriteWrite> = new_sprites.into_iter().map(|(id, pixels)| {
            SpriteWrite {
                id,
                is_empty: pixels.is_empty(),
                compressed_pixels: pixels,
            }
        }).collect();
        
        // We need to write to this path. 
        // Note: write_spr_file takes a path string and creates a file.
        // But NamedTempFile already created it.
        // We should probably just use the path and let write_spr_file overwrite it or open it.
        // However, NamedTempFile deletes on drop. We need to persist it NOW or return it.
        // We can't return NamedTempFile easily from spawn_blocking.
        // So we persist it HERE inside the thread.
        
        let (_, path_buf) = temp_file.keep().map_err(|e| format!("Failed to persist temp file: {}", e))?;
        let persisted_path = path_buf.to_string_lossy().to_string();
        
        // Now write to the persisted path
        crate::spr_writer::write_spr_file(&persisted_path, signature, extended, sprites_to_write)
            .map_err(|e| format!("Failed to write temp file: {}", e))?;
            
        let mut remap_blob = Vec::with_capacity(final_remap.len() * 8);
        for (old, new) in final_remap {
            remap_blob.extend_from_slice(&old.to_le_bytes());
            remap_blob.extend_from_slice(&new.to_le_bytes());
        }
        
        Ok::<(Vec<u8>, u32, u32, u32, String), String>((
            remap_blob,
            old_total - (new_id_counter - 1),
            old_total,
            new_id_counter - 1,
            persisted_path
        ))
    }).await.map_err(|e| format!("Task join error: {}", e))??;

    // 5. Pack response as binary
    let path_bytes = temp_path.as_bytes();
    let mut response = Vec::with_capacity(4 + 4 + 4 + 2 + path_bytes.len() + remap_blob.len());
    response.extend_from_slice(&old_total.to_le_bytes());
    response.extend_from_slice(&new_total.to_le_bytes());
    response.extend_from_slice(&removed_count.to_le_bytes());
    response.extend_from_slice(&(path_bytes.len() as u16).to_le_bytes());
    response.extend_from_slice(path_bytes);
    response.extend_from_slice(&remap_blob);

    Ok(tauri::ipc::Response::new(response))
}

#[tauri::command]
pub fn apply_optimization(
    temp_path: String,
    original_path: String,
    spr_state: tauri::State<SprManagerState>,
) -> Result<(), String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    
    // Close the file in manager to release the handle if it's open
    // CRITICAL: We must close BOTH the original file AND the temp file (which is currently open as data.sprPath)
    manager.close_file(&original_path).ok();
    manager.close_file(&temp_path).ok();
    
    // Replace original with temp
    // We use copy + remove instead of rename because rename fails across different drives/partitions
    // (e.g., temp folder on C: and project on D:)
    if std::path::Path::new(&original_path).exists() {
         std::fs::remove_file(&original_path).map_err(|e| format!("Failed to remove original file: {}", e))?;
    }
    
    std::fs::copy(&temp_path, &original_path).map_err(|e| format!("Failed to copy temp file to original: {}", e))?;
    std::fs::remove_file(&temp_path).map_err(|e| format!("Failed to remove temp file: {}", e))?;
    
    // Re-open the file in manager (it might be needed immediately)
    // We don't know if extended was true/false here easily without passing it, 
    // but usually the frontend reloads data anyway.
    // However, to be safe, we can try to detect or just leave it closed until next read.
    // The SprManager opens on demand usually.
    
    Ok(())
}
