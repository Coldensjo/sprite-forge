use mlua::{Lua, Table, Value};
use tauri::State;

use crate::lua_host::LuaState;

const BOOTSTRAP: &str = r#"
forge._panels = forge._panels or {}
forge._commands = forge._commands or {}
forge._handlers = {}
forge._hcount = 0

function forge.register_panel(p)
  forge._panels[#forge._panels + 1] = p
end

function forge.register_command(name, fn)
  forge._commands[name] = fn
end

local function wrap_props(props)
  if type(props) ~= 'table' then return {} end
  local out = {}
  for k, v in pairs(props) do
    if type(v) == 'function' then
      forge._hcount = forge._hcount + 1
      forge._handlers[forge._hcount] = v
      out[k] = { __cb = forge._hcount }
    else
      out[k] = v
    end
  end
  return out
end

function forge.h(t, props, ...)
  return { type = t, props = wrap_props(props), children = { ... } }
end
"#;

pub fn install(lua: &Lua) -> mlua::Result<()> {
    lua.load(BOOTSTRAP).set_name("forge:ui-bootstrap").exec()
}

fn lua_to_json(v: Value) -> serde_json::Value {
    use serde_json::Value as J;
    match v {
        Value::Nil => J::Null,
        Value::Boolean(b) => J::Bool(b),
        Value::Integer(i) => J::Number(i.into()),
        Value::Number(n) => serde_json::Number::from_f64(n).map(J::Number).unwrap_or(J::Null),
        Value::String(s) => J::String(s.to_str().map(|c| c.to_string()).unwrap_or_default()),
        Value::Table(t) => {
            let len = t.raw_len();
            if len > 0 {
                let mut arr = Vec::with_capacity(len);
                for i in 1..=len {
                    arr.push(lua_to_json(t.get(i).unwrap_or(Value::Nil)));
                }
                J::Array(arr)
            } else {
                let mut map = serde_json::Map::new();
                for pair in t.pairs::<Value, Value>().flatten() {
                    let key = match pair.0 {
                        Value::String(s) => s.to_str().map(|c| c.to_string()).ok(),
                        Value::Integer(i) => Some(i.to_string()),
                        Value::Number(n) => Some(n.to_string()),
                        _ => None,
                    };
                    if let Some(k) = key {
                        map.insert(k, lua_to_json(pair.1));
                    }
                }
                J::Object(map)
            }
        }
        _ => J::Null,
    }
}

fn json_to_lua(lua: &Lua, v: &serde_json::Value) -> mlua::Result<Value> {
    use serde_json::Value as J;
    Ok(match v {
        J::Null => Value::Nil,
        J::Bool(b) => Value::Boolean(*b),
        J::Number(n) => {
            if let Some(i) = n.as_i64() {
                Value::Integer(i)
            } else {
                Value::Number(n.as_f64().unwrap_or(0.0))
            }
        }
        J::String(s) => Value::String(lua.create_string(s)?),
        J::Array(a) => {
            let t = lua.create_table()?;
            for (i, e) in a.iter().enumerate() {
                t.set(i + 1, json_to_lua(lua, e)?)?;
            }
            Value::Table(t)
        }
        J::Object(o) => {
            let t = lua.create_table()?;
            for (k, e) in o {
                t.set(k.as_str(), json_to_lua(lua, e)?)?;
            }
            Value::Table(t)
        }
    })
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelRender {
    pub id: String,
    pub title: String,
    pub dock: String,
    pub tree: serde_json::Value,
}

fn render_all(lua: &Lua) -> mlua::Result<Vec<PanelRender>> {
    let forge: Table = lua.globals().get("forge")?;
    forge.set("_handlers", lua.create_table()?)?;
    forge.set("_hcount", 0)?;

    let panels: Table = forge.get("_panels")?;
    let mut out = Vec::new();
    for pair in panels.sequence_values::<Table>() {
        let p = pair?;
        let id: String = p.get("id").unwrap_or_default();
        let title: String = p.get("title").unwrap_or_else(|_| id.clone());
        let dock: String = p.get("dock").unwrap_or_else(|_| "right".to_string());
        let render: mlua::Function = match p.get("render") {
            Ok(f) => f,
            Err(_) => continue,
        };
        let state: Value = p.get("state").unwrap_or(Value::Nil);
        let tree: Value = render.call(state)?;
        out.push(PanelRender { id, title, dock, tree: lua_to_json(tree) });
    }
    Ok(out)
}

#[tauri::command]
pub fn forge_panels(lua_state: State<LuaState>) -> Result<Vec<PanelRender>, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    render_all(&guard.lua).map_err(|e| format!("panel render error: {}", e))
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PanelMeta {
    pub id: String,
    pub title: String,
    pub dock: String,
    pub menu: bool,
}

#[tauri::command]
pub fn forge_panel_list(lua_state: State<LuaState>) -> Result<Vec<PanelMeta>, String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    let forge: Table = guard.lua.globals().get("forge").map_err(|e| e.to_string())?;
    let panels: Table = forge.get("_panels").map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for pair in panels.sequence_values::<Table>() {
        let p = pair.map_err(|e| e.to_string())?;
        let id: String = p.get("id").unwrap_or_default();
        let title: String = p.get("title").unwrap_or_else(|_| id.clone());
        let dock: String = p.get("dock").unwrap_or_else(|_| "right".to_string());
        let menu: bool = p.get("menu").unwrap_or(true);
        out.push(PanelMeta { id, title, dock, menu });
    }
    Ok(out)
}

#[tauri::command]
pub fn forge_dispatch(cb_id: u32, args: Option<String>, lua_state: State<LuaState>) -> Result<(), String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    let lua = &guard.lua;
    let forge: Table = lua.globals().get("forge").map_err(|e| e.to_string())?;
    let handlers: Table = forge.get("_handlers").map_err(|e| e.to_string())?;
    let handler: mlua::Function = handlers
        .get(cb_id)
        .map_err(|_| format!("no live handler {} (stale tree?)", cb_id))?;
    let arg = match args {
        Some(s) => {
            let j: serde_json::Value = serde_json::from_str(&s).map_err(|e| e.to_string())?;
            json_to_lua(lua, &j).map_err(|e| e.to_string())?
        }
        None => Value::Nil,
    };
    handler.call::<()>(arg).map_err(|e| format!("handler error: {}", e))
}

