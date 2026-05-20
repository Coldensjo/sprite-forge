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
	// Sprite import notification - triggers SpriteList to go to last page
	spriteImportVersion: number;
	openedSpriteId: null | number;
	notifySpriteImport: () => void;
	selectedCategory: ThingCategory;
	notifySpritesLoaded: () => void;
	hasModifiedItems: () => boolean;
	highlightedItemId: null | number;
	spriteReader: null | SpriteReader;
	compileFiles: () => Promise<void>;
	clearModifiedTracking: () => void;
	highlightedSpriteId: null | number;
	modifiedSprites: Map<number, Sprite>;
	setError: (error: null | string) => void;
	getSprite: (id: number) => null | Sprite;
	openedItemCategory: null | ThingCategory;
	getItem: (id: number) => null | ThingType;
	getOutfit: (id: number) => null | ThingType;
	getEffect: (id: number) => null | ThingType;
	getMissile: (id: number) => null | ThingType;
	setOpenedSpriteId: (id: null | number) => void;
	notifyDataChanged: (spriteIds?: number[]) => void;
	setHighlightedItemId: (id: null | number) => void;
	setHighlightedSpriteId: (id: null | number) => void;
	setSelectedCategory: (category: ThingCategory) => void;
	removeOpenedItem: (id: number, category: ThingCategory) => void;
	getThing: (id: number, category: ThingCategory) => null | ThingType;
	hasUnsavedChanges: (id: number, category: ThingCategory) => boolean;
	setOpenedItemId: (id: null | number, category?: ThingCategory) => void;
	loadingProgress: null | { stage: string; total: number; current: number };
	setSelectedCategoryAndItem: (category: ThingCategory, itemId: number) => void;
	setData: (data: TibiaData, reader: SpriteReader, skipBackendSync?: boolean) => void;
	markUnsavedChanges: (id: number, category: ThingCategory, hasChanges: boolean) => void;
	updateThing: (id: number, category: ThingCategory, updates: Partial<ThingType>) => void;
	// Compile tracking
	modifiedSinceCompile: Map<string, { id: number; data: ThingType; category: ThingCategory }>;
	setLoading: (loading: boolean, progress?: { stage: string; total: number; current: number }) => void;
}

const TibiaDataContext = createContext<undefined | TibiaDataContextType>(undefined);

