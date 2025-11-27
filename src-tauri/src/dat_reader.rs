use std::fs::File;
use std::io::{self, Read, BufReader, Seek, SeekFrom};
use crate::dat_writer::{ThingType, FrameDuration};

// Binary encoding for fast IPC transfer (no JSON serialization)
// This module provides functions to encode parsed DAT data to binary buffers

/// Encode all parsed things to a binary buffer for IPC transfer
/// Format: 20-byte header + encoded things
pub fn encode_dat_to_binary(
    signature: u32,
    items: &[ThingType],
    outfits: &[ThingType],
    effects: &[ThingType],
    missiles: &[ThingType],
) -> Vec<u8> {
    // Estimate buffer size (20 header + ~150 bytes per thing average)
    let thing_count = items.len() + outfits.len() + effects.len() + missiles.len();
    let mut buffer = Vec::with_capacity(20 + thing_count * 150);

    // Write header (20 bytes)
    buffer.extend_from_slice(&signature.to_le_bytes());
    buffer.extend_from_slice(&(items.len() as u32).to_le_bytes());
    buffer.extend_from_slice(&(outfits.len() as u32).to_le_bytes());
    buffer.extend_from_slice(&(effects.len() as u32).to_le_bytes());
    buffer.extend_from_slice(&(missiles.len() as u32).to_le_bytes());

    // Encode each category
    for thing in items { encode_thing(&mut buffer, thing); }
    for thing in outfits { encode_thing(&mut buffer, thing); }
    for thing in effects { encode_thing(&mut buffer, thing); }
    for thing in missiles { encode_thing(&mut buffer, thing); }

    buffer
}

/// Encode a single ThingType to binary
fn encode_thing(buffer: &mut Vec<u8>, thing: &ThingType) {
    // Fixed header (12 bytes)
    buffer.extend_from_slice(&thing.id.to_le_bytes());           // 4 bytes
    buffer.push(thing.width);                                     // 1 byte
    buffer.push(thing.height);                                    // 1 byte
    buffer.push(thing.exact_size);                                // 1 byte
    buffer.push(thing.layers);                                    // 1 byte
    buffer.push(thing.pattern_x);                                 // 1 byte
    buffer.push(thing.pattern_y);                                 // 1 byte
    buffer.push(thing.pattern_z);                                 // 1 byte
    buffer.push(thing.frames);                                    // 1 byte

    // Encode boolean flags as 64-bit bitfield (8 bytes)
    let flags = encode_flags(thing);
    buffer.extend_from_slice(&flags.to_le_bytes());

    // Sprite IDs (2 + 4*n bytes)
    buffer.extend_from_slice(&(thing.sprite_index.len() as u16).to_le_bytes());
    for &sprite_id in &thing.sprite_index {
        buffer.extend_from_slice(&sprite_id.to_le_bytes());
    }

    // Conditional numeric fields (based on flags)
    if thing.is_ground {
        buffer.extend_from_slice(&thing.ground_speed.to_le_bytes());
    }
    if thing.has_light {
        buffer.extend_from_slice(&thing.light_level.to_le_bytes());
        buffer.extend_from_slice(&thing.light_color.to_le_bytes());
    }
    if thing.has_offset {
        buffer.extend_from_slice(&thing.offset_x.to_le_bytes());
        buffer.extend_from_slice(&thing.offset_y.to_le_bytes());
    }
    if thing.has_elevation {
        buffer.extend_from_slice(&thing.elevation.to_le_bytes());
    }
    if thing.mini_map {
        buffer.extend_from_slice(&thing.mini_map_color.to_le_bytes());
    }
    if thing.is_lens_help {
        buffer.extend_from_slice(&thing.lens_help.to_le_bytes());
    }
    if thing.cloth {
        buffer.extend_from_slice(&thing.cloth_slot.to_le_bytes());
    }
    if thing.is_market_item {
        buffer.extend_from_slice(&thing.market_category.to_le_bytes());
        buffer.extend_from_slice(&thing.market_trade_as.to_le_bytes());
        buffer.extend_from_slice(&thing.market_show_as.to_le_bytes());
        buffer.extend_from_slice(&thing.market_restrict_profession.to_le_bytes());
        buffer.extend_from_slice(&thing.market_restrict_level.to_le_bytes());
        // Market name as length-prefixed string
        let name_bytes = thing.market_name.as_bytes();
        buffer.extend_from_slice(&(name_bytes.len() as u16).to_le_bytes());
        buffer.extend_from_slice(name_bytes);
    }
    if thing.has_default_action {
        buffer.extend_from_slice(&thing.default_action.to_le_bytes());
    }
    if thing.writable || thing.writable_once {
        buffer.extend_from_slice(&thing.max_text_length.to_le_bytes());
    }

    // Animation data (only if is_animation AND has frame durations)
    if thing.is_animation && !thing.frame_durations.is_empty() {
        buffer.push(thing.animation_mode);
        buffer.extend_from_slice(&thing.loop_count.to_le_bytes());
        buffer.push(thing.start_frame as u8);
        buffer.push(thing.frame_durations.len() as u8);
        for fd in &thing.frame_durations {
            buffer.extend_from_slice(&fd.minimum.to_le_bytes());
            buffer.extend_from_slice(&fd.maximum.to_le_bytes());
        }
    }
}

