use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use serde::{Serialize, Deserialize};

mod spr_manager;
use spr_manager::{SprManager, SprManagerState, SprHeader, SpriteData};

mod logger;
use logger::{Logger, LoggerState, EventCode};

// Wrapper to use serde_bytes for efficient binary transfer
#[derive(Serialize)]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize SPR manager state
    let spr_manager: SprManagerState = Arc::new(Mutex::new(SprManager::new()));

    // Initialize logger state
    let logger: LoggerState = Arc::new(Mutex::new(Logger::new()));

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
        .invoke_handler(tauri::generate_handler![
            read_file,
            read_file_text,
            open_spr_file,
            read_sprite,
            close_spr_file,
            get_spr_header,
            read_sprites_batch,
            read_sprites_list,
            read_sprites_list_bin,
            read_sprites_batch_bin,
            read_sprite_bin,
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
            set_panel_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

