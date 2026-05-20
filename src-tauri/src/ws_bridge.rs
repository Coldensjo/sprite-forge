use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::spr_manager::SprManagerState;

pub const WS_BRIDGE_PORT: u16 = 17900;
const WS_BRIDGE_ADDR: &str = "127.0.0.1:17900";

#[derive(Debug, Deserialize)]
struct WsRequest {
    id: u32,
    cmd: String,
    path: String,
    #[serde(default, rename = "startId")]
    start_id: u32,
    #[serde(default)]
    count: u32,
    #[serde(default)]
    ids: Vec<u32>,
    #[serde(default)]
    transparent: bool,
}

fn frame(id: u32, status: u8, payload: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(5 + payload.len());
    out.extend_from_slice(&id.to_le_bytes());
    out.push(status);
    out.extend_from_slice(payload);
    out
}

fn handle_request(req: &WsRequest, spr: &SprManagerState) -> Result<Vec<u8>, String> {
    let mut manager = spr.lock().map_err(|e| format!("Lock error: {}", e))?;
    match req.cmd.as_str() {
        "read_sprites_batch_rgba" => {
            manager.read_sprites_batch_rgba(&req.path, req.start_id, req.count, req.transparent)
        }
        "read_sprites_rgba_lz4" => {
            manager.read_sprites_rgba_lz4(&req.path, req.ids.clone(), req.transparent)
        }
        other => Err(format!("Unknown ws cmd: {}", other)),
    }
}

async fn handle_client(stream: tokio::net::TcpStream, spr: SprManagerState) {
    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[ws_bridge] accept failed: {e}");
            return;
        }
    };

    let (mut ws_write, mut ws_read) = ws_stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel::<Message>();
    let writer = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if ws_write.send(msg).await.is_err() {
                break;
            }
        }
    });

    while let Some(msg) = ws_read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[ws_bridge] read error: {e}");
                break;
            }
        };

        match msg {
            Message::Text(text) => {
                let tx = tx.clone();
                let spr = spr.clone();
                tokio::spawn(async move {
                    let resp = tokio::task::spawn_blocking(move || {
                        let req: WsRequest = match serde_json::from_str(&text) {
                            Ok(r) => r,
                            Err(e) => return frame(0, 1, format!("Bad request: {e}").as_bytes()),
                        };
                        match handle_request(&req, &spr) {
                            Ok(payload) => frame(req.id, 0, &payload),
                            Err(e) => frame(req.id, 1, e.as_bytes()),
                        }
                    })
                    .await;

                    if let Ok(bytes) = resp {
                        let _ = tx.send(Message::Binary(bytes));
                    }
                });
            }
            Message::Ping(p) => {
                let _ = tx.send(Message::Pong(p));
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    writer.abort();
}

pub async fn run(spr: SprManagerState) {
    let listener = match TcpListener::bind(WS_BRIDGE_ADDR).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[ws_bridge] bind {WS_BRIDGE_ADDR} failed: {e}");
            return;
        }
    };
    println!("[ws_bridge] listening on ws://{WS_BRIDGE_ADDR}");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let _ = stream.set_nodelay(true);
                tokio::spawn(handle_client(stream, Arc::clone(&spr)));
            }
            Err(e) => {
                eprintln!("[ws_bridge] accept error: {e}");
            }
        }
    }
}
