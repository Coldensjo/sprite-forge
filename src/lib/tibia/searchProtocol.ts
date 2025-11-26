/**
 * Binary Protocol for Search Communication
 * Uses IPC buffer instead of JSON for efficient data transfer
 */

import { ThingCategory } from './types';

/**
 * Property flags mapping (matches FindWindow property order)
 */
export const PROPERTY_FLAGS = [
	'isGround',
	'isGroundBorder',
	'isOnBottom',
	'isOnTop',
	'hasLight',
	'miniMap',
	'hasOffset',
	'hasElevation',
	'cloth', // Equip
	'isMarketItem', // Market
	'writable',
	'writableOnce',
	'hasDefaultAction', // Has Action
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
	'isVertical', // Hook East
	'isHorizontal', // Hook South
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
	'isLensHelp', // Lens Help
	'isAnimation'
] as const;

export type PropertyFlag = (typeof PROPERTY_FLAGS)[number];

/**
 * Search criteria structure
 */
export interface SearchCriteria {
	name: string; // Market name search (case-insensitive partial match)
	category: null | ThingCategory; // null = all categories
	properties: Record<string, boolean>; // Property name -> enabled (true = must have, false = ignored)
}

/**
 * Pack search criteria into binary buffer
 * Format:
 * [Category: u8] (0 = all, 1 = item, 2 = outfit, 3 = effect, 4 = missile)
 * [Name Length: u16] [Name: u8 array]
 * [Property Count: u16]
 * For each property:
 *   [Property Index: u8] [Required: u8] (1 = must have, 0 = ignored)
 * [Result Limit: u32] (max results to return, 0 = unlimited)
 */
export function packSearchCriteria(criteria: SearchCriteria, limit: number = 0): Uint8Array {
	const nameBytes = new TextEncoder().encode(criteria.name);
	const nameLen = Math.min(nameBytes.length, 65535);

	// Count enabled properties
	let enabledCount = 0;
	for (const prop of PROPERTY_FLAGS) {
		if (criteria.properties[prop] !== undefined && criteria.properties[prop] !== false) {
			enabledCount++;
		}
	}

	// Calculate buffer size
	// 1 (category) + 2 (name len) + nameLen + 2 (prop count) + enabledCount * 2 + 4 (limit)
	const bufferSize = 1 + 2 + nameLen + 2 + enabledCount * 2 + 4;
	const buffer = new Uint8Array(bufferSize);
	const view = new DataView(buffer.buffer);

	let offset = 0;

	// Category (0 = all, 1 = item, 2 = outfit, 3 = effect, 4 = missile)
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

	// Name length and name
	view.setUint16(offset, nameLen, true);
	offset += 2;
	buffer.set(nameBytes.slice(0, nameLen), offset);
	offset += nameLen;

	// Property count
	view.setUint16(offset, enabledCount, true);
	offset += 2;

	// Properties
	for (let i = 0; i < PROPERTY_FLAGS.length; i++) {
		const prop = PROPERTY_FLAGS[i];
		if (criteria.properties[prop] === true) {
			buffer[offset] = i; // Property index
			offset += 1;
			buffer[offset] = 1; // Required
			offset += 1;
		}
	}

	// Result limit
	view.setUint32(offset, limit, true);
	offset += 4;

	return buffer;
}

/**
 * Unpack search criteria from binary buffer
 */
export function unpackSearchCriteria(buffer: Uint8Array): SearchCriteria {
	const view = new DataView(buffer.buffer);
	let offset = 0;

	// Category
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

	// Name length and name
	const nameLen = view.getUint16(offset, true);
	offset += 2;
	const nameBytes = buffer.slice(offset, offset + nameLen);
	offset += nameLen;
	const name = new TextDecoder().decode(nameBytes);

	// Property count
	const propCount = view.getUint16(offset, true);
	offset += 2;

	// Properties
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

/**
 * Pack search results into binary buffer
 * Format:
 * [Result Count: u32]
 * For each result:
 *   [ID: u32] [Category: u8] (1 = item, 2 = outfit, 3 = effect, 4 = missile)
 */
export function packSearchResults(results: Array<{ id: number; category: ThingCategory }>): Uint8Array {
	const bufferSize = 4 + results.length * 5; // 4 bytes count + 5 bytes per result (4 id + 1 category)
	const buffer = new Uint8Array(bufferSize);
	const view = new DataView(buffer.buffer);

	let offset = 0;

	// Result count
	view.setUint32(offset, results.length, true);
	offset += 4;

	// Results
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

/**
 * Unpack search results from binary buffer
 */
export function unpackSearchResults(buffer: Uint8Array): Array<{ id: number; category: ThingCategory }> {
	const view = new DataView(buffer.buffer);
	let offset = 0;

	// Result count
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