/// Encode boolean properties as 64-bit bitfield
fn encode_flags(thing: &ThingType) -> u64 {
    let mut flags: u64 = 0;
    if thing.is_ground          { flags |= 1 << 0; }
    if thing.is_ground_border   { flags |= 1 << 1; }
    if thing.is_on_bottom       { flags |= 1 << 2; }
    if thing.is_on_top          { flags |= 1 << 3; }
    if thing.is_container       { flags |= 1 << 4; }
    if thing.stackable          { flags |= 1 << 5; }
    if thing.force_use          { flags |= 1 << 6; }
    if thing.multi_use          { flags |= 1 << 7; }
    if thing.has_charges        { flags |= 1 << 8; }
    if thing.writable           { flags |= 1 << 9; }
    if thing.writable_once      { flags |= 1 << 10; }
    if thing.is_fluid_container { flags |= 1 << 11; }
    if thing.is_fluid           { flags |= 1 << 12; }
    if thing.is_unpassable      { flags |= 1 << 13; }
    if thing.is_unmoveable      { flags |= 1 << 14; }
    if thing.block_missile      { flags |= 1 << 15; }
    if thing.block_pathfind     { flags |= 1 << 16; }
    if thing.no_move_animation  { flags |= 1 << 17; }
    if thing.pickupable         { flags |= 1 << 18; }
    if thing.hangable           { flags |= 1 << 19; }
    if thing.is_vertical        { flags |= 1 << 20; }
    if thing.is_horizontal      { flags |= 1 << 21; }
    if thing.rotatable          { flags |= 1 << 22; }
    if thing.has_light          { flags |= 1 << 23; }
    if thing.dont_hide          { flags |= 1 << 24; }
    if thing.floor_change       { flags |= 1 << 25; }
    if thing.is_translucent     { flags |= 1 << 26; }
    if thing.has_offset         { flags |= 1 << 27; }
    if thing.has_elevation      { flags |= 1 << 28; }
    if thing.is_lying_object    { flags |= 1 << 29; }
    if thing.animate_always     { flags |= 1 << 30; }
    if thing.mini_map           { flags |= 1 << 31; }
    if thing.is_lens_help       { flags |= 1 << 32; }
    if thing.is_full_ground     { flags |= 1 << 33; }
    if thing.ignore_look        { flags |= 1 << 34; }
    if thing.cloth              { flags |= 1 << 35; }
    if thing.is_market_item     { flags |= 1 << 36; }
    if thing.has_default_action { flags |= 1 << 37; }
    if thing.usable             { flags |= 1 << 38; }
    if thing.wrappable          { flags |= 1 << 39; }
    if thing.unwrappable        { flags |= 1 << 40; }
    if thing.top_effect         { flags |= 1 << 41; }
    if thing.is_animation       { flags |= 1 << 42; }
    flags
}

