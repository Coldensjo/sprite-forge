/**
 * Tibia Outfit Color Palette and Blending Logic
 * Based on OTClient implementation (HSI color model)
 * Reference: otclient/src/client/outfit.cpp
 */

// HSI Color Constants
const HSI_H_STEPS = 19;
const HSI_SI_VALUES = 7;

/**
 * Convert Tibia color index to RGB using HSI color model
 * Direct port from OTClient's Outfit::getColor()
 * 
 * @param color - Color index (0-133)
 * @returns RGB color array [r, g, b] (0-255)
 */
export function getOutfitColor(color: number): [number, number, number] {
    // Handle color values: wrap around using modulo for values >= 133
    // Tibia supports color IDs up to 255, but the HSI palette only has 133 colors (0-132)
    // Colors >= 133 wrap around: 133 -> 0, 134 -> 1, ..., 206 -> 73, etc.
    if (isNaN(color) || color < 0) {
        color = 0;
    } else {
        color = Math.floor(color);
        // Wrap around for values >= 133 (like the C++ reference implementation)
        if (color >= HSI_H_STEPS * HSI_SI_VALUES) {
            color = color % (HSI_H_STEPS * HSI_SI_VALUES);
        }
    }

    let loc1 = 0;
    let loc2 = 0;
    let loc3 = 0;

    if (color % HSI_H_STEPS !== 0) {
        loc1 = (color % HSI_H_STEPS) * 1.0 / 18.0;
        loc2 = 1;
        loc3 = 1;

        const step = Math.floor(color / HSI_H_STEPS);
        switch (step) {
            case 0:
                loc2 = 0.25;
                loc3 = 1.00;
                break;
            case 1:
                loc2 = 0.25;
                loc3 = 0.75;
                break;
            case 2:
                loc2 = 0.50;
                loc3 = 0.75;
                break;
            case 3:
                loc2 = 0.667;
                loc3 = 0.75;
                break;
            case 4:
                loc2 = 1.00;
                loc3 = 1.00;
                break;
            case 5:
                loc2 = 1.00;
                loc3 = 0.75;
                break;
            case 6:
                loc2 = 1.00;
                loc3 = 0.50;
                break;
        }
    } else {
        loc1 = 0;
        loc2 = 0;
        loc3 = 1 - color / HSI_H_STEPS / HSI_SI_VALUES;
    }

    // Fully transparent
    if (loc3 === 0) {
        return [0, 0, 0];
    }

    // Grayscale
    if (loc2 === 0) {
        const gray = Math.floor(loc3 * 255);
        return [gray, gray, gray];
    }

    // HSI to RGB conversion
    let red = 0;
    let green = 0;
    let blue = 0;

    if (loc1 < 1.0 / 6.0) {
        red = loc3;
        blue = loc3 * (1 - loc2);
        green = blue + (loc3 - blue) * 6 * loc1;
    } else if (loc1 < 2.0 / 6.0) {
        green = loc3;
        blue = loc3 * (1 - loc2);
        red = green - (loc3 - blue) * (6 * loc1 - 1);
    } else if (loc1 < 3.0 / 6.0) {
        green = loc3;
        red = loc3 * (1 - loc2);
        blue = red + (loc3 - red) * (6 * loc1 - 2);
    } else if (loc1 < 4.0 / 6.0) {
        blue = loc3;
        red = loc3 * (1 - loc2);
        green = blue - (loc3 - red) * (6 * loc1 - 3);
    } else if (loc1 < 5.0 / 6.0) {
        blue = loc3;
        green = loc3 * (1 - loc2);
        red = green + (loc3 - green) * (6 * loc1 - 4);
    } else {
        red = loc3;
        green = loc3 * (1 - loc2);
        blue = red - (loc3 - green) * (6 * loc1 - 5);
    }

    return [
        Math.floor(red * 255),
        Math.floor(green * 255),
        Math.floor(blue * 255)
    ];
}

/**
 * Generate all outfit colors for display
 * Total: 133 colors (19 hue steps * 7 SI values)
 */
