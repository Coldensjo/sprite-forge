import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { TibiaData, ThingType, Sprite } from '@/lib/tibia';
import { SpriteReader, ThingCategory } from '@/lib/tibia';
import { logger, EventCode } from '@/lib/debug';

interface TibiaDataContextType {
  data: TibiaData | null;
  spriteReader: SpriteReader | null;
  isLoading: boolean;
  loadingProgress: { stage: string; current: number; total: number } | null;
  error: string | null;
  setData: (data: TibiaData, reader: SpriteReader) => void;
  setLoading: (loading: boolean, progress?: { stage: string; current: number; total: number }) => void;
  setError: (error: string | null) => void;
  clearData: () => void;
  getItem: (id: number) => ThingType | null;
  getOutfit: (id: number) => ThingType | null;
  getEffect: (id: number) => ThingType | null;
  getMissile: (id: number) => ThingType | null;
  getThing: (id: number, category: ThingCategory) => ThingType | null;
  updateThing: (id: number, category: ThingCategory, updates: Partial<ThingType>) => void;
  getSprite: (id: number) => Sprite | null;
  openedItemId: number | null;
  openedItemCategory: ThingCategory | null;
  setOpenedItemId: (id: number | null, category?: ThingCategory) => void;
  openedItems: ThingType[];
  removeOpenedItem: (id: number, category: ThingCategory) => void;
  highlightedItemId: number | null;
  setHighlightedItemId: (id: number | null) => void;
  selectedCategory: ThingCategory;
  setSelectedCategory: (category: ThingCategory) => void;
  setSelectedCategoryAndItem: (category: ThingCategory, itemId: number) => void;
  openedSpriteId: number | null;
  setOpenedSpriteId: (id: number | null) => void;
  spriteLoadVersion: number;
  notifySpritesLoaded: () => void;
  updateCounter: number;
}

const TibiaDataContext = createContext<TibiaDataContextType | undefined>(undefined);

export const TibiaDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setDataState] = useState<TibiaData | null>(null);
  const [spriteReader, setSpriteReader] = useState<SpriteReader | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{ stage: string; current: number; total: number } | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  // Load initial state from localStorage
  const loadOpenedItemsState = (): { items: Array<{ id: number; category: ThingCategory }>, openedId: number | null, openedCategory: ThingCategory | null } => {
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
  const [openedItemId, setOpenedItemIdState] = useState<number | null>(initialState.openedId);
  const [openedItemCategory, setOpenedItemCategoryState] = useState<ThingCategory | null>(initialState.openedCategory);
  const [openedItems, setOpenedItems] = useState<ThingType[]>([]);
  const [highlightedItemId, setHighlightedItemId] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategoryState] = useState<ThingCategory>(ThingCategory.ITEM);
  const settingItemRef = React.useRef(false);
  const hasRestoredRef = React.useRef(false);
  const [openedSpriteId, setOpenedSpriteId] = useState<number | null>(null);
  const [spriteLoadVersion, setSpriteLoadVersion] = useState(0);

  // Save opened items state to localStorage
  const saveOpenedItemsState = useCallback((items: ThingType[], openedId: number | null, openedCategory: ThingCategory | null) => {
    try {
      if (typeof window !== 'undefined') {
        const itemsToSave = items.map(item => ({ id: item.id, category: item.category }));
        localStorage.setItem('sprite-forge-opened-items', JSON.stringify({
          items: itemsToSave,
          openedId,
          openedCategory
        }));
      }
    } catch (e) {
      console.error('Failed to save opened items to localStorage:', e);
    }
  }, []);

  const removeOpenedItem = useCallback((id: number, category: ThingCategory) => {
    setOpenedItems(prev => {
      const newItems = prev.filter(item => !(item.id === id && item.category === category));
      return newItems;
    });
    // If removing the currently opened item, clear it
    if (openedItemId === id && openedItemCategory === category) {
      setOpenedItemIdState(null);
      setOpenedItemCategoryState(null);
    }
  }, [openedItemId, openedItemCategory]);

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
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }

    // Clear all application state when loading new files
    setOpenedItemIdState(null);
    setOpenedItemCategoryState(null);
    setOpenedItems([]);
    setHighlightedItemId(null);

    // Reset restoration flag BEFORE setting new data
    hasRestoredRef.current = false;

    setDataState(newData);
    setSpriteReader(reader);
    setError(null);
  }, []);

  const setLoading = useCallback((loading: boolean, progress?: { stage: string; current: number; total: number }) => {
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
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
  }, []);

  const getItem = useCallback(
    (id: number): ThingType | null => {
      return data?.items.get(id) || null;
    },
    [data]
  );

  const getOutfit = useCallback(
    (id: number): ThingType | null => {
      return data?.outfits.get(id) || null;
    },
    [data]
  );

  const getEffect = useCallback(
    (id: number): ThingType | null => {
      return data?.effects.get(id) || null;
    },
    [data]
  );

  const getMissile = useCallback(
    (id: number): ThingType | null => {
      return data?.missiles.get(id) || null;
    },
    [data]
  );

  const getThing = useCallback(
    (id: number, category: ThingCategory): ThingType | null => {
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

  const setOpenedItemId = useCallback((id: number | null, category?: ThingCategory) => {
    settingItemRef.current = true;
    setOpenedItemIdState(id);
    if (id && data) {
      const itemCategory = category || selectedCategory;
      const thing = getThing(id, itemCategory);
      if (thing) {
        setOpenedItemCategoryState(thing.category);
        setOpenedItems(prev => {
          const exists = prev.some(item => item.id === thing.id && item.category === thing.category);
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
  }, [data, selectedCategory, getThing, saveOpenedItemsState]);

  const setSelectedCategory = useCallback((category: ThingCategory) => {
    setSelectedCategoryState(category);
  }, []);

  const setSelectedCategoryAndItem = useCallback((category: ThingCategory, itemId: number) => {
    // Don't change the listing category - just open the item
    setOpenedItemId(itemId, category);
  }, [setOpenedItemId]);

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

      let collection: Map<number, ThingType> | undefined;
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
        setUpdateCounter(prev => prev + 1);
      }
    },
    [data]
  );

  const notifySpritesLoaded = useCallback(() => {
    setSpriteLoadVersion(v => {
      try {
        logger.log(EventCode.CTX_LOAD_END, { v: v + 1 });
      } catch (e) {
        // Ignore logger errors
      }
      return v + 1;
    });
  }, []);

  const getSprite = useCallback(
    (id: number): Sprite | null => {
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
        logger.log(EventCode.CTX_SPRITE_MISS, { id, sz: data.sprites.size, v: spriteLoadVersion });
      } catch (e) {
        // Ignore logger errors
      }
      return null;
    },
    [data, spriteLoadVersion] // Include version to re-run when sprites load
  );

  return (
    <TibiaDataContext.Provider
      value={{
        data,
        spriteReader,
        isLoading,
        loadingProgress,
        error,
        setData,
        setLoading,
        setError,
        clearData,
        getItem,
        getOutfit,
        getEffect,
        getMissile,
        getThing,
        updateThing,
        getSprite,
        openedItemId,
        openedItemCategory,
        setOpenedItemId,
        openedItems,
        removeOpenedItem,
        highlightedItemId,
        setHighlightedItemId,
        selectedCategory,
        setSelectedCategory,
        setSelectedCategoryAndItem,
        openedSpriteId,
        setOpenedSpriteId,
        spriteLoadVersion,
        notifySpritesLoaded,
        updateCounter,
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
