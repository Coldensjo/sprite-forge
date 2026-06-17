use crate::spr_manager::decompress_to_rgba;

const SPRITE_SIZE: usize = 32;
const SPRITE_PIXELS: usize = SPRITE_SIZE * SPRITE_SIZE;
const SPRITE_BYTES: usize = SPRITE_PIXELS * 4;

const SIG_SIZE: usize = 16;
const SIG_CELLS: usize = SIG_SIZE * SIG_SIZE;
const SIG_LEN: usize = SIG_CELLS * 4;

const ACTIVE_ALPHA: u8 = 24;

const SHAPE_DILATE: usize = 1;

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

const SHAPE_WEIGHT: f32 = 0.7;

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

pub fn combine_visual(shape: u8, color: u8) -> u8 {
    (SHAPE_WEIGHT * shape as f32 + (1.0 - SHAPE_WEIGHT) * color as f32)
        .round()
        .clamp(0.0, 100.0) as u8
}

pub const SHAPE_GOOD: u8 = 50;

pub const COLOR_GOOD: u8 = 55;

const STRUCTURAL: u32 = 100;

const SOFT: u32 = 1;

const COSMETIC: u32 = 0;

pub const FLAG_WEIGHTS: [u32; FLAG_BITS as usize] = [
    STRUCTURAL,
    STRUCTURAL,
    COSMETIC,
    COSMETIC,
    COSMETIC,
    COSMETIC,
    COSMETIC,
    COSMETIC,
    STRUCTURAL,
    COSMETIC,
    STRUCTURAL,
    STRUCTURAL,
    SOFT,
    STRUCTURAL,
    STRUCTURAL,
    SOFT,
    SOFT,
    STRUCTURAL,
    STRUCTURAL,
    STRUCTURAL,
    SOFT,
    SOFT,
    SOFT,
    COSMETIC,
    SOFT,
    STRUCTURAL,
    SOFT,
    SOFT,
    SOFT,
    COSMETIC,
    COSMETIC,
    COSMETIC,
    COSMETIC,
    STRUCTURAL,
    COSMETIC,
    SOFT,
    SOFT,
    COSMETIC,
    SOFT,
    SOFT,
    STRUCTURAL,
];

pub const PROPS_PENALTY_MAX: u32 = 8;

pub const FLAG_BITS: u32 = 41;

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