// Re-define flags locally for reading to avoid massive edits to dat_writer.rs
struct MetadataFlags6;
impl MetadataFlags6 {
    const GROUND: u8 = 0x00;
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
    const UPGRADE_CLASSIFICATION: u8 = 0x27;
    const WEAR_OUT: u8 = 0x28;
    const CLOCK_EXPIRE: u8 = 0x29;
    const EXPIRE: u8 = 0x2A;
    const EXPIRE_STOP: u8 = 0x2B;
    const PODIUM: u8 = 0x2C;
    const DECO_KIT: u8 = 0x2D;
    
    // Special flags
    const DEFAULT_ACTION_FILE: u8 = 35; // In file format for v10.10+
    const USABLE: u8 = 0xFE;
    const LAST_FLAG: u8 = 0xFF;
}

pub struct DatReader {
    reader: BufReader<File>,
    version: u32,
    extended: bool,
    frame_durations: bool,
    frame_groups: bool,
}

impl DatReader {
    pub fn open(path: &str) -> Result<Self, String> {
        let file = File::open(path).map_err(|e| format!("Failed to open DAT file: {}", e))?;
        let reader = BufReader::new(file);
        
        Ok(Self {
            reader,
            version: 0,
            extended: false,
            frame_durations: false,
            frame_groups: false,
        })
    }

    fn read_u8(&mut self) -> io::Result<u8> {
        let mut buf = [0u8; 1];
        self.reader.read_exact(&mut buf)?;
        Ok(buf[0])
    }

    fn read_u16_le(&mut self) -> io::Result<u16> {
        let mut buf = [0u8; 2];
        self.reader.read_exact(&mut buf)?;
        Ok(u16::from_le_bytes(buf))
    }

    fn read_u32_le(&mut self) -> io::Result<u32> {
        let mut buf = [0u8; 4];
        self.reader.read_exact(&mut buf)?;
        Ok(u32::from_le_bytes(buf))
    }

    fn read_i8(&mut self) -> io::Result<i8> {
        let mut buf = [0u8; 1];
        self.reader.read_exact(&mut buf)?;
        Ok(i8::from_le_bytes(buf))
    }

    fn read_i32_le(&mut self) -> io::Result<i32> {
        let mut buf = [0u8; 4];
        self.reader.read_exact(&mut buf)?;
        Ok(i32::from_le_bytes(buf))
    }

    fn read_string(&mut self) -> io::Result<String> {
        let len = self.read_u16_le()?;
        let mut buf = vec![0u8; len as usize];
        self.reader.read_exact(&mut buf)?;
        // Use lossy conversion for Latin-1/ISO-8859-1 approximation
        Ok(String::from_utf8_lossy(&buf).to_string())
    }

    pub fn read_dat(&mut self) -> Result<(u32, Vec<ThingType>, Vec<ThingType>, Vec<ThingType>, Vec<ThingType>), String> {
        // Read signature
        let signature = self.read_u32_le().map_err(|e| format!("Failed to read signature: {}", e))?;
        
        // Determine version based on signature (simplified for 10.98/11.00)
        // 10.98 signature: 0x42A3 (17059)
        // 11.00 signature: Unknown, but we'll assume it's close or user will provide it.
        // For now, we set version to 1098 if signature matches, otherwise we might warn.
        
        if signature == 0x42A3 {
            self.version = 1098;
        } else {
            // Assume 10.98+ for unknown signatures if requested
            self.version = 1098; 
        }

        // Set flags based on version (logic from Object Builder)
        self.extended = self.version >= 960;
        self.frame_durations = self.version >= 1050;
        self.frame_groups = self.version >= 1057;

        let items_count = self.read_u16_le().map_err(|e| format!("Failed to read items count: {}", e))?;
        let outfits_count = self.read_u16_le().map_err(|e| format!("Failed to read outfits count: {}", e))?;
        let effects_count = self.read_u16_le().map_err(|e| format!("Failed to read effects count: {}", e))?;
        let missiles_count = self.read_u16_le().map_err(|e| format!("Failed to read missiles count: {}", e))?;

        let mut items = Vec::with_capacity(items_count as usize);
        let mut outfits = Vec::with_capacity(outfits_count as usize);
        let mut effects = Vec::with_capacity(effects_count as usize);
        let mut missiles = Vec::with_capacity(missiles_count as usize);

        // Read Items (Category 1)
        // IDs start from 100
        for id in 100..=items_count {
            let thing = self.read_thing(id as u32, "item").map_err(|e| format!("Error reading item {}: {}", id, e))?;
            items.push(thing);
        }

        // Read Outfits (Category 2)
        // IDs start from 1
        for id in 1..=outfits_count {
            let thing = self.read_thing(id as u32, "outfit").map_err(|e| format!("Error reading outfit {}: {}", id, e))?;
            outfits.push(thing);
        }

        // Read Effects (Category 3)
        // IDs start from 1
        for id in 1..=effects_count {
            let thing = self.read_thing(id as u32, "effect").map_err(|e| format!("Error reading effect {}: {}", id, e))?;
            effects.push(thing);
        }

        // Read Missiles (Category 4)
        // IDs start from 1
        for id in 1..=missiles_count {
            let thing = self.read_thing(id as u32, "missile").map_err(|e| format!("Error reading missile {}: {}", id, e))?;
            missiles.push(thing);
        }

        Ok((signature, items, outfits, effects, missiles))
    }

