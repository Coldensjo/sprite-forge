/// DAT Manager - Centralized storage for loaded DAT data
/// Matches Object Builder's ThingTypeStorage pattern
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// Re-use ThingType struct from dat_writer
use crate::dat_writer::ThingType;

/// Stored DAT data for a loaded file
pub struct DatData {
    pub items: HashMap<u32, ThingType>,
    pub outfits: HashMap<u32, ThingType>,
    pub effects: HashMap<u32, ThingType>,
    pub missiles: HashMap<u32, ThingType>,
}

impl DatData {
    pub fn new() -> Self {
        Self {
            items: HashMap::new(),
            outfits: HashMap::new(),
            effects: HashMap::new(),
            missiles: HashMap::new(),
        }
    }
}

/// Manager for DAT file data
/// Stores loaded DAT data indexed by path
pub struct DatManager {
    /// Map of path -> loaded DAT data
    files: HashMap<String, DatData>,
}

impl DatManager {
    pub fn new() -> Self {
        Self {
            files: HashMap::new(),
        }
    }

    /// Store DAT data for a file path
    /// Replaces any existing data for that path
    pub fn store_data(
        &mut self,
        path: String,
        items: Vec<ThingType>,
        outfits: Vec<ThingType>,
        effects: Vec<ThingType>,
        missiles: Vec<ThingType>,
    ) -> Result<(), String> {
        let mut dat_data = DatData::new();

        // Convert vectors to HashMaps for O(1) lookup
        for item in items {
            dat_data.items.insert(item.id, item);
        }
        for outfit in outfits {
            dat_data.outfits.insert(outfit.id, outfit);
        }
        for effect in effects {
            dat_data.effects.insert(effect.id, effect);
        }
        for missile in missiles {
            dat_data.missiles.insert(missile.id, missile);
        }

        self.files.insert(path, dat_data);
        Ok(())
    }

    /// Get stored DAT data by path
    pub fn get_data(&self, path: &str) -> Option<&DatData> {
        self.files.get(path)
    }

    /// Remove DAT data for a path
    pub fn remove_data(&mut self, path: &str) {
        self.files.remove(path);
    }

    fn matches_criteria(
        thing: &ThingType,
        name: Option<&str>,
        properties: &HashMap<String, bool>,
        sprite_id: Option<u32>,
    ) -> bool {
        if let Some(search_name) = name {
            if !search_name.is_empty() {
                let thing_name = thing.market_name.to_lowercase();
                let search_name_lower = search_name.to_lowercase();
                if !thing_name.contains(&search_name_lower) {
                    return false;
                }
            }
        }

        for (prop_name, required) in properties {
            if *required {
                let value = Self::get_property_value(thing, prop_name);
                if value != *required {
                    return false;
                }
            }
        }

        if let Some(sid) = sprite_id {
            let in_main = thing.sprite_index.iter().any(|&id| id == sid);
            let in_groups = thing
                .frame_groups_data
                .as_ref()
                .map(|gs| gs.iter().any(|g| g.sprite_index.iter().any(|&id| id == sid)))
                .unwrap_or(false);
            if !in_main && !in_groups {
                return false;
            }
        }

        true
    }

