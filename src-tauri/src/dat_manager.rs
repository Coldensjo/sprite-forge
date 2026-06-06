use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

use crate::dat_writer::ThingType;
use crate::similarity::{
    COLOR_GOOD, PROPS_PENALTY_MAX, SHAPE_GOOD, SpriteSignature, combine_visual, property_penalty, visual_components,
};

pub struct ReferenceThing {
    pub sprite_ids: Vec<u32>,
    pub properties: u64,
}

pub fn pack_property_bits(thing: &ThingType) -> u64 {
    let mut b: u64 = 0;
    let flags: [(u64, bool); 41] = [
        (1 << 0, thing.is_ground),
        (1 << 1, thing.is_ground_border),
        (1 << 2, thing.is_on_bottom),
        (1 << 3, thing.is_on_top),
        (1 << 4, thing.has_light),
        (1 << 5, thing.mini_map),
        (1 << 6, thing.has_offset),
        (1 << 7, thing.has_elevation),
        (1 << 8, thing.cloth),
        (1 << 9, thing.is_market_item),
        (1 << 10, thing.writable),
        (1 << 11, thing.writable_once),
        (1 << 12, thing.has_default_action),
        (1 << 13, thing.is_container),
        (1 << 14, thing.stackable),
        (1 << 15, thing.force_use),
        (1 << 16, thing.multi_use),
        (1 << 17, thing.is_fluid_container),
        (1 << 18, thing.is_fluid),
        (1 << 19, thing.is_unpassable),
        (1 << 20, thing.is_unmoveable),
        (1 << 21, thing.block_missile),
        (1 << 22, thing.block_pathfind),
        (1 << 23, thing.no_move_animation),
        (1 << 24, thing.pickupable),
        (1 << 25, thing.hangable),
        (1 << 26, thing.is_horizontal),
        (1 << 27, thing.is_vertical),
        (1 << 28, thing.rotatable),
        (1 << 29, thing.dont_hide),
        (1 << 30, thing.is_translucent),
        (1 << 31, thing.is_lying_object),
        (1 << 32, thing.animate_always),
        (1 << 33, thing.is_full_ground),
        (1 << 34, thing.ignore_look),
        (1 << 35, thing.wrappable),
        (1 << 36, thing.unwrappable),
        (1 << 37, thing.top_effect),
        (1 << 38, thing.usable),
        (1 << 39, thing.has_charges),
        (1 << 40, thing.floor_change),
    ];
    for (mask, on) in flags {
        if on { b |= mask; }
    }
    b
}

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

    pub fn collect_candidate_sprite_ids(
        &self,
        path: &str,
        category: Option<&str>,
    ) -> Result<HashSet<u32>, String> {
        let dat_data = self.get_data(path)
            .ok_or_else(|| format!("No DAT data loaded for path: {}", path))?;

        let mut ids: HashSet<u32> = HashSet::new();
        let mut push_from = |collection: &HashMap<u32, ThingType>| {
            for thing in collection.values() {
                for &sid in &thing.sprite_index {
                    if sid != 0 {
                        ids.insert(sid);
                    }
                }
            }
        };

        match category {
            Some("item") => push_from(&dat_data.items),
            Some("outfit") => push_from(&dat_data.outfits),
            Some("effect") => push_from(&dat_data.effects),
            Some("missile") => push_from(&dat_data.missiles),
            None => {
                push_from(&dat_data.items);
                push_from(&dat_data.outfits);
                push_from(&dat_data.effects);
                push_from(&dat_data.missiles);
            }
            Some(cat) => return Err(format!("Invalid category: {}", cat)),
        }

        Ok(ids)
    }

    pub fn resolve_reference_things(
        &self,
        path: &str,
        refs: &[(u32, u8)],
    ) -> Result<Vec<ReferenceThing>, String> {
        let dat_data = self.get_data(path)
            .ok_or_else(|| format!("No DAT data loaded for path: {}", path))?;
        let mut out = Vec::with_capacity(refs.len());
        for &(id, cat) in refs {
            let map = match cat {
                1 => &dat_data.items,
                2 => &dat_data.outfits,
                3 => &dat_data.effects,
                4 => &dat_data.missiles,
                _ => continue,
            };
            if let Some(thing) = map.get(&id) {
                let mut sprite_ids: Vec<u32> = thing.sprite_index.iter().copied().filter(|&s| s != 0).collect();
                sprite_ids.sort_unstable();
                sprite_ids.dedup();
                if sprite_ids.is_empty() { continue; }
                out.push(ReferenceThing {
                    sprite_ids,
                    properties: pack_property_bits(thing),
                });
            }
        }
        Ok(out)
    }

    pub fn find_similar_binary(
        &self,
        path: &str,
        category: Option<&str>,
        refs: &[ReferenceThing],
        signatures: &HashMap<u32, SpriteSignature>,
        threshold_pct: u8,
        max_results: usize,
    ) -> Result<Vec<u8>, String> {
        let dat_data = self.get_data(path)
            .ok_or_else(|| format!("No DAT data loaded for path: {}", path))?;

        if refs.is_empty() {
            let mut empty = Vec::with_capacity(4);
            empty.extend_from_slice(&0u32.to_le_bytes());
            return Ok(empty);
        }

        // Returns (rank, visual) for the best-matching reference, or None if no reference
        // is visually similar enough. Shape and property agreement lead; a shared
        // silhouette (a corpse and its skeleton) or a shared kind (two containers) both
        // outrank a mere palette match. Tiers, best first:
        //   tier 5: shape matches AND properties match    (same form, same kind)
        //   tier 4: shape matches                         (same form, different kind)
        //   tier 3: properties match AND color matches    (same kind, same palette)
        //   tier 2: properties match                      (same kind, weaker resemblance)
        //   tier 1: color matches                         (looks alike, different kind)
        //   tier 0: rest                                  (above the visual threshold only)
        // Within a tier, the closest property match ranks first, then visual similarity.
        let score_thing = |thing: &ThingType| -> Option<(u32, u8)> {
            let thing_props = pack_property_bits(thing);
            let mut best_rank: u32 = 0;
            let mut best_visual: u8 = 0;
            let mut matched = false;

            for r in refs {
                let mut shape: u8 = 0;
                let mut color: u8 = 0;
                let mut visual: u8 = 0;
                for &cand_sid in &thing.sprite_index {
                    if cand_sid == 0 { continue; }
                    let Some(cand_sig) = signatures.get(&cand_sid) else { continue };
                    if cand_sig.is_empty() { continue; }
                    for &ref_sid in &r.sprite_ids {
                        let Some(ref_sig) = signatures.get(&ref_sid) else { continue };
                        if ref_sig.is_empty() { continue; }
                        let (s, c) = visual_components(ref_sig, cand_sig);
                        let v = combine_visual(s, c);
                        if v > visual { visual = v; shape = s; color = c; }
                    }
                }

                if visual < threshold_pct {
                    continue;
                }
                matched = true;

                let penalty = property_penalty(r.properties, thing_props);
                let props_match = penalty <= PROPS_PENALTY_MAX;
                let shape_match = shape >= SHAPE_GOOD;
                let color_match = color >= COLOR_GOOD;

                let tier: u32 = if shape_match && props_match {
                    5
                } else if shape_match {
                    4
                } else if props_match && color_match {
                    3
                } else if props_match {
                    2
                } else if color_match {
                    1
                } else {
                    0
                };

                let prop_closeness = PROPS_PENALTY_MAX.saturating_sub(penalty);
                let rank = tier * 100_000 + prop_closeness * 1_000 + visual as u32;

                if rank > best_rank {
                    best_rank = rank;
                    best_visual = visual;
                }
            }

            if matched { Some((best_rank, best_visual)) } else { None }
        };

        let mut candidates: Vec<(u8, &ThingType)> = Vec::new();

        let collections: &[(&HashMap<u32, ThingType>, u8)] = match category {
            Some("item") => &[(&dat_data.items, 1)],
            Some("outfit") => &[(&dat_data.outfits, 2)],
            Some("effect") => &[(&dat_data.effects, 3)],
            Some("missile") => &[(&dat_data.missiles, 4)],
            None => &[
                (&dat_data.items, 1),
                (&dat_data.outfits, 2),
                (&dat_data.effects, 3),
                (&dat_data.missiles, 4),
            ],
            Some(cat) => return Err(format!("Invalid category: {}", cat)),
        };

        for &(collection, category_val) in collections {
            for thing in collection.values() {
                candidates.push((category_val, thing));
            }
        }

        use rayon::prelude::*;
        let mut scored: Vec<(u8, &ThingType, u32, u8)> = candidates
            .par_iter()
            .filter_map(|&(category_val, thing)| {
                score_thing(thing).map(|(rank, score)| (category_val, thing, rank, score))
            })
            .collect();

        scored.sort_by(|a, b| b.2.cmp(&a.2).then(a.1.id.cmp(&b.1.id)));
        if max_results > 0 && scored.len() > max_results {
            scored.truncate(max_results);
        }

        let mut buffer: Vec<u8> = Vec::with_capacity(4 + scored.len() * 32);
        buffer.extend_from_slice(&(scored.len() as u32).to_le_bytes());
        for (category_val, thing, _rank, score) in scored {
            buffer.extend_from_slice(&thing.id.to_le_bytes());
            buffer.push(category_val);
            buffer.push(thing.width);
            buffer.push(thing.height);
            buffer.push(thing.layers);
            buffer.push(thing.pattern_x);
            buffer.push(thing.pattern_y);
            buffer.push(thing.pattern_z);
            buffer.push(thing.frames);
            buffer.extend_from_slice(&(thing.sprite_index.len() as u16).to_le_bytes());
            for &sid in &thing.sprite_index {
                buffer.extend_from_slice(&sid.to_le_bytes());
            }
            buffer.push(score);
        }
        Ok(buffer)
    }
}

pub type DatManagerState = Arc<Mutex<DatManager>>;
