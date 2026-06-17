import { ThingCategory } from './types';

export const PROPERTY_FLAGS = [
	'isGround',
	'isGroundBorder',
	'isOnBottom',
	'isOnTop',
	'hasLight',
	'miniMap',
	'hasOffset',
	'hasElevation',
	'cloth',
	'isMarketItem',
	'writable',
	'writableOnce',
	'hasDefaultAction',
	'isContainer',
	'stackable',
	'forceUse',
	'multiUse',
	'isFluidContainer',
	'isFluid',
	'isUnpassable',
	'isUnmoveable',
	'blockMissile',
	'blockPathfind',
	'noMoveAnimation',
	'pickupable',
	'hangable',
	'isVertical',
	'isHorizontal',
	'rotatable',
	'dontHide',
	'isTranslucent',
	'isLyingObject',
	'animateAlways',
	'isFullGround',
	'ignoreLook',
	'wrappable',
	'unwrappable',
	'topEffect',
	'usable',
	'hasCharges',
	'floorChange',
	'isLensHelp',
	'isAnimation'
] as const;

export type PropertyFlag = (typeof PROPERTY_FLAGS)[number];

export interface SearchCriteria {
	name: string;
	category: null | ThingCategory;
	properties: Record<string, boolean>;
}

export function packSearchCriteria(criteria: SearchCriteria, limit: number = 0): Uint8Array {
	const nameBytes = new TextEncoder().encode(criteria.name);
	const nameLen = Math.min(nameBytes.length, 65535);

	let enabledCount = 0;
	for (const prop of PROPERTY_FLAGS) {
		if (criteria.properties[prop] !== undefined && criteria.properties[prop] !== false) {
			enabledCount++;
		}
	}

	const bufferSize = 1 + 2 + nameLen + 2 + enabledCount * 2 + 4;
	const buffer = new Uint8Array(bufferSize);
	const view = new DataView(buffer.buffer);

	let offset = 0;

	const categoryValue = criteria.category
		? criteria.category === 'item'
			? 1
			: criteria.category === 'outfit'
				? 2
				: criteria.category === 'effect'
					? 3
					: 4
		: 0;
	buffer[offset] = categoryValue;
	offset += 1;

	view.setUint16(offset, nameLen, true);
	offset += 2;
	buffer.set(nameBytes.slice(0, nameLen), offset);
	offset += nameLen;

	view.setUint16(offset, enabledCount, true);
	offset += 2;

	for (let i = 0; i < PROPERTY_FLAGS.length; i++) {
		const prop = PROPERTY_FLAGS[i];
		if (criteria.properties[prop] === true) {
			buffer[offset] = i;
			offset += 1;
			buffer[offset] = 1;
			offset += 1;
		}
	}

	view.setUint32(offset, limit, true);
	offset += 4;

	return buffer;
}

export function unpackSearchCriteria(buffer: Uint8Array): SearchCriteria {
	const view = new DataView(buffer.buffer);
	let offset = 0;

	const categoryValue = buffer[offset];
	offset += 1;
	const category: null | ThingCategory =
		categoryValue === 0
			? null
			: categoryValue === 1
				? ThingCategory.ITEM
				: categoryValue === 2
					? ThingCategory.OUTFIT
					: categoryValue === 3
						? ThingCategory.EFFECT
						: ThingCategory.MISSILE;

	const nameLen = view.getUint16(offset, true);
	offset += 2;
	const nameBytes = buffer.slice(offset, offset + nameLen);
	offset += nameLen;
	const name = new TextDecoder().decode(nameBytes);

	const propCount = view.getUint16(offset, true);
	offset += 2;

	const properties: Record<string, boolean> = {};
	for (let i = 0; i < propCount; i++) {
		const propIndex = buffer[offset];
		offset += 1;
		const required = buffer[offset];
		offset += 1;
		if (propIndex < PROPERTY_FLAGS.length) {
			properties[PROPERTY_FLAGS[propIndex]] = required === 1;
		}
	}

	return { name, category, properties };
}

export function packSearchResults(results: Array<{ id: number; category: ThingCategory }>): Uint8Array {
	const bufferSize = 4 + results.length * 5;
	const buffer = new Uint8Array(bufferSize);
	const view = new DataView(buffer.buffer);

	let offset = 0;

	view.setUint32(offset, results.length, true);
	offset += 4;

	for (const result of results) {
		view.setUint32(offset, result.id, true);
		offset += 4;
		const categoryValue =
			result.category === ThingCategory.ITEM
				? 1
				: result.category === ThingCategory.OUTFIT
					? 2
					: result.category === ThingCategory.EFFECT
						? 3
						: 4;
		buffer[offset] = categoryValue;
		offset += 1;
	}

	return buffer;
}

export function unpackSearchResults(buffer: Uint8Array): Array<{ id: number; category: ThingCategory }> {
	const view = new DataView(buffer.buffer);
	let offset = 0;

	const count = view.getUint32(offset, true);
	offset += 4;

	const results: Array<{ id: number; category: ThingCategory }> = [];

	for (let i = 0; i < count; i++) {
		if (offset + 5 > buffer.length) break;

		const id = view.getUint32(offset, true);
		offset += 4;
		const categoryValue = buffer[offset];
		offset += 1;

		const category: ThingCategory =
			categoryValue === 1
				? ThingCategory.ITEM
				: categoryValue === 2
					? ThingCategory.OUTFIT
					: categoryValue === 3
						? ThingCategory.EFFECT
						: ThingCategory.MISSILE;

		results.push({ id, category });
	}

	return results;
}