    /// Get boolean property value from ThingType by name
    /// Maps property names from TypeScript to Rust struct fields
    fn get_property_value(thing: &ThingType, prop_name: &str) -> bool {
        match prop_name {
            "isGround" => thing.is_ground,
            "isGroundBorder" => thing.is_ground_border,
            "isOnBottom" => thing.is_on_bottom,
            "isOnTop" => thing.is_on_top,
            "hasLight" => thing.has_light,
            "miniMap" => thing.mini_map,
            "hasOffset" => thing.has_offset,
            "hasElevation" => thing.has_elevation,
            "cloth" => thing.cloth,
            "isMarketItem" => thing.is_market_item,
            "writable" => thing.writable,
            "writableOnce" => thing.writable_once,
            "hasDefaultAction" => thing.has_default_action,
            "isContainer" => thing.is_container,
            "stackable" => thing.stackable,
            "forceUse" => thing.force_use,
            "multiUse" => thing.multi_use,
            "isFluidContainer" => thing.is_fluid_container,
            "isFluid" => thing.is_fluid,
            "isUnpassable" => thing.is_unpassable,
            "isUnmoveable" => thing.is_unmoveable,
            "blockMissile" => thing.block_missile,
            "blockPathfind" => thing.block_pathfind,
            "noMoveAnimation" => thing.no_move_animation,
            "pickupable" => thing.pickupable,
            "hangable" => thing.hangable,
            "isHorizontal" => thing.is_horizontal,
            "isVertical" => thing.is_vertical,
            "rotatable" => thing.rotatable,
            "dontHide" => thing.dont_hide,
            "isTranslucent" => thing.is_translucent,
            "isLyingObject" => thing.is_lying_object,
            "animateAlways" => thing.animate_always,
            "isFullGround" => thing.is_full_ground,
            "ignoreLook" => thing.ignore_look,
            "wrappable" => thing.wrappable,
            "unwrappable" => thing.unwrappable,
            "topEffect" => thing.top_effect,
            "usable" => thing.usable,
            "hasCharges" => thing.has_charges,
            "floorChange" => thing.floor_change,
            "isLensHelp" => thing.is_lens_help,
            "isAnimation" => thing.is_animation,
            _ => {
                eprintln!("Warning: Unknown property name: {}", prop_name);
                false
            }
        }
    }
    /// Search for ThingTypes matching criteria and return binary buffer
    /// Format: [TotalCount: u32] + [Item...]
    /// Item: [ID: u32][Category: u8][Width: u8][Height: u8][Layers: u8][PatternX: u8][PatternY: u8][PatternZ: u8][Frames: u8][SpriteCount: u16][SpriteIDs: u32...]
    pub fn search_binary(
        &self,
        path: &str,
        category: Option<&str>,
        name: Option<&str>,
        properties: &HashMap<String, bool>,
        sprite_id: Option<u32>,
        limit: usize,
    ) -> Result<Vec<u8>, String> {
        let dat_data = self.get_data(path)
            .ok_or_else(|| format!("No DAT data loaded for path: {}", path))?;

        let mut buffer = Vec::new();
        // Reserve space for count (u32)
        buffer.extend_from_slice(&[0, 0, 0, 0]);
        let mut count: u32 = 0;

        // Helper to write u32 le
        let write_u32 = |buf: &mut Vec<u8>, val: u32| {
            buf.extend_from_slice(&val.to_le_bytes());
        };
        // Helper to write u16 le
        let write_u16 = |buf: &mut Vec<u8>, val: u16| {
            buf.extend_from_slice(&val.to_le_bytes());
        };

        // Helper to search a collection
        let mut search_collection = |collection: &HashMap<u32, ThingType>, category_val: u8| {
            let mut found_items: Vec<&ThingType> = Vec::new();
            
            for thing in collection.values() {
                if Self::matches_criteria(thing, name, properties, sprite_id) {
                    found_items.push(thing);
                }
            }
            
            // Sort by ID
            found_items.sort_by_key(|t| t.id);
            
            for thing in found_items {
                // Write Item Data
                write_u32(&mut buffer, thing.id);
                buffer.push(category_val);
                buffer.push(thing.width);
                buffer.push(thing.height);
                buffer.push(thing.layers);
                buffer.push(thing.pattern_x);
                buffer.push(thing.pattern_y);
                buffer.push(thing.pattern_z);
                buffer.push(thing.frames);
                
                let sprite_count = thing.sprite_index.len() as u16;
                write_u16(&mut buffer, sprite_count);
                
                for &sprite_id in &thing.sprite_index {
                    write_u32(&mut buffer, sprite_id);
                }

                count += 1;
                if limit > 0 && count as usize >= limit {
                    return true; // Stop searching
                }
            }
            false // Continue searching
        };

        // Search based on category filter
        match category {
            Some("item") => {
                search_collection(&dat_data.items, 1);
            }
            Some("outfit") => {
                search_collection(&dat_data.outfits, 2);
            }
            Some("effect") => {
                search_collection(&dat_data.effects, 3);
            }
            Some("missile") => {
                search_collection(&dat_data.missiles, 4);
            }
            None => {
                // Search all categories
                if !search_collection(&dat_data.items, 1) {
                    if !search_collection(&dat_data.outfits, 2) {
                        if !search_collection(&dat_data.effects, 3) {
                            search_collection(&dat_data.missiles, 4);
                        }
                    }
                }
            }
            Some(cat) => {
                return Err(format!("Invalid category: {}", cat));
            }
        }

        // Write final count at the beginning
        let count_bytes = count.to_le_bytes();
        buffer[0] = count_bytes[0];
        buffer[1] = count_bytes[1];
        buffer[2] = count_bytes[2];
        buffer[3] = count_bytes[3];

        Ok(buffer)
    }
}

pub type DatManagerState = Arc<Mutex<DatManager>>;
