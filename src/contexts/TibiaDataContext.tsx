import type { Sprite, TibiaData, ThingType } from '@/lib/tibia';

import { logger, EventCode } from '@/lib/debug';
import { SpriteReader, ThingCategory } from '@/lib/tibia';
import React, { useState, useEffect, useContext, useCallback, createContext } from 'react';

interface TibiaDataContextType {
	isLoading: boolean;
	error: null | string;
	clearData: () => void;
	updateCounter: number;
	data: null | TibiaData;
	openedItems: ThingType[];
	spriteLoadVersion: number;
	openedItemId: null | number;
	openedSpriteId: null | number;
	selectedCategory: ThingCategory;
	notifySpritesLoaded: () => void;
	highlightedItemId: null | number;
	spriteReader: null | SpriteReader;
	setError: (error: null | string) => void;
	getSprite: (id: number) => null | Sprite;
	openedItemCategory: null | ThingCategory;
	getItem: (id: number) => null | ThingType;
	getOutfit: (id: number) => null | ThingType;
	getEffect: (id: number) => null | ThingType;
	getMissile: (id: number) => null | ThingType;
	setOpenedSpriteId: (id: null | number) => void;
	setHighlightedItemId: (id: null | number) => void;
	setSelectedCategory: (category: ThingCategory) => void;
	setData: (data: TibiaData, reader: SpriteReader) => void;
	removeOpenedItem: (id: number, category: ThingCategory) => void;
	getThing: (id: number, category: ThingCategory) => null | ThingType;
	hasUnsavedChanges: (id: number, category: ThingCategory) => boolean;
	setOpenedItemId: (id: null | number, category?: ThingCategory) => void;
	loadingProgress: null | { stage: string; total: number; current: number };
	setSelectedCategoryAndItem: (category: ThingCategory, itemId: number) => void;
	markUnsavedChanges: (id: number, category: ThingCategory, hasChanges: boolean) => void;
	updateThing: (id: number, category: ThingCategory, updates: Partial<ThingType>) => void;
	setLoading: (loading: boolean, progress?: { stage: string; total: number; current: number }) => void;
}

const TibiaDataContext = createContext<undefined | TibiaDataContextType>(undefined);

