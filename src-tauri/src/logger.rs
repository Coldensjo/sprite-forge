use std::fs::{File, OpenOptions};
use std::io::Write;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};
use serde::Serialize;
use serde_json;

/// Event codes for structured logging (token-efficient)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum EventCode {
    /// SPR file opened
    SprOpen,
    /// Single sprite read
    SprRead,
    /// Batch sprite read
    SprBatch,
    /// SPR file closed
    SprClose,
    /// Error occurred
    Error,
}

/// Compact log entry (minimal tokens)
#[derive(Debug, Serialize)]
pub struct LogEntry {
    /// Timestamp (milliseconds since epoch)
    #[serde(rename = "t")]
    pub timestamp: u64,
    /// Event code
    #[serde(rename = "e")]
    pub event: EventCode,
    /// Event data (minimal, structured)
    #[serde(rename = "d")]
    pub data: serde_json::Value,
}

/// Thread-safe logger that writes JSONL to file
pub struct Logger {
    file: Option<File>,
    enabled: bool,
}

impl Logger {
    pub fn new() -> Self {
        Self {
            file: None,
            enabled: true  // Enabled by default
        }
    }

    /// Initialize logger with file path
    pub fn init(&mut self, path: &str) -> Result<(), String> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
            .map_err(|e| format!("Failed to open log file: {}", e))?;

        self.file = Some(file);
        Ok(())
    }

    /// Log an event (writes JSONL to file)
    pub fn log(&mut self, event: EventCode, data: serde_json::Value) {
        // Skip if logging disabled
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

    /// Close logger
    pub fn close(&mut self) {
        self.file = None;
    }

    /// Enable/disable logging
    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    /// Check if logging is enabled
    pub fn is_enabled(&self) -> bool {
        self.enabled
    }
}

/// Type alias for thread-safe logger
pub type LoggerState = Arc<Mutex<Logger>>;
