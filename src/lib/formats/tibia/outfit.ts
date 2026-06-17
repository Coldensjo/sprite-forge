const HSI_H_STEPS = 19;
const HSI_SI_VALUES = 7;

export function getOutfitColor(color: number): [number, number, number] {
	if (isNaN(color) || color < 0) {
		color = 0;
	} else {
		color = Math.floor(color);
		if (color >= HSI_H_STEPS * HSI_SI_VALUES) {
			color = color % (HSI_H_STEPS * HSI_SI_VALUES);
		}
	}

	let loc1 = 0;
	let loc2 = 0;
	let loc3 = 0;

	if (color % HSI_H_STEPS !== 0) {
		loc1 = ((color % HSI_H_STEPS) * 1.0) / 18.0;
		loc2 = 1;
		loc3 = 1;

		const step = Math.floor(color / HSI_H_STEPS);
		switch (step) {
			case 0:
				loc2 = 0.25;
				loc3 = 1.0;
				break;
			case 1:
				loc2 = 0.25;
				loc3 = 0.75;
				break;
			case 2:
				loc2 = 0.5;
				loc3 = 0.75;
				break;
			case 3:
				loc2 = 0.667;
				loc3 = 0.75;
				break;
			case 4:
				loc2 = 1.0;
				loc3 = 1.0;
				break;
			case 5:
				loc2 = 1.0;
				loc3 = 0.75;
				break;
			case 6:
				loc2 = 1.0;
				loc3 = 0.5;
				break;
		}
	} else {
		loc1 = 0;
		loc2 = 0;
		loc3 = 1 - color / HSI_H_STEPS / HSI_SI_VALUES;
	}

	if (loc3 === 0) {
		return [0, 0, 0];
	}

	if (loc2 === 0) {
		const gray = Math.floor(loc3 * 255);
		return [gray, gray, gray];
	}

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

	return [Math.floor(red * 255), Math.floor(green * 255), Math.floor(blue * 255)];
}

export function generateOutfitColorPalette(): string[] {
	const colors: string[] = [];
	for (let i = 0; i < HSI_H_STEPS * HSI_SI_VALUES; i++) {
		const [r, g, b] = getOutfitColor(i);
		colors.push(`rgb(${r}, ${g}, ${b})`);
	}
	return colors;
}

export function blendOutfit(
	basePixels: Uint8Array | Uint8ClampedArray,
	maskPixels: Uint8Array | Uint8ClampedArray,
	colors: { head: number; body: number; legs: number; feet: number }
): Uint8ClampedArray {
	const result = new Uint8ClampedArray(basePixels.length);

	const headColor = getOutfitColor(colors.head);
	const bodyColor = getOutfitColor(colors.body);
	const legsColor = getOutfitColor(colors.legs);
	const feetColor = getOutfitColor(colors.feet);

	for (let i = 0; i < basePixels.length; i += 4) {
		const r = basePixels[i];
		const g = basePixels[i + 1];
		const b = basePixels[i + 2];
		const a = basePixels[i + 3];

		if (a === 0) {
			result[i] = 0;
			result[i + 1] = 0;
			result[i + 2] = 0;
			result[i + 3] = 0;
			continue;
		}

		const mr = maskPixels[i];
		const mg = maskPixels[i + 1];
		const mb = maskPixels[i + 2];
		const ma = maskPixels[i + 3];

		if (ma === 0 || (mr === 0 && mg === 0 && mb === 0)) {
			result[i] = r;
			result[i + 1] = g;
			result[i + 2] = b;
			result[i + 3] = a;
			continue;
		}

		let finalR = r;
		let finalG = g;
		let finalB = b;

		const threshold = 10;

		if (mr > threshold && mg > threshold && mb < threshold) {
			finalR = Math.floor((r / 255) * headColor[0]);
			finalG = Math.floor((g / 255) * headColor[1]);
			finalB = Math.floor((b / 255) * headColor[2]);
		} else if (mr > threshold && mg < threshold && mb < threshold) {
			finalR = Math.floor((r / 255) * bodyColor[0]);
			finalG = Math.floor((g / 255) * bodyColor[1]);
			finalB = Math.floor((b / 255) * bodyColor[2]);
		} else if (mr < threshold && mg > threshold && mb < threshold) {
			finalR = Math.floor((r / 255) * legsColor[0]);
			finalG = Math.floor((g / 255) * legsColor[1]);
			finalB = Math.floor((b / 255) * legsColor[2]);
		} else if (mr < threshold && mg < threshold && mb > threshold) {
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
