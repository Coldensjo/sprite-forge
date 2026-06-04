use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};
use image::{RgbaImage, imageops, GenericImageView};

mod spr_manager;
use spr_manager::{SprManager, SprManagerState, SprHeader, SpriteData, compress_to_rle, decompress_to_rgba};

mod logger;
use logger::{Logger, LoggerState, EventCode};

mod dat_writer;
use dat_writer::{write_dat_from_buffer, read_thing, Reader, ThingType, FrameGroup};

mod spr_writer;
use spr_writer::{update_sprites_in_spr, copy_spr_with_modifications, SpriteWrite};

mod dat_manager;
use dat_manager::{DatManager, DatManagerState};

mod dat_reader;
use dat_reader::{DatReader, encode_dat_to_binary};

mod optimizer;
use optimizer::{optimize_sprites_rust, apply_optimization};

mod sprite_protocol;

// Wrapper to use serde_bytes for efficient binary transfer
#[derive(Serialize, Deserialize)]
struct FileBytes(#[serde(with = "serde_bytes")] Vec<u8>);

#[tauri::command]
#[allow(unused_variables)]
fn set_window_acrylic(
    window: tauri::Window,
    enabled: bool,
    color: Option<(u8, u8, u8, u8)>,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        if enabled {
            let tint = color.unwrap_or((26, 26, 26, 180));
            apply_acrylic(&window, Some(tint)).map_err(|e| e.to_string())?;
        } else {
            clear_acrylic(&window).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Acrylic is only supported on Windows".to_string())
    }
}

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
fn close_spr_file(
    path: String,
    state: tauri::State<SprManagerState>,
) -> Result<(), String> {
    let mut manager = state.lock().map_err(|e| format!("Lock error: {}", e))?;
    manager.close_file(&path)
}

use tauri::ipc::Response;

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

/// Request body: [transparent: u8][pixels: 4096 RGBA bytes]
#[tauri::command]
fn compress_sprite_rgba(request: tauri::ipc::Request) -> Result<Response, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("compress_sprite_rgba expects a raw binary payload".to_string()),
    };
    if bytes.len() != 4097 {
        return Err(format!("Invalid payload length: {} (expected 4097 = 1 flag + 4096 RGBA)", bytes.len()));
    }
    let transparent = bytes[0] != 0;
    let pixels = &bytes[1..];
    Ok(Response::new(compress_to_rle(pixels, transparent)))
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
    modified_ms: Option<i64>,
    size: Option<u64>,
}

#[derive(Serialize)]
struct DriveInfo {
    letter: String,
    label: String,
}

#[tauri::command]
#[cfg(target_os = "windows")]
fn list_drives() -> Vec<DriveInfo> {
    let mut drives = Vec::new();
    for c in b'A'..=b'Z' {
        let letter = (c as char).to_string();
        let path_str = format!("{}:\\", letter);
        if Path::new(&path_str).is_dir() {
            drives.push(DriveInfo {
                label: format!("Disco Local ({}:)", letter),
                letter: path_str,
            });
        }
    }
    drives
}

#[tauri::command]
#[cfg(not(target_os = "windows"))]
fn list_drives() -> Vec<DriveInfo> {
    vec![DriveInfo {
        letter: "/".to_string(),
        label: "Root (/)".to_string(),
    }]
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
                        let meta = entry.metadata().ok();
                        let modified_ms = meta.as_ref().and_then(|m| m.modified().ok()).and_then(|t| {
                            t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| d.as_millis() as i64)
                        });
                        let size = meta.as_ref().map(|m| m.len()).filter(|_| !is_dir);

                        entries.push(DirEntry {
                            name,
                            path: full_path,
                            is_dir,
                            modified_ms,
                            size,
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
    default_scene: Option<String>,
    item_list_view_mode: Option<String>,
    sprite_list_view_mode: Option<String>,
    find_list_view_mode: Option<String>,
    general_settings: Option<GeneralSettings>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct GeneralSettings {
    list_amount_objects: u32,
    list_amount_sprites: u32,
}

impl Default for GeneralSettings {
    fn default() -> Self {
        Self {
            list_amount_objects: 100,
            list_amount_sprites: 100,
        }
    }
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

#[tauri::command]
fn get_item_list_view_mode() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.item_list_view_mode)
}

#[tauri::command]
fn set_item_list_view_mode(mode: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.item_list_view_mode = Some(mode);
    save_config(config)
}

#[tauri::command]
fn get_sprite_list_view_mode() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.sprite_list_view_mode)
}

#[tauri::command]
fn set_sprite_list_view_mode(mode: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.sprite_list_view_mode = Some(mode);
    save_config(config)
}

#[tauri::command]
fn get_find_list_view_mode() -> Result<Option<String>, String> {
    let config = get_config()?;
    Ok(config.find_list_view_mode)
}

#[tauri::command]
fn set_find_list_view_mode(mode: String) -> Result<(), String> {
    let mut config = get_config()?;
    config.find_list_view_mode = Some(mode);
    save_config(config)
}

#[tauri::command]
fn get_general_settings() -> Result<GeneralSettings, String> {
    let config = get_config()?;
    Ok(config.general_settings.unwrap_or_default())
}

#[tauri::command]
fn set_general_settings(settings: GeneralSettings) -> Result<(), String> {
    let mut config = get_config()?;
    config.general_settings = Some(settings);
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

#[tauri::command]
fn save_scene(name: String, content: String) -> Result<String, String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    fs::create_dir_all(&scenes_dir)
        .map_err(|e| format!("Failed to create scenes directory: {}", e))?;
    
    // Sanitize filename to prevent directory traversal or invalid characters
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let file_path = scenes_dir.join(format!("{}.json", safe_name));
    
    fs::write(&file_path, content)
        .map_err(|e| format!("Failed to write scene file: {}", e))?;
        
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn list_scenes() -> Result<Vec<String>, String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    
    if !scenes_dir.exists() {
        return Ok(Vec::new());
    }
    
    let mut scenes = Vec::new();
    for entry in fs::read_dir(scenes_dir).map_err(|e| format!("Failed to read scenes dir: {}", e))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                scenes.push(stem.to_string());
            }
        }
    }
    scenes.sort();
    Ok(scenes)
}

