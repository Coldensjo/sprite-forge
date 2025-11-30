use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};

mod spr_manager;
use spr_manager::{SprManager, SprManagerState, SprHeader, SpriteData, compress_to_rle};

mod logger;
use logger::{Logger, LoggerState, EventCode};

mod dat_writer;
use dat_writer::{write_dat_file, ThingType};

mod spr_writer;
use spr_writer::{write_spr_file, update_sprites_in_spr, SpriteWrite};

mod dat_manager;
use dat_manager::{DatManager, DatManagerState};

mod dat_reader;
use dat_reader::{DatReader, encode_dat_to_binary};

mod optimizer;
use optimizer::{optimize_sprites_rust, apply_optimization};

// Wrapper to use serde_bytes for efficient binary transfer
#[derive(Serialize, Deserialize)]
struct FileBytes(#[serde(with = "serde_bytes")] Vec<u8>);

#[tauri::command]
fn read_file(path: String) -> Result<FileBytes, String> {
    fs::read(&path)
        .map(FileBytes)
        .map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file {}: {}", path, e))
}

#[tauri::command]
fn read_file_header(path: String, bytes: usize) -> Result<FileBytes, String> {
    use std::io::Read;
    let mut file = fs::File::open(&path)
        .map_err(|e| format!("Failed to open file {}: {}", path, e))?;

    let mut buffer = vec![0u8; bytes];
    file.read_exact(&mut buffer)
        .map_err(|e| format!("Failed to read {} bytes from {}: {}", bytes, path, e))?;

    Ok(FileBytes(buffer))
}

// SPR Manager Commands

#[tauri::command]
fn open_spr_file(
    path: String,
    extended: bool,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<SprHeader, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = manager.open_file(path.clone(), extended);

    if let Ok(ref header) = result {
        let mut logger = log_state.lock().unwrap();
        logger.log(
            EventCode::SprOpen,
            serde_json::json!({"p": &path, "c": header.sprite_count, "ex": extended})
        );
    }

    result
}

#[tauri::command]
fn read_sprite(
    path: String,
    id: u32,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<SpriteData, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = manager.read_sprite(&path, id);

    if let Ok(ref sprite) = result {
        let mut logger = log_state.lock().unwrap();
        logger.log(
            EventCode::SprRead,
            serde_json::json!({"id": id, "em": sprite.is_empty})
        );
    }

    result
}

#[tauri::command]
fn close_spr_file(
    path: String,
    state: tauri::State<SprManagerState>,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.close_file(&path)
}

#[tauri::command]
fn get_spr_header(
    path: String,
    state: tauri::State<SprManagerState>,
) -> Result<SprHeader, String> {
    let manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.get_header(&path)
}

#[tauri::command]
fn read_sprites_batch(
    path: String,
    start_id: u32,
    count: u32,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Vec<SpriteData>, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = manager.read_sprites_batch(&path, start_id, count);

    if let Ok(ref sprites) = result {
        let mut logger = log_state.lock().unwrap();
        logger.log(
            EventCode::SprBatch,
            serde_json::json!({"s": start_id, "c": count, "ok": sprites.len()})
        );
    }

    result
}

#[tauri::command]
fn read_sprites_list(
    path: String,
    ids: Vec<u32>,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Vec<SpriteData>, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let result = manager.read_sprites_list(&path, ids);

    if let Ok(ref sprites) = result {
        let mut logger = log_state.lock().unwrap();
        logger.log(
            EventCode::SprBatch,
            serde_json::json!({"c": sprites.len(), "list": true})
        );
    }

    result
}

use tauri::ipc::Response;

// Binary protocol for search (receives criteria, returns results)
// Note: Currently searches happen in frontend since DAT data is there
// This command maintains the binary IPC protocol structure
#[tauri::command]
fn search_thing_types_bin(
    criteria: FileBytes,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    // For now, return empty results since DAT data is in frontend
    // In future, we could add DAT reading to Rust and perform search here
    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprBatch, // Reuse event code for now
        serde_json::json!({"sz": criteria.0.len(), "bin": true, "search": true})
    );
    
    // Return empty results buffer: [Count: u32] = [0, 0, 0, 0]
    let empty_results = vec![0u8, 0u8, 0u8, 0u8];
    Ok(Response::new(empty_results))
}

#[tauri::command]
fn read_sprites_list_bin(
    path: String,
    ids: Vec<u32>,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_list_binary(&path, ids)?;

    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprBatch,
        serde_json::json!({"sz": bytes.len(), "bin": true})
    );
    
    Ok(Response::new(bytes))
}

