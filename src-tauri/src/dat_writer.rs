use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{self, Write};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct FrameDuration {
    pub minimum: u32,
    pub maximum: u32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ThingType {
    pub id: u32,
    pub category: String,
    pub width: u8,
    pub height: u8,
    pub exact_size: u8,
    pub layers: u8,
    pub pattern_x: u8,
    pub pattern_y: u8,
    pub pattern_z: u8,
    pub frames: u8,
    pub sprite_index: Vec<u32>,

    // Properties
    pub is_ground: bool,
    pub ground_speed: u16,
    pub is_ground_border: bool,
    pub is_on_bottom: bool,
    pub is_on_top: bool,
    pub is_container: bool,
    pub stackable: bool,
    pub force_use: bool,
    pub multi_use: bool,
    pub has_charges: bool,
    pub writable: bool,
    pub writable_once: bool,
    pub max_text_length: u16,
    pub is_fluid_container: bool,
    pub is_fluid: bool,
    pub is_unpassable: bool,
    pub is_unmoveable: bool,
    pub block_missile: bool,
    pub block_pathfind: bool,
    pub no_move_animation: bool,
    pub pickupable: bool,
    pub hangable: bool,
    pub is_vertical: bool,
    pub is_horizontal: bool,
    pub rotatable: bool,
    pub has_light: bool,
    pub light_level: u16,
    pub light_color: u16,
    pub dont_hide: bool,
    pub floor_change: bool,
    pub is_translucent: bool,
    pub has_offset: bool,
    pub offset_x: u16,
    pub offset_y: u16,
    pub has_elevation: bool,
    pub elevation: u16,
    pub is_lying_object: bool,
    pub animate_always: bool,
    pub mini_map: bool,
    pub mini_map_color: u16,
    pub is_lens_help: bool,
    pub lens_help: u16,
    pub is_full_ground: bool,
    pub ignore_look: bool,
    pub cloth: bool,
    pub cloth_slot: u16,
    pub is_market_item: bool,
    pub market_name: String,
    pub market_category: u16,
    pub market_trade_as: u16,
    pub market_show_as: u16,
    pub market_restrict_profession: u16,
    pub market_restrict_level: u16,
    pub has_default_action: bool,
    pub default_action: u16,
    pub usable: bool,
    pub wrappable: bool,
    pub unwrappable: bool,
    pub top_effect: bool,

    // Animation
    pub is_animation: bool,
    pub animation_mode: u8,
    pub loop_count: i32,
    pub start_frame: i8,
    pub frame_durations: Vec<FrameDuration>,
}

/// Metadata flags for different client versions
pub struct MetadataFlags4;
impl MetadataFlags4 {
    pub const GROUND: u8 = 0x00;
    const GROUND_BORDER: u8 = 0x01;
    const ON_BOTTOM: u8 = 0x02;
    const ON_TOP: u8 = 0x03;
    const CONTAINER: u8 = 0x04;
    const STACKABLE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const MULTI_USE: u8 = 0x07;
    const HAS_CHARGES: u8 = 0x08;
    const WRITABLE: u8 = 0x09;
    const WRITABLE_ONCE: u8 = 0x0a;
    const FLUID_CONTAINER: u8 = 0x0b;
    const FLUID: u8 = 0x0c;
    const UNPASSABLE: u8 = 0x0d;
    const UNMOVEABLE: u8 = 0x0e;
    const BLOCK_MISSILE: u8 = 0x0f;
    const BLOCK_PATHFIND: u8 = 0x10;
    const PICKUPABLE: u8 = 0x11;
    const HANGABLE: u8 = 0x12;
    const VERTICAL: u8 = 0x13;
    const HORIZONTAL: u8 = 0x14;
    const ROTATABLE: u8 = 0x15;
    const HAS_LIGHT: u8 = 0x16;
    const DONT_HIDE: u8 = 0x17;
    const FLOOR_CHANGE: u8 = 0x18;
    const HAS_OFFSET: u8 = 0x19;
    const HAS_ELEVATION: u8 = 0x1a;
    const LYING_OBJECT: u8 = 0x1b;
    const ANIMATE_ALWAYS: u8 = 0x1c;
    const MINI_MAP: u8 = 0x1d;
    const LENS_HELP: u8 = 0x1e;
    const FULL_GROUND: u8 = 0x1f;
    const IGNORE_LOOK: u8 = 0x20;
    const LAST_FLAG: u8 = 0xff;
}

pub struct MetadataFlags5;
impl MetadataFlags5 {
    pub const GROUND: u8 = 0x00;
    const GROUND_BORDER: u8 = 0x01;
    const ON_BOTTOM: u8 = 0x02;
    const ON_TOP: u8 = 0x03;
    const CONTAINER: u8 = 0x04;
    const STACKABLE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const MULTI_USE: u8 = 0x07;
    const WRITABLE: u8 = 0x08;
    const WRITABLE_ONCE: u8 = 0x09;
    const FLUID_CONTAINER: u8 = 0x0a;
    const FLUID: u8 = 0x0b;
    const UNPASSABLE: u8 = 0x0c;
    const UNMOVEABLE: u8 = 0x0d;
    const BLOCK_MISSILE: u8 = 0x0e;
    const BLOCK_PATHFIND: u8 = 0x0f;
    const PICKUPABLE: u8 = 0x10;
    const HANGABLE: u8 = 0x11;
    const VERTICAL: u8 = 0x12;
    const HORIZONTAL: u8 = 0x13;
    const ROTATABLE: u8 = 0x14;
    const HAS_LIGHT: u8 = 0x15;
    const DONT_HIDE: u8 = 0x16;
    const TRANSLUCENT: u8 = 0x17;
    const HAS_OFFSET: u8 = 0x18;
    const HAS_ELEVATION: u8 = 0x19;
    const LYING_OBJECT: u8 = 0x1a;
    const ANIMATE_ALWAYS: u8 = 0x1b;
    const MINI_MAP: u8 = 0x1c;
    const LENS_HELP: u8 = 0x1d;
    const FULL_GROUND: u8 = 0x1e;
    const IGNORE_LOOK: u8 = 0x1f;
    const CLOTH: u8 = 0x20;
    const MARKET_ITEM: u8 = 0x21;
    const LAST_FLAG: u8 = 0xff;
}

pub struct MetadataFlags6;
impl MetadataFlags6 {
    pub const GROUND: u8 = 0x00;
    const GROUND_BORDER: u8 = 0x01;
    const ON_BOTTOM: u8 = 0x02;
    const ON_TOP: u8 = 0x03;
    const CONTAINER: u8 = 0x04;
    const STACKABLE: u8 = 0x05;
    const FORCE_USE: u8 = 0x06;
    const MULTI_USE: u8 = 0x07;
    const WRITABLE: u8 = 0x08;
    const WRITABLE_ONCE: u8 = 0x09;
    const FLUID_CONTAINER: u8 = 0x0a;
    const FLUID: u8 = 0x0b;
    const UNPASSABLE: u8 = 0x0c;
    const UNMOVEABLE: u8 = 0x0d;
    const BLOCK_MISSILE: u8 = 0x0e;
    const BLOCK_PATHFIND: u8 = 0x0f;
    const NO_MOVE_ANIMATION: u8 = 0x10;
    const PICKUPABLE: u8 = 0x11;
    const HANGABLE: u8 = 0x12;
    const VERTICAL: u8 = 0x13;
    const HORIZONTAL: u8 = 0x14;
    const ROTATABLE: u8 = 0x15;
    const HAS_LIGHT: u8 = 0x16;
    const DONT_HIDE: u8 = 0x17;
    const TRANSLUCENT: u8 = 0x18;
    const HAS_OFFSET: u8 = 0x19;
    const HAS_ELEVATION: u8 = 0x1a;
    const LYING_OBJECT: u8 = 0x1b;
    const ANIMATE_ALWAYS: u8 = 0x1c;
    const MINI_MAP: u8 = 0x1d;
    const LENS_HELP: u8 = 0x1e;
    const FULL_GROUND: u8 = 0x1f;
    const IGNORE_LOOK: u8 = 0x20;
    const CLOTH: u8 = 0x21;
    const MARKET_ITEM: u8 = 0x22;
    const DEFAULT_ACTION: u8 = 0x23;
    const WRAPPABLE: u8 = 0x24;
    const UNWRAPPABLE: u8 = 0x25;
    const TOP_EFFECT: u8 = 0x26;
    const USABLE: u8 = 0xfe;
    const LAST_FLAG: u8 = 0xff;
}

pub struct DatWriter<W: Write> {
    writer: W,
    version: u32, // Version value (e.g., 780, 860, 1010)
    extended: bool,
    frame_durations: bool,
    frame_groups: bool, // Version >= 10.57 (1057) uses frame groups
}

impl<W: Write> DatWriter<W> {
    pub fn new(writer: W, version: u32, extended: bool, frame_durations: bool) -> Self {
        let frame_groups = version >= 1057;
        Self {
            writer,
            version,
            extended,
            frame_durations,
            frame_groups,
        }
    }

    fn write_u8(&mut self, value: u8) -> io::Result<()> {
        self.writer.write_all(&[value])
    }

    fn write_i8(&mut self, value: i8) -> io::Result<()> {
        self.writer.write_all(&[value as u8])
    }

    fn write_u16_le(&mut self, value: u16) -> io::Result<()> {
        self.writer.write_all(&value.to_le_bytes())
    }

    fn write_u32_le(&mut self, value: u32) -> io::Result<()> {
        self.writer.write_all(&value.to_le_bytes())
    }

    fn write_i32_le(&mut self, value: i32) -> io::Result<()> {
        self.writer.write_all(&value.to_le_bytes())
    }

    fn write_string(&mut self, s: &str) -> io::Result<()> {
        // Write length as u16
        self.write_u16_le(s.len() as u16)?;
        // Write string bytes (Latin-1 encoding)
        self.writer.write_all(s.as_bytes())
    }

    pub fn write_header(&mut self, signature: u32, items_count: u16, outfits_count: u16, effects_count: u16, missiles_count: u16) -> io::Result<()> {
        self.write_u32_le(signature)?;
        self.write_u16_le(items_count)?;
        self.write_u16_le(outfits_count)?;
        self.write_u16_le(effects_count)?;
        self.write_u16_le(missiles_count)?;
        Ok(())
    }

    // Write properties for ITEMS ONLY (version 4: 7.80 - 8.54)
    fn write_item_properties_v4(&mut self, thing: &ThingType) -> io::Result<()> {
        // Ground flags are mutually exclusive (same as Object Builder)
        if thing.is_ground {
            self.write_u8(MetadataFlags4::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags4::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags4::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags4::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags4::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags4::STACKABLE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags4::FORCE_USE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags4::MULTI_USE)?;
        }
        if thing.has_charges {
            self.write_u8(MetadataFlags4::HAS_CHARGES)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags4::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags4::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags4::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags4::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags4::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags4::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags4::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags4::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags4::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags4::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags4::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags4::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags4::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags4::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.dont_hide {
            self.write_u8(MetadataFlags4::DONT_HIDE)?;
        }
        if thing.floor_change {
            self.write_u8(MetadataFlags4::FLOOR_CHANGE)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags4::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x)?;
            self.write_u16_le(thing.offset_y)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags4::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags4::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags4::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags4::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags4::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags4::FULL_GROUND)?;
        }
        if thing.ignore_look {
            self.write_u8(MetadataFlags4::IGNORE_LOOK)?;
        }

        // Last flag
        self.write_u8(MetadataFlags4::LAST_FLAG)?;
        Ok(())
    }

    // Write properties for OUTFITS/EFFECTS/MISSILES ONLY (version 4: 7.80 - 8.54)
    // These categories only support 3 properties: hasLight, hasOffset, animateAlways
    fn write_non_item_properties_v4(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags4::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags4::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x)?;
            self.write_u16_le(thing.offset_y)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags4::ANIMATE_ALWAYS)?;
        }

        // Last flag
        self.write_u8(MetadataFlags4::LAST_FLAG)?;
        Ok(())
    }

    // Write properties for ITEMS ONLY (version 5: 8.60 - 9.86)
    fn write_item_properties_v5(&mut self, thing: &ThingType) -> io::Result<()> {
        // Ground flags are mutually exclusive (same as Object Builder)
        if thing.is_ground {
            self.write_u8(MetadataFlags5::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags5::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags5::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags5::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags5::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags5::STACKABLE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags5::FORCE_USE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags5::MULTI_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags5::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags5::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags5::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags5::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags5::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags5::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags5::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags5::BLOCK_PATHFIND)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags5::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags5::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags5::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags5::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags5::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags5::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.dont_hide {
            self.write_u8(MetadataFlags5::DONT_HIDE)?;
        }
        if thing.is_translucent {
            self.write_u8(MetadataFlags5::TRANSLUCENT)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags5::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x)?;
            self.write_u16_le(thing.offset_y)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags5::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags5::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags5::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags5::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags5::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags5::FULL_GROUND)?;
        }
        if thing.ignore_look {
            self.write_u8(MetadataFlags5::IGNORE_LOOK)?;
        }
        if thing.cloth {
            self.write_u8(MetadataFlags5::CLOTH)?;
            self.write_u16_le(thing.cloth_slot)?;
        }
        if thing.is_market_item {
            self.write_u8(MetadataFlags5::MARKET_ITEM)?;
            self.write_u16_le(thing.market_category)?;
            self.write_u16_le(thing.market_trade_as)?;
            self.write_u16_le(thing.market_show_as)?;
            self.write_string(&thing.market_name)?;
            self.write_u16_le(thing.market_restrict_profession)?;
            self.write_u16_le(thing.market_restrict_level)?;
        }

        // Last flag
        self.write_u8(MetadataFlags5::LAST_FLAG)?;
        Ok(())
    }

    // Write properties for OUTFITS/EFFECTS/MISSILES ONLY (version 5: 8.60 - 9.86)
    // These categories only support 3 properties: hasLight, hasOffset, animateAlways
    fn write_non_item_properties_v5(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags5::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags5::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x)?;
            self.write_u16_le(thing.offset_y)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags5::ANIMATE_ALWAYS)?;
        }

        // Last flag
        self.write_u8(MetadataFlags5::LAST_FLAG)?;
        Ok(())
    }

    // Write properties for ITEMS ONLY (version 6: 10.10 - 10.56)
    fn write_item_properties_v6(&mut self, thing: &ThingType) -> io::Result<()> {
        // Ground flags are mutually exclusive (same as Object Builder)
        if thing.is_ground {
            self.write_u8(MetadataFlags6::GROUND)?;
            self.write_u16_le(thing.ground_speed)?;
        } else if thing.is_ground_border {
            self.write_u8(MetadataFlags6::GROUND_BORDER)?;
        } else if thing.is_on_bottom {
            self.write_u8(MetadataFlags6::ON_BOTTOM)?;
        } else if thing.is_on_top {
            self.write_u8(MetadataFlags6::ON_TOP)?;
        }
        if thing.is_container {
            self.write_u8(MetadataFlags6::CONTAINER)?;
        }
        if thing.stackable {
            self.write_u8(MetadataFlags6::STACKABLE)?;
        }
        if thing.force_use {
            self.write_u8(MetadataFlags6::FORCE_USE)?;
        }
        if thing.multi_use {
            self.write_u8(MetadataFlags6::MULTI_USE)?;
        }
        if thing.writable {
            self.write_u8(MetadataFlags6::WRITABLE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.writable_once {
            self.write_u8(MetadataFlags6::WRITABLE_ONCE)?;
            self.write_u16_le(thing.max_text_length)?;
        }
        if thing.is_fluid_container {
            self.write_u8(MetadataFlags6::FLUID_CONTAINER)?;
        }
        if thing.is_fluid {
            self.write_u8(MetadataFlags6::FLUID)?;
        }
        if thing.is_unpassable {
            self.write_u8(MetadataFlags6::UNPASSABLE)?;
        }
        if thing.is_unmoveable {
            self.write_u8(MetadataFlags6::UNMOVEABLE)?;
        }
        if thing.block_missile {
            self.write_u8(MetadataFlags6::BLOCK_MISSILE)?;
        }
        if thing.block_pathfind {
            self.write_u8(MetadataFlags6::BLOCK_PATHFIND)?;
        }
        if thing.no_move_animation {
            self.write_u8(MetadataFlags6::NO_MOVE_ANIMATION)?;
        }
        if thing.pickupable {
            self.write_u8(MetadataFlags6::PICKUPABLE)?;
        }
        if thing.hangable {
            self.write_u8(MetadataFlags6::HANGABLE)?;
        }
        if thing.is_vertical {
            self.write_u8(MetadataFlags6::VERTICAL)?;
        }
        if thing.is_horizontal {
            self.write_u8(MetadataFlags6::HORIZONTAL)?;
        }
        if thing.rotatable {
            self.write_u8(MetadataFlags6::ROTATABLE)?;
        }
        if thing.has_light {
            self.write_u8(MetadataFlags6::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }
        if thing.dont_hide {
            self.write_u8(MetadataFlags6::DONT_HIDE)?;
        }
        if thing.is_translucent {
            self.write_u8(MetadataFlags6::TRANSLUCENT)?;
        }
        if thing.has_offset {
            self.write_u8(MetadataFlags6::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x)?;
            self.write_u16_le(thing.offset_y)?;
        }
        if thing.has_elevation {
            self.write_u8(MetadataFlags6::HAS_ELEVATION)?;
            self.write_u16_le(thing.elevation)?;
        }
        if thing.is_lying_object {
            self.write_u8(MetadataFlags6::LYING_OBJECT)?;
        }
        if thing.animate_always {
            self.write_u8(MetadataFlags6::ANIMATE_ALWAYS)?;
        }
        if thing.mini_map {
            self.write_u8(MetadataFlags6::MINI_MAP)?;
            self.write_u16_le(thing.mini_map_color)?;
        }
        if thing.is_lens_help {
            self.write_u8(MetadataFlags6::LENS_HELP)?;
            self.write_u16_le(thing.lens_help)?;
        }
        if thing.is_full_ground {
            self.write_u8(MetadataFlags6::FULL_GROUND)?;
        }
        if thing.ignore_look {
            self.write_u8(MetadataFlags6::IGNORE_LOOK)?;
        }
        if thing.cloth {
            self.write_u8(MetadataFlags6::CLOTH)?;
            self.write_u16_le(thing.cloth_slot)?;
        }
        if thing.is_market_item {
            self.write_u8(MetadataFlags6::MARKET_ITEM)?;
            self.write_u16_le(thing.market_category)?;
            self.write_u16_le(thing.market_trade_as)?;
            self.write_u16_le(thing.market_show_as)?;
            self.write_string(&thing.market_name)?;
            self.write_u16_le(thing.market_restrict_profession)?;
            self.write_u16_le(thing.market_restrict_level)?;
        }
        if thing.has_default_action {
            self.write_u8(MetadataFlags6::DEFAULT_ACTION)?;
            self.write_u16_le(thing.default_action)?;
        }
        if thing.wrappable {
            self.write_u8(MetadataFlags6::WRAPPABLE)?;
        }
        if thing.unwrappable {
            self.write_u8(MetadataFlags6::UNWRAPPABLE)?;
        }
        if thing.top_effect {
            self.write_u8(MetadataFlags6::TOP_EFFECT)?;
        }
        if thing.usable {
            self.write_u8(MetadataFlags6::USABLE)?;
        }

        // Last flag
        self.write_u8(MetadataFlags6::LAST_FLAG)?;
        Ok(())
    }

    // Write properties for OUTFITS/EFFECTS/MISSILES ONLY (version 6: 10.10 - 10.56)
    // These categories only support 3 properties: hasLight, hasOffset, animateAlways
    fn write_non_item_properties_v6(&mut self, thing: &ThingType) -> io::Result<()> {
        if thing.has_light {
            self.write_u8(MetadataFlags6::HAS_LIGHT)?;
            self.write_u16_le(thing.light_level)?;
            self.write_u16_le(thing.light_color)?;
        }

        if thing.has_offset {
            self.write_u8(MetadataFlags6::HAS_OFFSET)?;
            self.write_u16_le(thing.offset_x)?;
            self.write_u16_le(thing.offset_y)?;
        }

        if thing.animate_always {
            self.write_u8(MetadataFlags6::ANIMATE_ALWAYS)?;
        }

        // Last flag
        self.write_u8(MetadataFlags6::LAST_FLAG)?;
        Ok(())
    }

    fn write_texture_patterns(&mut self, thing: &ThingType) -> io::Result<()> {
        // For version >= 10.57 (1057) outfits use frame groups
        if self.frame_groups && thing.category == "outfit" {
            // Write group count (we only write 1 group - the DEFAULT)
            self.write_u8(1)?;
            // Write group type (0 = DEFAULT/IDLE)
            self.write_u8(0)?;
        }

        // Write texture data
        self.write_u8(thing.width)?;
        self.write_u8(thing.height)?;

        if thing.width > 1 || thing.height > 1 {
            self.write_u8(thing.exact_size)?;
        }

        self.write_u8(thing.layers)?;
        self.write_u8(thing.pattern_x)?;
        self.write_u8(thing.pattern_y)?;
        self.write_u8(thing.pattern_z)?;
        self.write_u8(thing.frames)?;

        // Write animation data if frames > 1
        if thing.frames > 1 && self.frame_durations {
            self.write_u8(thing.animation_mode)?;
            self.write_i32_le(thing.loop_count)?;
            self.write_i8(thing.start_frame)?;

            // Write frame durations
            for fd in &thing.frame_durations {
                self.write_u32_le(fd.minimum)?;
                self.write_u32_le(fd.maximum)?;
            }
        }

        // Write sprite indices
        for &sprite_id in &thing.sprite_index {
            if self.extended {
                self.write_u32_le(sprite_id)?;
            } else {
                self.write_u16_le(sprite_id as u16)?;
            }
        }

        Ok(())
    }

    pub fn write_thing(&mut self, thing: &ThingType) -> io::Result<()> {
        // CRITICAL VALIDATION: Calculate total sprites to detect corrupt data
        let total_sprites = thing.width as u32
            * thing.height as u32
            * thing.pattern_x as u32
            * thing.pattern_y as u32
            * thing.pattern_z as u32
            * thing.frames as u32
            * thing.layers as u32;

        if total_sprites > 4096 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "Thing ID {} ({}) has {} sprites ({}×{}×{}×{}×{}×{}×{}) which exceeds the limit of 4096. Sprite index length: {}",
                    thing.id,
                    thing.category,
                    total_sprites,
                    thing.width, thing.height,
                    thing.pattern_x, thing.pattern_y, thing.pattern_z,
                    thing.frames, thing.layers,
                    thing.sprite_index.len()
                )
            ));
        }

        // Validate sprite index length matches calculated total
        if thing.sprite_index.len() != total_sprites as usize {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!(
                    "Thing ID {} ({}) sprite index length mismatch: expected {} sprites but array has {} entries",
                    thing.id,
                    thing.category,
                    total_sprites,
                    thing.sprite_index.len()
                )
            ));
        }

        // Write properties based on category and version
        // CRITICAL: Items use full property set, other categories only support 3 properties
        let is_item = thing.category == "item";

        if self.version >= 780 && self.version <= 854 {
            if is_item {
                self.write_item_properties_v4(thing)?;
            } else {
                self.write_non_item_properties_v4(thing)?;
            }
        } else if self.version >= 860 && self.version <= 986 {
            if is_item {
                self.write_item_properties_v5(thing)?;
            } else {
                self.write_non_item_properties_v5(thing)?;
            }
        } else {
            if is_item {
                self.write_item_properties_v6(thing)?;
            } else {
                self.write_non_item_properties_v6(thing)?;
            }
        }

        // Write texture patterns and sprite indices
        self.write_texture_patterns(thing)?;

        Ok(())
    }
}