#[tauri::command]
fn load_scene(name: String) -> Result<String, String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let file_path = scenes_dir.join(format!("{}.json", safe_name));
    
    fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read scene file: {}", e))
}

#[tauri::command]
fn delete_scene(name: String) -> Result<(), String> {
    let mut scenes_dir = get_config_dir()?;
    scenes_dir.push("scenes");
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "_");
    let file_path = scenes_dir.join(format!("{}.json", safe_name));
    
    if file_path.exists() {
        fs::remove_file(&file_path)
            .map_err(|e| format!("Failed to delete scene file: {}", e))?;
    }
    Ok(())
}

// DAT/SPR Writer Commands

#[tauri::command]
fn write_dat_bin(request: tauri::ipc::Request) -> Result<(), String> {
    match request.body() {
        tauri::ipc::InvokeBody::Raw(bytes) => write_dat_from_buffer(bytes),
        _ => Err("write_dat_bin expects a raw binary payload".to_string()),
    }
}

#[tauri::command]
fn copy_spr_file_with_mods(request: tauri::ipc::Request) -> Result<(), String> {
    fn take<'a>(bytes: &'a [u8], o: &mut usize, n: usize) -> Result<&'a [u8], String> {
        if *o + n > bytes.len() {
            return Err(format!("SPR copy buffer truncated at offset {}", *o));
        }
        let s = &bytes[*o..*o + n];
        *o += n;
        Ok(s)
    }

    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("copy_spr_file_with_mods expects a raw binary payload".to_string()),
    };

    let mut o = 0usize;
    let extended = take(bytes, &mut o, 1)?[0] == 1;
    let signature = u32::from_le_bytes(take(bytes, &mut o, 4)?.try_into().unwrap());
    let target_count = u32::from_le_bytes(take(bytes, &mut o, 4)?.try_into().unwrap());
    let src_len = u16::from_le_bytes(take(bytes, &mut o, 2)?.try_into().unwrap()) as usize;
    let source_path = String::from_utf8_lossy(take(bytes, &mut o, src_len)?).into_owned();
    let dst_len = u16::from_le_bytes(take(bytes, &mut o, 2)?.try_into().unwrap()) as usize;
    let dest_path = String::from_utf8_lossy(take(bytes, &mut o, dst_len)?).into_owned();

    let modifications = parse_sprites_buffer(&bytes[o..])?;

    copy_spr_with_modifications(&source_path, &dest_path, extended, signature, target_count, modifications)
}

/// Parse binary buffer into Vec<SpriteWrite>
/// Binary format: [Count: u32] + for each sprite: [ID: u32][IsEmpty: u8][Len: u32][Data...]
fn parse_sprites_buffer(buffer: &[u8]) -> Result<Vec<SpriteWrite>, String> {
    if buffer.len() < 4 {
        return Err("Buffer too small to contain sprite count".to_string());
    }

    let mut offset = 0;

    // Read sprite count
    let count = u32::from_le_bytes(
        buffer[offset..offset + 4]
            .try_into()
            .map_err(|_| "Failed to read sprite count")?,
    ) as usize;
    offset += 4;

    let mut sprites = Vec::with_capacity(count);

    for i in 0..count {
        // Check we have enough bytes for header (id + is_empty + len = 9 bytes)
        if offset + 9 > buffer.len() {
            return Err(format!(
                "Buffer truncated at sprite {}: need {} bytes, have {}",
                i,
                offset + 9,
                buffer.len()
            ));
        }

        // Read ID (u32)
        let id = u32::from_le_bytes(
            buffer[offset..offset + 4]
                .try_into()
                .map_err(|_| format!("Failed to read sprite {} ID", i))?,
        );
        offset += 4;

        // Read IsEmpty (u8)
        let is_empty = buffer[offset] == 1;
        offset += 1;

        // Read compressed length (u32)
        let compressed_len = u32::from_le_bytes(
            buffer[offset..offset + 4]
                .try_into()
                .map_err(|_| format!("Failed to read sprite {} compressed length", i))?,
        ) as usize;
        offset += 4;

        // Read compressed pixels
        let compressed_pixels = if compressed_len > 0 {
            if offset + compressed_len > buffer.len() {
                return Err(format!(
                    "Buffer truncated at sprite {} data: need {} bytes, have {}",
                    i,
                    offset + compressed_len,
                    buffer.len()
                ));
            }
            buffer[offset..offset + compressed_len].to_vec()
        } else {
            Vec::new()
        };
        offset += compressed_len;

        sprites.push(SpriteWrite {
            id,
            is_empty,
            compressed_pixels,
        });
    }

    Ok(sprites)
}

#[tauri::command]
fn update_spr_sprites_bin(request: tauri::ipc::Request) -> Result<(), String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("update_spr_sprites_bin expects a raw binary payload".to_string()),
    };

    if bytes.len() < 7 {
        return Err("SPR update buffer too small for header".to_string());
    }
    let extended = bytes[0] == 1;
    let sprites_count = u32::from_le_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]);
    let path_len = u16::from_le_bytes([bytes[5], bytes[6]]) as usize;
    let path_start = 7;
    if path_start + path_len > bytes.len() {
        return Err("SPR update buffer truncated (path)".to_string());
    }
    let path = String::from_utf8_lossy(&bytes[path_start..path_start + path_len]).into_owned();

    let sprites = parse_sprites_buffer(&bytes[path_start + path_len..])?;

    update_sprites_in_spr(&path, extended, sprites, sprites_count)
}