#[tauri::command]
fn read_sprites_batch_bin(
    path: String,
    start_id: u32,
    count: u32,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_batch_binary(&path, start_id, count)?;

    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprBatch,
        serde_json::json!({"sz": bytes.len(), "bin": true, "batch": true})
    );
    
    Ok(Response::new(bytes))
}

#[tauri::command]
fn read_sprite_bin(
    path: String,
    id: u32,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprite_binary(&path, id)?;

    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprRead,
        serde_json::json!({"sz": bytes.len(), "bin": true})
    );

    Ok(Response::new(bytes))
}

/// Read sprites and return decompressed RGBA pixels ready for canvas rendering
/// Format: [Count: u32] -> ([ID: u32][IsEmpty: u8][RGBA pixels: 4096 bytes])*
#[tauri::command]
fn read_sprites_rgba(
    path: String,
    ids: Vec<u32>,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_rgba(&path, ids.clone(), transparent)?;

    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprBatch,
        serde_json::json!({"sz": bytes.len(), "rgba": true, "n": ids.len()})
    );

    Ok(Response::new(bytes))
}

/// Read a batch of sprites and return decompressed RGBA pixels
#[tauri::command]
fn read_sprites_batch_rgba(
    path: String,
    start_id: u32,
    count: u32,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_batch_rgba(&path, start_id, count, transparent)?;

    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprBatch,
        serde_json::json!({"sz": bytes.len(), "rgba": true, "batch": true, "s": start_id, "c": count})
    );

    Ok(Response::new(bytes))
}

/// Read sprites and return LZ4-compressed RGBA pixels for faster IPC transfer
/// The response is LZ4-compressed, reducing transfer size by ~5x (7-8MB -> 1.5MB)
/// Frontend must decompress with LZ4 before parsing
#[tauri::command]
fn read_sprites_rgba_lz4(
    path: String,
    ids: Vec<u32>,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.read_sprites_rgba_lz4(&path, ids.clone(), transparent)?;

    let mut logger = log_state.lock().unwrap();
    logger.log(
        EventCode::SprBatch,
        serde_json::json!({"sz": bytes.len(), "lz4": true, "n": ids.len()})
    );

    Ok(Response::new(bytes))
}

/// Compress RGBA pixels to Tibia RLE format
/// Input: 4096 bytes of RGBA data (32x32 pixels, 4 bytes per pixel)
/// Output: RLE compressed data ready for SPR file
#[tauri::command]
fn compress_sprite_rgba(
    pixels: Vec<u8>,
    transparent: bool,
) -> Result<Vec<u8>, String> {
    if pixels.len() != 4096 {
        return Err(format!("Invalid pixel data length: {} (expected 4096)", pixels.len()));
    }
    Ok(compress_to_rle(&pixels, transparent))
}

#[tauri::command]
fn set_debug_logging(
    enabled: bool,
    log_state: tauri::State<LoggerState>,
) -> Result<(), String> {
    let mut logger = log_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    logger.set_enabled(enabled);
    Ok(())
}

#[tauri::command]
fn get_debug_logging(
    log_state: tauri::State<LoggerState>,
) -> Result<bool, String> {
    let logger = log_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    Ok(logger.is_enabled())
}

#[derive(Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

#[derive(Serialize)]
struct SystemDirectory {
    name: String,
    path: String,
}

#[tauri::command]
fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Home directory not found".to_string())
}

