import React from 'react';
import { logger, EventCode } from '@/lib/debug';
import { useListViewMode } from '@/usecase/hooks/useListViewMode';
import { useAssetData } from '@/usecase/context/AssetDataContext';
import { getThumbnailSpriteIds } from '@/usecase/util/thumbnailUtils';
import { exportObjectSheet, importObjectSheet } from '@/lib/formats/tibia';
import { useGeneralSettings } from '@/usecase/context/GeneralSettingsContext';
import {
	MIN_ITEM_ID,
	MIN_OUTFIT_ID,
	MIN_EFFECT_ID,
	ThingCategory,
	MIN_MISSILE_ID,
	type ThingType,
	isValidSpriteId,
	createThingType
} from '@/lib/formats/tibia';

import { useToast } from './use-toast';

export const useItemList = () => {
	const {
		data,
		isNewItem,
		spriteSize,
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
	} = useAssetData();
	const { toast } = useToast();
	const { viewMode, setViewMode } = useListViewMode('get_item_list_view_mode', 'set_item_list_view_mode');
	const [currentPage, setCurrentPage] = React.useState<number>(1);
	const [copiedProperties, setCopiedProperties] = React.useState<null | Partial<ThingType>>(null);
	const [inputValue, setInputValue] = React.useState<string>('');

	const scrollViewportRef = React.useRef<HTMLDivElement>(null);
	const shouldScrollToHighlightedRef = React.useRef(false);
	const pendingNewItemId = React.useRef<null | number>(null);
	const prevCategoryRef = React.useRef<null | ThingCategory>(null);
	const prevDataRef = React.useRef<null | typeof data>(null);
	const { settings: generalSettings } = useGeneralSettings();
	const itemsPerPage = generalSettings.listAmountObjects;

	const getCategoryMap = React.useMemo(() => {
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

	const getThing = React.useCallback(
		(id: number, category: ThingCategory) => {
			const map = getCategoryMap(category);
			return map?.get(id) || null;
		},
		[getCategoryMap]
	);

	const allItemIds = React.useMemo(() => {
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
	const paginatedItemIds = React.useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return allItemIds.slice(start, end);
	}, [currentPage, allItemIds, itemsPerPage]);

	React.useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	React.useEffect(() => {
		if (data) {
			const categoryChanged = prevCategoryRef.current !== selectedCategory;
			const dataChanged = prevDataRef.current !== data;
			if (categoryChanged || dataChanged) {
				prevCategoryRef.current = selectedCategory;
				prevDataRef.current = data;
				setCurrentPage(1);
				const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
				if (viewport) viewport.scrollTo({ top: 0, behavior: 'instant' });
				const firstItemId = allItemIds[0];
				if (firstItemId !== undefined) {
					setHighlightedItemId(firstItemId);
				} else {
					setHighlightedItemId(null);
				}
			}
		}
	}, [data, selectedCategory, setHighlightedItemId, allItemIds]);

	React.useEffect(() => {
		setInputValue(highlightedItemId ? String(highlightedItemId) : '');
	}, [highlightedItemId]);

	const [pendingSelection, setPendingSelection] = React.useState<null | { id: number; category: ThingCategory }>(null);

	React.useEffect(() => {
		let unlisten: undefined | (() => void);

		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen('select_thing', (event: any) => {
				const { id, category } = event.payload;
				setPendingSelection({ id, category });
				setSelectedCategory(category);
			});
		};

		setupListener();

		return () => {
			if (unlisten) unlisten();
		};
	}, [setSelectedCategory]);

	React.useEffect(() => {
		if (pendingSelection && pendingSelection.category === selectedCategory) {
			const { id } = pendingSelection;
			const itemIndex = allItemIds.indexOf(id);

			if (itemIndex !== -1) {
				const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
				setCurrentPage(targetPage);
				shouldScrollToHighlightedRef.current = true;
				setHighlightedItemId(id);
				setPendingSelection(null);
			}
		}
	}, [pendingSelection, selectedCategory, allItemIds, itemsPerPage, setHighlightedItemId]);

	React.useEffect(() => {
		if (!data || !data.sprPath) return;

		let cancelled = false;

		const loadSpritesProgressively = async () => {
			logger.log(EventCode.ITEM_PAGE, { pg: currentPage, cat: selectedCategory, n: paginatedItemIds.length });

			const { loadSpriteIds, loadSpriteIdsLz4 } = await import('@/lib/formats/tibia');
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
		updateCounter
	]);

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			setCurrentPage(page);

			const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
			if (viewport) {
				viewport.scrollTop = 0;
			}

			const start = (page - 1) * itemsPerPage;
			const firstItemId = allItemIds[start];
			if (firstItemId !== undefined) {
				setHighlightedItemId(firstItemId);
			}
		}
	};

	const handleFindSimilar = React.useCallback(
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
				const item = getThing(itemId, selectedCategory);
				if (item) {
					const itemIndex = allItemIds.indexOf(itemId);
					if (itemIndex !== -1) {
						const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;
						setCurrentPage(targetPage);
						shouldScrollToHighlightedRef.current = true;
						setHighlightedItemId(itemId);
					}
				}
			}
		}
	};

	React.useEffect(() => {
		if (pendingNewItemId.current !== null && currentPage > 0) {
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

	React.useEffect(() => {
		if (shouldScrollToHighlightedRef.current && highlightedItemId) {
			setTimeout(() => {
				const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
				if (viewport) {
					const highlightedButton = viewport.querySelector(`[data-item-id="${highlightedItemId}"]`) as HTMLElement;
					if (highlightedButton) {
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

	const createNewItem = () => {
		if (!data) return;
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

		let newId = minId;
		while (map?.has(newId)) {
			newId++;
		}

		const newItem = createThingType(newId, selectedCategory);

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

		const itemIndex = updatedAllItemIds.indexOf(newId);
		const targetPage = Math.floor(itemIndex / itemsPerPage) + 1;

		markAsNewItem(newId, selectedCategory);
		markUnsavedChanges(newId, selectedCategory, true);

		pendingNewItemId.current = newId;
		notifyDataChanged();
		setCurrentPage(targetPage);
	};

	const editItem = (id: number) => {
		setOpenedItemId(id);
		setHighlightedItemId(id);
	};

	const duplicateItem = (id: number, item: ThingType) => {
		if (!data) return;
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
	};

	const copyProperties = (item: ThingType) => {
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { id: _, category: ___, spriteIndex: __, frameGroupsData: ____, ...properties } = item;
		setCopiedProperties(properties);
		toast({ description: 'Properties copied' });
	};

	const pasteProperties = (id: number) => {
		if (!copiedProperties) return;
		updateThing(id, selectedCategory, copiedProperties);
		markUnsavedChanges(id, selectedCategory, true);
		notifyDataChanged([id]);
		toast({ description: 'Properties pasted' });
	};

	const exportSheet = (item: ThingType) => {
		if (data) exportObjectSheet(item, data);
	};

	const importSheet = async (item: ThingType) => {
		if (!data) return;
		const result = await importObjectSheet(item, data, undefined, {
			isNew: isNewItem(item.id, selectedCategory)
		});
		if (result.success) {
			notifySpritesLoaded();
			notifyDataChanged([item.id]);
		} else if (result.error) {
			toast({ variant: 'destructive', description: `Import rejected: ${result.error}` });
		}
	};

	const removeItem = (id: number) => {
		if (!data) return;
		const map = getCategoryMap(selectedCategory);
		if (!map?.has(id)) return;
		map.delete(id);

		removeOpenedItem(id, selectedCategory);

		if (openedItemId === id) {
			setOpenedItemId(null);
		}

		setHighlightedItemId(null);

		const remainingIds = allItemIds.filter((itemId) => itemId !== id);
		if (remainingIds.length === 0) {
			setCurrentPage(1);
		} else {
			const currentIndex = allItemIds.indexOf(id);
			const nextId = remainingIds[currentIndex] || remainingIds[currentIndex - 1] || remainingIds[0];
			if (nextId) {
				setHighlightedItemId(nextId);
				const targetPage = Math.floor(remainingIds.indexOf(nextId) / itemsPerPage) + 1;
				setCurrentPage(targetPage);
			}
		}

		notifyDataChanged();
	};

	const canFindSimilar = (item: ThingType) => !!item.spriteIndex?.some((sid) => isValidSpriteId(sid));

	return {
		data,
		getThing,
		viewMode,
		editItem,
		inputValue,
		removeItem,
		totalPages,
		spriteSize,
		currentPage,
		setViewMode,
		exportSheet,
		importSheet,
		createNewItem,
		setInputValue,
		updateCounter,
		duplicateItem,
		canFindSimilar,
		copyProperties,
		pasteProperties,
		handlePageChange,
		copiedProperties,
		selectedCategory,
		paginatedItemIds,
		scrollViewportRef,
		hasUnsavedChanges,
		highlightedItemId,
		handleInputKeyDown,
		setSelectedCategory,
		setHighlightedItemId,
		findSimilar: handleFindSimilar
	};
};
