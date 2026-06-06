import { cn } from '@/lib/utils';
import { type Sprite } from '@/lib/tibia';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '@/usecase/hooks/use-toast';
import { useDragDrop } from '@/usecase/context/DragDropContext';
import { useTibiaData } from '@/usecase/context/TibiaDataContext';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { useGeneralSettings } from '@/usecase/context/GeneralSettingsContext';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
	ContextMenu,
	ContextMenuItem,
	ContextMenuContent,
	ContextMenuTrigger,
	ContextMenuSeparator
} from '@/components/ui/context-menu';
import {
	List,
	Copy,
	Plus,
	Image,
	Search,
	Square,
	Trash2,
	Upload,
	Grid3x3,
	Download,
	SkipBack,
	LayoutGrid,
	ChevronLeft,
	SkipForward,
	ChevronRight,
	ClipboardPaste,
	LayoutDashboard
} from 'lucide-react';

import { Input } from './ui/input';
import { Button } from './ui/button';
import { SpriteCanvas } from './SpriteCanvas';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';

type ViewMode = 'grid' | 'list' | 'large' | 'grid-3' | 'grid-4';

const VIEW_MODES: ViewMode[] = ['list', 'grid', 'grid-3', 'grid-4', 'large'];

export const SpriteList = () => {
	const {
		data,
		updateCounter,
		openedSpriteId,
		setOpenedSpriteId,
		notifyDataChanged,
		notifySpritesLoaded,
		highlightedSpriteId,
		spriteImportVersion,
		setHighlightedSpriteId
	} = useTibiaData();
	const { startDrag } = useDragDrop();
	const { toast } = useToast();
	const [currentPage, setCurrentPage] = useState<number>(1);
	// const [highlightedSpriteId, setHighlightedSpriteId] = useState<null | number>(null); // Moved to context
	const [selectedSpriteIds, setSelectedSpriteIds] = useState<Set<number>>(new Set());
	const [inputValue, setInputValue] = useState<string>('');
	const [viewMode, setViewModeState] = useState<ViewMode>('list');

	useEffect(() => {
		invoke<null | string>('get_sprite_list_view_mode')
			.then((mode) => {
				if (mode && VIEW_MODES.includes(mode as ViewMode)) {
					setViewModeState(mode as ViewMode);
				}
			})
			.catch(() => {});
	}, []);

	const setViewMode = useCallback((mode: ViewMode) => {
		setViewModeState(mode);
		invoke('set_sprite_list_view_mode', { mode }).catch(() => {});
	}, []);
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const shouldScrollToHighlightedRef = useRef(false);
	const isInternalHighlightChange = useRef(false);
	const pendingNewSpriteId = useRef<null | number>(null);
	const { settings: generalSettings } = useGeneralSettings();
	const itemsPerPage = generalSettings.listAmountSprites;

	// Get all sprite IDs from the loaded data
	const allSpriteIds = useMemo(() => {
		if (!data) return [];
		const ids: number[] = [];
		for (let id = 1; id <= data.spritesCount; id++) {
			// Include all sprites within the count range
			// We don't check data.sprites.has(id) because sprites are loaded lazily
			ids.push(id);
		}
		return ids;
	}, [data, updateCounter]);

	const totalPages = Math.max(1, Math.ceil(allSpriteIds.length / itemsPerPage));
	const paginatedSpriteIds = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return allSpriteIds.slice(start, end);
	}, [currentPage, allSpriteIds, itemsPerPage]);

	useEffect(() => {
		if (currentPage > totalPages) setCurrentPage(totalPages);
	}, [currentPage, totalPages]);

	// Reset to page 1 when data changes
	useEffect(() => {
		if (data) {
			setCurrentPage(1);
			// Auto-highlight first sprite (but don't open it)
			const firstSpriteId = allSpriteIds[0];
			if (firstSpriteId !== undefined) {
				setHighlightedSpriteId(firstSpriteId);
				setSelectedSpriteIds(new Set([firstSpriteId]));
			} else {
				setHighlightedSpriteId(null);
				setSelectedSpriteIds(new Set());
			}
			// Don't auto-open in properties panel
			setOpenedSpriteId(null);
		}
	}, [data, setOpenedSpriteId]);

	// Sync input value with highlighted sprite
	useEffect(() => {
		setInputValue(highlightedSpriteId ? String(highlightedSpriteId) : '');
	}, [highlightedSpriteId]);

	// Navigate to last page when new sprites are imported
	useEffect(() => {
		if (spriteImportVersion > 0 && totalPages > 0) {
			setCurrentPage(totalPages);
			// Also highlight the last sprite
			if (allSpriteIds.length > 0) {
				const lastSpriteId = allSpriteIds[allSpriteIds.length - 1];
				setHighlightedSpriteId(lastSpriteId);
				setSelectedSpriteIds(new Set([lastSpriteId]));
			}
		}
	}, [spriteImportVersion, totalPages, allSpriteIds, setHighlightedSpriteId]);

	// Load sprites for current page + prefetch ahead
	useEffect(() => {
		if (!data || !data.sprPath) return;

		let cancelled = false;

		const loadSpritesForCurrentPage = async () => {
			const { loadSpriteIds, loadSpriteIdsLz4 } = await import('@/lib/tibia');

			if (cancelled) return;

			const PREFETCH_PAGES = 2;
			const pagesToLoad = Math.min(PREFETCH_PAGES + 1, totalPages - currentPage + 1);

			const spritesToLoad: number[] = [];

			for (let i = 0; i < pagesToLoad; i++) {
				const pageNum = currentPage + i;
				if (pageNum > totalPages) break;

				const start = (pageNum - 1) * itemsPerPage;
				const end = start + itemsPerPage;
				spritesToLoad.push(...allSpriteIds.slice(start, end));
			}

			// Notifying with no actual change still cascades a re-render across
			// every SpriteCanvas on the page, so bail out when nothing is missing.
			const uncached = spritesToLoad.filter((id) => !data.sprites.has(id));
			if (uncached.length === 0) return;

			if (uncached.length > 100) {
				await loadSpriteIdsLz4(data.sprPath, spritesToLoad, data.transparency, data.sprites);
			} else {
				await loadSpriteIds(data.sprPath, spritesToLoad, data.transparency, data.sprites);
			}

			if (cancelled) return;
			notifySpritesLoaded();
		};

		loadSpritesForCurrentPage();

		return () => {
			cancelled = true;
		};
	}, [currentPage, data, allSpriteIds, totalPages, itemsPerPage]);

	const handlePageChange = (page: number) => {
		if (page >= 1 && page <= totalPages) {
			setCurrentPage(page);

			// Scroll to top
			const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
			if (viewport) {
				viewport.scrollTop = 0;
			}

			// Auto-highlight first sprite on the new page (but don't open it)
			const start = (page - 1) * itemsPerPage;
			const firstSpriteId = allSpriteIds[start];
			if (firstSpriteId !== undefined) {
				setHighlightedSpriteId(firstSpriteId);
				setSelectedSpriteIds(new Set([firstSpriteId]));
			}
		}
	};

	const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			const spriteId = parseInt(inputValue);
			if (!isNaN(spriteId) && data && spriteId >= 1 && spriteId <= data.spritesCount) {
				// Find the index of this sprite in allSpriteIds
				const spriteIndex = allSpriteIds.indexOf(spriteId);
				if (spriteIndex !== -1) {
					// Calculate which page this sprite is on
					const targetPage = Math.floor(spriteIndex / itemsPerPage) + 1;
					// Navigate to that page
					setCurrentPage(targetPage);
					// Set flag to scroll to highlighted sprite
					shouldScrollToHighlightedRef.current = true;
					// Highlight the sprite (not open it)
					setHighlightedSpriteId(spriteId);
				}
			}
		}
	};

	// Handle pending new sprite highlight after page change
	useEffect(() => {
		if (pendingNewSpriteId.current !== null && currentPage > 0) {
			// Wait for the page to render the new sprite
			setTimeout(() => {
				if (pendingNewSpriteId.current !== null) {
					shouldScrollToHighlightedRef.current = true;
					setHighlightedSpriteId(pendingNewSpriteId.current);
					setOpenedSpriteId(pendingNewSpriteId.current);
					pendingNewSpriteId.current = null;
				}
			}, 50);
		}
	}, [currentPage, setHighlightedSpriteId, setOpenedSpriteId, updateCounter]);

	// Handle external highlightedSpriteId changes
	useEffect(() => {
		if (highlightedSpriteId && data) {
			const spriteIndex = allSpriteIds.indexOf(highlightedSpriteId);
			if (spriteIndex !== -1) {
				const targetPage = Math.floor(spriteIndex / itemsPerPage) + 1;

				if (targetPage !== currentPage) {
					setCurrentPage(targetPage);
					shouldScrollToHighlightedRef.current = true;
				} else {
					// External change on same page
					if (!isInternalHighlightChange.current) {
						shouldScrollToHighlightedRef.current = true;
					}
				}
			}
		}
		isInternalHighlightChange.current = false;
	}, [highlightedSpriteId, data, allSpriteIds, currentPage, itemsPerPage, selectedSpriteIds]);

	// Scroll highlighted sprite to center when it changes (only if triggered by input)
	useEffect(() => {
		if (shouldScrollToHighlightedRef.current && highlightedSpriteId) {
			// Wait for DOM to update
			setTimeout(() => {
				const viewport = scrollViewportRef.current;
				if (viewport) {
					// Find the highlighted sprite button
					const highlightedButton = viewport.querySelector(`[data-sprite-id="${highlightedSpriteId}"]`) as HTMLElement;
					if (highlightedButton) {
						// Calculate scroll position to center the sprite
						const viewportHeight = viewport.clientHeight;
						const itemTop = highlightedButton.offsetTop;
						const itemHeight = highlightedButton.offsetHeight;
						const scrollTop = itemTop - viewportHeight / 2 + itemHeight / 2;

						viewport.scrollTo({
							behavior: 'smooth',
							top: Math.max(0, scrollTop)
						});
					}
				}
				shouldScrollToHighlightedRef.current = false;
			}, 50);
		}
	}, [highlightedSpriteId, currentPage]);

	// Helper function to delete/empty a sprite
	const handleDeleteSprite = (id: number) => {
		if (!data || !data.sprites) return;

		const sprite = data.sprites.get(id);
		if (!sprite) return;

		// If deleting the last sprite, we can reduce the count
		if (id === data.spritesCount) {
			data.sprites.delete(id);
			data.spritesCount--;
		} else {
			// For middle sprites, we can't remove the ID because it would shift all other IDs
			// Instead, we replace it with an empty sprite
			sprite.isEmpty = true;
			sprite.rgbaPixels = new Uint8Array(4096); // 32x32x4 bytes of zeros (RGBA)
			sprite.pixels = undefined; // Clear legacy ARGB cache
			sprite.compressedPixels = new Uint8Array(0);
			sprite.imageData = undefined; // Clear cached image data
		}

		// If this was the opened sprite, close it
		if (openedSpriteId === id) {
			setOpenedSpriteId(null);
		}

		// Clear highlight since sprite is gone
		if (highlightedSpriteId === id) {
			setHighlightedSpriteId(null);
		}

		notifySpritesLoaded();
		notifyDataChanged([id]); // Mark as modified for compilation
	};

	// Helper function to paste clipboard image into sprite(s)
	const pasteClipboardImage = async (targetSpriteId?: number) => {
		if (!data) return;

		try {
			const clipboardItems = await navigator.clipboard.read();

			for (const clipboardItem of clipboardItems) {
				for (const type of clipboardItem.types) {
					if (type.startsWith('image/')) {
						const blob = await clipboardItem.getType(type);

						// Load the image to check dimensions
						const img = document.createElement('img');
						const url = URL.createObjectURL(blob);

						img.onload = async () => {
							URL.revokeObjectURL(url);

							// Validate that dimensions are multiples of 32
							if (img.width % 32 !== 0 || img.height % 32 !== 0) {
								alert(`Image dimensions must be multiples of 32 pixels.\nCurrent size: ${img.width}x${img.height}`);
								return;
							}

							// Check if pasting into existing sprite (only allows 32x32)
							if (targetSpriteId !== undefined && (img.width !== 32 || img.height !== 32)) {
								alert(
									`When pasting into an existing sprite, image must be exactly 32x32 pixels.\nCurrent size: ${img.width}x${img.height}`
								);
								return;
							}

							// Create canvas to extract pixel data
							const canvas = document.createElement('canvas');
							canvas.width = img.width;
							canvas.height = img.height;
							const ctx = canvas.getContext('2d');
							if (!ctx) return;

							ctx.drawImage(img, 0, 0);
							const imageData = ctx.getImageData(0, 0, img.width, img.height);

							// For each 32x32 tile, create a new sprite or update existing
							const tilesX = img.width / 32;
							const tilesY = img.height / 32;

							let lastCreatedId = targetSpriteId;
							const modifiedSpriteIds: number[] = [];

							for (let ty = 0; ty < tilesY; ty++) {
								for (let tx = 0; tx < tilesX; tx++) {
									// Extract 32x32 tile
									const pixels = new Uint8Array(32 * 32 * 4);
									for (let y = 0; y < 32; y++) {
										for (let x = 0; x < 32; x++) {
											const srcIdx = ((ty * 32 + y) * img.width + (tx * 32 + x)) * 4;
											const dstIdx = (y * 32 + x) * 4;
											pixels[dstIdx] = imageData.data[srcIdx]; // R
											pixels[dstIdx + 1] = imageData.data[srcIdx + 1]; // G
											pixels[dstIdx + 2] = imageData.data[srcIdx + 2]; // B
											pixels[dstIdx + 3] = imageData.data[srcIdx + 3]; // A
										}
									}

									// The `pixels` from canvas are in RGBA format
									// Compress using Rust via raw binary IPC
									const compressBuf = new Uint8Array(4097);
									compressBuf[0] = data.transparency ? 1 : 0;
									compressBuf.set(pixels, 1);
									const compressResp = await invoke<ArrayBuffer>('compress_sprite_rgba', compressBuf);
									const compressedPixels = compressResp instanceof Uint8Array ? compressResp : new Uint8Array(compressResp);

									let spriteId: number;

									if (targetSpriteId !== undefined && ty === 0 && tx === 0) {
										// Pasting into existing sprite
										spriteId = targetSpriteId;
										const sprite = data.sprites.get(spriteId);
										if (sprite) {
											sprite.rgbaPixels = pixels; // Store RGBA for rendering
											sprite.compressedPixels = new Uint8Array(compressedPixels);
											sprite.isEmpty = pixels.every((p) => p === 0);
											sprite.imageData = undefined; // Clear cached image data
											modifiedSpriteIds.push(spriteId);
										}
									} else if (targetSpriteId === undefined) {
										// Creating new sprite
										let newId = data.spritesCount + 1;
										while (data.sprites.has(newId)) {
											newId++;
										}
										spriteId = newId;

										const newSprite: Sprite = {
											id: newId,
											rgbaPixels: pixels, // RGBA for rendering
											imageData: undefined,
											transparent: data.transparency,
											isEmpty: pixels.every((p) => p === 0),
											compressedPixels: new Uint8Array(compressedPixels)
										};

										data.sprites.set(newId, newSprite);
										data.spritesCount = newId;
										lastCreatedId = newId;
										modifiedSpriteIds.push(newId);
									}
								}
							}

							// Navigate to the last created/updated sprite
							if (lastCreatedId !== undefined) {
								const lastPage = Math.ceil(lastCreatedId / itemsPerPage);
								pendingNewSpriteId.current = lastCreatedId;
								setCurrentPage(lastPage);
							}

							notifySpritesLoaded();
							notifyDataChanged(modifiedSpriteIds);
						};

						img.onerror = () => {
							URL.revokeObjectURL(url);
							alert('Failed to load image from clipboard');
						};

						img.src = url;
						return; // Only handle the first image
					}
				}
			}
		} catch (err) {
			console.error('Failed to read clipboard:', err);
			alert('Failed to access clipboard. Please make sure you have granted clipboard permissions.');
		}
	};

	const ensureSpriteLoaded = useCallback(
		async (id: number): Promise<null | Sprite> => {
			if (!data || !data.sprPath) return null;
			const cached = data.sprites.get(id);
			if (cached) return cached;
			const { loadSpriteIds } = await import('@/lib/tibia');
			await loadSpriteIds(data.sprPath, [id], data.transparency, data.sprites);
			notifySpritesLoaded();
			return data.sprites.get(id) ?? null;
		},
		[data, notifySpritesLoaded]
	);

	const rgbaToPngBlob = useCallback((rgba: Uint8Array, width = 32, height = 32): Promise<null | Blob> => {
		return new Promise((resolve) => {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return resolve(null);
			const imageData = ctx.createImageData(width, height);
			imageData.data.set(rgba);
			ctx.putImageData(imageData, 0, 0);
			canvas.toBlob((blob) => resolve(blob), 'image/png');
		});
	}, []);

	const handleCopySpriteImage = useCallback(
		async (id: number) => {
			const sprite = await ensureSpriteLoaded(id);
			if (!sprite) return;
			const blob = await rgbaToPngBlob(sprite.rgbaPixels);
			if (!blob) return;
			try {
				await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
				toast({ title: 'Copied', description: `Sprite ${id} copied to clipboard` });
			} catch (err) {
				console.error('Clipboard write failed:', err);
				toast({ title: 'Copy failed', variant: 'destructive', description: 'Could not write image to clipboard' });
			}
		},
		[ensureSpriteLoaded, rgbaToPngBlob, toast]
	);

	const handleFindUsages = useCallback(
		async (id: number) => {
			try {
				const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
				const { emit } = await import('@tauri-apps/api/event');
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
					// Give the React app a moment to mount its listener
					await new Promise((r) => setTimeout(r, 300));
				}
				await emit('find_by_sprite', { spriteId: id });
			} catch (err) {
				console.error('Failed to open find window:', err);
				toast({ title: 'Error', variant: 'destructive', description: 'Failed to open Find window' });
			}
		},
		[toast]
	);

	const handleExportSpritePng = useCallback(
		async (id: number) => {
			const sprite = await ensureSpriteLoaded(id);
			if (!sprite) return;
			try {
				const { save } = await import('@tauri-apps/plugin-dialog');
				const filePath = await save({
					defaultPath: `sprite_${id}.png`,
					filters: [{ name: 'PNG Image', extensions: ['png'] }]
				});
				if (!filePath) return;
				await invoke('write_sprite_png', { path: filePath, rgba: Array.from(sprite.rgbaPixels) });
				toast({ title: 'Exported', description: `Sprite ${id} saved` });
			} catch (err) {
				console.error('Export failed:', err);
				toast({ title: 'Export failed', variant: 'destructive', description: String(err) });
			}
		},
		[ensureSpriteLoaded, toast]
	);

	const handleReplaceFromPng = useCallback(
		async (id: number) => {
			if (!data) return;
			try {
				const { open } = await import('@tauri-apps/plugin-dialog');
				const filePath = await open({
					multiple: false,
					filters: [{ name: 'Image', extensions: ['png', 'bmp', 'jpg', 'jpeg'] }]
				});
				if (!filePath || typeof filePath !== 'string') return;

				const rgbaArr = await invoke<number[] | Uint8Array>('read_sprite_png', { path: filePath });
				const pixels = rgbaArr instanceof Uint8Array ? rgbaArr : new Uint8Array(rgbaArr);

				const compressBuf = new Uint8Array(4097);
				compressBuf[0] = data.transparency ? 1 : 0;
				compressBuf.set(pixels, 1);
				const compressResp = await invoke<ArrayBuffer>('compress_sprite_rgba', compressBuf);
				const compressedPixels = compressResp instanceof Uint8Array ? compressResp : new Uint8Array(compressResp);

				const sprite = data.sprites.get(id);
				if (sprite) {
					sprite.rgbaPixels = pixels;
					sprite.compressedPixels = compressedPixels;
					sprite.isEmpty = pixels.every((p) => p === 0);
					sprite.imageData = undefined;
					sprite.pixels = undefined;
				} else {
					data.sprites.set(id, {
						id,
						compressedPixels,
						rgbaPixels: pixels,
						imageData: undefined,
						transparent: data.transparency,
						isEmpty: pixels.every((p) => p === 0)
					});
				}

				notifySpritesLoaded();
				notifyDataChanged([id]);
				toast({ title: 'Replaced', description: `Sprite ${id} replaced from PNG` });
			} catch (err) {
				console.error('Replace failed:', err);
				toast({ variant: 'destructive', title: 'Replace failed', description: String(err) });
			}
		},
		[data, notifySpritesLoaded, notifyDataChanged, toast]
	);

	// Handle global clipboard paste events (creates new sprites)
	useEffect(() => {
		const handlePaste = async (e: ClipboardEvent) => {
			// Only handle global paste if no specific target
			if (!data) return;
			if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;

			e.preventDefault();
			await pasteClipboardImage();
		};

		document.addEventListener('paste', handlePaste);
		return () => {
			document.removeEventListener('paste', handlePaste);
		};
	}, [data, pasteClipboardImage]);

	// Handle Delete key to remove highlighted sprite
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Only handle Delete key if we have a highlighted sprite and no input is focused
			if (e.key !== 'Delete') return;
			if (!data || !highlightedSpriteId) return;
			if (document.activeElement?.tagName === 'INPUT') return;

			e.preventDefault();
			handleDeleteSprite(highlightedSpriteId);
		};

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [data, highlightedSpriteId]);

	// Show empty state if no data loaded
	if (!data) {
		return (
			<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden">
				<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80">
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprites</h2>
					<span className="ml-auto text-xs text-muted-foreground font-mono">0</span>
				</div>
				<div className="flex-1 flex items-center justify-center p-4">
					<div className="text-center text-muted-foreground">
						<Image className="h-10 w-10 mx-auto mb-2 opacity-50" />
						<p className="text-xs">No files loaded</p>
						<p className="text-[10px] mt-1">Click "Open Files" to load Tibia.spr</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden relative">
			<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprites</h2>

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
											// Find next available sprite ID
											let newId = data.spritesCount + 1;
											while (data.sprites.has(newId)) {
												newId++;
											}

											// Create new empty sprite
											const newSprite: Sprite = {
												id: newId,
												isEmpty: true,
												pixels: undefined,
												imageData: undefined,
												transparent: data.transparency,
												rgbaPixels: new Uint8Array(4096), // Empty RGBA
												compressedPixels: new Uint8Array(0)
											};

											// Add to map
											data.sprites.set(newId, newSprite);

											// Update count
											data.spritesCount = newId;

											// Since the new sprite is added at the end, it will be on the last page
											const lastPage = Math.ceil(newId / itemsPerPage);

											// Set pending sprite ID to highlight after page change
											pendingNewSpriteId.current = newId;
											setCurrentPage(lastPage);

											notifySpritesLoaded();
											notifyDataChanged([newId]);
										}
									}}
								>
									<Plus className="h-3.5 w-3.5" />
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Create new sprite</p>
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

			<div
				ref={scrollViewportRef}
				className="flex-1 overflow-y-auto custom-scrollbar"
				onDragOver={(e) => {
					e.preventDefault();
					e.dataTransfer.dropEffect = 'move';
				}}
			>
				<div
					className={cn(
						'p-2 pb-16',
						viewMode === 'list' && 'space-y-0.5',
						viewMode === 'grid' && 'grid grid-cols-2 gap-1',
						viewMode === 'grid-3' && 'grid grid-cols-3 gap-1',
						viewMode === 'grid-4' && 'grid grid-cols-4 gap-1',
						viewMode === 'large' && 'grid grid-cols-1 gap-2'
					)}
				>
					{paginatedSpriteIds.map((id) => (
						<ContextMenu key={id}>
							<ContextMenuTrigger asChild>
								<div
									role="button"
									data-sprite-id={id}
									onMouseUp={(e) => {
										const timer = (e.target as any)._dragTimer;
										if (timer) clearTimeout(timer);
									}}
									style={{
										userSelect: 'none',
										msUserSelect: 'none',
										MozUserSelect: 'none',
										WebkitUserSelect: 'none'
									}}
									onDoubleClick={(e) => {
										e.stopPropagation();
										setOpenedSpriteId(id);
										setHighlightedSpriteId(id);
										isInternalHighlightChange.current = true;
									}}
									className={cn(
										'w-full rounded-md transition-all hover:bg-item-hover cursor-grab active:cursor-grabbing relative',
										(selectedSpriteIds.has(id) || highlightedSpriteId === id) && 'bg-primary/15 ring-1 ring-primary/50',
										viewMode === 'list' && 'flex items-center gap-2 px-2 py-1',
										viewMode === 'grid' && 'flex items-center px-1 py-0.5 gap-1.5',
										viewMode === 'grid-3' && 'flex flex-col items-center px-1 py-1 gap-1',
										viewMode === 'grid-4' && 'flex flex-col items-center px-0.5 py-1 gap-0.5',
										viewMode === 'large' && 'flex items-center px-1 py-0.5 gap-1.5'
									)}
									onClick={(e) => {
										e.stopPropagation();

										const newSelection = new Set(e.ctrlKey ? selectedSpriteIds : []);

										if (e.shiftKey && highlightedSpriteId) {
											const start = Math.min(highlightedSpriteId, id);
											const end = Math.max(highlightedSpriteId, id);
											for (let i = start; i <= end; i++) {
												newSelection.add(i);
											}
										} else if (e.ctrlKey) {
											if (newSelection.has(id)) {
												newSelection.delete(id);
											} else {
												newSelection.add(id);
											}
											setHighlightedSpriteId(id);
										} else {
											newSelection.add(id);
											setHighlightedSpriteId(id);
										}

										isInternalHighlightChange.current = true;
										setSelectedSpriteIds(newSelection);
									}}
									onMouseDown={(e) => {
										if (e.button !== 0) return;

										e.preventDefault();
										e.stopPropagation();

										const timer = setTimeout(() => {
											let idsToDrag: number[] = [];
											if (selectedSpriteIds.has(id)) {
												idsToDrag = Array.from(selectedSpriteIds).sort((a, b) => a - b);
											} else {
												idsToDrag = [id];
												setSelectedSpriteIds(new Set([id]));
												setHighlightedSpriteId(id);
											}

											const preview = (
												<div className="bg-background border border-border rounded-md shadow-lg overflow-hidden w-12 h-12 flex items-center justify-center relative">
													<SpriteCanvas showEmpty scale={1.5} spriteId={id} renderMode="list" />
													{idsToDrag.length > 1 && (
														<div className="absolute top-0 right-0 bg-primary text-primary-foreground text-[10px] font-bold px-1 rounded-bl-md">
															{idsToDrag.length}
														</div>
													)}
												</div>
											);
											startDrag(idsToDrag, 'sprites', preview);
										}, 150);

										(e.target as any)._dragTimer = timer;
									}}
								>
									<div
										className={cn(
											'rounded-md border border-border/50 flex items-center justify-center flex-shrink-0 overflow-hidden bg-muted pointer-events-none select-none',
											viewMode === 'list' && 'w-8 h-8',
											viewMode === 'grid' && 'w-12 h-12',
											viewMode === 'grid-3' && 'w-11 h-11',
											viewMode === 'grid-4' && 'w-9 h-9',
											viewMode === 'large' && 'w-32 h-32'
										)}
									>
										<SpriteCanvas
											showEmpty
											spriteId={id}
											renderMode="list"
											className="pointer-events-none select-none"
											scale={
												viewMode === 'list'
													? 1
													: viewMode === 'grid'
														? 1.5
														: viewMode === 'grid-3'
															? 1.375
															: viewMode === 'grid-4'
																? 1.125
																: 4
											}
										/>
									</div>
									<div
										className={cn(
											'min-w-0 pointer-events-none select-none',
											viewMode === 'list' && 'flex-1 text-left',
											viewMode === 'grid' && 'flex-1 text-right',
											viewMode === 'grid-3' && 'w-full text-center',
											viewMode === 'grid-4' && 'w-full text-center',
											viewMode === 'large' && 'flex-1 text-right'
										)}
									>
										<div
											className={cn(
												'text-foreground font-mono font-medium leading-tight truncate',
												viewMode === 'grid-4' ? 'text-[9px]' : viewMode === 'grid-3' ? 'text-[10px]' : 'text-[11px]'
											)}
										>
											{id}
										</div>
									</div>
								</div>
							</ContextMenuTrigger>
							<ContextMenuContent>
								<ContextMenuItem onClick={() => id && handleCopySpriteImage(id)}>
									<Copy className="mr-2 h-4 w-4" />
									<span>Copy Image</span>
								</ContextMenuItem>
								<ContextMenuItem onClick={() => id && data && pasteClipboardImage(id)}>
									<ClipboardPaste className="mr-2 h-4 w-4" />
									<span>Paste from Clipboard</span>
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => id && handleFindUsages(id)}>
									<Search className="mr-2 h-4 w-4" />
									<span>Find Usages</span>
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => id && handleExportSpritePng(id)}>
									<Download className="mr-2 h-4 w-4" />
									<span>Export PNG...</span>
								</ContextMenuItem>
								<ContextMenuItem onClick={() => id && handleReplaceFromPng(id)}>
									<Upload className="mr-2 h-4 w-4" />
									<span>Replace from PNG...</span>
								</ContextMenuItem>
								<ContextMenuSeparator />
								<ContextMenuItem onClick={() => id && handleDeleteSprite(id)} className="text-destructive focus:text-destructive">
									<Trash2 className="mr-2 h-4 w-4" />
									<span>Remove</span>
								</ContextMenuItem>
							</ContextMenuContent>
						</ContextMenu>
					))}
				</div>
			</div>

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