    fn read_thing(&mut self, id: u32, category: &str) -> io::Result<ThingType> {
        let mut thing = self.create_empty_thing(id, category);

        // Read properties
        self.read_properties(&mut thing)?;

        // Read texture patterns
        self.read_texture_patterns(&mut thing)?;

        Ok(thing)
    }

    fn create_empty_thing(&self, id: u32, category: &str) -> ThingType {
        ThingType {
            id,
            category: category.to_string(),
            width: 1,
            height: 1,
            exact_size: 32,
            layers: 1,
            pattern_x: 1,
            pattern_y: 1,
            pattern_z: 1,
            frames: 1,
            sprite_index: Vec::new(),
            is_ground: false,
            ground_speed: 0,
            is_ground_border: false,
            is_on_bottom: false,
            is_on_top: false,
            is_container: false,
            stackable: false,
            force_use: false,
            multi_use: false,
            has_charges: false,
            writable: false,
            writable_once: false,
            max_text_length: 0,
            is_fluid_container: false,
            is_fluid: false,
            is_unpassable: false,
            is_unmoveable: false,
            block_missile: false,
            block_pathfind: false,
            no_move_animation: false,
            pickupable: false,
            hangable: false,
            is_vertical: false,
            is_horizontal: false,
            rotatable: false,
            has_light: false,
            light_level: 0,
            light_color: 0,
            dont_hide: false,
            floor_change: false,
            is_translucent: false,
            has_offset: false,
            offset_x: 0,
            offset_y: 0,
            has_elevation: false,
            elevation: 0,
            is_lying_object: false,
            animate_always: false,
            mini_map: false,
            mini_map_color: 0,
            is_lens_help: false,
            lens_help: 0,
            is_full_ground: false,
            ignore_look: false,
            cloth: false,
            cloth_slot: 0,
            is_market_item: false,
            market_name: String::new(),
            market_category: 0,
            market_trade_as: 0,
            market_show_as: 0,
            market_restrict_profession: 0,
            market_restrict_level: 0,
            has_default_action: false,
            default_action: 0,
            usable: false,
            wrappable: false,
            unwrappable: false,
            top_effect: false,
            is_animation: false,
            animation_mode: 0,
            loop_count: 0,
            start_frame: 0,
            frame_durations: Vec::new(),
        }
    }

