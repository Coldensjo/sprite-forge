import { cn } from '@/lib/utils';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { useRef, useMemo, useState, useEffect } from 'react';
import { List, Image, Square, SkipBack, LayoutGrid, ChevronLeft, SkipForward, ChevronRight } from 'lucide-react';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

import { Input } from './ui/input';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';

type ViewMode = 'list' | 'grid' | 'large';

export const SpriteList = () => {
	const { data, openedSpriteId, setOpenedSpriteId, notifySpritesLoaded } = useTibiaData();
	const [currentPage, setCurrentPage] = useState<number>(1);
	const [highlightedSpriteId, setHighlightedSpriteId] = useState<null | number>(null);
	const [inputValue, setInputValue] = useState<string>('');
	const [viewMode, setViewMode] = useState<ViewMode>('list');
	const scrollViewportRef = useRef<HTMLDivElement>(null);
	const shouldScrollToHighlightedRef = useRef(false);
	const itemsPerPage = 100;

	// Get all sprite IDs from the loaded data
	const allSpriteIds = useMemo(() => {
		if (!data) return [];
		const ids: number[] = [];
		for (let id = 1; id <= data.spritesCount; id++) {
			ids.push(id);
		}
		return ids;
	}, [data]);

	const totalPages = Math.ceil(allSpriteIds.length / itemsPerPage);
	const paginatedSpriteIds = useMemo(() => {
		const start = (currentPage - 1) * itemsPerPage;
		const end = start + itemsPerPage;
		return allSpriteIds.slice(start, end);
	}, [currentPage, allSpriteIds]);

	// Reset to page 1 when data changes
	useEffect(() => {
		if (data) {
			setCurrentPage(1);
			// Auto-highlight first sprite (but don't open it)
			const firstSpriteId = allSpriteIds[0];
			if (firstSpriteId !== undefined) {
				setHighlightedSpriteId(firstSpriteId);
			} else {
				setHighlightedSpriteId(null);
			}
			// Don't auto-open in properties panel
			setOpenedSpriteId(null);
		}
	}, [data, allSpriteIds, setOpenedSpriteId]);

	// Sync input value with highlighted sprite
	useEffect(() => {
		setInputValue(highlightedSpriteId ? String(highlightedSpriteId) : '');
	}, [highlightedSpriteId]);

	// Load sprite window when page changes (Object Builder style)
	useEffect(() => {
		if (!data || !data.sprPath) return;

		const loadCurrentWindow = async () => {
			// Load window for first sprite on current page
			const firstSpriteOnPage = paginatedSpriteIds[0];
			if (firstSpriteOnPage) {
				const { loadSpriteWindow } = await import('@/lib/tibia');
				await loadSpriteWindow(data.sprPath!, firstSpriteOnPage, data.spritesCount, data.transparency, data.sprites);
				// Notify context that sprites were loaded (triggers re-render)
				notifySpritesLoaded();
			}
		};

		loadCurrentWindow();
	}, [currentPage, data, paginatedSpriteIds, notifySpritesLoaded]);

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

	// Scroll highlighted sprite to center when it changes (only if triggered by input)
	useEffect(() => {
		if (shouldScrollToHighlightedRef.current && highlightedSpriteId) {
			// Wait for DOM to update
			setTimeout(() => {
				const viewport = scrollViewportRef.current?.querySelector('[data-radix-scroll-area-viewport]');
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
			}, 100);
		}
	}, [highlightedSpriteId, currentPage]);

	// Show empty state if no data loaded
	if (!data) {
		return (
			<div className="w-[216px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden">
				<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/50">
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
		<div className="w-[216px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden relative">
			<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/50">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprites</h2>

				<div className="ml-auto flex items-center gap-1">
					<span className="text-xs text-muted-foreground font-mono mr-1">{allSpriteIds.length}</span>
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
				<div
					className={cn(
						'p-2 pb-16',
						viewMode === 'list' && 'space-y-0.5',
						viewMode === 'grid' && 'grid grid-cols-2 gap-1',
						viewMode === 'large' && 'grid grid-cols-1 gap-2'
					)}
				>
					{paginatedSpriteIds.map((id) => (
						<button
							key={id}
							data-sprite-id={id}
							onClick={() => setHighlightedSpriteId(id)}
							onDoubleClick={() => {
								setOpenedSpriteId(id);
								setHighlightedSpriteId(id);
							}}
							className={cn(
								'w-full rounded-md transition-all hover:bg-item-hover',
								highlightedSpriteId === id && 'bg-primary/15 ring-1 ring-primary/50',
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
								<SpriteCanvas
									showEmpty
									spriteId={id}
									renderMode="list"
									scale={viewMode === 'list' ? 1 : viewMode === 'grid' ? 1.5 : 4}
								/>
							</CheckerBoard>
							<div
								className={cn(
									'min-w-0',
									viewMode === 'list' && 'flex-1 text-left',
									viewMode === 'grid' && 'flex-1 text-right',
									viewMode === 'large' && 'flex-1 text-right'
								)}
							>
								<div className="text-[11px] text-foreground font-mono font-medium leading-tight">{id}</div>
							</div>
						</button>
					))}
				</div>
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
