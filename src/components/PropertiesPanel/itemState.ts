import type { ThingCategory } from '@/lib/tibia';
import type { ItemPropertiesState } from './types';

export const getItemStateKey = (category: ThingCategory, id: number) => {
	return `sprite-forge-item-state-${category}-${id}`;
};

export const loadItemState = (category: ThingCategory, id: number): null | Partial<ItemPropertiesState> => {
	try {
		if (typeof window !== 'undefined') {
			const key = getItemStateKey(category, id);
			const saved = localStorage.getItem(key);
			if (saved) {
				const parsed = JSON.parse(saved);
				if (parsed && typeof parsed === 'object') {
					return parsed;
				}
			}
		}
	} catch (e) {
		console.error(`Failed to load item state for ${category}-${id} from localStorage:`, e);
	}
	return null;
};

export const saveItemState = (category: ThingCategory, id: number, state: ItemPropertiesState) => {
	try {
		if (typeof window !== 'undefined') {
			localStorage.setItem(getItemStateKey(category, id), JSON.stringify(state));
		}
	} catch (e) {
		console.error('Failed to save item state to localStorage:', e);
	}
};
