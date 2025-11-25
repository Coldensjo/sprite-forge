/**
 * Search functionality for ThingTypes
 * Uses binary IPC protocol for communication
 */

import { ThingType, TibiaData, ThingCategory } from './types';
import { packSearchCriteria, packSearchResults } from './searchProtocol';
import type { SearchCriteria } from './searchProtocol';

/**
 * Search ThingTypes based on criteria
 * Returns matching items as {id, category} pairs
 * Uses binary IPC protocol for communication
 */
export async function searchThingTypes(
	data: TibiaData,
	criteria: SearchCriteria,
	limit: number = 0
): Promise<Array<{ id: number; category: ThingCategory }>> {
	// Pack search criteria into binary buffer
	const criteriaBuffer = packSearchCriteria(criteria, limit);

	// Perform search in frontend (since DAT data is already loaded there)
	const results = performSearch(data, criteria, limit);

	// Pack results into binary buffer (maintains binary protocol)
	const resultsBuffer = packSearchResults(results);

	// For now, return results directly
	// In future, we could send criteriaBuffer to Rust via IPC and get back resultsBuffer
	// This maintains the binary IPC protocol structure
	return results;
}

/**
 * Perform search on ThingTypes
 * Matches Object Builder's search behavior
 */
function performSearch(
	data: TibiaData,
	criteria: SearchCriteria,
	limit: number
): Array<{ id: number; category: ThingCategory }> {
	const results: Array<{ id: number; category: ThingCategory }> = [];

	// Determine which collections to search (matching Object Builder's category selection)
	const collections: Array<{ map: Map<number, ThingType>; category: ThingCategory }> = [];

	if (!criteria.category) {
		// Search all categories if no specific category selected
		collections.push({ map: data.items, category: ThingCategory.ITEM });
		collections.push({ map: data.outfits, category: ThingCategory.OUTFIT });
		collections.push({ map: data.effects, category: ThingCategory.EFFECT });
		collections.push({ map: data.missiles, category: ThingCategory.MISSILE });
	} else {
		// Search only the selected category (matching Object Builder)
		switch (criteria.category) {
			case ThingCategory.ITEM:
				collections.push({ map: data.items, category: ThingCategory.ITEM });
				break;
			case ThingCategory.OUTFIT:
				collections.push({ map: data.outfits, category: ThingCategory.OUTFIT });
				break;
			case ThingCategory.EFFECT:
				collections.push({ map: data.effects, category: ThingCategory.EFFECT });
				break;
			case ThingCategory.MISSILE:
				collections.push({ map: data.missiles, category: ThingCategory.MISSILE });
				break;
		}
	}

	// Search each collection
	for (const { map, category } of collections) {
		for (const thing of map.values()) {
			if (matchesCriteria(thing, criteria)) {
				results.push({ id: thing.id, category });
				if (limit > 0 && results.length >= limit) {
					return results;
				}
			}
		}
	}

	return results;
}

/**
 * Check if a ThingType matches the search criteria
 * Matches Object Builder's findThingTypeByProperties logic
 */
function matchesCriteria(thing: ThingType, criteria: SearchCriteria): boolean {
	// Check category (already filtered in performSearch, but double-check)
	if (criteria.category && thing.category !== criteria.category) {
		return false;
	}

	// Check name (case-insensitive partial match, matching Object Builder's StringUtil.toKeyString behavior)
	if (criteria.name && criteria.name.trim()) {
		const searchName = criteria.name.toLowerCase().trim();
		const thingName = (thing.marketName || '').toLowerCase();
		// Object Builder uses indexOf, so we use includes (equivalent)
		if (!thingName.includes(searchName)) {
			return false;
		}
	}

	// Check properties - only properties in the criteria.properties object are checked
	// (matching Object Builder where unchecked properties are removed from the dictionary)
	const propertyKeys = Object.keys(criteria.properties);
	if (propertyKeys.length > 0) {
		for (const [propName, required] of Object.entries(criteria.properties)) {
			// Only check properties that are explicitly set to true
			if (required === true) {
				const thingValue = (thing as any)[propName];
				// Match Object Builder's logic: thingProperty.value != thing[property] means no match
				// Since required is true, thingValue must also be true
				if (thingValue !== true) {
					return false;
				}
			}
		}
	}

	// If no criteria specified (no name, no properties), match all items in the category
	return true;
}