pub fn write_dat_file(
    path: &str,
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


    let file = File::create(path).map_err(|e| format!("Failed to create file: {}", e))?;
    let mut writer = DatWriter::new(file, version, extended, frame_durations);

    // Write header - CRITICAL: Use maxId, not array length!
    writer
        .write_header(
            signature,
            items_max_id,
            outfits_max_id,
            effects_max_id,
            missiles_max_id,
        )
        .map_err(|e| format!("Failed to write header: {}", e))?;

    // Create HashMaps for O(1) lookup
    use std::collections::HashMap;
    let items_map: HashMap<u32, &ThingType> = items.iter().map(|t| (t.id, t)).collect();
    let outfits_map: HashMap<u32, &ThingType> = outfits.iter().map(|t| (t.id, t)).collect();
    let effects_map: HashMap<u32, &ThingType> = effects.iter().map(|t| (t.id, t)).collect();
    let missiles_map: HashMap<u32, &ThingType> = missiles.iter().map(|t| (t.id, t)).collect();

    // Write items sequentially from minId to maxId
    for id in items_min_id..=items_max_id {
        match items_map.get(&(id as u32)) {
            Some(item) => {
                writer
                    .write_thing(item)
                    .map_err(|e| format!("Failed to write item {}: {}", id, e))?;
            }
            None => {
                // Missing ID - write only LAST_FLAG
                writer
                    .write_u8(0xFF)
                    .map_err(|e| format!("Failed to write LAST_FLAG for item {}: {}", id, e))?;
            }
        }
    }

    // Write outfits sequentially from minId to maxId
    for id in outfits_min_id..=outfits_max_id {
        match outfits_map.get(&(id as u32)) {
            Some(outfit) => {
                writer
                    .write_thing(outfit)
                    .map_err(|e| format!("Failed to write outfit {}: {}", id, e))?;
            }
            None => {
                writer
                    .write_u8(0xFF)
                    .map_err(|e| format!("Failed to write LAST_FLAG for outfit {}: {}", id, e))?;
            }
        }
    }

    // Write effects sequentially from minId to maxId
    for id in effects_min_id..=effects_max_id {
        match effects_map.get(&(id as u32)) {
            Some(effect) => {
                writer
                    .write_thing(effect)
                    .map_err(|e| format!("Failed to write effect {}: {}", id, e))?;
            }
            None => {
                writer
                    .write_u8(0xFF)
                    .map_err(|e| format!("Failed to write LAST_FLAG for effect {}: {}", id, e))?;
            }
        }
    }

    // Write missiles sequentially from minId to maxId
    for id in missiles_min_id..=missiles_max_id {
        match missiles_map.get(&(id as u32)) {
            Some(missile) => {
                writer
                    .write_thing(missile)
                    .map_err(|e| format!("Failed to write missile {}: {}", id, e))?;
            }
            None => {
                writer
                    .write_u8(0xFF)
                    .map_err(|e| format!("Failed to write LAST_FLAG for missile {}: {}", id, e))?;
            }
        }
    }

    Ok(())
}