export const TibiaDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [data, setDataState] = useState<null | TibiaData>(null);
	const [spriteReader, setSpriteReader] = useState<null | SpriteReader>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [loadingProgress, setLoadingProgress] = useState<null | { stage: string; total: number; current: number }>(null);
	const [error, setError] = useState<null | string>(null);
	// Load initial state from localStorage
	const loadOpenedItemsState = (): {
		openedId: null | number;
		openedCategory: null | ThingCategory;
		items: Array<{ id: number; category: ThingCategory }>;
	} => {
		try {
			if (typeof window !== 'undefined') {
				const saved = localStorage.getItem('sprite-forge-opened-items');
				if (saved) {
					return JSON.parse(saved);
				}
			}
		} catch (e) {
			console.error('Failed to load opened items from localStorage:', e);
		}
		return { items: [], openedId: null, openedCategory: null };
	};

	const initialState = loadOpenedItemsState();
	const [openedItemId, setOpenedItemIdState] = useState<null | number>(initialState.openedId);
	const [openedItemCategory, setOpenedItemCategoryState] = useState<null | ThingCategory>(initialState.openedCategory);
	const [openedItems, setOpenedItems] = useState<ThingType[]>([]);
	const [highlightedItemId, setHighlightedItemId] = useState<null | number>(null);
	const [selectedCategory, setSelectedCategoryState] = useState<ThingCategory>(ThingCategory.ITEM);
	const settingItemRef = React.useRef(false);
	const hasRestoredRef = React.useRef(false);
	const hasPreloadedRef = React.useRef(false);
	const [openedSpriteId, setOpenedSpriteId] = useState<null | number>(null);
	const [spriteLoadVersion, setSpriteLoadVersion] = useState(0);
	const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());

	// Save opened items state to localStorage
	const saveOpenedItemsState = useCallback(
		(items: ThingType[], openedId: null | number, openedCategory: null | ThingCategory) => {
			try {
				if (typeof window !== 'undefined') {
					const itemsToSave = items.map((item) => ({ id: item.id, category: item.category }));
					localStorage.setItem(
						'sprite-forge-opened-items',
						JSON.stringify({
							openedId,
							openedCategory,
							items: itemsToSave
						})
					);
				}
			} catch (e) {
				console.error('Failed to save opened items to localStorage:', e);
			}
		},
		[]
	);

	const removeOpenedItem = useCallback(
		(id: number, category: ThingCategory) => {
			setOpenedItems((prev) => {
				const newItems = prev.filter((item) => !(item.id === id && item.category === category));
				return newItems;
			});
			// If removing the currently opened item, clear it
			if (openedItemId === id && openedItemCategory === category) {
				setOpenedItemIdState(null);
				setOpenedItemCategoryState(null);
			}
		},
		[openedItemId, openedItemCategory]
	);

	const setData = useCallback((newData: TibiaData, reader: SpriteReader) => {
		// Clear localStorage FIRST (before setting new data)
		try {
			if (typeof window !== 'undefined') {
				localStorage.removeItem('sprite-forge-opened-items');
				// Clear all item property states
				const keysToRemove: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key && key.startsWith('sprite-forge-item-state-')) {
						keysToRemove.push(key);
					}
				}
				keysToRemove.forEach((key) => localStorage.removeItem(key));
			}
		} catch (e) {
			console.error('Failed to clear localStorage:', e);
		}

		// Clear all application state when loading new files
		setOpenedItemIdState(null);
		setOpenedItemCategoryState(null);
		setOpenedItems([]);
		setHighlightedItemId(null);
		setUnsavedChanges(new Set());

		// Reset restoration flag BEFORE setting new data
		hasRestoredRef.current = false;
		hasPreloadedRef.current = false;

		setDataState(newData);
		setSpriteReader(reader);
		setError(null);
	}, []);

	const setLoading = useCallback((loading: boolean, progress?: { stage: string; total: number; current: number }) => {
		setIsLoading(loading);
		setLoadingProgress(progress || null);
	}, []);

	const clearData = useCallback(() => {
		setDataState(null);
		setSpriteReader(null);
		setError(null);
		setOpenedItemIdState(null);
		setOpenedItemCategoryState(null);
		setOpenedItems([]);
		setHighlightedItemId(null);
		setSelectedCategory(ThingCategory.ITEM);
		setOpenedSpriteId(null);
		setUnsavedChanges(new Set());
		// Clear localStorage when data is cleared
		try {
			if (typeof window !== 'undefined') {
				localStorage.removeItem('sprite-forge-opened-items');
				// Clear all item property states
				const keysToRemove: string[] = [];
				for (let i = 0; i < localStorage.length; i++) {
					const key = localStorage.key(i);
					if (key && key.startsWith('sprite-forge-item-state-')) {
						keysToRemove.push(key);
					}
				}
				keysToRemove.forEach((key) => localStorage.removeItem(key));
			}
		} catch (e) {
			console.error('Failed to clear localStorage:', e);
		}
	}, []);

	const getItem = useCallback(
		(id: number): null | ThingType => {
			return data?.items.get(id) || null;
		},
		[data]
	);

	const getOutfit = useCallback(
		(id: number): null | ThingType => {
			return data?.outfits.get(id) || null;
		},
		[data]
	);

	const getEffect = useCallback(
		(id: number): null | ThingType => {
			return data?.effects.get(id) || null;
		},
		[data]
	);

	const getMissile = useCallback(
		(id: number): null | ThingType => {
			return data?.missiles.get(id) || null;
		},
		[data]
	);

	const getThing = useCallback(
		(id: number, category: ThingCategory): null | ThingType => {
			switch (category) {
				case 'item':
					return getItem(id);
				case 'outfit':
					return getOutfit(id);
				case 'effect':
					return getEffect(id);
				case 'missile':
					return getMissile(id);
				default:
					return null;
			}
		},
		[getItem, getOutfit, getEffect, getMissile]
	);

	const setOpenedItemId = useCallback(
		(id: null | number, category?: ThingCategory) => {
			settingItemRef.current = true;
			setOpenedItemIdState(id);
			if (id && data) {
				const itemCategory = category || selectedCategory;
				const thing = getThing(id, itemCategory);
				if (thing) {
					setOpenedItemCategoryState(thing.category);
					setOpenedItems((prev) => {
						const exists = prev.some((item) => item.id === thing.id && item.category === thing.category);
						if (!exists) {
							return [...prev, thing];
						}
						return prev;
					});
				}
			} else {
				setOpenedItemCategoryState(null);
			}
			// Reset flag after a short delay to allow useEffect to check it
			setTimeout(() => {
				settingItemRef.current = false;
			}, 0);
		},
		[data, selectedCategory, getThing, saveOpenedItemsState]
	);

	const setSelectedCategory = useCallback((category: ThingCategory) => {
		setSelectedCategoryState(category);
	}, []);

	const setSelectedCategoryAndItem = useCallback(
		(category: ThingCategory, itemId: number) => {
			// Don't change the listing category - just open the item
			setOpenedItemId(itemId, category);
		},
		[setOpenedItemId]
	);

	// Don't clear openedItemId when category changes - keep them independent

	// Save opened items state to localStorage whenever it changes
	useEffect(() => {
		saveOpenedItemsState(openedItems, openedItemId, openedItemCategory);
	}, [openedItems, openedItemId, openedItemCategory, saveOpenedItemsState]);

	// Restore opened items when data is loaded (only once, and only if localStorage wasn't just cleared)
	useEffect(() => {
		// Only restore if we have data, haven't restored yet
		// Check localStorage directly (not initialState) to see if items exist
		if (data && !hasRestoredRef.current) {
			try {
				if (typeof window !== 'undefined') {
					const saved = localStorage.getItem('sprite-forge-opened-items');
					if (saved) {
						const savedState = JSON.parse(saved);
						if (savedState.items && savedState.items.length > 0) {
							hasRestoredRef.current = true;
							const restoredItems: ThingType[] = [];
							for (const { id, category } of savedState.items) {
								const thing = getThing(id, category);
								if (thing) {
									restoredItems.push(thing);
								}
							}
							if (restoredItems.length > 0) {
								setOpenedItems(restoredItems);
							}
							// Restore opened item if it exists
							if (savedState.openedId !== null && savedState.openedCategory) {
								const thing = getThing(savedState.openedId, savedState.openedCategory);
								if (thing) {
									setOpenedItemIdState(savedState.openedId);
									setOpenedItemCategoryState(savedState.openedCategory);
								}
							}
						} else {
							hasRestoredRef.current = true;
						}
					} else {
						hasRestoredRef.current = true;
					}
				}
			} catch (e) {
				console.error('Failed to restore opened items:', e);
				hasRestoredRef.current = true;
			}
		}
	}, [data, getThing]);

	const [updateCounter, setUpdateCounter] = useState(0);

	const updateThing = useCallback(
		(id: number, category: ThingCategory, updates: Partial<ThingType>) => {
			if (!data) return;

			let collection: undefined | Map<number, ThingType>;
			switch (category) {
				case 'item':
					collection = data.items;
					break;
				case 'outfit':
					collection = data.outfits;
					break;
				case 'effect':
					collection = data.effects;
					break;
				case 'missile':
					collection = data.missiles;
					break;
			}

			if (collection && collection.has(id)) {
				const thing = collection.get(id)!;
				Object.assign(thing, updates);
				// Force re-render by incrementing counter
				setUpdateCounter((prev) => prev + 1);
				// Clear unsaved changes when saved
				const key = `${category}-${id}`;
				setUnsavedChanges((prev) => {
					const next = new Set(prev);
					next.delete(key);
					return next;
				});
			}
		},
		[data]
	);

	const hasUnsavedChanges = useCallback(
		(id: number, category: ThingCategory): boolean => {
			const key = `${category}-${id}`;
			return unsavedChanges.has(key);
		},
		[unsavedChanges]
	);

	const markUnsavedChanges = useCallback((id: number, category: ThingCategory, hasChanges: boolean) => {
		const key = `${category}-${id}`;
		setUnsavedChanges((prev) => {
			const next = new Set(prev);
			if (hasChanges) {
				next.add(key);
			} else {
				next.delete(key);
			}
			return next;
		});
	}, []);

	const notifySpritesLoaded = useCallback(() => {
		setSpriteLoadVersion((v) => {
			try {
				logger.log(EventCode.CTX_LOAD_END, { v: v + 1 });
			} catch (e) {
				// Ignore logger errors
			}
			return v + 1;
		});
	}, []);

	const getSprite = useCallback(
		(id: number): null | Sprite => {
			if (!data || !data.sprPath) return null;

			try {
				logger.log(EventCode.CTX_SPRITE_REQ, { id });
			} catch (e) {
				// Ignore logger errors
			}

			// Check cache first - sprites loaded via window-based loading
			if (data.sprites.has(id)) {
				try {
					logger.log(EventCode.CTX_SPRITE_HIT, { id });
				} catch (e) {
					// Ignore logger errors
				}
				return data.sprites.get(id)!;
			}

			// Sprite not in cache - will be loaded when user navigates to that page
			try {
				logger.log(EventCode.CTX_SPRITE_MISS, { id, v: spriteLoadVersion, sz: data.sprites.size });
			} catch (e) {
				// Ignore logger errors
			}
			return null;
		},
		[data, spriteLoadVersion] // Include version to re-run when sprites load
	);

	// Global Preloading Effect
	useEffect(() => {
		if (data && data.sprPath && !hasPreloadedRef.current) {
			hasPreloadedRef.current = true;

			const preload = async () => {
				// Import dependencies dynamically
				const { loadSpriteIds, isValidSpriteId } = await import('@/lib/tibia');

				// Update loading state to show preloading phase
				setLoading(true, { current: 0, total: 100, stage: 'Preparing sprite cache...' });

				// Preload first 5 pages (500 items) of each category
				// This ensures that when the user switches tabs, the content is likely already there
				const PRELOAD_COUNT = 500;
				const allIdsToLoad: number[] = [];

				// Helper to collect IDs from a map
				const collectFromMap = (map: Map<number, ThingType>) => {
					let count = 0;
					// Map iteration order is insertion order, which matches ID order usually
					for (const thing of map.values()) {
						if (count >= PRELOAD_COUNT) break;

						if (thing.spriteIndex) {
							for (const spriteId of thing.spriteIndex) {
								if (isValidSpriteId(spriteId, data.spritesCount)) {
									allIdsToLoad.push(spriteId);
								}
							}
						}
						count++;
					}
				};

				collectFromMap(data.items);
				collectFromMap(data.outfits);
				collectFromMap(data.effects);
				collectFromMap(data.missiles);

				if (allIdsToLoad.length > 0) {
					try {
						setLoading(true, { current: 0, total: allIdsToLoad.length, stage: `Preloading ${allIdsToLoad.length} sprites...` });

						// OPTIMIZATION: Split into chunks to parallelize IPC serialization/deserialization
						// and allow for smoother progress updates.
						const CHUNK_SIZE = 500;
						const chunks: number[][] = [];
						for (let i = 0; i < allIdsToLoad.length; i += CHUNK_SIZE) {
							chunks.push(allIdsToLoad.slice(i, i + CHUNK_SIZE));
						}

						let loadedCount = 0;

						// Process chunks in parallel
						await Promise.all(
							chunks.map(async (chunk) => {
								await loadSpriteIds(data.sprPath!, chunk, data.transparency, data.sprites);
								loadedCount += chunk.length;
								// Update progress (throttled slightly by React state batching)
								setLoading(true, {
									current: loadedCount,
									total: allIdsToLoad.length,
									stage: `Preloading sprites...`
								});
							})
						);

						notifySpritesLoaded();
					} catch (e) {
						console.error('Preload failed', e);
					}
				}

				// Finish loading completely
				setLoading(false);
			};

			// Run preload with a slight delay to let the UI settle first
			setTimeout(preload, 100);
		}
	}, [data, notifySpritesLoaded, setLoading]);

	return (
		<TibiaDataContext.Provider
			value={{
				data,
				error,
				setData,
				getItem,
				setError,
				getThing,
				isLoading,
				clearData,
				getOutfit,
				getEffect,
				getSprite,
				setLoading,
				getMissile,
				updateThing,
				openedItems,
				spriteReader,
				openedItemId,
				updateCounter,
				openedSpriteId,
				loadingProgress,
				setOpenedItemId,
				removeOpenedItem,
				selectedCategory,
				highlightedItemId,
				setOpenedSpriteId,
				spriteLoadVersion,
				hasUnsavedChanges,
				openedItemCategory,
				markUnsavedChanges,
				setSelectedCategory,
				notifySpritesLoaded,
				setHighlightedItemId,
				setSelectedCategoryAndItem
			}}
		>
			{children}
		</TibiaDataContext.Provider>
	);
};

export const useTibiaData = () => {
	const context = useContext(TibiaDataContext);
	if (context === undefined) {
		throw new Error('useTibiaData must be used within a TibiaDataProvider');
	}
	return context;
};