#[tauri::command]
fn get_system_directories() -> Result<Vec<SystemDirectory>, String> {
    let mut dirs = Vec::new();

    if let Some(home) = dirs::home_dir() {
        let home_str = home.to_string_lossy().to_string();
        dirs.push(SystemDirectory {
            name: "Home".to_string(),
            path: home_str.clone(),
        });

        if let Some(doc) = dirs::document_dir() {
            dirs.push(SystemDirectory {
                name: "Documents".to_string(),
                path: doc.to_string_lossy().to_string(),
            });
        }

        if let Some(download) = dirs::download_dir() {
            dirs.push(SystemDirectory {
                name: "Downloads".to_string(),
                path: download.to_string_lossy().to_string(),
            });
        }

        if let Some(desktop) = dirs::desktop_dir() {
            dirs.push(SystemDirectory {
                name: "Desktop".to_string(),
                path: desktop.to_string_lossy().to_string(),
            });
        }

        if let Some(pic) = dirs::picture_dir() {
            dirs.push(SystemDirectory {
                name: "Pictures".to_string(),
                path: pic.to_string_lossy().to_string(),
            });
        }

        if let Some(video) = dirs::video_dir() {
            dirs.push(SystemDirectory {
                name: "Videos".to_string(),
                path: video.to_string_lossy().to_string(),
            });
        }

        if let Some(music) = dirs::audio_dir() {
            dirs.push(SystemDirectory {
                name: "Music".to_string(),
                path: music.to_string_lossy().to_string(),
            });
        }
    }

    {
        let temp = std::env::temp_dir();
        dirs.push(SystemDirectory {
            name: "Temp".to_string(),
            path: temp.to_string_lossy().to_string(),
        });
    }

    #[cfg(windows)]
    {
        if let Ok(program_files) = std::env::var("ProgramFiles") {
            dirs.push(SystemDirectory {
                name: "Program Files".to_string(),
                path: program_files,
            });
        }
        if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
            dirs.push(SystemDirectory {
                name: "Program Files (x86)".to_string(),
                path: program_files_x86,
            });
        }
    }

    #[cfg(unix)]
    {
        dirs.push(SystemDirectory {
            name: "Root".to_string(),
            path: "/".to_string(),
        });
    }

    Ok(dirs)
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<DirEntry>, String> {
    let path = Path::new(&path);
    
    if !path.exists() {
        return Err(format!("Path does not exist: {}", path.display()));
    }
    
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", path.display()));
    }
    
    let mut entries = Vec::new();
    
    match fs::read_dir(path) {
        Ok(reader) => {
            for entry_result in reader {
                match entry_result {
                    Ok(entry) => {
                        let entry_path = entry.path();
                        let name = entry_path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("")
                            .to_string();
                        
                        let full_path = entry_path.to_string_lossy().to_string();
                        let is_dir = entry_path.is_dir();
                        
                        entries.push(DirEntry {
                            name,
                            path: full_path,
                            is_dir,
                        });
                    }
                    Err(e) => {
                        return Err(format!("Failed to read directory entry: {}", e));
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Failed to read directory: {}", e));
        }
    }
    
    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });
    
    Ok(entries)
}

