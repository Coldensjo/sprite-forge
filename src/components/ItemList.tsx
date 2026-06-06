import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { logger, EventCode } from '@/lib/debug';
import { useToast } from '@/usecase/hooks/use-toast';
import { useTibiaData } from '@/usecase/context/TibiaDataContext';
import { exportObjectSheet, importObjectSheet } from '@/lib/tibia';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useGeneralSettings } from '@/usecase/context/GeneralSettingsContext';
import { ContextMenu, ContextMenuItem, ContextMenuContent, ContextMenuTrigger } from '@/components/ui/context-menu';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
	MIN_ITEM_ID,
	MIN_OUTFIT_ID,
	MIN_EFFECT_ID,
	ThingCategory,
	MIN_MISSILE_ID,
	type ThingType,
	getSpriteIndex,
	isValidSpriteId,
	createThingType
} from '@/lib/tibia';
import {
	List,
	Edit,
	Copy,
	Plus,
	Square,
	Circle,
	Trash2,
	Upload,
	Grid3x3,
	Package,
	Sparkles,
	SkipBack,
	Download,
	Clipboard,
	LayoutGrid,
	ChevronLeft,
	SkipForward,
	ChevronRight,
	ClipboardPaste,
	LayoutDashboard
} from 'lucide-react';

import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from './ui/select';

type ViewMode = 'grid' | 'list' | 'large' | 'grid-3' | 'grid-4';

const VIEW_MODES: ViewMode[] = ['list', 'grid', 'grid-3', 'grid-4', 'large'];

function getThumbnailSpriteIds(thing: ThingType): number[] {
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
}

