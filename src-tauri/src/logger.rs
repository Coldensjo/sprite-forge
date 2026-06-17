use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use serde_json;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventCode {
    SprOpen,
    SprBatch,
}

#[derive(Debug, Serialize)]
pub struct LogEntry {
    #[serde(rename = "t")]
    pub timestamp: u64,
    #[serde(rename = "e")]
    pub event: EventCode,
    #[serde(rename = "d")]
    pub data: serde_json::Value,
}

pub struct Logger {
    file: Option<File>,
    enabled: bool,
}

impl Logger {
    pub fn new() -> Self {
        Self {
            file: None,
            enabled: true
        }
    }

    pub fn init(&mut self, path: &str) -> Result<(), String> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| format!("Failed to open log file: {}", e))?;

        self.file = Some(file);
        Ok(())
    }

    pub fn log(&mut self, event: EventCode, data: serde_json::Value) {
        if !self.enabled {
            return;
        }

        if let Some(file) = &mut self.file {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;

            let entry = LogEntry {
                timestamp,
                event,
                data,
            };

            if let Ok(json) = serde_json::to_string(&entry) {
                let _ = writeln!(file, "{}", json);
            }
        }
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
}

pub type LoggerState = Arc<Mutex<Logger>>;