export const TibiaDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [data, setDataState] = useState<null | TibiaData>(null);
	const [spriteReader, setSpriteReader] = useState<null | SpriteReader>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [loadingProgress, setLoadingProgress] = useState<null | { stage: string; total: number; current: number }>(null);
	const [error, setError] = useState<null | string>(null);
	// Counter to force re-renders when data is mutated in place
	const [updateCounter, setUpdateCounter] = useState(0);
	// Counter to notify SpriteList about new sprite imports (go to last page)
	const [spriteImportVersion, setSpriteImportVersion] = useState(0);
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
	const [highlightedSpriteId, setHighlightedSpriteId] = useState<null | number>(null);
	const [spriteLoadVersion, setSpriteLoadVersion] = useState(0);
	const [unsavedChanges, setUnsavedChanges] = useState<Set<string>>(new Set());
	// Compile tracking
	const [modifiedSinceCompile, setModifiedSinceCompile] = useState<
		Map<string, { id: number; data: ThingType; category: ThingCategory }>
	>(new Map());
	const [modifiedSprites, setModifiedSprites] = useState<Map<number, Sprite>>(new Map());

	// Save opened items state to localStorage whenever it changes
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

			// Clear unsaved changes flag since the draft is lost
			const key = `${category}-${id}`;
			setUnsavedChanges((prev) => {
				const next = new Set(prev);
				next.delete(key);
				return next;
			});
		},
		[openedItemId, openedItemCategory]
	);

	const setData = useCallback(
		async (newData: TibiaData, reader: SpriteReader, skipBackendSync = false) => {
			if (data?.sprPath && data.sprPath !== newData.sprPath) {
				try {
					const { invoke } = await import('@tauri-apps/api/core');
					await invoke('close_spr_file', { path: data.sprPath });
					console.log('Closed previous SPR file:', data.sprPath);
				} catch (e) {
					console.warn('Failed to close previous SPR file:', e);
				}
			}
			if (data?.datPath && data.datPath !== newData.datPath) {
				try {
					const { invoke } = await import('@tauri-apps/api/core');
					await invoke('clear_dat_data', { path: data.datPath });
					console.log('Cleared previous DAT data:', data.datPath);
				} catch (e) {
					console.warn('Failed to clear previous DAT data:', e);
				}
			}

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
			setSelectedCategoryState(ThingCategory.ITEM);

			// Reset restoration flag BEFORE setting new data
			hasRestoredRef.current = false;
			hasPreloadedRef.current = false;

			setDataState(newData);
			setSpriteReader(reader);
			setError(null);

			// Store paths in localStorage for Find window to access
			// NOTE: DAT data is already stored in Rust backend by parse_dat_file_bin command
			// No need to call store_dat_data again - that would be redundant and slow
			if (newData.datPath && !skipBackendSync) {
				try {
					if (typeof window !== 'undefined') {
						localStorage.setItem('sprite-forge-dat-path', newData.datPath);
						if (newData.sprPath) {
							localStorage.setItem('sprite-forge-spr-path', newData.sprPath);
						}
						localStorage.setItem('sprite-forge-transparency', String(newData.transparency));
						localStorage.setItem('sprite-forge-sprites-count', String(newData.spritesCount));
					}
					console.log('DAT paths stored in localStorage for cross-window access');
				} catch (e) {
					console.error('Failed to store paths in localStorage:', e);
					// Non-fatal - continue execution
				}
			}
		},
		[data]
	);

	const setLoading = useCallback((loading: boolean, progress?: { stage: string; total: number; current: number }) => {
		setIsLoading(loading);
		setLoadingProgress(progress || null);
	}, []);

	const clearData = useCallback(async () => {
		const currentDatPath = data?.datPath;

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
				localStorage.removeItem('sprite-forge-dat-path');
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

		// Clear DAT data in Rust backend
		if (currentDatPath) {
			try {
				const { invoke } = await import('@tauri-apps/api/core');
				const { emit } = await import('@tauri-apps/api/event');

				await invoke('clear_dat_data', { path: currentDatPath });
				await emit('data_cleared');
				console.log('DAT data cleared from Rust backend and event emitted');
			} catch (e) {
				console.error('Failed to clear DAT data from Rust backend:', e);
				// Non-fatal
			}
		}
	}, [data]);

	const getItem = useCallback(
		(id: number): null | ThingType => {
			return data?.items.get(id) || null;
		},

		[data, updateCounter]
	);

	const getOutfit = useCallback(
		(id: number): null | ThingType => {
			return data?.outfits.get(id) || null;
		},

		[data, updateCounter]
	);

	const getEffect = useCallback(
		(id: number): null | ThingType => {
			return data?.effects.get(id) || null;
		},

		[data, updateCounter]
	);

	const getMissile = useCallback(
		(id: number): null | ThingType => {
			return data?.missiles.get(id) || null;
		},

		[data, updateCounter]
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

				// Track as modified since last compile
				const key = `${category}-${id}`;
				setModifiedSinceCompile((prev) => {
					const next = new Map(prev);
					next.set(key, {
						id,
						category,
						data: { ...thing } // Deep clone
					});
					return next;
				});

				// Force re-render by incrementing counter
				setUpdateCounter((prev) => prev + 1);
				// Clear unsaved changes when saved
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
			} catch {
				// Ignore logger errors
			}
			return v + 1;
		});
	}, []);

	const notifySpriteImport = useCallback(() => {
		setSpriteImportVersion((v) => v + 1);
	}, []);

	const notifyDataChanged = useCallback(
		(spriteIds?: number[]) => {
			setUpdateCounter((c) => c + 1);

			// If sprite IDs are provided, track them as modified
			if (spriteIds && spriteIds.length > 0 && data) {
				setModifiedSprites((prev) => {
					const next = new Map(prev);
					for (const spriteId of spriteIds) {
						const sprite = data.sprites.get(spriteId);
						if (sprite) {
							next.set(spriteId, sprite);
						} else {
							// Sprite was deleted (removed from map)
							// We need to track it so compiler knows to update it (e.g. mark as empty or handle count reduction)
							next.set(spriteId, {
								id: spriteId,
								isEmpty: true,
								transparent: data.transparency,
								rgbaPixels: new Uint8Array(4096), // Empty RGBA
								compressedPixels: new Uint8Array(0)
							} as Sprite);
						}
					}
					return next;
				});
			}

			// Also mark items as changed for compilation tracking (for button enabling)
			setModifiedSinceCompile((prev) => {
				const next = new Map(prev);
				// Add a sentinel value to indicate sprite changes
				next.set('sprite-changed', {
					id: 0,
					data: {} as ThingType,
					category: 'item' as ThingCategory
				});
				return next;
			});
		},
		[data]
	);

	const getSprite = useCallback(
		(id: number): null | Sprite => {
			if (!data || !data.sprPath) return null;

			try {
				logger.log(EventCode.CTX_SPRITE_REQ, { id });
			} catch {
				// Ignore logger errors
			}

			// Check cache first - sprites loaded via window-based loading
			if (data.sprites.has(id)) {
				try {
					logger.log(EventCode.CTX_SPRITE_HIT, { id });
				} catch {
					// Ignore logger errors
				}
				return data.sprites.get(id)!;
			}

			// Sprite not in cache - will be loaded when user navigates to that page
			try {
				logger.log(EventCode.CTX_SPRITE_MISS, { id, v: spriteLoadVersion, sz: data.sprites.size });
			} catch {
				// Ignore logger errors
			}
			return null;
		},
		[data, spriteLoadVersion] // Include version to re-run when sprites load
	);

	// Compile tracking methods
	const hasModifiedItems = useCallback(() => {
		return modifiedSinceCompile.size > 0;
	}, [modifiedSinceCompile]);

	const clearModifiedTracking = useCallback(() => {
		setModifiedSinceCompile(new Map());
		setModifiedSprites(new Map());
	}, []);

	const compileFiles = useCallback(async () => {
		if (!data || !data.datPath || !data.sprPath) {
			throw new Error('No data or file paths available for compilation');
		}

		if (modifiedSinceCompile.size === 0) {
			console.log('No modifications to compile');
			return;
		}

		// Import compiler dynamically
		const { compileFiles: doCompile } = await import('@/lib/tibia/compiler');

		// Execute compile
		await doCompile(data, data.datPath, data.sprPath, modifiedSinceCompile, modifiedSprites, (stage, current, total) => {
			setLoading(true, { stage, total, current });
		});

		// Clear modified tracking after successful compile
		clearModifiedTracking();

		// Done
		setLoading(false);
	}, [data, modifiedSinceCompile, clearModifiedTracking]);

	// NOTE: Global sprite preloading has been REMOVED
	// Preloading now happens directly in loadTibiaData() in loader.ts
	// This eliminates the redundant second preload phase that was causing 1-2s extra delay
	// Sprites are loaded on-demand as user navigates (Object Builder pattern)

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
				compileFiles,
				updateCounter,
				openedSpriteId,
				loadingProgress,
				setOpenedItemId,
				modifiedSprites,
				removeOpenedItem,
				selectedCategory,
				hasModifiedItems,
				highlightedItemId,
				setOpenedSpriteId,
				spriteLoadVersion,
				hasUnsavedChanges,
				notifyDataChanged,
				openedItemCategory,
				markUnsavedChanges,
				notifySpriteImport,
				setSelectedCategory,
				notifySpritesLoaded,
				highlightedSpriteId,
				// Sprite import notification
				spriteImportVersion,
				setHighlightedItemId,
				// Compile tracking
				modifiedSinceCompile,
				clearModifiedTracking,
				setHighlightedSpriteId,
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