export const ItemList = () => {
	const {
		data,
		isNewItem,
		updateThing,
		openedItemId,
		updateCounter,
		markAsNewItem,
		setOpenedItemId,
		selectedCategory,
		removeOpenedItem,
		highlightedItemId,
		hasUnsavedChanges,
		notifyDataChanged,
		markUnsavedChanges,
		setSelectedCategory,
		notifySpritesLoaded,
		setHighlightedItemId
	} = useTibiaData();
	const { toast } = useToast();
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [copiedProperties, setCopiedProperties] = useState<null | Partial<ThingType>>(null);
	const [inputValue, setInputValue] = useState<string>('');
	const [viewMode, setViewModeState] = useState<ViewMode>('list');

	useEffect(() => {
		invoke<null | string>('get_item_list_view_mode')
			.then((mode) => {
				if (mode && VIEW_MODES.includes(mode as ViewMode)) {
					setViewModeState(mode as ViewMode);
				}
			})
			.catch(() => {});
	}, []);

	const setViewMode = useCallback((mode: ViewMode) => {
		setViewModeState(mode);
		invoke('set_item_list_view_mode', { mode }).catch(() => {});
	}, []);
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const shouldScrollToHighlightedRef = useRef(false);
	const pendingNewItemId = useRef<null | number>(null);
	const prevCategoryRef = useRef<null | ThingCategory>(null);
	const prevDataRef = useRef<null | typeof data>(null);
	const { settings: generalSettings } = useGeneralSettings();
	const itemsPerPage = generalSettings.listAmountObjects;

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
			const maxId = minId + count - 1;
			for (let id = minId; id <= maxId; id++) {
				if (map.has(id)) {
					ids.push(id);
				}
			}
		}
		return ids;
	}, [data, selectedCategory, updateCounter]);

	const totalPages = Math.max(1, Math.ceil(allItemIds.length / itemsPerPage));
	const paginatedItemIds = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return allItemIds.slice(start, end);
	}, [currentPage, allItemIds, itemsPerPage]);

	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	useEffect(() => {
		if (data) {
			const categoryChanged = prevCategoryRef.current !== selectedCategory;
			const dataChanged = prevDataRef.current !== data;
			if (categoryChanged || dataChanged) {
				prevCategoryRef.current = selectedCategory;
				prevDataRef.current = data;
				setCurrentPage(1);
				const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
				if (viewport) viewport.scrollTo({ top: 0, behavior: 'instant' });
				// Auto-highlight first item (but don't open it)
				const firstItemId = allItemIds[0];
				if (firstItemId !== undefined) {
					setHighlightedItemId(firstItemId);
				} else {
					setHighlightedItemId(null);
				}
				// Keep opened item when category changes - don't clear it
			}
		}
	}, [data, selectedCategory, setHighlightedItemId, allItemIds]);

	// Sync input value with highlighted item
	useEffect(() => {
		setInputValue(highlightedItemId ? String(highlightedItemId) : '');
	}, [highlightedItemId]);

	// Handle cross-window selection (from Find Window)
	const [pendingSelection, setPendingSelection] = useState<null | { id: number; category: ThingCategory }>(null);

	useEffect(() => {
		let unlisten: undefined | (() => void);

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

	useEffect(() => {
		if (!data || !data.sprPath) return;

		let cancelled = false;

		const loadSpritesProgressively = async () => {
			logger.log(EventCode.ITEM_PAGE, { pg: currentPage, cat: selectedCategory, n: paginatedItemIds.length });

			const { loadSpriteIds, loadSpriteIdsLz4 } = await import('@/lib/tibia');
			if (cancelled) return;

			const thumbIds: number[] = [];
			const seenThumb = new Set<number>();
			for (const id of paginatedItemIds) {
				const item = getThing(id, selectedCategory);
				if (!item) continue;
				for (const spriteId of getThumbnailSpriteIds(item)) {
					if (!seenThumb.has(spriteId)) {
						seenThumb.add(spriteId);
						thumbIds.push(spriteId);
					}
				}
			}

			if (thumbIds.length > 0 && !cancelled) {
				if (thumbIds.length > 100) {
					await loadSpriteIdsLz4(data.sprPath, thumbIds, data.transparency, data.sprites);
				} else {
					await loadSpriteIds(data.sprPath, thumbIds, data.transparency, data.sprites);
				}
				if (!cancelled) notifySpritesLoaded();
			}

			if (cancelled || totalPages <= currentPage) return;

			const PREFETCH_PAGES = 3;
			const pagesToPrefetch = Math.min(PREFETCH_PAGES, totalPages - currentPage);
			const prefetchIds: number[] = [];
			const seenPrefetch = new Set<number>();

			for (let i = 1; i <= pagesToPrefetch; i++) {
				const pageNum = currentPage + i;
				const start = (pageNum - 1) * itemsPerPage;
				const end = start + itemsPerPage;
				for (const id of allItemIds.slice(start, end)) {
					const item = getThing(id, selectedCategory);
					if (!item) continue;
					for (const spriteId of getThumbnailSpriteIds(item)) {
						if (!seenPrefetch.has(spriteId) && !data.sprites.has(spriteId)) {
							seenPrefetch.add(spriteId);
							prefetchIds.push(spriteId);
						}
					}
				}
			}

			// Prefetch is best-effort; failures are non-fatal.
			if (prefetchIds.length > 0 && !cancelled) {
				try {
					if (prefetchIds.length > 100) {
						await loadSpriteIdsLz4(data.sprPath, prefetchIds, data.transparency, data.sprites);
					} else {
						await loadSpriteIds(data.sprPath, prefetchIds, data.transparency, data.sprites);
					}
				} catch {
					/* noop */
				}
			}
		};

		loadSpritesProgressively();

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
		itemsPerPage,
		updateCounter // Force reload when data changes (e.g. after optimization)
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

	const handleFindSimilar = useCallback(
		async (seeds: Array<{ id: number; category: ThingCategory }>) => {
			if (seeds.length === 0) return;
			const refs = seeds.filter(({ id, category }) => {
				const thing = getThing(id, category);
				return !!thing && (thing.spriteIndex || []).some((sid) => isValidSpriteId(sid));
			});

			if (refs.length === 0) {
				toast({ description: 'No valid sprites to compare against' });
				return;
			}

			try {
				const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
				const { emit } = await import('@tauri-apps/api/event');
				localStorage.setItem('sprite-forge-pending-find-similar', JSON.stringify({ refs, ts: Date.now() }));
				const existing = await WebviewWindow.getByLabel('find');
				if (existing) {
					await existing.show();
					await existing.setFocus();
				} else {
					const win = new WebviewWindow('find', {
						width: 900,
						height: 600,
						center: true,
						minWidth: 700,
						shadow: false,
						minHeight: 500,
						resizable: true,
						url: 'find.html',
						transparent: true,
						decorations: false,
						title: 'Find - Sprite Forge',
						backgroundColor: [0, 0, 0, 0]
					});
					await new Promise<void>((resolve) => {
						win.once('tauri://created', () => resolve());
						win.once('tauri://error', () => resolve());
					});
					await new Promise((r) => setTimeout(r, 300));
				}
				await emit('find_similar', { refs });
			} catch (err) {
				console.error('Failed to open find window:', err);
				toast({ title: 'Error', variant: 'destructive', description: 'Failed to open Find window' });
			}
		},
		[getThing, toast]
	);

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
	}, [currentPage, setHighlightedItemId, setOpenedItemId]);

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
									disabled={!data}
									className="h-6 w-6"
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

											const newCount = map?.size ?? count;
											switch (selectedCategory) {
												case ThingCategory.ITEM:
													data.itemsCount = newCount;
													break;
												case ThingCategory.OUTFIT:
													data.outfitsCount = newCount;
													break;
												case ThingCategory.EFFECT:
													data.effectsCount = newCount;
													break;
												case ThingCategory.MISSILE:
													data.missilesCount = newCount;
													break;
											}

											const updatedMaxId = minId + newCount - 1;
											const updatedAllItemIds: number[] = [];
											if (map) {
												for (let id = minId; id <= updatedMaxId; id++) {
													if (map.has(id)) {
														updatedAllItemIds.push(id);
													}
												}
											}

											// Calculate page for the new item
											const itemIndex = updatedAllItemIds.indexOf(newId);
											const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;

											markAsNewItem(newId, selectedCategory);
											markUnsavedChanges(newId, selectedCategory, true);

											// Set pending item ID to highlight after page change
											pendingNewItemId.current = newId;
											notifyDataChanged();
											setCurrentPage(targetPage);
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
								{viewMode === 'grid-3' && <Grid3x3 className="h-3.5 w-3.5 text-muted-foreground" />}
								{viewMode === 'grid-4' && <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />}
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
								<span>Grid (2 cols)</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setViewMode('grid-3')}>
								<Grid3x3 className="mr-2 h-4 w-4" />
								<span>Grid (3 cols)</span>
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => setViewMode('grid-4')}>
								<LayoutDashboard className="mr-2 h-4 w-4" />
								<span>Grid (4 cols)</span>
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
						key={updateCounter} // Force re-render when data changes (e.g. after optimization)
						className={cn(
							'p-2 pb-16',
							viewMode === 'list' && 'space-y-0.5',
							viewMode === 'grid' && 'grid grid-cols-2 gap-1',
							viewMode === 'grid-3' && 'grid grid-cols-3 gap-1',
							viewMode === 'grid-4' && 'grid grid-cols-4 gap-1',
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
												'w-full rounded-md transition-all hover:bg-item-hover relative',
												highlightedItemId === id && 'bg-primary/15 ring-1 ring-primary/50',
												viewMode === 'list' && 'flex items-center gap-2 px-2 py-1',
												viewMode === 'grid' && 'flex items-center px-1 py-0.5 gap-1.5',
												viewMode === 'grid-3' && 'flex flex-col items-center px-1 py-1 gap-1',
												viewMode === 'grid-4' && 'flex flex-col items-center px-0.5 py-1 gap-0.5',
												viewMode === 'large' && 'flex items-center px-1 py-0.5 gap-1.5'
											)}
										>
											<CheckerBoard
												className={cn(
													'rounded-md border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden',
													viewMode === 'list' && 'w-8 h-8',
													viewMode === 'grid' && 'w-12 h-12',
													viewMode === 'grid-3' && 'w-11 h-11',
													viewMode === 'grid-4' && 'w-9 h-9',
													viewMode === 'large' && 'w-32 h-32'
												)}
											>
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
																: viewMode === 'grid-3'
																	? 44 / (Math.max(item.width, item.height) * 32)
																	: viewMode === 'grid-4'
																		? 36 / (Math.max(item.width, item.height) * 32)
																		: 128 / (Math.max(item.width, item.height) * 32)
													}
												/>
											</CheckerBoard>
											<div
												className={cn(
													'min-w-0',
													viewMode === 'list' && 'flex-1 text-left',
													viewMode === 'grid' && 'flex-1 text-right',
													viewMode === 'grid-3' && 'w-full text-center',
													viewMode === 'grid-4' && 'w-full text-center',
													viewMode === 'large' && 'flex-1 text-right'
												)}
											>
												{viewMode === 'grid' || viewMode === 'large' ? (
													<div className="text-[11px] text-foreground font-mono font-medium leading-tight">{id}</div>
												) : viewMode === 'grid-3' ? (
													<div className="text-[10px] text-foreground font-mono font-medium leading-tight truncate">{id}</div>
												) : viewMode === 'grid-4' ? (
													<div className="text-[9px] text-foreground font-mono font-medium leading-tight truncate">{id}</div>
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
														<Circle
															className={cn(
																'text-primary fill-primary flex-shrink-0',
																viewMode === 'grid-3' || viewMode === 'grid-4'
																	? 'absolute top-0.5 right-0.5 h-2 w-2'
																	: 'h-2.5 w-2.5'
															)}
														/>
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

													const duplicate: ThingType = {
														...item,
														id: newId,
														spriteIndex: [...item.spriteIndex],
														frameDurations: item.frameDurations?.map((d) => ({ ...d })),
														frameGroupsData: item.frameGroupsData?.map((g) => ({
															...g,
															spriteIndex: [...g.spriteIndex],
															frameDurations: g.frameDurations?.map((d) => ({ ...d }))
														}))
													};

													map?.set(newId, duplicate);

													let minId: number;
													let updatedCount: number;
													switch (selectedCategory) {
														case ThingCategory.ITEM:
															minId = MIN_ITEM_ID;
															updatedCount = Math.max(data.itemsCount, newId - minId + 1);
															data.itemsCount = updatedCount;
															break;
														case ThingCategory.OUTFIT:
															minId = MIN_OUTFIT_ID;
															updatedCount = Math.max(data.outfitsCount, newId - minId + 1);
															data.outfitsCount = updatedCount;
															break;
														case ThingCategory.EFFECT:
															minId = MIN_EFFECT_ID;
															updatedCount = Math.max(data.effectsCount, newId - minId + 1);
															data.effectsCount = updatedCount;
															break;
														case ThingCategory.MISSILE:
															minId = MIN_MISSILE_ID;
															updatedCount = Math.max(data.missilesCount, newId - minId + 1);
															data.missilesCount = updatedCount;
															break;
														default:
															minId = MIN_ITEM_ID;
															updatedCount = Math.max(data.itemsCount, newId - minId + 1);
															data.itemsCount = updatedCount;
													}

													const updatedMaxId = minId + updatedCount - 1;
													const updatedAllItemIds: number[] = [];
													if (map) {
														for (let scanId = minId; scanId <= updatedMaxId; scanId++) {
															if (map.has(scanId)) {
																updatedAllItemIds.push(scanId);
															}
														}
													}

													const itemIndex = updatedAllItemIds.indexOf(newId);
													const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;

													markAsNewItem(newId, selectedCategory);
													markUnsavedChanges(newId, selectedCategory, true);

													pendingNewItemId.current = newId;
													notifyDataChanged();
													setCurrentPage(targetPage);
												}
											}}
										>
											<Copy className="mr-2 h-4 w-4" />
											<span>Duplicate</span>
										</ContextMenuItem>
										<ContextMenuItem
											disabled={!item.spriteIndex?.some((sid) => isValidSpriteId(sid))}
											onClick={() => handleFindSimilar([{ id, category: selectedCategory }])}
										>
											<Sparkles className="mr-2 h-4 w-4" />
											<span>Find Similar</span>
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() => {
												if (item) {
													// eslint-disable-next-line @typescript-eslint/no-unused-vars
													const { id: _, category: ___, spriteIndex: __, frameGroupsData: ____, ...properties } = item;
													setCopiedProperties(properties);
													toast({ description: 'Properties copied' });
												}
											}}
										>
											<Clipboard className="mr-2 h-4 w-4" />
											<span>Copy Properties</span>
										</ContextMenuItem>
										<ContextMenuItem
											disabled={!copiedProperties}
											onClick={() => {
												if (item && copiedProperties) {
													updateThing(id, selectedCategory, copiedProperties);
													markUnsavedChanges(id, selectedCategory, true);
													notifyDataChanged([id]);
													toast({ description: 'Properties pasted' });
												}
											}}
										>
											<ClipboardPaste className="mr-2 h-4 w-4" />
											<span>Paste Properties</span>
										</ContextMenuItem>
										<ContextMenuItem
											onClick={() => {
												if (data && item) {
													exportObjectSheet(item, data);
												}
											}}
										>
											<Download className="mr-2 h-4 w-4" />
											<span>Export Object Sheet</span>
										</ContextMenuItem>
										<ContextMenuItem
											onClick={async () => {
												if (data && item) {
													console.log('Context Menu: Import Object Sheet clicked for item', item.id);
													const result = await importObjectSheet(item, data, undefined, {
														isNew: isNewItem(item.id, selectedCategory)
													});
													if (result.success) {
														notifySpritesLoaded(); // Force re-render of canvases
														notifyDataChanged([item.id]); // Force refresh lists
													} else if (result.error) {
														toast({ variant: 'destructive', description: `Import rejected: ${result.error}` });
													}
												}
											}}
										>
											<Upload className="mr-2 h-4 w-4" />
											<span>Import Object Sheet</span>
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
														const remainingIds = allItemIds.filter((itemId) => itemId !== id);
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
