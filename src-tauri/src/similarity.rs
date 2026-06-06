use crate::spr_manager::decompress_to_rgba;

const SPRITE_SIZE: usize = 32;
const SPRITE_PIXELS: usize = SPRITE_SIZE * SPRITE_SIZE;
const SPRITE_BYTES: usize = SPRITE_PIXELS * 4;

const SIG_SIZE: usize = 16;
const SIG_CELLS: usize = SIG_SIZE * SIG_SIZE;
const SIG_LEN: usize = SIG_CELLS * 4;

/// Cell counts as sprite content (not background) once its averaged alpha clears
/// this. Cells transparent in both signatures are ignored so matching empty
/// background neither rewards nor penalizes.
const ACTIVE_ALPHA: u8 = 24;

/// Radius, in 16x16 cells, the coverage mask is dilated by before shape comparison, so
/// a sparse silhouette (scattered bones) still overlaps the solid body of the same
/// outline instead of scoring low on the holes between its parts.
const SHAPE_DILATE: usize = 1;

/// 16x16 downsample of one 32x32 sprite. `cells` stores the un-premultiplied average
/// color over its opaque source pixels plus a coverage (average alpha). `shape_alpha`
/// is that coverage dilated, used only for the silhouette overlap.
#[derive(Clone)]
pub struct SpriteSignature {
    cells: [u8; SIG_LEN],
    shape_alpha: [u8; SIG_CELLS],
    opaque_pixels: u16,
}

impl SpriteSignature {
    pub fn empty() -> Self {
        Self { cells: [0u8; SIG_LEN], shape_alpha: [0u8; SIG_CELLS], opaque_pixels: 0 }
    }

    pub fn is_empty(&self) -> bool {
        self.opaque_pixels == 0
    }
}

pub fn signature_rgba(rgba: &[u8]) -> SpriteSignature {
    if rgba.len() != SPRITE_BYTES {
        return SpriteSignature::empty();
    }

    let mut cells = [0u8; SIG_LEN];
    let mut opaque_pixels: u32 = 0;

    for cy in 0..SIG_SIZE {
        for cx in 0..SIG_SIZE {
            let mut sr: u32 = 0;
            let mut sg: u32 = 0;
            let mut sb: u32 = 0;
            let mut sa: u32 = 0;
            let mut opaque: u32 = 0;
            for dy in 0..2 {
                for dx in 0..2 {
                    let x = cx * 2 + dx;
                    let y = cy * 2 + dy;
                    let idx = (y * SPRITE_SIZE + x) * 4;
                    let a = rgba[idx + 3] as u32;
                    sa += a;
                    if a >= 128 {
                        opaque += 1;
                        opaque_pixels += 1;
                        sr += rgba[idx] as u32;
                        sg += rgba[idx + 1] as u32;
                        sb += rgba[idx + 2] as u32;
                    }
                }
            }
            let c = (cy * SIG_SIZE + cx) * 4;
            if opaque > 0 {
                cells[c] = (sr / opaque) as u8;
                cells[c + 1] = (sg / opaque) as u8;
                cells[c + 2] = (sb / opaque) as u8;
            }
            cells[c + 3] = (sa / 4) as u8;
        }
    }

    let mut shape_alpha = [0u8; SIG_CELLS];
    for cy in 0..SIG_SIZE {
        for cx in 0..SIG_SIZE {
            let y0 = cy.saturating_sub(SHAPE_DILATE);
            let y1 = (cy + SHAPE_DILATE).min(SIG_SIZE - 1);
            let x0 = cx.saturating_sub(SHAPE_DILATE);
            let x1 = (cx + SHAPE_DILATE).min(SIG_SIZE - 1);
            let mut m = 0u8;
            for ny in y0..=y1 {
                for nx in x0..=x1 {
                    let a = cells[(ny * SIG_SIZE + nx) * 4 + 3];
                    if a > m {
                        m = a;
                    }
                }
            }
            shape_alpha[cy * SIG_SIZE + cx] = m;
        }
    }

    SpriteSignature {
        cells,
        shape_alpha,
        opaque_pixels: opaque_pixels.min(u16::MAX as u32) as u16,
    }
}

pub fn signature_compressed(compressed: &[u8], transparent: bool) -> SpriteSignature {
    if compressed.is_empty() {
        return SpriteSignature::empty();
    }
    let rgba = decompress_to_rgba(compressed, transparent);
    signature_rgba(&rgba)
}

/// Fraction of the combined score carried by shape. Shape dominates so a sprite
/// with a different silhouette (a thin diagonal beam vs a compact corpse blob)
/// scores low regardless of how similar its color is.
const SHAPE_WEIGHT: f32 = 0.7;