export function generateOutfitColorPalette(): string[] {
    const colors: string[] = [];
    for (let i = 0; i < HSI_H_STEPS * HSI_SI_VALUES; i++) {
        const [r, g, b] = getOutfitColor(i);
        colors.push(`rgb(${r}, ${g}, ${b})`);
    }
    return colors;
}

/**
 * Blend outfit layers with color masks
 * Applies color masking to the base sprite based on mask layer
 * 
 * How it works:
 * - Layer 0 (base): The base sprite pixels
 * - Layer 1 (mask): Color mask that defines which body part each pixel belongs to
 *   - Yellow (R>0, G>0, B=0): Head
 *   - Red (R>0, G=0, B=0): Body  
 *   - Green (R=0, G>0, B=0): Legs
 *   - Blue (R=0, G=0, B>0): Feet
 * 
 * @param basePixels - Layer 0 pixels (RGBA format)
 * @param maskPixels - Layer 1 pixels (RGBA format) - The color mask
 * @param colors - Outfit colors (head, body, legs, feet)
 * @returns Blended pixels (RGBA)
 */
export function blendOutfit(
    basePixels: Uint8ClampedArray | Uint8Array,
    maskPixels: Uint8ClampedArray | Uint8Array,
    colors: { head: number; body: number; legs: number; feet: number }
): Uint8ClampedArray {
    const result = new Uint8ClampedArray(basePixels.length);

    // Get RGB values for the selected colors
    const headColor = getOutfitColor(colors.head);
    const bodyColor = getOutfitColor(colors.body);
    const legsColor = getOutfitColor(colors.legs);
    const feetColor = getOutfitColor(colors.feet);

    for (let i = 0; i < basePixels.length; i += 4) {
        const r = basePixels[i];
        const g = basePixels[i + 1];
        const b = basePixels[i + 2];
        const a = basePixels[i + 3];

        // If base is fully transparent, result is transparent
        if (a === 0) {
            result[i] = 0;
            result[i + 1] = 0;
            result[i + 2] = 0;
            result[i + 3] = 0;
            continue;
        }

        // Check mask pixel
        const mr = maskPixels[i];
        const mg = maskPixels[i + 1];
        const mb = maskPixels[i + 2];
        const ma = maskPixels[i + 3];

        // If mask is transparent or black, just use base pixel
        if (ma === 0 || (mr === 0 && mg === 0 && mb === 0)) {
            result[i] = r;
            result[i + 1] = g;
            result[i + 2] = b;
            result[i + 3] = a;
            continue;
        }

        // Apply color masking based on mask color
        // The mask defines WHICH color to apply, and we multiply the base sprite by that color
        let finalR = r;
        let finalG = g;
        let finalB = b;

        // Detect which body part based on mask color
        // Use a threshold to handle slight variations in mask colors
        const threshold = 10;

        if (mr > threshold && mg > threshold && mb < threshold) {
            // Yellow -> Head
            finalR = Math.floor((r / 255) * headColor[0]);
            finalG = Math.floor((g / 255) * headColor[1]);
            finalB = Math.floor((b / 255) * headColor[2]);
        } else if (mr > threshold && mg < threshold && mb < threshold) {
            // Red -> Body
            finalR = Math.floor((r / 255) * bodyColor[0]);
            finalG = Math.floor((g / 255) * bodyColor[1]);
            finalB = Math.floor((b / 255) * bodyColor[2]);
        } else if (mr < threshold && mg > threshold && mb < threshold) {
            // Green -> Legs
            finalR = Math.floor((r / 255) * legsColor[0]);
            finalG = Math.floor((g / 255) * legsColor[1]);
            finalB = Math.floor((b / 255) * legsColor[2]);
        } else if (mr < threshold && mg < threshold && mb > threshold) {
            // Blue -> Feet
            finalR = Math.floor((r / 255) * feetColor[0]);
            finalG = Math.floor((g / 255) * feetColor[1]);
            finalB = Math.floor((b / 255) * feetColor[2]);
        }

        result[i] = finalR;
        result[i + 1] = finalG;
        result[i + 2] = finalB;
        result[i + 3] = a;
    }

    return result;
}
