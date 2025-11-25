import { cn } from '@/lib/utils';
import { invoke } from '@tauri-apps/api/core';
import { isValidSpriteId } from '@/lib/tibia';
import { useVirtualizer } from '@tanstack/react-virtual';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { ThingType, ThingCategory } from '@/lib/tibia/types';
import { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { X, List, Minus, Square, Trash2, Columns, LayoutGrid } from 'lucide-react';

import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';
import { ScrollArea } from './ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectItem, SelectValue, SelectContent, SelectTrigger } from './ui/select';
import { DropdownMenu, DropdownMenuItem, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu';

type ViewMode = 'list' | 'grid' | 'large' | 'compact';

// Property display names and their corresponding ThingType property names
const PROPERTIES: Array<{ display: string; property: string }> = [
	{ display: 'Is Ground', property: 'isGround' },
	{ display: 'Ground Border', property: 'isGroundBorder' },
	{ display: 'Bottom', property: 'isOnBottom' },
	{ display: 'Top', property: 'isOnTop' },
	{ display: 'Has Light', property: 'hasLight' },
	{ display: 'Automap', property: 'miniMap' },
	{ display: 'Has Offset', property: 'hasOffset' },
	{ display: 'Has Elevation', property: 'hasElevation' },
	{ display: 'Equip', property: 'cloth' },
	{ display: 'Market', property: 'isMarketItem' },
	{ display: 'Writable', property: 'writable' },
	{ display: 'Writable Once', property: 'writableOnce' },
	{ display: 'Has Action', property: 'hasDefaultAction' },
	{ display: 'Container', property: 'isContainer' },
	{ display: 'Stackable', property: 'stackable' },
	{ display: 'Force Use', property: 'forceUse' },
	{ display: 'Multi Use', property: 'multiUse' },
	{ display: 'Fluid Container', property: 'isFluidContainer' },
	{ display: 'Fluid', property: 'isFluid' },
	{ display: 'Unpassable', property: 'isUnpassable' },
	{ display: 'Unmovable', property: 'isUnmoveable' },
	{ display: 'Block Missile', property: 'blockMissile' },
	{ property: 'blockPathfind', display: 'Block Pathfinder' },
	{ property: 'noMoveAnimation', display: 'No Move Animation' },
	{ display: 'Pickupable', property: 'pickupable' },
	{ display: 'Hangable', property: 'hangable' },
	{ display: 'Hook East', property: 'isHorizontal' },
	{ display: 'Hook South', property: 'isVertical' },
	{ display: 'Rotatable', property: 'rotatable' },
	{ property: 'dontHide', display: "Don't Hide" },
	{ display: 'Translucent', property: 'isTranslucent' },
	{ display: 'Lying Object', property: 'isLyingObject' },
	{ display: 'Animate Always', property: 'animateAlways' },
	{ display: 'Full Ground', property: 'isFullGround' },
	{ display: 'Ignore Look', property: 'ignoreLook' },
	{ display: 'Wrappable', property: 'wrappable' },
	{ display: 'Unwrappable', property: 'unwrappable' },
	{ display: 'Top effect', property: 'topEffect' },
	{ display: 'Useable', property: 'usable' },
	{ display: 'Has Charges', property: 'hasCharges' },
	{ display: 'Floor Change', property: 'floorChange' },
	{ display: 'Lens Help', property: 'isLensHelp' },
	{ display: 'Is Animation', property: 'isAnimation' }
];

export const FindWindow = () => {
	const { data, setData, setOpenedItemId, notifySpritesLoaded } = useTibiaData();
	const [selectedCategory, setSelectedCategory] = useState<'all' | ThingCategory>('all');
	const [properties, setProperties] = useState<Record<string, boolean>>(
		PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.property]: false }), {})
	);
	const [name, setName] = useState('');
	const [searchResults, setSearchResults] = useState<Array<{ id: number; category: ThingCategory }>>([]);
	const [resultThings, setResultThings] = useState<Map<string, ThingType>>(new Map());
	const [isSearching, setIsSearching] = useState(false);
	const [selectedResultId, setSelectedResultId] = useState<null | number>(null);
	const [selectedResultCategory, setSelectedResultCategory] = useState<null | ThingCategory>(null);
	const [viewMode, setViewMode] = useState<ViewMode>('list');
	const parentRef = useRef<HTMLDivElement>(null);

	const [parentWidth, setParentWidth] = useState(0);

	useEffect(() => {
		if (!parentRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				setParentWidth(entry.contentRect.width);
			}
		});
		observer.observe(parentRef.current);
		return () => observer.disconnect();
	}, [parentRef.current]);

	const itemsPerRow = useMemo(() => {
		if (viewMode === 'list') return 1;
		if (viewMode === 'large') return 1;
		if (viewMode === 'grid') return 2;
		if (viewMode === 'compact') {
			const width = parentWidth || 400;
			// 48px (image) + 4px (padding) + 2px (gap) = 54px approx
			return Math.max(1, Math.floor(width / 54));
		}
		return 1;
	}, [viewMode, parentWidth]);

	const rowCount = Math.ceil(searchResults.length / itemsPerRow);

	// Virtualizer for efficient rendering of large lists
	const virtualizer = useVirtualizer({
		overscan: 5,
		count: rowCount,
		getScrollElement: () => parentRef.current,
		estimateSize: () => {
			if (viewMode === 'list') return 40;
			if (viewMode === 'grid') return 54;
			if (viewMode === 'compact') return 74; // Increased height to fit ID
			if (viewMode === 'large') return 140;
			return 40;
		}
	});

	const handlePropertyToggle = (property: string) => {
		setProperties((prev) => ({ ...prev, [property]: !prev[property] }));
	};

	const handleFind = useCallback(async () => {
		console.log('handleFind called', { name, properties, selectedCategory });

		// Get the DAT path from localStorage (set by main window when files are loaded)
		const datPath = localStorage.getItem('sprite-forge-dat-path');
		if (!datPath) {
			console.warn('No DAT file loaded in main window - cannot search');
			setSearchResults([]);
			return;
		}

		// Filter properties to only include those that are true AND relevant to the selected category
		const activeProperties: Record<string, boolean> = {};
		const relevantProps = ['hasLight', 'hasOffset', 'animateAlways'];

		for (const [propName, value] of Object.entries(properties)) {
			if (value === true) {
				// If category is NOT item or all, check if property is relevant
				if (selectedCategory !== 'all' && selectedCategory !== 'item') {
					if (!relevantProps.includes(propName)) {
						continue; // Skip irrelevant property
					}
				}
				activeProperties[propName] = true;
			}
		}

		console.log('Search criteria:', { datPath, activeProperties, selectedCategory, name: name.trim() });

		setIsSearching(true);
		try {
			console.log('Invoking search_things_bin...');
			const response: any = await invoke('search_things_bin', {
				limit: 0, // 0 = unlimited
				path: datPath,
				name: name.trim() || null,
				properties: activeProperties,
				category: selectedCategory === 'all' ? null : selectedCategory
			});

			console.log('Search response received', response);

			let buffer: ArrayBufferLike;
			if (response instanceof Uint8Array) {
				buffer = response.buffer;
			} else if (Array.isArray(response)) {
				buffer = new Uint8Array(response).buffer;
			} else if (response && response.buffer instanceof ArrayBuffer) {
				buffer = response.buffer;
			} else {
				// Fallback: try to treat as array
				buffer = new Uint8Array(response).buffer;
			}

			// Parse binary response
			const view = new DataView(buffer);
			let offset = 0;
			const count = view.getUint32(offset, true);
			offset += 4;

			console.log(`Parsing ${count} results from ${buffer.byteLength} bytes`);

			const newResults: Array<{ id: number; category: ThingCategory }> = [];
			const newThings = new Map<string, ThingType>();

			for (let i = 0; i < count; i++) {
				const id = view.getUint32(offset, true);
				offset += 4;
				const catVal = view.getUint8(offset);
				offset += 1;

				let category: ThingCategory;
				switch (catVal) {
					case 1:
						category = ThingCategory.ITEM;
						break;
					case 2:
						category = ThingCategory.OUTFIT;
						break;
					case 3:
						category = ThingCategory.EFFECT;
						break;
					case 4:
						category = ThingCategory.MISSILE;
						break;
					default:
						category = ThingCategory.ITEM;
				}

				const width = view.getUint8(offset);
				offset += 1;
				const height = view.getUint8(offset);
				offset += 1;
				const layers = view.getUint8(offset);
				offset += 1;
				const patternX = view.getUint8(offset);
				offset += 1;
				const patternY = view.getUint8(offset);
				offset += 1;
				const patternZ = view.getUint8(offset);
				offset += 1;
				const frames = view.getUint8(offset);
				offset += 1;

				const spriteCount = view.getUint16(offset, true);
				offset += 2;

				const spriteIndex: number[] = [];
				for (let s = 0; s < spriteCount; s++) {
					spriteIndex.push(view.getUint32(offset, true));
					offset += 4;
				}

				// Create minimal ThingType for SpriteCanvas
				const thing: ThingType = {
					id,
					width,
					height,
					layers,
					frames,
					category,
					patternX,
					patternY,
					patternZ,
					offsetX: 0,
					offsetY: 0,
					spriteIndex,
					lensHelp: 0,
					cloth: false,
					elevation: 0,
					clothSlot: 0,
					loopCount: 0,
					// Defaults for required fields
					exactSize: 32,
					usable: false,
					lightLevel: 0,
					lightColor: 0,
					startFrame: 0,
					isOnTop: false,
					isFluid: false,
					miniMap: false,
					groundSpeed: 0,
					marketName: '',
					isGround: false,
					forceUse: false,
					multiUse: false,
					writable: false,
					hangable: false,
					hasLight: false,
					dontHide: false,
					miniMapColor: 0,
					marketShowAs: 0,
					stackable: false,
					maxTextLength: 0,
					rotatable: false,
					hasOffset: false,
					marketTradeAs: 0,
					defaultAction: 0,
					wrappable: false,
					topEffect: false,
					animationMode: 0,
					isOnBottom: false,
					pickupable: false,
					isVertical: false,
					isLensHelp: false,
					ignoreLook: false,
					marketCategory: 0,
					hasCharges: false,
					isContainer: false,
					floorChange: false,
					unwrappable: false,
					frameDurations: [],
					writableOnce: false,
					isUnpassable: false,
					isUnmoveable: false,
					blockMissile: false,
					isHorizontal: false,
					hasElevation: false,
					isFullGround: false,
					isMarketItem: false,
					blockPathfind: false,
					isTranslucent: false,
					isLyingObject: false,
					animateAlways: false,
					isGroundBorder: false,
					noMoveAnimation: false,
					marketRestrictLevel: 0,
					isAnimation: frames > 1,
					isFluidContainer: false,
					hasDefaultAction: false,
					marketRestrictProfession: 0
				};

				newResults.push({ id, category });
				newThings.set(`${category}-${id}`, thing);
			}

			setResultThings(newThings);
			setSearchResults(newResults);
		} catch (error) {
			console.error('Search failed with error:', error);
			setSearchResults([]);
		} finally {
			setIsSearching(false);
		}
	}, [name, properties, selectedCategory]);

	const handleSelect = useCallback(async () => {
		if (selectedResultId !== null && selectedResultCategory !== null) {
			// Emit event for main window to handle selection
			const { emit } = await import('@tauri-apps/api/event');
			await emit('select_thing', {
				id: selectedResultId,
				category: selectedResultCategory
			});

			// Also open locally in FindWindow (optional, but good for feedback)
			setOpenedItemId(selectedResultId, selectedResultCategory);
		}
	}, [selectedResultId, selectedResultCategory, setOpenedItemId]);

	const handleResultClick = useCallback((id: number, category: ThingCategory) => {
		setSelectedResultId(id);
		setSelectedResultCategory(category);
	}, []);

	// Fetch ThingType logic removed - now handled by binary search response
	useEffect(() => {
		// Only load sprites now
		const loadSprites = async () => {
			if (!data || !data.sprPath || searchResults.length === 0) return;

			const { loadSpriteIds } = await import('@/lib/tibia');
			const idsToLoad: number[] = [];

			// Collect sprite IDs from the already populated resultThings
			for (const result of searchResults) {
				const key = `${result.category}-${result.id}`;
				const thing = resultThings.get(key);
				if (thing && thing.spriteIndex) {
					for (const spriteId of thing.spriteIndex) {
						if (isValidSpriteId(spriteId, data.spritesCount)) {
							idsToLoad.push(spriteId);
						}
					}
				}
			}

			if (idsToLoad.length > 0) {
				// Load sprites in batches if needed, but loadSpriteIds handles it well
				await loadSpriteIds(data.sprPath, idsToLoad, data.transparency, data.sprites);
				notifySpritesLoaded();
			}
		};

		loadSprites();
	}, [searchResults, data, notifySpritesLoaded]); // Removed resultThings dependency to avoid loop if it changes (it's set with searchResults)

	// Initialize data from localStorage if needed (for SpriteCanvas)
	useEffect(() => {
		if (!data) {
			const datPath = localStorage.getItem('sprite-forge-dat-path');
			const sprPath = localStorage.getItem('sprite-forge-spr-path');
			const transparency = localStorage.getItem('sprite-forge-transparency') === 'true';
			const spritesCount = parseInt(localStorage.getItem('sprite-forge-sprites-count') || '0');

			if (datPath && sprPath) {
				const minimalData: any = {
					datPath,
					sprPath,
					transparency,
					items: new Map(),
					sprites: new Map(),
					outfits: new Map(),
					effects: new Map(),
					missiles: new Map(),
					version: { value: 0 },
					spritesCount: spritesCount || 999999
				};
				// Skip backend sync to avoid overwriting search data
				setData(minimalData, {} as any, true);
			}
		}
	}, [data, setData]);

	const handleClear = useCallback(() => {
		setProperties(PROPERTIES.reduce((acc, prop) => ({ ...acc, [prop.property]: false }), {}));
		setName('');
		setSearchResults([]);
		setResultThings(new Map());
		setSelectedResultId(null);
		setSelectedResultCategory(null);
	}, []);

	const handleMinimize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const appWindow = getCurrentWindow();
		await appWindow.minimize();
	};

	const handleMaximize = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const appWindow = getCurrentWindow();
		await appWindow.toggleMaximize();
	};

	const handleClose = useCallback(
		async (e?: React.MouseEvent) => {
			e?.stopPropagation();
			handleClear();
			const appWindow = getCurrentWindow();
			await appWindow.hide();
		},
		[handleClear]
	);

	// Listen for data cleared event from main window
	useEffect(() => {
		let unlisten: undefined | (() => void);

		const setupListener = async () => {
			const { listen } = await import('@tauri-apps/api/event');
			unlisten = await listen('data_cleared', () => {
				handleClose();
			});
		};

		setupListener();

		return () => {
			if (unlisten) unlisten();
		};
	}, [handleClose]);

	return (
		<div className="h-screen w-screen flex flex-col bg-background">
			<div data-tauri-drag-region className="h-8 bg-toolbar-bg border-b border-border/50 flex items-center justify-between px-4">
				<span className="text-sm font-medium">Find</span>
				<div className="flex items-center gap-1">
					<Button
						size="icon"
						variant="ghost"
						onClick={handleMinimize}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-8 w-8 hover:bg-secondary/50"
					>
						<Minus className="h-4 w-4" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						onClick={handleMaximize}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-8 w-8 hover:bg-secondary/50"
					>
						<Square className="h-3.5 w-3.5" />
					</Button>
					<Button
						size="icon"
						variant="ghost"
						onClick={handleClose}
						onMouseDown={(e) => e.stopPropagation()}
						className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<Tabs defaultValue="objects" className="flex-1 flex flex-col overflow-hidden">
				<div className="border-b border-border px-4">
					<TabsList className="h-8 bg-transparent p-0 gap-0">
						<TabsTrigger
							value="objects"
							className="h-8 px-3 text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
						>
							Objects
						</TabsTrigger>
					</TabsList>
				</div>

				<TabsContent value="objects" className="flex-1 flex overflow-hidden mt-0">
					<div className="flex-1 flex overflow-hidden">
						<div className="w-80 border-r border-border p-4 flex flex-col overflow-hidden">
							<div className="mb-4">
								<label className="text-xs font-medium mb-2 block">Category</label>
								<Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as 'all' | ThingCategory)}>
									<SelectTrigger className="h-8 text-xs">
										<SelectValue placeholder="All" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="all">All</SelectItem>
										<SelectItem value="item">Item</SelectItem>
										<SelectItem value="outfit">Outfit</SelectItem>
										<SelectItem value="effect">Effect</SelectItem>
										<SelectItem value="missile">Missile</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<ScrollArea className="flex-1 pr-2">
								<div className="space-y-2">
									{PROPERTIES.filter((prop) => {
										if (selectedCategory === 'all' || selectedCategory === 'item') return true;
										// For non-item categories, only show relevant properties
										const relevantProps = ['hasLight', 'hasOffset', 'animateAlways'];
										return relevantProps.includes(prop.property);
									}).map((prop) => (
										<div key={prop.property} className="flex items-center justify-between">
											<span className="text-xs">{prop.display}</span>
											<Switch
												checked={properties[prop.property] || false}
												onCheckedChange={() => handlePropertyToggle(prop.property)}
											/>
										</div>
									))}
								</div>
							</ScrollArea>

							<div className="mt-4 pt-4 border-t border-border">
								<label className="text-xs font-medium mb-2 block">Name:</label>
								<Input value={name} placeholder="" className="h-8 text-xs" onChange={(e) => setName(e.target.value)} />
							</div>
						</div>

						<div className="flex-1 p-4 flex flex-col">
							<div className="flex items-center justify-between mb-2">
								<div className="text-xs font-medium">Found {searchResults.length > 0 ? `(${searchResults.length})` : ''}</div>
								{searchResults.length > 0 && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button size="icon" variant="ghost" className="h-6 w-6 p-0 hover:bg-secondary">
												{viewMode === 'list' && <List className="h-3.5 w-3.5 text-muted-foreground" />}
												{viewMode === 'grid' && <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />}
												{viewMode === 'compact' && <Columns className="h-3.5 w-3.5 text-muted-foreground" />}
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
											<DropdownMenuItem onClick={() => setViewMode('compact')}>
												<Columns className="mr-2 h-4 w-4" />
												<span>Compact</span>
											</DropdownMenuItem>
											<DropdownMenuItem onClick={() => setViewMode('large')}>
												<Square className="mr-2 h-4 w-4" />
												<span>Large</span>
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
							<div className="flex-1 border border-border rounded bg-muted/20 p-2 overflow-hidden flex flex-col">
								{isSearching ? (
									<div className="text-xs text-muted-foreground p-4 text-center">Searching...</div>
								) : searchResults.length === 0 ? (
									<div className="text-xs text-muted-foreground p-4 text-center">
										{name.trim() === '' && Object.values(properties).every((v) => !v)
											? 'Enter a name or select properties to search'
											: 'No results'}
									</div>
								) : (
									<div ref={parentRef} className="h-full overflow-auto">
										<div
											style={{
												width: '100%',
												position: 'relative',
												height: `${virtualizer.getTotalSize()}px`
											}}
										>
											{virtualizer.getVirtualItems().map((virtualRow) => {
												const rowStartIndex = virtualRow.index * itemsPerRow;
												const rowEndIndex = Math.min(rowStartIndex + itemsPerRow, searchResults.length);
												const rowItems = searchResults.slice(rowStartIndex, rowEndIndex);

												return (
													<div
														key={virtualRow.index}
														data-index={virtualRow.index}
														ref={virtualizer.measureElement}
														className={cn(
															viewMode === 'list' && 'px-2',
															viewMode === 'grid' && 'px-1',
															viewMode === 'compact' && 'px-1',
															viewMode === 'large' && 'px-1'
														)}
														style={{
															top: 0,
															left: 0,
															width: '100%',
															display: 'flex',
															position: 'absolute',
															gap: viewMode === 'compact' ? '2px' : '4px',
															transform: `translateY(${virtualRow.start}px)`
														}}
													>
														{rowItems.map((result) => {
															const key = `${result.category}-${result.id}`;
															const thing = resultThings.get(key);
															const spriteId = thing?.spriteIndex?.[0];

															return (
																<div
																	key={key}
																	onClick={() => handleResultClick(result.id, result.category)}
																	style={{
																		width: viewMode === 'list' || viewMode === 'large' ? '100%' : `${100 / itemsPerRow}%`,
																		flex:
																			viewMode === 'list' || viewMode === 'large'
																				? '1'
																				: `0 0 calc(${100 / itemsPerRow}% - ${viewMode === 'compact' ? 2 : 4}px)`
																	}}
																	className={cn(
																		'text-xs rounded cursor-pointer transition-colors',
																		selectedResultId === result.id && selectedResultCategory === result.category
																			? 'bg-primary text-primary-foreground'
																			: 'hover:bg-muted',
																		viewMode === 'list' && 'p-2 flex items-center gap-2 h-10',
																		viewMode === 'grid' && 'p-1 flex items-center gap-1.5 h-[50px]',
																		viewMode === 'compact' && 'p-0.5 flex flex-col items-center gap-0.5 h-[74px]',
																		viewMode === 'large' && 'p-1 flex items-center gap-1.5 h-[140px]'
																	)}
																>
																	{spriteId && (
																		<CheckerBoard
																			className={cn(
																				'flex-shrink-0 border border-border/50 rounded overflow-hidden flex items-center justify-center',
																				viewMode === 'list' && 'w-8 h-8',
																				viewMode === 'grid' && 'w-12 h-12',
																				viewMode === 'compact' && 'w-12 h-12',
																				viewMode === 'large' && 'w-32 h-32'
																			)}
																		>
																			{thing ? (
																				<SpriteCanvas
																					showEmpty
																					thing={thing}
																					renderMode="list"
																					width={thing.width}
																					height={thing.height}
																					scale={
																						viewMode === 'list'
																							? 32 / (Math.max(thing.width, thing.height) * 32)
																							: viewMode === 'grid' || viewMode === 'compact'
																								? 48 / (Math.max(thing.width, thing.height) * 32)
																								: 128 / (Math.max(thing.width, thing.height) * 32)
																					}
																				/>
																			) : (
																				<span className="text-[8px] text-muted-foreground">{spriteId}</span>
																			)}
																		</CheckerBoard>
																	)}
																	<div
																		className={cn(
																			'min-w-0',
																			viewMode === 'list' && 'flex-1 text-left',
																			viewMode === 'grid' && 'flex-1 text-right',
																			viewMode === 'compact' && 'text-center w-full truncate',
																			viewMode === 'large' && 'flex-1 text-right'
																		)}
																	>
																		{viewMode === 'grid' || viewMode === 'large' ? (
																			<div className="text-[11px] text-foreground font-mono font-medium leading-tight">
																				{result.id}
																			</div>
																		) : viewMode === 'compact' ? (
																			<div className="text-[11px] text-foreground font-mono font-medium leading-tight">
																				{result.id}
																			</div>
																		) : (
																			<span>
																				{result.category.charAt(0).toUpperCase() + result.category.slice(1)} #{result.id}
																			</span>
																		)}
																	</div>
																</div>
															);
														})}
													</div>
												);
											})}
										</div>
									</div>
								)}
							</div>
						</div>
					</div>
				</TabsContent>
			</Tabs>

			<div className="h-12 border-t border-border flex items-center justify-between gap-2 px-4">
				<Button
					size="sm"
					variant="outline"
					onClick={handleClear}
					className="h-8 text-xs"
					disabled={name.trim() === '' && Object.values(properties).every((v) => !v) && searchResults.length === 0}
				>
					<Trash2 className="h-3.5 w-3.5 mr-1.5" />
					Clear
				</Button>
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						className="h-8 text-xs"
						disabled={isSearching || (name.trim() === '' && Object.values(properties).every((v) => !v))}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							handleFind();
						}}
					>
						{isSearching ? 'Searching...' : 'Find'}
					</Button>
					<Button size="sm" variant="outline" onClick={handleSelect} className="h-8 text-xs" disabled={selectedResultId === null}>
						Select
					</Button>
				</div>
			</div>
		</div>
	);
};