/// Shape and color similarity components, each in [0, 100].
///
/// `shape` is a soft IoU over per-cell alpha coverage — how much the two opaque
/// masks overlap, independent of color. `color` is the inverse mean color distance
/// over cells opaque in both signatures. Two brown objects of different form get a
/// low `shape` because their masks barely overlap; identical sprites score 100/100.
pub fn visual_components(a: &SpriteSignature, b: &SpriteSignature) -> (u8, u8) {
    if a.is_empty() || b.is_empty() {
        return (0, 0);
    }

    let mut inter: u32 = 0;
    let mut union: u32 = 0;
    let mut color_dist: u32 = 0;
    let mut overlap: u32 = 0;

    for cell in 0..SIG_CELLS {
        let i = cell * 4;
        let ca = a.shape_alpha[cell] as u32;
        let cb = b.shape_alpha[cell] as u32;
        inter += ca.min(cb);
        union += ca.max(cb);

        if a.cells[i + 3] >= ACTIVE_ALPHA && b.cells[i + 3] >= ACTIVE_ALPHA {
            overlap += 1;
            color_dist += (a.cells[i] as i32 - b.cells[i] as i32).unsigned_abs();
            color_dist += (a.cells[i + 1] as i32 - b.cells[i + 1] as i32).unsigned_abs();
            color_dist += (a.cells[i + 2] as i32 - b.cells[i + 2] as i32).unsigned_abs();
        }
    }

    if union == 0 {
        return (0, 0);
    }
    let shape = (inter as f32 / union as f32 * 100.0).round() as u8;
    let color = if overlap > 0 {
        ((1.0 - color_dist as f32 / (overlap * 3 * 255) as f32) * 100.0).round() as u8
    } else {
        0
    };

    (shape, color)
}

/// Blend the shape and color components into one [0, 100] score.
pub fn combine_visual(shape: u8, color: u8) -> u8 {
    (SHAPE_WEIGHT * shape as f32 + (1.0 - SHAPE_WEIGHT) * color as f32)
        .round()
        .clamp(0.0, 100.0) as u8
}

/// A candidate's shape silhouette overlaps the reference's well enough to be
/// considered the same kind of form (corpse blob vs corpse blob, not vs a beam).
pub const SHAPE_GOOD: u8 = 50;

/// A candidate's color matches the reference's closely over their shared mask.
pub const COLOR_GOOD: u8 = 55;

/// A differing structural flag means the two objects are a different *kind* (a
/// container vs a wall), so a single one buries the candidate below the penalty cap.
const STRUCTURAL: u32 = 100;

/// A differing interaction flag (pickupable, force use, unmovable…) is a minor
/// variation between objects of the same kind; several may differ and still match.
const SOFT: u32 = 1;

/// Cosmetic / rendering flags (light, minimap, offset…) say nothing about kind.
const COSMETIC: u32 = 0;

/// Per-flag weight, in the same bit order as `pack_property_bits`. Differing on a
/// flag adds its weight to the property penalty.
pub const FLAG_WEIGHTS: [u32; FLAG_BITS as usize] = [
    STRUCTURAL, // is_ground
    STRUCTURAL, // is_ground_border
    COSMETIC,   // is_on_bottom
    COSMETIC,   // is_on_top
    COSMETIC,   // has_light
    COSMETIC,   // mini_map
    COSMETIC,   // has_offset
    COSMETIC,   // has_elevation
    STRUCTURAL, // cloth (equipable)
    COSMETIC,   // is_market_item
    STRUCTURAL, // writable
    STRUCTURAL, // writable_once
    SOFT,       // has_default_action
    STRUCTURAL, // is_container
    STRUCTURAL, // stackable
    SOFT,       // force_use
    SOFT,       // multi_use
    STRUCTURAL, // is_fluid_container
    STRUCTURAL, // is_fluid
    STRUCTURAL, // is_unpassable
    SOFT,       // is_unmoveable
    SOFT,       // block_missile
    SOFT,       // block_pathfind
    COSMETIC,   // no_move_animation
    SOFT,       // pickupable
    STRUCTURAL, // hangable
    SOFT,       // is_horizontal
    SOFT,       // is_vertical
    SOFT,       // rotatable
    COSMETIC,   // dont_hide
    COSMETIC,   // is_translucent
    COSMETIC,   // is_lying_object
    COSMETIC,   // animate_always
    STRUCTURAL, // is_full_ground
    COSMETIC,   // ignore_look
    SOFT,       // wrappable
    SOFT,       // unwrappable
    COSMETIC,   // top_effect
    SOFT,       // usable
    SOFT,       // has_charges
    STRUCTURAL, // floor_change
];

/// Largest weighted property penalty still treated as the same kind of object. Below
/// `STRUCTURAL`, so any structural mismatch fails the match while several soft ones pass.
pub const PROPS_PENALTY_MAX: u32 = 8;

/// Number of property flags packed into the bitmap by `pack_property_bits`.
pub const FLAG_BITS: u32 = 41;

/// Weighted property penalty between two packed bitmaps: each differing flag adds its
/// `FLAG_WEIGHTS` entry. 0 means identical flags; one structural mismatch alone exceeds
/// `PROPS_PENALTY_MAX`, so only objects of the same kind stay under it.
pub fn property_penalty(reference: u64, candidate: u64) -> u32 {
    let mut diff = (reference ^ candidate) & ((1u64 << FLAG_BITS) - 1);
    let mut penalty = 0u32;
    while diff != 0 {
        let bit = diff.trailing_zeros() as usize;
        penalty += FLAG_WEIGHTS[bit];
        diff &= diff - 1;
    }
    penalty
}