#[tauri::command]
pub fn forge_command(name: String, args: Option<String>, lua_state: State<LuaState>) -> Result<(), String> {
    let guard = lua_state.lock().map_err(|e| e.to_string())?;
    let lua = &guard.lua;
    let forge: Table = lua.globals().get("forge").map_err(|e| e.to_string())?;
    let commands: Table = forge.get("_commands").map_err(|e| e.to_string())?;
    let cmd: mlua::Function = commands.get(name.as_str()).map_err(|_| format!("no command '{}'", name))?;
    let arg = match args {
        Some(s) => {
            let j: serde_json::Value = serde_json::from_str(&s).map_err(|e| e.to_string())?;
            json_to_lua(lua, &j).map_err(|e| e.to_string())?
        }
        None => Value::Nil,
    };
    cmd.call::<()>(arg).map_err(|e| format!("command error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn host(src: &str) -> Lua {
        let lua = unsafe { Lua::unsafe_new() };
        lua.globals().set("forge", lua.create_table().unwrap()).unwrap();
        crate::lua_bridge::register(&lua).unwrap();
        lua.load(src).exec().unwrap();
        lua
    }

    #[test]
    fn renders_tree_and_registers_handlers() {
        let lua = host(
            "local n = 0\n\
             forge.register_panel{ id='p', title='P', dock='right', render=function()\n\
               return forge.h('vstack', { gap=8 },\n\
                 forge.h('label', { text='count '..n }),\n\
                 forge.h('button', { label='inc', onClick=function() n = n + 1 end }))\n\
             end }",
        );
        let panels = render_all(&lua).unwrap();
        assert_eq!(panels.len(), 1);
        let t = &panels[0].tree;
        assert_eq!(t["type"], "vstack");
        assert_eq!(t["props"]["gap"], 8);
        assert_eq!(t["children"][0]["props"]["text"], "count 0");
        let cb = t["children"][1]["props"]["onClick"]["__cb"].as_u64().unwrap();
        assert_eq!(cb, 1, "first handler id");
    }

    #[test]
    fn dispatch_mutates_and_rerenders() {
        let lua = host(
            "_G.n = 0\n\
             forge.register_panel{ id='p', title='P', render=function()\n\
               return forge.h('button', { label='x', onClick=function() _G.n = _G.n + 5 end })\n\
             end }",
        );
        let first = render_all(&lua).unwrap();
        let cb = first[0].tree["props"]["onClick"]["__cb"].as_u64().unwrap() as u32;

        let forge: Table = lua.globals().get("forge").unwrap();
        let handlers: Table = forge.get("_handlers").unwrap();
        let h: mlua::Function = handlers.get(cb).unwrap();
        h.call::<()>(Value::Nil).unwrap();

        let n: i64 = lua.load("return _G.n").eval().unwrap();
        assert_eq!(n, 5, "handler ran");

        let second = render_all(&lua).unwrap();
        assert_eq!(second[0].tree["props"]["label"], "x");
        let cb2 = second[0].tree["props"]["onClick"]["__cb"].as_u64().unwrap() as u32;
        assert_eq!(cb2, 1, "handlers reset on re-render, ids stable");
    }
}