#[tauri::command]
fn check_files_exist(path: String, filenames: Vec<String>) -> Result<Vec<bool>, String> {
    let dir_path = Path::new(&path);
    
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err(format!("Path does not exist or is not a directory: {}", path));
    }
    
    let results: Vec<bool> = filenames
        .iter()
        .map(|filename| {
            let file_path = dir_path.join(filename);
            file_path.exists() && file_path.is_file()
        })
        .collect();
    
    Ok(results)
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FavoriteFolder {
    name: String,
    path: String,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct AppConfig {
    last_folder: Option<String>,
    favorite_folders: Vec<FavoriteFolder>,
    panel_settings: Option<PanelSettings>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
struct PanelSettings {
    show_visualization: bool,
    show_opened_items: bool,
}

fn get_config_dir() -> Result<PathBuf, String> {
    dirs::config_dir()
        .ok_or_else(|| "Config directory not found".to_string())
        .map(|mut path| {
            path.push("sprite-forge");
            path
        })
}

#[tauri::command]
fn get_config_dir_path() -> Result<String, String> {
    get_config_dir().map(|p| p.to_string_lossy().to_string())
}

fn get_config_path() -> Result<PathBuf, String> {
    get_config_dir().map(|mut path| {
        path.push("config.json");
        path
    })
}

fn ensure_config_dir() -> Result<(), String> {
    let config_dir = get_config_dir()?;
    fs::create_dir_all(&config_dir)
        .map_err(|e| format!("Failed to create config directory: {}", e))?;
    Ok(())
}

#[tauri::command]
fn get_config() -> Result<AppConfig, String> {
    let config_path = get_config_path()?;
    
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }
    
    match fs::read_to_string(&config_path) {
        Ok(content) => {
            serde_json::from_str(&content)
                .map_err(|e| format!("Failed to parse config: {}", e))
        }
        Err(e) => Err(format!("Failed to read config: {}", e))
    }
}

#[tauri::command]
fn save_config(config: AppConfig) -> Result<(), String> {
    ensure_config_dir()?;
    let config_path = get_config_path()?;
    
    let json = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    
    fs::write(&config_path, json)
        .map_err(|e| format!("Failed to write config: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn get_last_folder() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.last_folder)
}

#[tauri::command]
fn set_last_folder(path: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.last_folder = Some(path);
    save_config(config)
}

#[tauri::command]
fn get_favorite_folders() -> Result<Vec<FavoriteFolder>, String> {
    let config = get_config()?;
    Ok(config.favorite_folders)
}

#[tauri::command]
fn set_favorite_folders(folders: Vec<FavoriteFolder>) -> Result<(), String> {
    let mut config = get_config()?;
    config.favorite_folders = folders;
    save_config(config)
}

#[tauri::command]
fn get_panel_settings() -> Result<PanelSettings, String> {
    let config = get_config()?;
    Ok(config.panel_settings.unwrap_or_default())
}

#[tauri::command]
fn set_panel_settings(settings: PanelSettings) -> Result<(), String> {
    let mut config = get_config()?;
    config.panel_settings = Some(settings);
    save_config(config)
}

// Version Control Commands

#[tauri::command]
fn ensure_versions_dir() -> Result<(), String> {
    let mut versions_dir = get_config_dir()?;
    versions_dir.push("versions");
    fs::create_dir_all(&versions_dir)
        .map_err(|e| format!("Failed to create versions directory: {}", e))?;
    Ok(())
}

#[tauri::command]
fn write_json_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write JSON file {}: {}", path, e))
}

#[tauri::command]
fn delete_file(path: String) -> Result<(), String> {
    fs::remove_file(&path)
        .map_err(|e| format!("Failed to delete file {}: {}", path, e))
}

// DAT/SPR Writer Commands

// TODO: PERFORMANCE - This command currently uses JSON serialization which violates RULE #1
// This causes slowdown when writing large numbers of items (6000+ items)
// SOLUTION: Rewrite to use binary IPC buffers:
//   1. TypeScript encodes ThingType[] to binary buffer using DataView
//   2. Rust parses binary buffer manually
//   3. See CLAUDE.md "RULE #1: NEVER USE JSON FOR TAURI IPC" for implementation guide
//   4. Reference: read_sprites_batch_bin command for binary IPC example
// Current implementation is ACCEPTABLE as temporary solution but should be optimized
#[tauri::command]
fn write_dat(
    path: String,
    signature: u32,
    version: u32,
    extended: bool,
    frame_durations: bool,
    items_min_id: u16,
    items_max_id: u16,
    outfits_min_id: u16,
    outfits_max_id: u16,
    effects_min_id: u16,
    effects_max_id: u16,
    missiles_min_id: u16,
    missiles_max_id: u16,
    items: Vec<ThingType>,
    outfits: Vec<ThingType>,
    effects: Vec<ThingType>,
    missiles: Vec<ThingType>,
) -> Result<(), String> {
    write_dat_file(&path, signature, version, extended, frame_durations,
                   items_min_id, items_max_id,
                   outfits_min_id, outfits_max_id,
                   effects_min_id, effects_max_id,
                   missiles_min_id, missiles_max_id,
                   items, outfits, effects, missiles)
}

#[tauri::command]
fn write_spr(
    path: String,
    signature: u32,
    extended: bool,
    sprites: Vec<SpriteWrite>,
) -> Result<(), String> {
    write_spr_file(&path, signature, extended, sprites)
}

#[tauri::command]
fn update_spr_sprites(
    path: String,
    extended: bool,
    sprites: Vec<SpriteWrite>,
    sprites_count: u32,
) -> Result<(), String> {
    update_sprites_in_spr(&path, extended, sprites, sprites_count)
}

// DAT Manager Commands

#[tauri::command]
fn store_dat_data(
    path: String,
    items: Vec<ThingType>,
    outfits: Vec<ThingType>,
    effects: Vec<ThingType>,
    missiles: Vec<ThingType>,
    dat_state: tauri::State<DatManagerState>,
) -> Result<(), String> {
    let mut manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.store_data(path, items, outfits, effects, missiles)
}

#[tauri::command]
fn load_dat_file(
    path: String,
    dat_state: tauri::State<DatManagerState>,
) -> Result<u32, String> {
    let mut reader = DatReader::open(&path)?;
    let (signature, items, outfits, effects, missiles) = reader.read_dat()?;

    let mut manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.store_data(path, items, outfits, effects, missiles)?;

    Ok(signature)
}

/// Parse DAT file in Rust and return binary buffer for fast IPC transfer
/// This replaces slow TypeScript parsing + JSON serialization with:
/// 1. Native Rust parsing (fast)
/// 2. Binary IPC response (no JSON overhead)
/// 3. Automatic storage in DatManager for search operations
///
/// Binary format: [signature:u32][items_count:u32][outfits_count:u32][effects_count:u32][missiles_count:u32]
///                followed by encoded things (see dat_reader::encode_dat_to_binary)
#[tauri::command]
fn parse_dat_file_bin(
    path: String,
    version: u32,  // Version from frontend (e.g., 860 for 8.60, 1098 for 10.98)
    dat_state: tauri::State<DatManagerState>,
    log_state: tauri::State<LoggerState>,
) -> Result<Response, String> {
    let start = std::time::Instant::now();

    // Parse DAT file using existing reader
    let mut reader = DatReader::open(&path)?;
    reader.set_version(version);  // Set version from frontend
    let (signature, items, outfits, effects, missiles) = reader.read_dat()
        .map_err(|e| format!("DAT parse error (version {}): {}", version, e))?;

    let items_count = items.len();
    let outfits_count = outfits.len();
    let effects_count = effects.len();
    let missiles_count = missiles.len();

    // Store in DatManager for search operations
    {
        let mut manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
        manager.store_data(path.clone(), items.clone(), outfits.clone(), effects.clone(), missiles.clone())?;
    }

    // Encode to binary buffer for fast IPC transfer
    let buffer = encode_dat_to_binary(signature, &items, &outfits, &effects, &missiles);

    // Log performance metrics
    {
        let mut logger = log_state.lock().unwrap();
        logger.log(
            EventCode::SprBatch, // Reuse event code for now
            serde_json::json!({
                "op": "parse_dat_bin",
                "ms": start.elapsed().as_millis(),
                "items": items_count,
                "outfits": outfits_count,
                "effects": effects_count,
                "missiles": missiles_count,
                "bytes": buffer.len()
            })
        );
    }

    Ok(Response::new(buffer))
}

#[tauri::command]
fn search_things(
    path: String,
    category: Option<String>,
    name: Option<String>,
    properties: std::collections::HashMap<String, bool>,
    limit: usize,
    dat_state: tauri::State<DatManagerState>,
) -> Result<Vec<(u32, String)>, String> {
    let manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.search(
        &path,
        category.as_deref(),
        name.as_deref(),
        &properties,
        limit
    )
}

#[tauri::command]
fn search_things_bin(
    path: String,
    category: Option<String>,
    name: Option<String>,
    properties: std::collections::HashMap<String, bool>,
    limit: usize,
    dat_state: tauri::State<DatManagerState>,
) -> Result<Response, String> {
    let manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.search_binary(
        &path,
        category.as_deref(),
        name.as_deref(),
        &properties,
        limit
    )?;
    Ok(Response::new(bytes))
}

#[tauri::command]
fn clear_dat_data(
    path: String,
    dat_state: tauri::State<DatManagerState>,
) -> Result<(), String> {
    let mut manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.remove_data(&path);
    Ok(())
}

#[tauri::command]
fn get_thing(
    path: String,
    id: u32,
    category: String,
    dat_state: tauri::State<DatManagerState>,
) -> Result<ThingType, String> {
    let manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.get_thing(&path, id, &category)
        .ok_or_else(|| format!("Thing not found: {} #{}", category, id))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize SPR manager state
    let spr_manager: SprManagerState = Arc::new(Mutex::new(SprManager::new()));

    // Initialize logger state
    let logger: LoggerState = Arc::new(Mutex::new(Logger::new()));

    // Initialize DAT manager state
    let dat_manager: DatManagerState = Arc::new(Mutex::new(DatManager::new()));

    // Initialize log file
    {
        let mut log = logger.lock().unwrap();
        let log_path = "sprite-forge-debug.jsonl";
        if let Err(e) = log.init(log_path) {
            eprintln!("Warning: Could not initialize logger: {}", e);
        } else {
            println!("Debug logs: {}", log_path);
        }
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(spr_manager)
        .manage(logger)
        .manage(dat_manager)
        .invoke_handler(tauri::generate_handler![
            read_file,
            read_file_text,
            read_file_header,
            open_spr_file,
            read_sprite,
            close_spr_file,
            get_spr_header,
            read_sprites_batch,
            read_sprites_list,
            read_sprites_list_bin,
            read_sprites_batch_bin,
            read_sprite_bin,
            read_sprites_rgba,
            read_sprites_batch_rgba,
            read_sprites_rgba_lz4,
            compress_sprite_rgba,
            search_thing_types_bin,
            set_debug_logging,
            get_debug_logging,
            list_directory,
            get_home_dir,
            get_system_directories,
            check_files_exist,
            get_config,
            save_config,
            get_last_folder,
            set_last_folder,
            get_favorite_folders,
            set_favorite_folders,
            get_panel_settings,
            set_panel_settings,
            get_config_dir_path,
            ensure_versions_dir,
            write_json_file,
            delete_file,
            write_dat,
            write_spr,
            update_spr_sprites,
            store_dat_data,
            load_dat_file,
            parse_dat_file_bin,
            search_things,
            search_things_bin,
            clear_dat_data,
            get_thing,
            optimize_sprites_rust,
            apply_optimization
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

