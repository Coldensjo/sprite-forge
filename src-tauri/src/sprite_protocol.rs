use std::borrow::Cow;

use tauri::{Manager, UriSchemeContext, UriSchemeResponder};

use crate::spr_manager::SprManagerState;

pub const SCHEME: &str = "spr";

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(hi), Some(lo)) = (hi, lo) {
                    out.push((hi * 16 + lo) as u8);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn parse_query(query: &str) -> std::collections::HashMap<String, String> {
    query
        .split('&')
        .filter_map(|kv| {
            let mut it = kv.splitn(2, '=');
            let k = it.next()?;
            let v = it.next().unwrap_or("");
            Some((k.to_string(), percent_decode(v)))
        })
        .collect()
}

fn num<T: std::str::FromStr>(q: &std::collections::HashMap<String, String>, key: &str, default: T) -> T {
    q.get(key).and_then(|v| v.parse().ok()).unwrap_or(default)
}

fn dispatch(
    spr: &SprManagerState,
    path_seg: &str,
    query: &std::collections::HashMap<String, String>,
) -> Result<(&'static str, Vec<u8>), String> {
    let spr_path = query.get("path").cloned().unwrap_or_default();
    if spr_path.is_empty() {
        return Err("missing `path` query param".to_string());
    }
    let start = num::<u32>(query, "start", 1);
    let count = num::<u32>(query, "count", 0);
    let transparent = num::<u32>(query, "transparent", 0) != 0;

    let mut manager = spr.lock().map_err(|e| format!("lock: {e}"))?;

    match path_seg {
        "/atlas.png" => {
            let cols = num::<u32>(query, "cols", 12).max(1);
            let png = manager.compose_atlas_png(&spr_path, start, count, cols, transparent)?;
            Ok(("image/png", png))
        }
        "/sprites.bin" => {
            let bytes = manager.read_sprites_batch_rgba(&spr_path, start, count, transparent)?;
            Ok(("application/octet-stream", bytes))
        }
        other => Err(format!("unknown route: {other}")),
    }
}

pub fn handle<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: tauri::http::Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let spr = ctx.app_handle().state::<SprManagerState>().inner().clone();

    let uri = request.uri().clone();
    let path_seg = uri.path().to_string();
    let query = parse_query(uri.query().unwrap_or(""));

    tauri::async_runtime::spawn_blocking(move || {
        let response = match dispatch(&spr, &path_seg, &query) {
            Ok((content_type, bytes)) => tauri::http::Response::builder()
                .status(200)
                .header(tauri::http::header::CONTENT_TYPE, content_type)
                .header(tauri::http::header::CACHE_CONTROL, "no-cache")
                .header("Access-Control-Allow-Origin", "*")
                .body(Cow::<'static, [u8]>::Owned(bytes))
                .unwrap(),
            Err(msg) => tauri::http::Response::builder()
                .status(500)
                .header(tauri::http::header::CONTENT_TYPE, "text/plain")
                .header("Access-Control-Allow-Origin", "*")
                .body(Cow::<'static, [u8]>::Owned(msg.into_bytes()))
                .unwrap(),
        };
        responder.respond(response);
    });
}