    fn read_properties(&mut self, thing: &mut ThingType) -> io::Result<()> {
        // We assume v6 (10.98+)
        loop {
            let mut flag = self.read_u8()?;
            let orig_flag = flag; // Keep original for error reporting
            if flag == MetadataFlags6::LAST_FLAG {
                break;
            }

            // Version 10.10-10.56 flag remapping (like OTClient)
            // Version 10.57+ uses frame groups and different format
            if self.version >= 1010 && self.version < 1057 {
                if flag == 16 {
                    flag = MetadataFlags6::NO_MOVE_ANIMATION;
                } else if flag == 254 {
                    flag = MetadataFlags6::USABLE;
                } else if flag == 35 {
                    flag = MetadataFlags6::DEFAULT_ACTION;
                } else if flag > 16 {
                    // All flags > 16 are decremented by 1 in v10.10-10.56
                    flag -= 1;
                }
            }

            match flag {
                MetadataFlags6::GROUND => {
                    thing.is_ground = true;
                    thing.ground_speed = self.read_u16_le()?;
                }
                MetadataFlags6::GROUND_BORDER => thing.is_ground_border = true,
                MetadataFlags6::ON_BOTTOM => thing.is_on_bottom = true,
                MetadataFlags6::ON_TOP => thing.is_on_top = true,
                MetadataFlags6::CONTAINER => thing.is_container = true,
                MetadataFlags6::STACKABLE => thing.stackable = true,
                MetadataFlags6::FORCE_USE => thing.force_use = true,
                MetadataFlags6::MULTI_USE => thing.multi_use = true,
                MetadataFlags6::WRITABLE => {
                    thing.writable = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags6::WRITABLE_ONCE => {
                    thing.writable_once = true;
                    thing.max_text_length = self.read_u16_le()?;
                }
                MetadataFlags6::FLUID_CONTAINER => thing.is_fluid_container = true,
                MetadataFlags6::FLUID => thing.is_fluid = true,
                MetadataFlags6::UNPASSABLE => thing.is_unpassable = true,
                MetadataFlags6::UNMOVEABLE => thing.is_unmoveable = true,
                MetadataFlags6::BLOCK_MISSILE => thing.block_missile = true,
                MetadataFlags6::BLOCK_PATHFIND => thing.block_pathfind = true,
                MetadataFlags6::NO_MOVE_ANIMATION => thing.no_move_animation = true,
                MetadataFlags6::PICKUPABLE => thing.pickupable = true,
                MetadataFlags6::HANGABLE => thing.hangable = true,
                MetadataFlags6::VERTICAL => thing.is_vertical = true,
                MetadataFlags6::HORIZONTAL => thing.is_horizontal = true,
                MetadataFlags6::ROTATABLE => thing.rotatable = true,
                MetadataFlags6::HAS_LIGHT => {
                    thing.has_light = true;
                    thing.light_level = self.read_u16_le()?;
                    thing.light_color = self.read_u16_le()?;
                }
                MetadataFlags6::DONT_HIDE => thing.dont_hide = true,
                MetadataFlags6::TRANSLUCENT => thing.is_translucent = true,
                MetadataFlags6::HAS_OFFSET => {
                    thing.has_offset = true;
                    thing.offset_x = self.read_u16_le()?;
                    thing.offset_y = self.read_u16_le()?;
                }
                MetadataFlags6::HAS_ELEVATION => {
                    thing.has_elevation = true;
                    thing.elevation = self.read_u16_le()?;
                }
                MetadataFlags6::LYING_OBJECT => thing.is_lying_object = true,
                MetadataFlags6::ANIMATE_ALWAYS => thing.animate_always = true,
                MetadataFlags6::MINI_MAP => {
                    thing.mini_map = true;
                    thing.mini_map_color = self.read_u16_le()?;
                }
                MetadataFlags6::LENS_HELP => {
                    thing.is_lens_help = true;
                    thing.lens_help = self.read_u16_le()?;
                }
                MetadataFlags6::FULL_GROUND => thing.is_full_ground = true,
                MetadataFlags6::IGNORE_LOOK => thing.ignore_look = true,
                MetadataFlags6::CLOTH => {
                    thing.cloth = true;
                    thing.cloth_slot = self.read_u16_le()?;
                }
                MetadataFlags6::MARKET_ITEM => {
                    thing.is_market_item = true;
                    thing.market_category = self.read_u16_le()?;
                    thing.market_trade_as = self.read_u16_le()?;
                    thing.market_show_as = self.read_u16_le()?;
                    thing.market_name = self.read_string()?;
                    thing.market_restrict_profession = self.read_u16_le()?;
                    thing.market_restrict_level = self.read_u16_le()?;
                }
                MetadataFlags6::DEFAULT_ACTION => {
                    thing.has_default_action = true;
                    thing.default_action = self.read_u16_le()?;
                }
                MetadataFlags6::WRAPPABLE => thing.wrappable = true,
                MetadataFlags6::UNWRAPPABLE => thing.unwrappable = true,
                MetadataFlags6::TOP_EFFECT => thing.top_effect = true,
                MetadataFlags6::UPGRADE_CLASSIFICATION => {
                    // Read but ignore for now (u16)
                    self.read_u16_le()?;
                }
                MetadataFlags6::WEAR_OUT => {
                    // Boolean flag, not stored in ThingType yet
                }
                MetadataFlags6::CLOCK_EXPIRE => {
                    // Boolean flag, not stored in ThingType yet
                }
                MetadataFlags6::EXPIRE => {
                    // Boolean flag, not stored in ThingType yet
                }
                MetadataFlags6::EXPIRE_STOP => {
                    // Boolean flag, not stored in ThingType yet
                }
                MetadataFlags6::PODIUM => {
                    // Boolean flag, not stored in ThingType yet
                }
                MetadataFlags6::DECO_KIT => {
                    // Boolean flag, not stored in ThingType yet
                }
                MetadataFlags6::USABLE => thing.usable = true,
                _ => {
                    // Unknown flag, but we should probably continue or error
                    return Err(io::Error::new(
                        io::ErrorKind::InvalidData, 
                        format!("Unknown flag: 0x{:02X} (original: 0x{:02X}, version: {})", flag, orig_flag, self.version)
                    ));
                }
            }
        }
        Ok(())
    }

    fn read_texture_patterns(&mut self, thing: &mut ThingType) -> io::Result<()> {
        // For version >= 10.57 (1057) outfits use frame groups
        let group_count = if self.frame_groups && thing.category == "outfit" {
            self.read_u8()?
        } else {
            1
        };

        // Read all frame groups, but only store the first one (DEFAULT/IDLE)
        for group_idx in 0..group_count {
            // Read group type if frame groups enabled
            if self.frame_groups && thing.category == "outfit" {
                let _group_type = self.read_u8()?; // 0=DEFAULT, 1=WALKING, etc.
            }

            // Read texture data
            let width = self.read_u8()?;
            let height = self.read_u8()?;
            let exact_size = if width > 1 || height > 1 {
                self.read_u8()?
            } else {
                32
            };
            let layers = self.read_u8()?;
            let pattern_x = self.read_u8()?;
            let pattern_y = self.read_u8()?;
            let pattern_z = self.read_u8()?;
            let frames = self.read_u8()?;

            // Read animation data if frames > 1
            let (is_animation, animation_mode, loop_count, start_frame, frame_durations) = if frames > 1 && self.frame_durations {
                let mode = self.read_u8()?;
                let loop_cnt = self.read_i32_le()?;
                let start = self.read_i8()?;
                let mut durations = Vec::new();
                for _ in 0..frames {
                    let min = self.read_u32_le()?;
                    let max = self.read_u32_le()?;
                    durations.push(FrameDuration { minimum: min, maximum: max });
                }
                (true, mode, loop_cnt, start, durations)
            } else {
                (frames > 1, 0, 0, 0, Vec::new())
            };

            // Calculate sprite count for this group
            let total_sprites = width as u32 * height as u32 * layers as u32
                * pattern_x as u32 * pattern_y as u32 * pattern_z as u32 * frames as u32;

            if total_sprites > 4096 {
                return Err(io::Error::new(io::ErrorKind::InvalidData,
                    format!("Group {} has {} sprites (exceeds 4096 limit)", group_idx, total_sprites)));
            }

            // Read sprite indices for this group
            let mut sprite_indices = Vec::new();
            for _ in 0..total_sprites {
                let sprite_id = if self.extended {
                    self.read_u32_le()?
                } else {
                    self.read_u16_le()? as u32
                };
                sprite_indices.push(sprite_id);
            }

            // Only store the first group (DEFAULT) to ThingType
            if group_idx == 0 {
                thing.width = width;
                thing.height = height;
                thing.exact_size = exact_size;
                thing.layers = layers;
                thing.pattern_x = pattern_x;
                thing.pattern_y = pattern_y;
                thing.pattern_z = pattern_z;
                thing.frames = frames;
                thing.is_animation = is_animation;
                thing.animation_mode = animation_mode;
                thing.loop_count = loop_count;
                thing.start_frame = start_frame;
                thing.frame_durations = frame_durations;
                thing.sprite_index = sprite_indices;
            }
            // Additional groups are read but discarded
        }

        Ok(())
    }
}
