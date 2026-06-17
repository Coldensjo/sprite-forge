import { ThingCategory, type ThingType, getSpriteIndex, isValidSpriteId } from '@/lib/formats/tibia';

export const getThumbnailSpriteIds = (thing: ThingType): number[] => {
	const ids: number[] = [];
	if (!thing.spriteIndex || thing.spriteIndex.length === 0) return ids;
	const defaultPatternX = thing.category === ThingCategory.OUTFIT && thing.patternX > 2 ? 2 : 0;
	for (let h = 0; h < thing.height; h++) {
		for (let w = 0; w < thing.width; w++) {
			const index = getSpriteIndex(thing, w, h, 0, defaultPatternX, 0, 0, 0);
			if (index < thing.spriteIndex.length) {
				const spriteId = thing.spriteIndex[index];
				if (spriteId && isValidSpriteId(spriteId)) ids.push(spriteId);
			}
		}
	}
	return ids;
};
