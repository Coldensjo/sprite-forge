import { cn } from '@/lib/utils';
import { logger, EventCode } from '@/lib/debug';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu';
import { List, Square, Circle, Package, SkipBack, LayoutGrid, ChevronLeft, SkipForward, ChevronRight, Edit, Copy, Plus, Trash2 } from 'lucide-react';
import {
  MIN_ITEM_ID,
  MIN_OUTFIT_ID,
  MIN_EFFECT_ID,
  ThingCategory,
  MIN_MISSILE_ID,
  type ThingType,
  isValidSpriteId,
  createThingType
} from '@/lib/tibia';

import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from './ui/select';

type ViewMode = 'list' | 'grid' | 'large';

export const ItemList = () => {
  const {
    data,
    openedItemId,
    setOpenedItemId,
    selectedCategory,
    highlightedItemId,
    hasUnsavedChanges,
    setSelectedCategory,
    notifySpritesLoaded,
    setHighlightedItemId,
    notifyDataChanged,
    updateCounter,
    removeOpenedItem
  } = useTibiaData();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [inputValue, setInputValue] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const shouldScrollToHighlightedRef = useRef(false);
  const pendingNewItemId = useRef<number | null>(null);
  const itemsPerPage = 100;

  const categoryLabels: Record<ThingCategory, string> = {
    [ThingCategory.ITEM]: 'Item',
    [ThingCategory.OUTFIT]: 'Outfit',
    [ThingCategory.EFFECT]: 'Effect',
    [ThingCategory.MISSILE]: 'Missile'
  };

  const getCategoryMap = useMemo(() => {
    return (category: ThingCategory) => {
      switch (category) {
        case ThingCategory.ITEM:
          return data?.items;
        case ThingCategory.OUTFIT:
          return data?.outfits;
        case ThingCategory.EFFECT:
          return data?.effects;
        case ThingCategory.MISSILE:
          return data?.missiles;
        default:
          return data?.items;
      }
    };
  }, [data]);

  const getThing = useCallback(
    (id: number, category: ThingCategory) => {
      const map = getCategoryMap(category);
      return map?.get(id) || null;
    },
    [getCategoryMap]
  );

  const allItemIds = useMemo(() => {
    if (!data) return [];
    const ids: number[] = [];

    let map: undefined | Map<number, ThingType>;
    let count: number;
    let minId: number;

    switch (selectedCategory) {
      case ThingCategory.ITEM:
        map = data.items;
        count = data.itemsCount;
        minId = MIN_ITEM_ID;
        break;
      case ThingCategory.OUTFIT:
        map = data.outfits;
        count = data.outfitsCount;
        minId = MIN_OUTFIT_ID;
        break;
      case ThingCategory.EFFECT:
        map = data.effects;
        count = data.effectsCount;
        minId = MIN_EFFECT_ID;
        break;
      case ThingCategory.MISSILE:
        map = data.missiles;
        count = data.missilesCount;
        minId = MIN_MISSILE_ID;
        break;
      default:
        map = data.items;
        count = data.itemsCount;
        minId = MIN_ITEM_ID;
    }

    if (map) {
      for (let id = minId; id <= count; id++) {
        if (map.has(id)) {
          ids.push(id);
        }
      }
    }
    return ids;
  }, [data, selectedCategory, updateCounter]);

  const totalPages = Math.ceil(allItemIds.length / itemsPerPage);
  const paginatedItemIds = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return allItemIds.slice(start, end);
  }, [currentPage, allItemIds]);

  useEffect(() => {
    if (data) {
      setCurrentPage(1);
      // Auto-highlight first item (but don't open it)
      const firstItemId = allItemIds[0];
      if (firstItemId !== undefined) {
        setHighlightedItemId(firstItemId);
      } else {
        setHighlightedItemId(null);
      }
      // Keep opened item when category changes - don't clear it
    }
  }, [data, selectedCategory, setOpenedItemId]);

  // Sync input value with highlighted item
  useEffect(() => {
    setInputValue(highlightedItemId ? String(highlightedItemId) : '');
  }, [highlightedItemId]);

  // Handle cross-window selection (from Find Window)
  const [pendingSelection, setPendingSelection] = useState<{ id: number; category: ThingCategory } | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event');
      unlisten = await listen('select_thing', (event: any) => {
        const { id, category } = event.payload;
        // Set pending selection - this will trigger the effect below
        setPendingSelection({ id, category });
        // Switch category if needed
        setSelectedCategory(category);
      });
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [setSelectedCategory]);

  // Process pending selection
  useEffect(() => {
    if (pendingSelection && pendingSelection.category === selectedCategory) {
      // Wait for allItemIds to be populated with the correct category data
      const { id } = pendingSelection;
      const itemIndex = allItemIds.indexOf(id);

      if (itemIndex !== -1) {
        const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
        setCurrentPage(targetPage);
        shouldScrollToHighlightedRef.current = true;
        setHighlightedItemId(id);
        setPendingSelection(null); // Clear pending
      }
    }
  }, [pendingSelection, selectedCategory, allItemIds, itemsPerPage, setHighlightedItemId]);

  // Load sprites for items on current page + prefetch ahead
  useEffect(() => {
    if (!data || !data.sprPath) return;

    let cancelled = false;

    const loadSpritesForCurrentPage = async () => {
      logger.log(EventCode.ITEM_PAGE, { pg: currentPage, cat: selectedCategory, n: paginatedItemIds.length });

      const { loadSpriteIds } = await import('@/lib/tibia');

      if (cancelled) return;

      // OPTIMIZATION: Collect ALL sprite IDs for an item at once (all frames/patterns)
      // With the new read_sprites_list command, this is very fast even for thousands of sprites
      const collectAllSpriteIds = (itemIds: number[]) => {
        const ids: number[] = [];
        for (const id of itemIds) {
          const item = getThing(id, selectedCategory);
          if (item && item.spriteIndex && item.spriteIndex.length > 0) {
            // Add ALL sprites for this item (all frames, patterns, layers)
            for (const spriteId of item.spriteIndex) {
              if (spriteId && isValidSpriteId(spriteId, data.spritesCount)) {
                ids.push(spriteId);
              }
            }
          }
        }
        return ids;
      };

      // OPTIMIZATION: Load multiple pages at once
      // Current page + next 2 pages for smoother navigation
      const PREFETCH_PAGES = 2;
      const pagesToLoad = Math.min(PREFETCH_PAGES + 1, totalPages - currentPage + 1);

      const allSpriteIds: number[] = [];

      for (let i = 0; i < pagesToLoad; i++) {
        const pageNum = currentPage + i;
        if (pageNum > totalPages) break;

        const start = (pageNum - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItemIds = allItemIds.slice(start, end);

        const pageSpriteIds = collectAllSpriteIds(pageItemIds);
        allSpriteIds.push(...pageSpriteIds);
      }

      if (allSpriteIds.length > 0) {
        logger.log(EventCode.ITEM_LOAD_BATCH, { pages: pagesToLoad, n: allSpriteIds.length });

        // OPTIMIZATION: Load all at once, no filtering
        // loadSpriteIds already handles deduplication internally
        await loadSpriteIds(data.sprPath, allSpriteIds, data.transparency, data.sprites);
      }

      if (cancelled) return;
      notifySpritesLoaded();
    };

    loadSpritesForCurrentPage();

    return () => {
      cancelled = true;
    };
  }, [
    currentPage,
    data,
    paginatedItemIds,
    selectedCategory,
    getThing,
    notifySpritesLoaded,
    allItemIds,
    totalPages,
    itemsPerPage
  ]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);

      // Scroll to top
      const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = 0;
      }

      // Auto-highlight first item on the new page (but don't open it)
      const start = (page - 1) * itemsPerPage;
      const firstItemId = allItemIds[start];
      if (firstItemId !== undefined) {
        setHighlightedItemId(firstItemId);
      }
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const itemId = parseInt(inputValue);
      if (!isNaN(itemId) && data) {
        // Check if item exists
        const item = getThing(itemId, selectedCategory);
        if (item) {
          // Find the index of this item in allItemIds
          const itemIndex = allItemIds.indexOf(itemId);
          if (itemIndex !== -1) {
            // Calculate which page this item is on
            const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
            // Navigate to that page
            setCurrentPage(targetPage);
            // Set flag to scroll to highlighted item
            shouldScrollToHighlightedRef.current = true;
            // Highlight the item (not open it)
            setHighlightedItemId(itemId);
          }
        }
      }
    }
  };

  // Handle pending new item highlight after page change
  useEffect(() => {
    if (pendingNewItemId.current !== null && currentPage > 0) {
      // Wait for the page to render the new item
      setTimeout(() => {
        if (pendingNewItemId.current !== null) {
          shouldScrollToHighlightedRef.current = true;
          setHighlightedItemId(pendingNewItemId.current);
          setOpenedItemId(pendingNewItemId.current);
          pendingNewItemId.current = null;
        }
      }, 50);
    }
  }, [currentPage, setHighlightedItemId, setOpenedItemId, updateCounter]);

  // Scroll highlighted item to center when it changes (only if triggered by input)
  useEffect(() => {
    if (shouldScrollToHighlightedRef.current && highlightedItemId) {
      // Wait for DOM to update
      setTimeout(() => {
        const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
          // Find the highlighted item button
          const highlightedButton = viewport.querySelector(`[data-item-id="${highlightedItemId}"]`) as HTMLElement;
          if (highlightedButton) {
            // Calculate scroll position to center the item
            const viewportHeight = viewport.clientHeight;
            const itemTop = highlightedButton.offsetTop;
            const itemHeight = highlightedButton.offsetHeight;
            const scrollTop = itemTop - viewportHeight / 2 + itemHeight / 2;

            viewport.scrollTo({
              behavior: 'instant',
              top: Math.max(0, scrollTop)
            });
          }
        }
        shouldScrollToHighlightedRef.current = false;
      }, 0);
    }
  }, [highlightedItemId, currentPage]);

  // Show empty state if no data loaded
  if (!data) {
    return (
      <div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden">
        <div className="h-8 px-3 flex items-center gap-2 border-b border-border/50 bg-secondary/80">
          <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ThingCategory)}>
            <SelectTrigger className="h-6 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ThingCategory.ITEM}>Item</SelectItem>
              <SelectItem value={ThingCategory.OUTFIT}>Outfit</SelectItem>
              <SelectItem value={ThingCategory.EFFECT}>Effect</SelectItem>
              <SelectItem value={ThingCategory.MISSILE}>Missile</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto text-xs text-muted-foreground font-mono">0</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="text-xs">No files loaded</p>
            <p className="text-[10px] mt-1">Click "Open Files" to load Tibia.dat</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden relative">
      <div className="h-8 px-3 flex items-center gap-2 border-b border-border/50 bg-secondary/80">
        <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ThingCategory)}>
          <SelectTrigger className="h-6 w-24 text-xs mt-[1px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ThingCategory.ITEM}>Item</SelectItem>
            <SelectItem value={ThingCategory.OUTFIT}>Outfit</SelectItem>
            <SelectItem value={ThingCategory.EFFECT}>Effect</SelectItem>
            <SelectItem value={ThingCategory.MISSILE}>Missile</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  disabled={!data}
                  onClick={() => {
                    if (data) {
                      const map = getCategoryMap(selectedCategory);
                      let minId: number;
                      let count: number;

                      switch (selectedCategory) {
                        case ThingCategory.ITEM:
                          minId = MIN_ITEM_ID;
                          count = data.itemsCount;
                          break;
                        case ThingCategory.OUTFIT:
                          minId = MIN_OUTFIT_ID;
                          count = data.outfitsCount;
                          break;
                        case ThingCategory.EFFECT:
                          minId = MIN_EFFECT_ID;
                          count = data.effectsCount;
                          break;
                        case ThingCategory.MISSILE:
                          minId = MIN_MISSILE_ID;
                          count = data.missilesCount;
                          break;
                        default:
                          minId = MIN_ITEM_ID;
                          count = data.itemsCount;
                      }

                      // Find first available ID starting from minId
                      let newId = minId;
                      while (map?.has(newId)) {
                        newId++;
                      }

                      // Create new empty item
                      const newItem = createThingType(newId, selectedCategory);

                      // Add to map
                      map?.set(newId, newItem);

                      // Update count if we exceeded the previous max
                      switch (selectedCategory) {
                        case ThingCategory.ITEM:
                          data.itemsCount = Math.max(data.itemsCount, newId);
                          break;
                        case ThingCategory.OUTFIT:
                          data.outfitsCount = Math.max(data.outfitsCount, newId);
                          break;
                        case ThingCategory.EFFECT:
                          data.effectsCount = Math.max(data.effectsCount, newId);
                          break;
                        case ThingCategory.MISSILE:
                          data.missilesCount = Math.max(data.missilesCount, newId);
                          break;
                      }

                      // Recalculate allItemIds to include the new item
                      // We need to reconstruct the list to find the correct page
                      const updatedCount = Math.max(count, newId);
                      const updatedAllItemIds: number[] = [];
                      if (map) {
                        for (let id = minId; id <= updatedCount; id++) {
                          if (map.has(id)) {
                            updatedAllItemIds.push(id);
                          }
                        }
                      }

                      // Calculate page for the new item
                      const itemIndex = updatedAllItemIds.indexOf(newId);
                      const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;

                      // Set pending item ID to highlight after page change
                      pendingNewItemId.current = newId;
                      setCurrentPage(targetPage);

                      notifyDataChanged();
                    }
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create new item</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-secondary">
                {viewMode === 'list' && <List className="h-3.5 w-3.5 text-muted-foreground" />}
                {viewMode === 'grid' && <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
                {viewMode === 'large' && <Square className="h-3.5 w-3.5 text-muted-foreground" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setViewMode('list')}>
                <List className="mr-2 h-4 w-4" />
                <span>List</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode('grid')}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                <span>Grid (50/50)</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setViewMode('large')}>
                <Square className="mr-2 h-4 w-4" />
                <span>Large</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScrollArea className="flex-1" ref={scrollViewportRef}>
        <TooltipProvider>
          <div
            className={cn(
              'p-2 pb-16',
              viewMode === 'list' && 'space-y-0.5',
              viewMode === 'grid' && 'grid grid-cols-2 gap-1',
              viewMode === 'large' && 'grid grid-cols-1 gap-2'
            )}
          >
            {paginatedItemIds.map((id) => {
              const item = getThing(id, selectedCategory);
              if (!item) return null;

              return (
                <ContextMenu key={id}>
                  <ContextMenuTrigger asChild>
                    <button
                      data-item-id={id}
                      onClick={() => setHighlightedItemId(id)}
                      onDoubleClick={() => {
                        setOpenedItemId(id);
                        setHighlightedItemId(id);
                      }}
                      className={cn(
                        'w-full rounded-md transition-all hover:bg-item-hover',
                        highlightedItemId === id && 'bg-primary/15 ring-1 ring-primary/50',
                        viewMode === 'list' && 'flex items-center gap-2 px-2 py-1',
                        viewMode === 'grid' && 'flex items-center px-1 py-0.5 gap-1.5',
                        viewMode === 'large' && 'flex items-center px-1 py-0.5 gap-1.5'
                      )}
                    >
                      <CheckerBoard
                        className={cn(
                          'rounded-md border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden',
                          viewMode === 'list' && 'w-8 h-8',
                          viewMode === 'grid' && 'w-12 h-12',
                          viewMode === 'large' && 'w-32 h-32'
                        )}
                      >
                        {item.spriteIndex && item.spriteIndex.length > 0 ? (
                          <SpriteCanvas
                            showEmpty
                            thing={item}
                            renderMode="list"
                            width={item.width}
                            height={item.height}
                            scale={
                              viewMode === 'list'
                                ? 36 / (Math.max(item.width, item.height) * 32)
                                : viewMode === 'grid'
                                  ? 48 / (Math.max(item.width, item.height) * 32)
                                  : 128 / (Math.max(item.width, item.height) * 32)
                            }
                          />
                        ) : null}
                      </CheckerBoard>
                      <div
                        className={cn(
                          'min-w-0',
                          viewMode === 'list' && 'flex-1 text-left',
                          viewMode === 'grid' && 'flex-1 text-right',
                          viewMode === 'large' && 'flex-1 text-right'
                        )}
                      >
                        {viewMode === 'grid' || viewMode === 'large' ? (
                          <div className="text-[11px] text-foreground font-mono font-medium leading-tight">{id}</div>
                        ) : (
                          <>
                            <div className="text-[11px] text-foreground font-mono font-medium leading-tight">{id}</div>
                            {((item.isMarketItem && item.marketName) || item.stackable) && (
                              <div className="text-[9px] text-muted-foreground leading-tight truncate">
                                {item.isMarketItem && item.marketName ? item.marketName : ''}
                                {item.isMarketItem && item.marketName && item.stackable ? ' • ' : ''}
                                {item.stackable && !item.marketName ? 'Stackable' : ''}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                      {hasUnsavedChanges(id, selectedCategory) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Circle className="h-2.5 w-2.5 text-primary fill-primary flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Unsaved changes</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem
                      onClick={() => {
                        setOpenedItemId(id);
                        setHighlightedItemId(id);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      <span>Edit</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => {
                        if (data) {
                          const map = getCategoryMap(selectedCategory);
                          let newId = id + 1;
                          while (map?.has(newId)) {
                            newId++;
                          }

                          // Create duplicate
                          const duplicate: ThingType = {
                            ...item,
                            id: newId
                          };

                          // Add to map
                          map?.set(newId, duplicate);

                          // Update count if needed
                          switch (selectedCategory) {
                            case ThingCategory.ITEM:
                              if (newId > data.itemsCount) {
                                data.itemsCount = newId;
                              }
                              break;
                            case ThingCategory.OUTFIT:
                              if (newId > data.outfitsCount) {
                                data.outfitsCount = newId;
                              }
                              break;
                            case ThingCategory.EFFECT:
                              if (newId > data.effectsCount) {
                                data.effectsCount = newId;
                              }
                              break;
                            case ThingCategory.MISSILE:
                              if (newId > data.missilesCount) {
                                data.missilesCount = newId;
                              }
                              break;
                          }

                          // Highlight and open the new item
                          setHighlightedItemId(newId);
                          setOpenedItemId(newId);
                        }
                      }}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      <span>Duplicate</span>
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (data) {
                          const map = getCategoryMap(selectedCategory);
                          if (map?.has(id)) {
                            map.delete(id);

                            // Remove from opened items panel
                            removeOpenedItem(id, selectedCategory);

                            // If this was the opened item, close it
                            if (openedItemId === id) {
                              setOpenedItemId(null);
                            }

                            // Clear highlight
                            setHighlightedItemId(null);

                            // Navigate to first page if current page is empty
                            const remainingIds = allItemIds.filter(itemId => itemId !== id);
                            if (remainingIds.length === 0) {
                              setCurrentPage(1);
                            } else {
                              // Try to highlight the next item, or previous if at end
                              const currentIndex = allItemIds.indexOf(id);
                              const nextId = remainingIds[currentIndex] || remainingIds[currentIndex - 1] || remainingIds[0];
                              if (nextId) {
                                setHighlightedItemId(nextId);
                                const targetPage = Math.floor(remainingIds.indexOf(nextId) / itemsPerPage) + 1;
                                setCurrentPage(targetPage);
                              }
                            }
                          }
                        }
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      <span>Remove</span>
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </TooltipProvider>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-card/95 backdrop-blur-sm border-t border-border/50">
        <div className="flex items-center justify-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => handlePageChange(1)}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
              currentPage === 1 && 'opacity-50 cursor-not-allowed'
            )}
          >
            <SkipBack className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
              currentPage === 1 && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5 text-foreground" />
          </button>
          <Input
            type="text"
            placeholder="-"
            value={inputValue}
            onKeyDown={handleInputKeyDown}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-16 h-7 text-xs font-mono text-center bg-secondary/50 border-0 mx-1 px-1"
          />
          <button
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
              currentPage === totalPages && 'opacity-50 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(totalPages)}
            className={cn(
              'w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors',
              currentPage === totalPages && 'opacity-50 cursor-not-allowed'
            )}
          >
            <SkipForward className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};
