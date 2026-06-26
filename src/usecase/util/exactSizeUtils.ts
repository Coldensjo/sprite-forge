import { type Sprite, type ThingType, isValidSpriteId } from '~/lib/formats/tibia';

type ResolveSprite = (id: number) => null | Sprite | undefined;

export function computeExactSize(thing: ThingType, resolveSprite: ResolveSprite, spriteSize: number): number {
	const w = thing.width || 1;
	const h = thing.height || 1;
	const pxW = w * spriteSize;
	const pxH = h * spriteSize;
	const idx = thing.spriteIndex || [];

	let minPx = Infinity;
	let minPy = Infinity;

	for (let i = 0; i < idx.length; i++) {
		const id = idx[i];
		if (!isValidSpriteId(id)) continue;

		const sprite = resolveSprite(id);
		if (!sprite || sprite.isEmpty) continue;

		const tileW = i % w;
		const tileH = Math.floor(i / w) % h;
		const baseX = (w - 1 - tileW) * spriteSize;
		const baseY = (h - 1 - tileH) * spriteSize;

		const data = sprite.rgbaPixels;
		let localMinX = spriteSize;
		let localMinY = spriteSize;

		for (let y = 0; y < spriteSize; y++) {
			for (let x = 0; x < spriteSize; x++) {
				if (data[(y * spriteSize + x) * 4 + 3] !== 0) {
					if (x < localMinX) localMinX = x;
					if (y < localMinY) localMinY = y;
				}
			}
		}

		if (localMinX < spriteSize) {
			if (baseX + localMinX < minPx) minPx = baseX + localMinX;
			if (baseY + localMinY < minPy) minPy = baseY + localMinY;
		}
	}

	if (minPx === Infinity) return thing.exactSize || spriteSize;

	const size = Math.max(pxW - minPx, pxH - minPy);
	return Math.max(1, Math.min(Math.max(pxW, pxH), size));
}