// DAT Manager Commands

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
fn search_things_bin(
    path: String,
    category: Option<String>,
    name: Option<String>,
    properties: std::collections::HashMap<String, bool>,
    sprite_id: Option<u32>,
    limit: usize,
    dat_state: tauri::State<DatManagerState>,
) -> Result<Response, String> {
    let manager = dat_state.lock().map_err(|e| format!("Lock error: {}", e))?;
    let bytes = manager.search_binary(
        &path,
        category.as_deref(),
        name.as_deref(),
        &properties,
        sprite_id,
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
fn write_sprite_png(path: String, rgba: Vec<u8>) -> Result<(), String> {
    if rgba.len() != 32 * 32 * 4 {
        return Err(format!("Expected 4096 RGBA bytes, got {}", rgba.len()));
    }
    let img = image::RgbaImage::from_raw(32, 32, rgba)
        .ok_or_else(|| "Failed to build RGBA image".to_string())?;
    img.save(&path).map_err(|e| format!("Failed to write PNG: {}", e))
}

#[tauri::command]
fn read_sprite_png(path: String) -> Result<Vec<u8>, String> {
    let img = image::open(&path)
        .map_err(|e| format!("Failed to open image: {}", e))?
        .to_rgba8();
    if img.width() != 32 || img.height() != 32 {
        return Err(format!(
            "Image must be exactly 32x32 pixels (got {}x{})",
            img.width(),
            img.height()
        ));
    }
    Ok(img.into_raw())
}

fn get_group_dimensions(group: &FrameGroup) -> (u32, u32) {
    let total_x = (group.pattern_z as u32) * (group.pattern_x as u32) * (group.layers as u32);
    let total_y = (group.frames as u32) * (group.pattern_y as u32);
    (total_x, total_y)
}

fn get_sprite_index(
    group: &FrameGroup,
    width: u32,
    height: u32,
    layer: u32,
    pattern_x: u32,
    pattern_y: u32,
    pattern_z: u32,
    frame: u32,
) -> usize {
    let w = group.width as u32;
    let h = group.height as u32;
    let l = group.layers as u32;
    let px = group.pattern_x as u32;
    let py = group.pattern_y as u32;
    let pz = group.pattern_z as u32;
    let f = group.frames as u32;
    
    (((
        (((
            (frame % f) * pz + pattern_z
         ) * py + pattern_y
        ) * px + pattern_x
       ) * l + layer
      ) * h + height
     ) * w + width
    ) as usize
}


fn create_synthetic_group(thing: &ThingType) -> FrameGroup {
    FrameGroup {
        r#type: 0,
        width: thing.width,
        height: thing.height,
        exact_size: thing.exact_size,
        layers: thing.layers,
        pattern_x: thing.pattern_x,
        pattern_y: thing.pattern_y,
        pattern_z: thing.pattern_z,
        frames: thing.frames,
        sprite_index: thing.sprite_index.clone(),
        is_animation: thing.is_animation,
        animation_mode: Some(thing.animation_mode),
        loop_count: Some(thing.loop_count),
        start_frame: Some(thing.start_frame),
        frame_durations: Some(thing.frame_durations.clone()),
    }
}

#[tauri::command]
fn export_object_sheet_rust(
    thing: ThingType,
    spr_path: String,
    path: String,
    transparent: bool,
    spr_state: tauri::State<SprManagerState>,
) -> Result<(), String> {
    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;

    let mut groups: Vec<FrameGroup> = Vec::new();
    if let Some(ref fgs) = thing.frame_groups_data {
        if !fgs.is_empty() {
             groups = fgs.clone();
             groups.sort_by(|a, b| a.r#type.cmp(&b.r#type));
        } else {
             groups.push(create_synthetic_group(&thing));
        }
    } else {
         groups.push(create_synthetic_group(&thing));
    }

    let mut sheet_total_x = 0;
    let mut sheet_total_y = 0;
    let mut max_thing_width = 0;
    let mut max_thing_height = 0;
    
    struct GroupMetric {
        start_y: u32,
    }
    let mut group_metrics = Vec::new();
    let mut current_y = 0;
    
    for group in &groups {
        let (total_x, total_y) = get_group_dimensions(group);
        if total_x > sheet_total_x { sheet_total_x = total_x; }
        
        group_metrics.push(GroupMetric {
            start_y: current_y,
        });
        
        current_y += total_y;
        sheet_total_y += total_y;
        
        if (group.width as u32) > max_thing_width { max_thing_width = group.width as u32; }
        if (group.height as u32) > max_thing_height { max_thing_height = group.height as u32; }
    }
    
    const SPRITE_SIZE: u32 = 32;
    let texture_width_px = max_thing_width * SPRITE_SIZE;
    let texture_height_px = max_thing_height * SPRITE_SIZE;
    
    let canvas_width = sheet_total_x * texture_width_px;
    let canvas_height = sheet_total_y * texture_height_px;
    
    if canvas_width == 0 || canvas_height == 0 {
        return Err("Invalid canvas dimensions".to_string());
    }
    
    // 3. Load Sprites
    let mut sprite_ids = Vec::new();
    for group in &groups {
        for f in 0..group.frames {
            for z in 0..group.pattern_z {
                for y in 0..group.pattern_y {
                    for x in 0..group.pattern_x {
                        for l in 0..group.layers {
                            for h in 0..group.height {
                                for w in 0..group.width {
                                    let index = get_sprite_index(group, w as u32, h as u32, l as u32, x as u32, y as u32, z as u32, f as u32);
                                    if index < group.sprite_index.len() {
                                        sprite_ids.push(group.sprite_index[index]);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Read sprites from SPR manager (uses cached reader)
    let sprite_data_list = manager.read_sprites_list(&spr_path, sprite_ids)?;
    
    // Map ID -> SpriteData for quick lookup
    use std::collections::HashMap;
    let mut sprite_map = HashMap::new();
    for sprite in sprite_data_list {
        sprite_map.insert(sprite.id, sprite);
    }
    
    // 4. Draw
    let mut sheet = RgbaImage::new(canvas_width, canvas_height);
    
    for (i, group) in groups.iter().enumerate() {
        let metrics = &group_metrics[i];
        let start_y_px = metrics.start_y * texture_height_px;
        let cell_width = texture_width_px;
        let cell_height = texture_height_px;
        
        for f in 0..group.frames {
            for z in 0..group.pattern_z {
                for y in 0..group.pattern_y {
                    for x in 0..group.pattern_x {
                        for l in 0..group.layers {
                             // Calculate column: pz * (pX * layers) + px * layers + layer
                             // This places mount variations horizontally after base outfit
                             let col = (z as u32) * (group.pattern_x as u32) * (group.layers as u32)
                                     + (x as u32) * (group.layers as u32)
                                     + (l as u32);

                             // Calculate row: frame * patternY + addon
                             // This places addons vertically, grouped by frame
                             let row = (f as u32) * (group.pattern_y as u32) + (y as u32);

                             let fx = col * cell_width;
                             let fy = row * cell_height + start_y_px;
                             
                             for h in 0..group.height {
                                 for w in 0..group.width {
                                     let index = get_sprite_index(group, w as u32, h as u32, l as u32, x as u32, y as u32, z as u32, f as u32);
                                     if index < group.sprite_index.len() {
                                         let sprite_id = group.sprite_index[index];
                                         if let Some(sprite) = sprite_map.get(&sprite_id) {
                                             if !sprite.is_empty {
                                                 // Decompress
                                                 let rgba = decompress_to_rgba(&sprite.compressed_pixels, transparent);
                                                 if let Some(img_buffer) = RgbaImage::from_raw(SPRITE_SIZE, SPRITE_SIZE, rgba) {
                                                     // Position
                                                     let px = ((group.width as u32 - w as u32 - 1) * SPRITE_SIZE);
                                                     let py = ((group.height as u32 - h as u32 - 1) * SPRITE_SIZE);
                                                     
                                                     imageops::overlay(&mut sheet, &img_buffer, (fx + px) as i64, (fy + py) as i64);
                                                 }
                                             }
                                         }
                                     }
                                 }
                             }
                        }
                    }
                }
            }
        }
    }

    sheet.save(&path).map_err(|e| format!("Failed to save image to {}: {}", path, e))?;

    Ok(())
}

#[derive(Clone)]
struct GroupGeom {
    width: u8,
    height: u8,
    layers: u8,
    pattern_x: u8,
    pattern_y: u8,
    pattern_z: u8,
    frames: u8,
}

impl GroupGeom {
    fn from_thing(t: &ThingType) -> Self {
        Self {
            width: t.width.max(1),
            height: t.height.max(1),
            layers: t.layers.max(1),
            pattern_x: t.pattern_x.max(1),
            pattern_y: t.pattern_y.max(1),
            pattern_z: t.pattern_z.max(1),
            frames: t.frames.max(1),
        }
    }

    fn from_frame_group(g: &FrameGroup) -> Self {
        Self {
            width: g.width.max(1),
            height: g.height.max(1),
            layers: g.layers.max(1),
            pattern_x: g.pattern_x.max(1),
            pattern_y: g.pattern_y.max(1),
            pattern_z: g.pattern_z.max(1),
            frames: g.frames.max(1),
        }
    }

    fn total_x(&self) -> u32 {
        self.pattern_z as u32 * self.pattern_x as u32 * self.layers as u32
    }

    fn total_y(&self) -> u32 {
        self.frames as u32 * self.pattern_y as u32
    }

    fn sheet_size(&self) -> (u32, u32) {
        (self.total_x() * self.width as u32 * 32, self.total_y() * self.height as u32 * 32)
    }

    fn total_sprites(&self) -> usize {
        self.width as usize
            * self.height as usize
            * self.layers as usize
            * self.pattern_x as usize
            * self.pattern_y as usize
            * self.pattern_z as usize
            * self.frames as usize
    }
}

fn extract_group_sprites(
    img: &RgbaImage,
    g: &GroupGeom,
    sheet_total_x: u32,
    cell_w_px: u32,
    cell_h_px: u32,
    fy_offset: u32,
    transparent: bool,
    spr_path: &str,
    manager: &mut SprManager,
    reusable_ids: &[u32],
    id_alloc_idx: &mut usize,
    current_next_id: &mut u32,
) -> Result<(Vec<u32>, Vec<SpriteData>), String> {
    let mut sprite_index: Vec<u32> = Vec::with_capacity(g.total_sprites());
    let mut sprites_data: Vec<SpriteData> = Vec::new();
    let img_w = img.width();
    let img_h = img.height();

    for frame in 0..g.frames {
        for pz in 0..g.pattern_z {
            for py in 0..g.pattern_y {
                for px in 0..g.pattern_x {
                    for layer in 0..g.layers {
                        let tex_index = (((((frame as u32) * g.pattern_z as u32 + pz as u32)
                            * g.pattern_y as u32
                            + py as u32)
                            * g.pattern_x as u32
                            + px as u32)
                            * g.layers as u32)
                            + layer as u32;
                        let fx = (tex_index % sheet_total_x) * cell_w_px;
                        let fy = fy_offset + (tex_index / sheet_total_x) * cell_h_px;

                        for h in 0..g.height {
                            for w in 0..g.width {
                                let reversed_w = (g.width - 1 - w) as u32;
                                let reversed_h = (g.height - 1 - h) as u32;
                                let src_x = fx + reversed_w * 32;
                                let src_y = fy + reversed_h * 32;

                                if src_x + 32 > img_w || src_y + 32 > img_h {
                                    sprite_index.push(0);
                                    continue;
                                }

                                let sub_img = img.view(src_x, src_y, 32, 32);
                                let mut sub_img_buffer = sub_img.to_image();
                                for pixel in sub_img_buffer.pixels_mut() {
                                    if pixel[3] == 0 { pixel.0 = [0, 0, 0, 0]; }
                                }
                                let raw_pixels = sub_img_buffer.as_raw();
                                let is_empty = raw_pixels.chunks(4).all(|p| p[3] == 0);

                                if is_empty {
                                    sprite_index.push(0);
                                    continue;
                                }

                                let sprite_id = if *id_alloc_idx < reusable_ids.len() {
                                    let id = reusable_ids[*id_alloc_idx];
                                    *id_alloc_idx += 1;
                                    id
                                } else {
                                    let id = *current_next_id;
                                    *current_next_id += 1;
                                    id
                                };

                                let compressed_pixels = compress_to_rle(raw_pixels, transparent);
                                let sprite_data = SpriteData {
                                    id: sprite_id,
                                    is_empty: false,
                                    compressed_pixels,
                                };

                                manager.update_sprite(spr_path, sprite_id, sprite_data.clone())?;
                                sprites_data.push(sprite_data);
                                sprite_index.push(sprite_id);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok((sprite_index, sprites_data))
}

fn build_import_response(new_thing: &ThingType, sprites_data: Vec<SpriteData>, transparent: bool)
    -> Result<tauri::ipc::Response, String>
{
    let thing_json = serde_json::to_vec(new_thing)
        .map_err(|e| format!("JSON serialize error: {}", e))?;
    let sprites_buffer = SprManager::pack_sprites_rgba_lz4(sprites_data, transparent);
    let mut result = Vec::with_capacity(4 + thing_json.len() + sprites_buffer.len());
    result.extend_from_slice(&(thing_json.len() as u32).to_le_bytes());
    result.extend_from_slice(&thing_json);
    result.extend_from_slice(&sprites_buffer);
    Ok(tauri::ipc::Response::new(result))
}

fn collect_reusable_ids(thing: &ThingType) -> Vec<u32> {
    let mut ids: Vec<u32> = Vec::new();
    if let Some(fgs) = &thing.frame_groups_data {
        for fg in fgs {
            for &id in &fg.sprite_index {
                if id != 0 { ids.push(id); }
            }
        }
    } else {
        for &id in &thing.sprite_index {
            if id != 0 { ids.push(id); }
        }
    }
    ids.sort();
    ids.dedup();
    ids
}

fn import_preserve_geometry(
    img: &RgbaImage,
    img_width: u32,
    img_height: u32,
    thing: ThingType,
    transparent: bool,
    next_sprite_id: u32,
    spr_path: &str,
    manager: &mut SprManager,
) -> Result<tauri::ipc::Response, String> {
    let synthetic = thing.frame_groups_data.is_none();
    let groups: Vec<GroupGeom> = if synthetic {
        vec![GroupGeom::from_thing(&thing)]
    } else {
        thing.frame_groups_data
            .as_ref()
            .unwrap()
            .iter()
            .map(GroupGeom::from_frame_group)
            .collect()
    };

    let reusable_ids = collect_reusable_ids(&thing);
    let mut id_alloc_idx: usize = 0;
    let mut current_next_id: u32 = next_sprite_id;

    let active = GroupGeom::from_thing(&thing);
    let active_matches = |g: &GroupGeom| {
        g.width == active.width && g.height == active.height && g.layers == active.layers
            && g.pattern_x == active.pattern_x && g.pattern_y == active.pattern_y
            && g.pattern_z == active.pattern_z && g.frames == active.frames
    };

    let single_match: Option<usize> = groups
        .iter()
        .enumerate()
        .find(|(_, g)| g.sheet_size() == (img_width, img_height) && active_matches(g))
        .map(|(i, _)| i)
        .or_else(|| {
            groups
                .iter()
                .enumerate()
                .find(|(_, g)| g.sheet_size() == (img_width, img_height))
                .map(|(i, _)| i)
        });

    if let Some(idx) = single_match {
        let g = groups[idx].clone();
        let cell_w_px = g.width as u32 * 32;
        let cell_h_px = g.height as u32 * 32;
        let (new_sprite_index, sprites_data) = extract_group_sprites(
            img, &g, g.total_x(), cell_w_px, cell_h_px, 0,
            transparent, spr_path, manager,
            &reusable_ids, &mut id_alloc_idx, &mut current_next_id,
        )?;

        let mut new_thing = thing.clone();
        if synthetic {
            new_thing.sprite_index = new_sprite_index;
        } else if let Some(fgs) = new_thing.frame_groups_data.as_mut() {
            fgs[idx].sprite_index = new_sprite_index.clone();
            if active_matches(&GroupGeom::from_frame_group(&fgs[idx])) {
                new_thing.sprite_index = new_sprite_index;
            }
        }

        return build_import_response(&new_thing, sprites_data, transparent);
    }

    if groups.len() > 1 {
        let combined_w: u32 = groups.iter().map(|g| g.total_x() * g.width as u32 * 32).max().unwrap_or(0);
        let combined_h: u32 = groups.iter().map(|g| g.total_y() * g.height as u32 * 32).sum();

        if combined_w == img_width && combined_h == img_height {
            let global_total_x: u32 = groups.iter().map(|g| g.total_x()).max().unwrap_or(1);
            let global_cell_w_px: u32 = groups.iter().map(|g| g.width as u32 * 32).max().unwrap_or(32);
            let global_cell_h_px: u32 = groups.iter().map(|g| g.height as u32 * 32).max().unwrap_or(32);

            let mut all_sprites: Vec<SpriteData> = Vec::new();
            let mut per_group_index: Vec<Vec<u32>> = Vec::with_capacity(groups.len());
            let mut fy_offset: u32 = 0;

            for g in groups.iter() {
                let (idx_vec, mut sprites) = extract_group_sprites(
                    img, g, global_total_x, global_cell_w_px, global_cell_h_px, fy_offset,
                    transparent, spr_path, manager,
                    &reusable_ids, &mut id_alloc_idx, &mut current_next_id,
                )?;
                fy_offset += g.total_y() * global_cell_h_px;
                per_group_index.push(idx_vec);
                all_sprites.append(&mut sprites);
            }

            let mut new_thing = thing.clone();
            if let Some(fgs) = new_thing.frame_groups_data.as_mut() {
                for (i, idx_vec) in per_group_index.into_iter().enumerate() {
                    if i < fgs.len() {
                        fgs[i].sprite_index = idx_vec.clone();
                        if active_matches(&GroupGeom::from_frame_group(&fgs[i])) {
                            new_thing.sprite_index = idx_vec;
                        }
                    }
                }
            }

            return build_import_response(&new_thing, all_sprites, transparent);
        }
    }

    let single_sizes: Vec<String> = groups
        .iter()
        .enumerate()
        .map(|(i, g)| {
            let (w, h) = g.sheet_size();
            if groups.len() > 1 {
                format!("group {}: {}x{}", i, w, h)
            } else {
                format!("{}x{}", w, h)
            }
        })
        .collect();
    let mut msg = format!(
        "Image is {}x{} but does not match the object's geometry. Expected {}",
        img_width, img_height, single_sizes.join(" or ")
    );
    if groups.len() > 1 {
        let combined_w: u32 = groups.iter().map(|g| g.total_x() * g.width as u32 * 32).max().unwrap_or(0);
        let combined_h: u32 = groups.iter().map(|g| g.total_y() * g.height as u32 * 32).sum();
        msg.push_str(&format!(", or combined: {}x{}", combined_w, combined_h));
    }
    Err(msg)
}

/// Request body: [transparent: u8][version: u32 LE][next_sprite_id: u32 LE][is_new: u8]
///               [spr_path: u16-len UTF-8][category: u16-len UTF-8]
///               [thing: encodeThing payload][image bytes: rest]
/// Response:     [thing_json_len: u32][thing_json][LZ4 RGBA sprites]
#[tauri::command]
fn import_object_sheet_binary(
    request: tauri::ipc::Request,
    spr_state: tauri::State<SprManagerState>,
) -> Result<tauri::ipc::Response, String> {
    let bytes = match request.body() {
        tauri::ipc::InvokeBody::Raw(b) => b.as_slice(),
        _ => return Err("import_object_sheet_binary expects a raw binary payload".to_string()),
    };

    let mut r = Reader::new(bytes);
    let transparent = r.bool()?;
    let version = r.u32()?;
    let next_sprite_id = r.u32()?;
    let is_new = r.bool()?;
    let spr_path = r.string()?;
    let category = r.string()?;
    let thing = read_thing(&mut r, &category)?;
    let image_bytes = r.rest();

    let mut manager = spr_state.lock().map_err(|e| format!("Lock error: {}", e))?;

    // 1. Load image from bytes
    let img = image::load_from_memory(image_bytes)
        .map_err(|e| format!("Failed to load image from bytes: {}", e))?
        .to_rgba8();

    let img_width = img.width();
    let img_height = img.height();

    if img_width < 32 || img_height < 32 {
        return Err("Image is too small (must be at least 32x32)".to_string());
    }

    if !is_new {
        return import_preserve_geometry(
            &img,
            img_width,
            img_height,
            thing,
            transparent,
            next_sprite_id,
            &spr_path,
            &mut manager,
        );
    }

    // 2. Detect if this is an outfit (special handling)
    let is_outfit = thing.category == "outfit";

    // Variables we'll calculate
    let tile_size: u32;
    let layers: u8;
    let pattern_x: u8;
    let pattern_y: u8;
    let pattern_z: u8;
    let frames: u8;
    let thing_width: u8;
    let thing_height: u8;

    if is_outfit {
        // OUTFIT-SPECIFIC DETECTION
        // Step 1: Detect tile size (32, 64, or 96) based on valid column counts
        tile_size = if img_width % 64 == 0 && img_height % 64 == 0 {
            let cols_64 = img_width / 64;
            if cols_64 == 4 || cols_64 == 8 || cols_64 == 16 { 64 }
            else if img_width % 96 == 0 && img_height % 96 == 0 {
                let cols_96 = img_width / 96;
                if cols_96 == 4 || cols_96 == 8 || cols_96 == 16 { 96 } else { 32 }
            } else { 32 }
        } else if img_width % 96 == 0 && img_height % 96 == 0 {
            let cols_96 = img_width / 96;
            if cols_96 == 4 || cols_96 == 8 || cols_96 == 16 { 96 } else { 32 }
        } else { 32 };

        let cols = img_width / tile_size;
        let rows = img_height / tile_size;

        // Step 2: Detect layers and mount from column count
        // 4 cols = no mask (layers=1), no mount (patternZ=1)
        // 8 cols = has mask (layers=2), no mount (patternZ=1)
        // 16 cols = has mask (layers=2), has mount (patternZ=2)
        let (detected_layers, detected_pattern_z) = match cols {
            4 => (1u8, 1u8),
            8 => (2u8, 1u8),
            16 => (2u8, 2u8),
            _ => return Err(format!("Invalid outfit column count: {}. Expected 4, 8, or 16", cols)),
        };
        layers = detected_layers;
        pattern_z = detected_pattern_z;

        // Step 3: Detect frames and addons from row count
        // Formula: rows = frames × patternY
        // Use version to determine max frames: version >= 1057 supports 9 frames, otherwise max 3
        let max_frames: u32 = if version >= 1057 { 9 } else { 3 };

        // Try to detect frames/patternY from image dimensions
        // Priority: prefer combinations that make sense for the version
        let (detected_frames, detected_pattern_y) = {
            let mut best_match: Option<(u8, u8)> = None;

            // Try frame counts from max down to 1
            for try_frames in (1..=max_frames).rev() {
                if rows % try_frames == 0 {
                    let addon_count = rows / try_frames;
                    // patternY (addons) can be 1, 2, or 3
                    if addon_count >= 1 && addon_count <= 3 {
                        // Valid combination found
                        // Prefer 3 frames for standard animation if it works
                        if try_frames == 3 || best_match.is_none() {
                            best_match = Some((try_frames as u8, addon_count as u8));
                            if try_frames == 3 {
                                break; // 3 frames is preferred for standard outfits
                            }
                        }
                    }
                }
            }

            // Fallback to original values if no valid combination found
            best_match.unwrap_or((thing.frames, thing.pattern_y))
        };

        frames = detected_frames;
        pattern_y = detected_pattern_y;

        // Outfits always have 4 directions
        pattern_x = 4;

        // Multi-tile size
        thing_width = (tile_size / 32) as u8;
        thing_height = (tile_size / 32) as u8;

        println!("Outfit import: tile_size={}, cols={}, rows={}, layers={}, pattern_x={}, pattern_y={}, pattern_z={}, frames={}, thing_size={}x{}",
                 tile_size, cols, rows, layers, pattern_x, pattern_y, pattern_z, frames, thing_width, thing_height);
    } else {
        // NON-OUTFIT: Use original simple detection
        tile_size = 32;
        thing_width = 1;
        thing_height = 1;

        let cols = img_width / 32;
        let rows = img_height / 32;

        // Detect mask colors
        let mut has_mask = false;
        'mask_check: for pixel in img.pixels() {
            if pixel[3] == 0 { continue; }
            let r = pixel[0];
            let g = pixel[1];
            let b = pixel[2];
            let is_red = r > 200 && g < 50 && b < 50;
            let is_green = r < 50 && g > 200 && b < 50;
            let is_blue = r < 50 && g < 50 && b > 200;
            let is_yellow = r > 200 && g > 200 && b < 50;
            if is_red || is_green || is_blue || is_yellow {
                has_mask = true;
                break 'mask_check;
            }
        }

        layers = if has_mask { 2 } else { 1 };
        frames = cols as u8;
        pattern_x = rows as u8;
        pattern_y = 1;
        pattern_z = 1;
    }

    // 3. Collect reusable sprite IDs from existing frame groups
    let mut reusable_ids: Vec<u32> = Vec::new();
    if let Some(fgs) = &thing.frame_groups_data {
        for fg in fgs {
            for &id in &fg.sprite_index {
                if id != 0 {
                    reusable_ids.push(id);
                }
            }
        }
    }
    reusable_ids.sort();
    reusable_ids.dedup();

    // 4. Extract sprites following Tibia's index formula order
    // index = ((((frame * patternZ + pz) * patternY + py) * patternX + px) * layers + layer) * height + h) * width + w
    let mut new_sprite_index = Vec::new();
    let mut sprites_data: Vec<SpriteData> = Vec::new();
    let mut id_alloc_idx = 0;
    let mut current_next_id = next_sprite_id;

    for frame in 0..frames {
        for pz in 0..pattern_z {
            for py in 0..pattern_y {
                for px in 0..pattern_x {
                    for layer in 0..layers {
                        for h in 0..thing_height {
                            for w in 0..thing_width {
                                // Calculate image coordinates
                                let img_row = if is_outfit {
                                    // Outfit: row = frame * patternY + py (addon)
                                    (frame as u32) * (pattern_y as u32) + (py as u32)
                                } else {
                                    // Non-outfit: original formula
                                    (layer as u32) * (pattern_x as u32) + (px as u32)
                                };

                                let img_col = if is_outfit {
                                    // Outfit: col = pz * (directions * layers) + px * layers + layer
                                    (pz as u32) * (pattern_x as u32) * (layers as u32)
                                        + (px as u32) * (layers as u32)
                                        + (layer as u32)
                                } else {
                                    frame as u32
                                };

                                // Pixel coordinates (for multi-tile, extract each 32x32 sub-tile)
                                // Tibia stores multi-tile sprites in REVERSE order (bottom-right first)
                                // So sprite index [0] = bottom-right, but in image it's at top-left
                                // We need to reverse the extraction: w=0 extracts from right side, h=0 from bottom
                                let reversed_w = (thing_width - 1 - w) as u32;
                                let reversed_h = (thing_height - 1 - h) as u32;
                                let src_x = img_col * tile_size + reversed_w * 32;
                                let src_y = img_row * tile_size + reversed_h * 32;

                                // Extract 32x32 sprite - check bounds first
                                if src_x + 32 <= img_width && src_y + 32 <= img_height {
                                    let sub_img = img.view(src_x, src_y, 32, 32);
                                    let mut sub_img_buffer = sub_img.to_image();

                                    // Normalize transparent pixels
                                    for pixel in sub_img_buffer.pixels_mut() {
                                        if pixel[3] == 0 { pixel.0 = [0, 0, 0, 0]; }
                                    }

                                    let raw_pixels = sub_img_buffer.as_raw();

                                    // Check if sprite is completely empty (all transparent)
                                    let is_empty = raw_pixels.chunks(4).all(|p| p[3] == 0);

                                    if is_empty {
                                        // Empty sprite = use sprite ID 0 (Tibia convention)
                                        new_sprite_index.push(0);
                                    } else {
                                        // Allocate new sprite ID for non-empty sprite
                                        let sprite_id = if id_alloc_idx < reusable_ids.len() {
                                            let id = reusable_ids[id_alloc_idx];
                                            id_alloc_idx += 1;
                                            id
                                        } else {
                                            let id = current_next_id;
                                            current_next_id += 1;
                                            id
                                        };

                                        let compressed_pixels = compress_to_rle(raw_pixels, transparent);

                                        let sprite_data = SpriteData {
                                            id: sprite_id,
                                            is_empty: false,
                                            compressed_pixels,
                                        };

                                        // Store in overrides
                                        manager.update_sprite(&spr_path, sprite_id, sprite_data.clone())?;

                                        // Collect for response
                                        sprites_data.push(sprite_data);

                                        new_sprite_index.push(sprite_id);
                                    }
                                } else {
                                    // Out of bounds = empty sprite (use ID 0)
                                    new_sprite_index.push(0);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 5. Build frame groups (only if version >= 1057 supports them)
    // Frame groups are only supported for outfits in version 10.57 (1057) and above
    let has_frame_groups = version >= 1057;

    println!("Frame groups check: version={}, has_frame_groups={}", version, has_frame_groups);

    let sprites_per_frame = (pattern_x as usize) * (pattern_y as usize) * (pattern_z as usize)
                          * (layers as usize) * (thing_height as usize) * (thing_width as usize);

    let frame_groups: Option<Vec<FrameGroup>> = if has_frame_groups {
        // VERSION >= 1057: Create frame groups
        let mut groups = Vec::new();

        if is_outfit && frames > 1 {
            // Outfit with multiple frames: split into Idle (frame 0) and Walking (frames 1+)
            let idle_group = FrameGroup {
                r#type: 0, // Idle
                width: thing_width,
                height: thing_height,
                exact_size: tile_size as u8,
                layers,
                pattern_x,
                pattern_y,
                pattern_z,
                frames: 1,
                sprite_index: new_sprite_index[0..sprites_per_frame].to_vec(),
                is_animation: false,
                animation_mode: Some(0),
                loop_count: Some(0),
                start_frame: Some(0),
                frame_durations: Some(vec![]),
            };
            groups.push(idle_group);

            let walking_frames = frames - 1;
            if walking_frames > 0 {
                let walking_group = FrameGroup {
                    r#type: 1, // Walking
                    width: thing_width,
                    height: thing_height,
                    exact_size: tile_size as u8,
                    layers,
                    pattern_x,
                    pattern_y,
                    pattern_z,
                    frames: walking_frames,
                    sprite_index: new_sprite_index[sprites_per_frame..].to_vec(),
                    is_animation: true,
                    animation_mode: Some(0),
                    loop_count: Some(-1),
                    start_frame: Some(0),
                    frame_durations: Some(vec![]),
                };
                groups.push(walking_group);
            }
        } else {
            // Single frame group for non-outfits or single-frame outfits
            let group = FrameGroup {
                r#type: 0,
                width: thing_width,
                height: thing_height,
                exact_size: tile_size as u8,
                layers,
                pattern_x,
                pattern_y,
                pattern_z,
                frames,
                sprite_index: new_sprite_index.clone(),
                is_animation: frames > 1,
                animation_mode: Some(0),
                loop_count: Some(if frames > 1 { -1 } else { 0 }),
                start_frame: Some(0),
                frame_durations: Some(vec![]),
            };
            groups.push(group);
        }
        Some(groups)
    } else {
        // VERSION < 1057: No frame groups - all frames in single sprite_index array
        None
    };

    // 6. Build updated ThingType
    let mut new_thing = thing.clone();
    new_thing.frame_groups_data = frame_groups;
    new_thing.width = thing_width;
    new_thing.height = thing_height;
    new_thing.exact_size = tile_size as u8;
    new_thing.layers = layers;
    new_thing.pattern_x = pattern_x;
    new_thing.pattern_y = pattern_y;
    new_thing.pattern_z = pattern_z;
    new_thing.frames = frames;
    new_thing.is_animation = frames > 1;
    // For legacy compatibility, use all sprites in sprite_index
    new_thing.sprite_index = new_sprite_index;

    // 7. Serialize ThingType to JSON
    let thing_json = serde_json::to_vec(&new_thing)
        .map_err(|e| format!("JSON serialize error: {}", e))?;

    // 8. Pack sprites to RGBA format (for immediate frontend cache population)
    let sprites_buffer = SprManager::pack_sprites_rgba_lz4(sprites_data, transparent);

    // 9. Build response: [JSON len: u32][JSON bytes][sprites buffer (already LZ4)]
    // Note: sprites_buffer is already LZ4 compressed, so we DON'T compress again
    // But we need the frontend to decompress the sprites separately from the JSON
    // So let's NOT LZ4 the whole thing - just prepend JSON
    let mut result = Vec::with_capacity(4 + thing_json.len() + sprites_buffer.len());
    result.extend_from_slice(&(thing_json.len() as u32).to_le_bytes());
    result.extend_from_slice(&thing_json);
    result.extend_from_slice(&sprites_buffer);

    Ok(tauri::ipc::Response::new(result))
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .register_asynchronous_uri_scheme_protocol(
            sprite_protocol::SCHEME,
            sprite_protocol::handle,
        )
        .manage(spr_manager)
        .manage(logger)
        .manage(dat_manager)
        .invoke_handler(tauri::generate_handler![
            read_file,
            read_file_text,
            read_file_header,
            open_spr_file,
            close_spr_file,
            read_sprites_rgba,
            read_sprites_batch_rgba,
            read_sprites_rgba_lz4,
            compress_sprite_rgba,
            set_debug_logging,
            get_debug_logging,
            list_directory,
            list_drives,
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
            get_item_list_view_mode,
            set_item_list_view_mode,
            get_sprite_list_view_mode,
            set_sprite_list_view_mode,
            get_find_list_view_mode,
            set_find_list_view_mode,
            get_general_settings,
            set_general_settings,
            get_config_dir_path,
            ensure_versions_dir,
            write_json_file,
            delete_file,
            save_scene,
            list_scenes,
            load_scene,
            delete_scene,
            write_dat_bin,
            update_spr_sprites_bin,
            copy_spr_file_with_mods,
            parse_dat_file_bin,
            search_things_bin,
            clear_dat_data,
            write_sprite_png,
            read_sprite_png,
            optimize_sprites_rust,
            apply_optimization,
            export_object_sheet_rust,
            import_object_sheet_binary,
            set_window_acrylic
        ])
        .setup(move |app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::{Manager, Listener};
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                // Apply vibrancy to main window
                if let Some(window) = app.get_webview_window("main") {
                    let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
                }

                // Listen for new windows and apply vibrancy to them too
                let app_handle = app.handle().clone();
                app.listen("tauri://webview-created", move |_event| {
                    if let Some(window) = app_handle.get_webview_window("find") {
                        let _ = apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(12.0));
                    }
                });
            }

            // Enable shadows on Windows (since tauri.conf.json has shadow: false for macOS compatibility)
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(true);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
