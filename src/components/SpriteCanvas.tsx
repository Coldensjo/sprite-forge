import { cn } from '@/lib/utils';
import { logger, EventCode } from '@/lib/debug';
import { blendOutfit } from '@/lib/tibia/outfit';
import { Loader2, ImagePlus } from 'lucide-react';
import { useDragDrop } from '@/contexts/DragDropContext';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { memo, useRef, useMemo, useState, useEffect, useCallback } from 'react';
import { SPRITE_SIZE, getSpriteIndex, type ThingType, isValidSpriteId, importObjectSheet } from '@/lib/tibia';

interface SceneItem {
	id: number;
	count?: number;
}

interface SceneTile {
	items: SceneItem[];
}

interface SpriteCanvasProps {
	panX?: number;
	panY?: number;
	width?: number;
	scale?: number;
	frame?: number;
	layer?: number;
	height?: number;
	// Smoothing/blur effect (bilinear filtering like OTClient's GL_LINEAR)
	smooth?: boolean;
	spriteId?: number;
	thing?: ThingType;
	patternX?: number;
	patternY?: number;

	patternZ?: number;
	className?: string;
	showGrid?: boolean;
	showEmpty?: boolean;
	sceneWidth?: number;
	spriteIds?: number[];
	sceneHeight?: number;
	isPanEnabled?: boolean;

	showExactSize?: boolean;
	// Enable file drop functionality (only for PropertiesPanel sprite editor)
	allowFileDrop?: boolean;
	sceneScrollOffset?: number;
	// Scene preview props (for outfit scene background)
	sceneTiles?: null | SceneTile[][];
	// Pattern/Frame support for full rendering mode
	renderMode?: 'list' | 'full' | 'preview';
	onPanChange?: (x: number, y: number) => void;
	onSpriteDoubleClick?: (spriteId: number) => void;
	onSpriteHover?: (spriteId: null | number) => void;
	onMiddleMousePanChange?: (isPanning: boolean) => void;
	onSpriteDrop?: (index: number, spriteId: number | number[]) => void;
	// Outfit data for colorization and addons
	outfitData?: {
		head: number;
		body: number;
		legs: number;
		feet: number;
		addons: boolean[]; // [addon1, addon2]
	};
}

export const SpriteCanvas = memo(
	({
		thing,
		spriteId,
		panX = 0,
		panY = 0,
		spriteIds,
		width = 1,
		scale = 1,
		frame = 0,
		layer = 0,
		height = 1,
		outfitData,
		sceneTiles,
		onPanChange,
		patternX = 0,
		patternY = 0,
		patternZ = 0,
		onSpriteDrop,
		onSpriteHover,
		className = '',
		sceneWidth = 0,
		smooth = false,
		sceneHeight = 0,
		showGrid = false,
		onSpriteDoubleClick,
		renderMode = 'full',
		isPanEnabled = false,
		showExactSize = false,
		sceneScrollOffset = 0,
		allowFileDrop = false,
		onMiddleMousePanChange
	}: SpriteCanvasProps) => {
		const canvasRef = useRef<HTMLCanvasElement>(null);
		const containerRef = useRef<HTMLDivElement>(null);
		const { data, getSprite, spriteLoadVersion, notifyDataChanged, notifySpriteImport, notifySpritesLoaded } = useTibiaData();
		const { dragType, isDragging, draggedItem } = useDragDrop();
		const [isLoading, setIsLoading] = useState(false);
		const [isPanning, setIsPanning] = useState(false);
		const [panStart, setPanStart] = useState({ x: 0, y: 0 });

		// Highlight state for internal sprite-to-sprite drag and drop
		const [highlightedSlot, setHighlightedSlot] = useState<null | { x: number; y: number; w: number; h: number }>(null);
		// Hover state for visual feedback
		const [hoveredSlot, setHoveredSlot] = useState<null | { x: number; y: number; w: number; h: number }>(null);
		// File drag states for Tauri file drops
		const [isFileDragging, setIsFileDragging] = useState(false); // True when image file is being dragged in window (shows glowing border)
		const [isFileDragOver, setIsFileDragOver] = useState(false); // True when drag is over this canvas (shows overlay with icon)
		// Ref to track highlight for drop logic (persists across re-renders)
		const currentHighlightRef = useRef<null | { x: number; y: number; w: number; h: number }>(null);

		// Memoize sprite layout calculation to prevent unnecessary recalculations
		const { canvasWidth, canvasHeight, spriteLayout } = useMemo(() => {
			let canvasW: number;
			let canvasH: number;
			const layout: Array<{ x: number; y: number; layer: number; spriteId: number; patternY: number }> = [];

			if (renderMode === 'list' && thing) {
				// List mode: Always show first pattern (0,0,0), first frame (0), first layer (0)
				// Compact 32x32 preview - single texture
				canvasW = thing.width * SPRITE_SIZE;
				canvasH = thing.height * SPRITE_SIZE;

				// For Outfits, default to South direction (patternX = 2)
				// For others, default to first pattern (patternX = 0)
				const defaultPatternX = thing.category === 'outfit' && thing.patternX > 2 ? 2 : 0;

				for (let h = 0; h < thing.height; h++) {
					for (let w = 0; w < thing.width; w++) {
						const index = getSpriteIndex(thing, w, h, 0, defaultPatternX, 0, 0, 0);
						if (index < thing.spriteIndex.length) {
							// Reverse position (Tibia format)
							const posX = (thing.width - w - 1) * SPRITE_SIZE;
							const posY = (thing.height - h - 1) * SPRITE_SIZE;
							layout.push({
								x: posX,
								y: posY,
								layer: 0,
								patternY: 0,
								spriteId: thing.spriteIndex[index]
							});
						}
					}
				}
			} else if (renderMode === 'preview' && thing) {
				// Preview mode: Render specific pattern/frame configuration
				// Used for PropertiesPanel to show the current state
				// If scene is enabled for outfit, expand canvas to fit scene
				if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && thing.category === 'outfit') {
					canvasW = sceneWidth * SPRITE_SIZE;
					canvasH = sceneHeight * SPRITE_SIZE;
				} else {
					canvasW = thing.width * SPRITE_SIZE;
					canvasH = thing.height * SPRITE_SIZE;
				}

				const currentFrame = thing.frames > 1 ? frame : 0;

				// For outfits with addons, render base + all active addons stacked
				const patternYsToRender: number[] = [];

				if (thing.category === 'outfit' && outfitData) {
					// Always render base outfit (patternY = 0)
					patternYsToRender.push(0);
					// Add active addon layers if patternY > 1
					if (thing.patternY > 1 && outfitData.addons) {
						for (let i = 0; i < outfitData.addons.length && i < thing.patternY - 1; i++) {
							if (outfitData.addons[i]) {
								patternYsToRender.push(i + 1);
							}
						}
					}
				} else {
					// Default: use provided patternY
					patternYsToRender.push(patternY);
				}

				// Calculate offset to center outfit when scene is enabled
				let offsetX = 0;
				let offsetY = 0;
				if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && thing.category === 'outfit') {
					// Center outfit at the middle of the scene
					const centerTileX = Math.floor(sceneWidth / 2);
					const centerTileY = Math.floor(sceneHeight / 2);
					// Outfit position: center tile, adjusted for outfit size
					offsetX = centerTileX * SPRITE_SIZE - (thing.width - 1) * SPRITE_SIZE;
					offsetY = centerTileY * SPRITE_SIZE - (thing.height - 1) * SPRITE_SIZE;
				}

				// Render all layers for each patternY (stacked on top of each other)
				for (const py of patternYsToRender) {
					for (let l = 0; l < thing.layers; l++) {
						for (let h = 0; h < thing.height; h++) {
							for (let w = 0; w < thing.width; w++) {
								const index = getSpriteIndex(thing, w, h, l, patternX, py, patternZ, currentFrame);
								if (index < thing.spriteIndex.length) {
									const posX = (thing.width - w - 1) * SPRITE_SIZE + offsetX;
									const posY = (thing.height - h - 1) * SPRITE_SIZE + offsetY;
									layout.push({
										x: posX,
										y: posY,
										layer: l,
										patternY: py,
										spriteId: thing.spriteIndex[index]
									});
								}
							}
						}
					}
				}
			} else if (renderMode === 'full' && thing) {
				// Full mode: Render pattern grid
				// - If animated (frames > 1): Show patterns for CURRENT frame only
				// - If not animated (frames = 1): Show all patterns (frame = 0)

				// Grid dimensions
				// We stack layers on top of each other, so they don't contribute to grid size
				// We spread Pattern Z horizontally alongside Pattern X
				const cols = thing.patternX * thing.patternZ;
				const rows = thing.patternY;

				canvasW = cols * thing.width * SPRITE_SIZE;
				canvasH = rows * thing.height * SPRITE_SIZE;

				const pixelsWidth = thing.width * SPRITE_SIZE;
				const pixelsHeight = thing.height * SPRITE_SIZE;

				// Use current frame if animated, otherwise use frame 0
				const currentFrame = thing.frames > 1 ? frame : 0;

				// Loop through patterns
				for (let z = 0; z < thing.patternZ; z++) {
					for (let y = 0; y < thing.patternY; y++) {
						for (let x = 0; x < thing.patternX; x++) {
							// Calculate position in grid
							const col = x + z * thing.patternX;
							const row = y;

							const fx = col * pixelsWidth;
							const fy = row * pixelsHeight;

							// Render all layers for this pattern position (stacked)
							for (let l = 0; l < thing.layers; l++) {
								// Render sprites within this texture/layer
								for (let h = 0; h < thing.height; h++) {
									for (let w = 0; w < thing.width; w++) {
										const spriteIndex = getSpriteIndex(thing, w, h, l, x, y, z, currentFrame);

										if (spriteIndex < thing.spriteIndex.length) {
											// Reverse position within texture (Tibia format)
											const px = (thing.width - w - 1) * SPRITE_SIZE;
											const py = (thing.height - h - 1) * SPRITE_SIZE;
											const spriteId = thing.spriteIndex[spriteIndex];

											layout.push({
												spriteId,
												layer: l,
												x: px + fx,
												y: py + fy,
												patternY: y
											});
										}
									}
								}
							}
						}
					}
				}
			} else {
				// Legacy mode: Use provided spriteIds or spriteId
				const spritesToRender = spriteIds || (spriteId !== undefined ? [spriteId] : []);
				canvasW = width * SPRITE_SIZE;
				canvasH = height * SPRITE_SIZE;

				for (let y = 0; y < height; y++) {
					for (let x = 0; x < width; x++) {
						const index = y * width + x;
						if (index < spritesToRender.length) {
							const posX = (width - x - 1) * SPRITE_SIZE;
							const posY = (height - y - 1) * SPRITE_SIZE;
							layout.push({
								x: posX,
								y: posY,
								layer: 0,
								patternY: 0,
								spriteId: spritesToRender[index]
							});
						}
					}
				}
			}

			return { canvasWidth: canvasW, spriteLayout: layout, canvasHeight: canvasH };
		}, [
			thing,
			frame,
			renderMode,
			spriteId,
			spriteIds,
			width,
			height,
			patternX,
			patternY,
			patternZ,
			layer,
			outfitData,
			sceneTiles,
			sceneWidth,
			sceneHeight,
			spriteLoadVersion // Force recalculation if sprites/data reload (e.g. after import)
		]);

		// Offscreen canvas for compositing ImageData
		const offscreenCanvasRef = useRef<null | HTMLCanvasElement>(null);

		// Cached scene canvas - pre-rendered scene for performance
		const sceneCacheRef = useRef<{
			width: number;
			height: number;
			tiles: null | SceneTile[][];
			canvas: null | HTMLCanvasElement;
		}>({ width: 0, height: 0, tiles: null, canvas: null });

		// Preload sprites for scene items when scene tiles change
		useEffect(() => {
			if (!sceneTiles || !data || !data.sprPath || sceneWidth === 0 || sceneHeight === 0) return;

			const loadSceneSprites = async () => {
				// Collect all sprite IDs needed for scene items
				const spriteIds = new Set<number>();

				for (let tileY = 0; tileY < sceneHeight; tileY++) {
					for (let tileX = 0; tileX < sceneWidth; tileX++) {
						const tile = sceneTiles[tileY]?.[tileX];
						if (!tile) continue;

						for (const sceneItem of tile.items) {
							const sceneThing = data.items.get(sceneItem.id);
							if (!sceneThing) continue;

							// Collect all sprites for multi-tile items
							for (const spriteId of sceneThing.spriteIndex) {
								if (isValidSpriteId(spriteId)) {
									spriteIds.add(spriteId);
								}
							}
						}
					}
				}

				if (spriteIds.size === 0) return;

				// Filter out already loaded sprites
				const missingIds = Array.from(spriteIds).filter((id) => !data.sprites.has(id));
				if (missingIds.length === 0) return;

				// Load missing sprites
				const { loadSpriteIds } = await import('@/lib/tibia');
				await loadSpriteIds(data.sprPath, missingIds, data.transparency, data.sprites);
				notifySpritesLoaded();
			};

			loadSceneSprites();
		}, [sceneTiles, sceneWidth, sceneHeight, data, notifySpritesLoaded]);

		useEffect(() => {
			const canvas = canvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			// Initialize offscreen canvas if needed
			if (!offscreenCanvasRef.current) {
				offscreenCanvasRef.current = document.createElement('canvas');
				offscreenCanvasRef.current.width = SPRITE_SIZE;
				offscreenCanvasRef.current.height = SPRITE_SIZE;
			}
			const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
			if (!offscreenCtx) return;

			// Apply smoothing setting (bilinear filtering like OTClient's GL_LINEAR)
			ctx.imageSmoothingEnabled = smooth;
			if (smooth) {
				ctx.imageSmoothingQuality = 'high';
			}

			// Clear canvas (transparent, checkerboard shows through)
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);

			// Render scene tiles first (behind everything else) when in preview mode for outfits
			if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && renderMode === 'preview' && thing?.category === 'outfit') {
				const sceneCache = sceneCacheRef.current;
				const scenePixelWidth = sceneWidth * SPRITE_SIZE;
				const scenePixelHeight = sceneHeight * SPRITE_SIZE;

				// Check if we need to rebuild the scene cache
				const needsRebuild =
					!sceneCache.canvas ||
					sceneCache.tiles !== sceneTiles ||
					sceneCache.width !== sceneWidth ||
					sceneCache.height !== sceneHeight;

				if (needsRebuild) {
					// Create or resize cache canvas (2x size for seamless wrapping)
					if (!sceneCache.canvas) {
						sceneCache.canvas = document.createElement('canvas');
					}
					sceneCache.canvas.width = scenePixelWidth * 2;
					sceneCache.canvas.height = scenePixelHeight * 2;
					sceneCache.tiles = sceneTiles;
					sceneCache.width = sceneWidth;
					sceneCache.height = sceneHeight;

					const cacheCtx = sceneCache.canvas.getContext('2d');
					if (cacheCtx) {
						cacheCtx.clearRect(0, 0, sceneCache.canvas.width, sceneCache.canvas.height);

						// Render scene 2x2 times for seamless wrapping
						for (let repeatY = 0; repeatY < 2; repeatY++) {
							for (let repeatX = 0; repeatX < 2; repeatX++) {
								const offsetX = repeatX * scenePixelWidth;
								const offsetY = repeatY * scenePixelHeight;

								// Render all tiles
								for (let tileY = 0; tileY < sceneHeight; tileY++) {
									for (let tileX = 0; tileX < sceneWidth; tileX++) {
										const tile = sceneTiles[tileY]?.[tileX];
										if (!tile) continue;

										const drawBaseX = tileX * SPRITE_SIZE + offsetX;
										const drawBaseY = tileY * SPRITE_SIZE + offsetY;
										let elevation = 0;

										// Render items in tile stack
										for (const sceneItem of tile.items) {
											const sceneThing = data?.items.get(sceneItem.id);
											if (!sceneThing) continue;

											const itemWidth = sceneThing.width || 1;
											const itemHeight = sceneThing.height || 1;

											for (let h = 0; h < itemHeight; h++) {
												for (let w = 0; w < itemWidth; w++) {
													const spriteIdx = (itemHeight - h - 1) * itemWidth + (itemWidth - w - 1);
													const sceneSpriteId = sceneThing.spriteIndex[spriteIdx];

													if (isValidSpriteId(sceneSpriteId)) {
														const sceneSprite = getSprite(sceneSpriteId);
														if (sceneSprite && !sceneSprite.isEmpty) {
															if (!sceneSprite.imageData) {
																const imageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
																imageData.data.set(sceneSprite.rgbaPixels);
																sceneSprite.imageData = imageData;
															}
															offscreenCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
															offscreenCtx.putImageData(sceneSprite.imageData, 0, 0);

															const drawX = drawBaseX - elevation - w * SPRITE_SIZE;
															const drawY = drawBaseY - elevation - h * SPRITE_SIZE;
															cacheCtx.drawImage(offscreenCanvasRef.current!, drawX, drawY);
														}
													}
												}
											}

											if (sceneThing.elevation && sceneThing.elevation > 0) {
												elevation += sceneThing.elevation;
											}
										}
									}
								}
							}
						}
					}
				}

				// Draw from cache with scroll offset (fast!)
				if (sceneCache.canvas) {
					// Calculate scroll offset based on direction
					let scrollX = 0;
					let scrollY = 0;

					switch (patternX) {
						case 0: // North - scene scrolls down
							scrollY = -(sceneScrollOffset % scenePixelHeight);
							break;
						case 1: // East - scene scrolls left
							scrollX = sceneScrollOffset % scenePixelWidth;
							break;
						case 2: // South - scene scrolls up
							scrollY = sceneScrollOffset % scenePixelHeight;
							break;
						case 3: // West - scene scrolls right
							scrollX = -(sceneScrollOffset % scenePixelWidth);
							break;
					}

					// Normalize scroll to positive values within cache bounds
					const sourceX = ((scrollX % scenePixelWidth) + scenePixelWidth) % scenePixelWidth;
					const sourceY = ((scrollY % scenePixelHeight) + scenePixelHeight) % scenePixelHeight;

					// Draw the visible portion from cache (single drawImage call!)
					ctx.drawImage(sceneCache.canvas, sourceX, sourceY, canvasWidth, canvasHeight, 0, 0, canvasWidth, canvasHeight);
				}
			}

			if (spriteLayout.length === 0) {
				// Empty sprite - checkerboard background shows through automatically
				return;
			}

			// Track loaded vs missing sprites
			let loadedSprites = 0;
			let missingSprites = 0;

			// Special handling for Outfits with color data
			if (thing?.category === 'outfit' && outfitData && thing.layers === 2) {
				// Group sprites by PatternY first, then by position (x,y)
				// This ensures we blend Base (PatternY=0) then Addons (PatternY>0) in correct order
				const spritesByPatternAndPos = new Map<number, Map<string, { x: number; y: number; layer0?: any; layer1?: any }>>();

				// First pass: Collect and organize sprites
				for (const { layer, x: posX, y: posY, patternY, spriteId: currentSpriteId } of spriteLayout) {
					const isValid = isValidSpriteId(currentSpriteId);
					if (!isValid) {
						loadedSprites++;
						continue;
					}

					const sprite = getSprite(currentSpriteId);
					if (!sprite) {
						missingSprites++;
						continue;
					}

					if (sprite.isEmpty) {
						loadedSprites++;
						continue;
					}

					loadedSprites++;

					// OPTIMIZATION: Use pre-decompressed RGBA pixels from Rust
					// No decompression or color conversion needed - pixels are already in RGBA format
					if (!sprite.imageData) {
						const imageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
						// Direct copy - rgbaPixels is already in RGBA format
						imageData.data.set(sprite.rgbaPixels);
						sprite.imageData = imageData;
					}

					// Organize into map
					if (!spritesByPatternAndPos.has(patternY)) {
						spritesByPatternAndPos.set(patternY, new Map());
					}
					const patternGroup = spritesByPatternAndPos.get(patternY)!;
					const key = `${posX},${posY} `;

					if (!patternGroup.has(key)) {
						patternGroup.set(key, { x: posX, y: posY });
					}
					const entry = patternGroup.get(key)!;

					if (layer === 0) {
						entry.layer0 = sprite;
					} else if (layer === 1) {
						entry.layer1 = sprite;
					}
				}

				// Second pass: Render blended groups in order of PatternY
				// Sort patterns to ensure Base (0) is drawn before Addons (1, 2...)
				const sortedPatterns = Array.from(spritesByPatternAndPos.keys()).sort((a, b) => a - b);

				for (const py of sortedPatterns) {
					const patternGroup = spritesByPatternAndPos.get(py)!;

					for (const entry of patternGroup.values()) {
						// Clear offscreen canvas for this sprite
						offscreenCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
						let drawn = false;

						if (entry.layer0 && entry.layer1) {
							// Blend Base + Mask
							// Extract only color properties (head, body, legs, feet) for blending
							// Values >= 133 will be wrapped by getOutfitColor function
							const colors = {
								head: Math.max(0, Math.min(255, Math.floor(outfitData.head || 0))),
								body: Math.max(0, Math.min(255, Math.floor(outfitData.body || 0))),
								legs: Math.max(0, Math.min(255, Math.floor(outfitData.legs || 0))),
								feet: Math.max(0, Math.min(255, Math.floor(outfitData.feet || 0)))
							};
							const blendedPixels = blendOutfit(entry.layer0.imageData.data, entry.layer1.imageData.data, colors);
							const blendedImageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
							blendedImageData.data.set(blendedPixels);
							offscreenCtx.putImageData(blendedImageData, 0, 0);
							drawn = true;
						} else if (entry.layer0) {
							// Only base exists
							offscreenCtx.putImageData(entry.layer0.imageData, 0, 0);
							drawn = true;
						} else if (entry.layer1) {
							// Only mask exists (unusual, but draw it)
							offscreenCtx.putImageData(entry.layer1.imageData, 0, 0);
							drawn = true;
						}

						if (drawn) {
							// Composite onto main canvas
							ctx.drawImage(offscreenCanvasRef.current, entry.x, entry.y);
						}
					}
				}
			} else {
				// Standard Rendering
				for (const { x: posX, y: posY, spriteId: currentSpriteId } of spriteLayout) {
					const isValid = isValidSpriteId(currentSpriteId);

					if (!isValid) {
						loadedSprites++;
						continue;
					}

					const sprite = getSprite(currentSpriteId);

					if (!sprite) {
						missingSprites++;
						continue;
					}

					if (sprite.isEmpty) {
						loadedSprites++;
						continue;
					}

					loadedSprites++;

					// OPTIMIZATION: Use pre-decompressed RGBA pixels from Rust
					// No decompression or color conversion needed - pixels are already in RGBA format
					if (!sprite.imageData) {
						const imageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
						// Direct copy - rgbaPixels is already in RGBA format
						imageData.data.set(sprite.rgbaPixels);
						sprite.imageData = imageData;
					}

					// Use cached ImageData - no conversion needed
					offscreenCtx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
					offscreenCtx.putImageData(sprite.imageData, 0, 0);
					ctx.drawImage(offscreenCanvasRef.current, posX, posY);
				}
			}

			// Update loading state - only show loader if we have VALID sprites that are missing
			// Don't show loading if all sprites are invalid or loaded
			setIsLoading(missingSprites > 0 && loadedSprites === 0 && spriteLayout.length > 0);

			// Draw Grid if enabled
			if (showGrid) {
				ctx.strokeStyle = '#FF00FF'; // Magenta
				ctx.lineWidth = 1;
				ctx.beginPath();

				// Vertical lines
				for (let x = 0; x <= canvasWidth; x += SPRITE_SIZE) {
					ctx.moveTo(x, 0);
					ctx.lineTo(x, canvasHeight);
				}

				// Horizontal lines
				for (let y = 0; y <= canvasHeight; y += SPRITE_SIZE) {
					ctx.moveTo(0, y);
					ctx.lineTo(canvasWidth, y);
				}

				ctx.stroke();
			}

			// Draw Exact Size bounding box if enabled
			if (showExactSize && thing) {
				const exactSize = thing.exactSize || SPRITE_SIZE;
				ctx.strokeStyle = '#00FF00'; // Bright green
				ctx.lineWidth = 1;

				// Determine grid dimensions based on renderMode
				let cols = 1;
				let rows = 1;

				if (renderMode === 'full') {
					cols = thing.patternX * thing.patternZ;
					rows = thing.patternY;
				}

				const pixelsWidth = thing.width * SPRITE_SIZE;
				const pixelsHeight = thing.height * SPRITE_SIZE;

				for (let r = 0; r < rows; r++) {
					for (let c = 0; c < cols; c++) {
						// Calculate bottom-right of THIS cell
						const cellX = c * pixelsWidth;
						const cellY = r * pixelsHeight;

						// The box is at the bottom-right of the cell
						const x = cellX + pixelsWidth - exactSize;
						const y = cellY + pixelsHeight - exactSize;

						ctx.strokeRect(x + 0.5, y + 0.5, exactSize - 1, exactSize - 1);
					}
				}
			}

			// Log render event (only once per render to reduce spam)
			if (spriteLayout.length > 0) {
				try {
					logger.log(EventCode.CANVAS_DRAW, {
						v: spriteLoadVersion,
						loaded: loadedSprites,
						n: spriteLayout.length,
						miss: missingSprites > 0,
						ids: spriteLayout.slice(0, 3).map((s) => s.spriteId)
					});
				} catch {
					// Ignore logger errors - don't break rendering
				}
			}
		}, [
			spriteLayout,
			spriteLoadVersion,
			canvasWidth,
			canvasHeight,
			data,
			showGrid,
			showExactSize,
			thing,
			outfitData,
			renderMode,
			sceneTiles,
			sceneWidth,
			sceneHeight,
			sceneScrollOffset,
			patternX,
			getSprite,
			smooth
		]);

		const exactSizeCenter = useMemo(() => {
			// Calculate exact size center for all categories
			if (!thing) return null;

			const exactSize = thing.exactSize || SPRITE_SIZE;
			const pixelsWidth = thing.width * SPRITE_SIZE;
			const pixelsHeight = thing.height * SPRITE_SIZE;

			// Base exact size center (bottom-right of outfit area)
			let exactSizeCenterX = pixelsWidth - exactSize / 2;
			let exactSizeCenterY = pixelsHeight - exactSize / 2;

			// When scene is enabled, outfit is offset to center of scene
			// Adjust exact size center to match
			if (sceneTiles && sceneWidth > 0 && sceneHeight > 0 && thing.category === 'outfit') {
				const centerTileX = Math.floor(sceneWidth / 2);
				const centerTileY = Math.floor(sceneHeight / 2);
				const offsetX = centerTileX * SPRITE_SIZE - (thing.width - 1) * SPRITE_SIZE;
				const offsetY = centerTileY * SPRITE_SIZE - (thing.height - 1) * SPRITE_SIZE;
				exactSizeCenterX += offsetX;
				exactSizeCenterY += offsetY;
			}

			return { x: exactSizeCenterX, y: exactSizeCenterY };
		}, [thing, sceneTiles, sceneWidth, sceneHeight]);

		const handleMouseDown = useCallback(
			(e: React.MouseEvent) => {
				// Only handle panning if onPanChange is provided
				if (!onPanChange) return;

				// Check which button was pressed
				const isLeftButton = e.button === 0;
				const isMiddleButton = e.button === 1;

				// Determine if panning should be allowed
				let allowPanning = false;

				if (isMiddleButton) {
					// Middle mouse button always allows panning
					allowPanning = true;
				} else if (isLeftButton && isPanEnabled) {
					// Left button only allows panning when explicitly enabled
					allowPanning = true;
				}

				if (!allowPanning) return;

				setIsPanning(true);
				setPanStart({ x: e.clientX - panX, y: e.clientY - panY });

				// Notify parent if middle mouse button is being used
				if (isMiddleButton && onMiddleMousePanChange) {
					onMiddleMousePanChange(true);
				}

				e.preventDefault();
			},
			[onPanChange, isPanEnabled, panX, panY, onMiddleMousePanChange]
		);

		useEffect(() => {
			if (!isPanning || !onPanChange) return;

			const handleMouseMove = (e: MouseEvent) => {
				const newPanX = e.clientX - panStart.x;
				const newPanY = e.clientY - panStart.y;
				onPanChange(newPanX, newPanY);
			};

			const handleMouseUp = (e: MouseEvent) => {
				// Stop panning on any mouse button release
				const wasMiddleButton = e.button === 1;
				setIsPanning(false);

				// Notify parent if middle mouse button was released
				if (wasMiddleButton && onMiddleMousePanChange) {
					onMiddleMousePanChange(false);
				}
			};

			window.addEventListener('mousemove', handleMouseMove);
			window.addEventListener('mouseup', handleMouseUp);

			return () => {
				window.removeEventListener('mousemove', handleMouseMove);
				window.removeEventListener('mouseup', handleMouseUp);
			};
		}, [isPanning, panStart, onPanChange, panX, panY, onMiddleMousePanChange]);

		// Handle custom drag and drop (for highlighting)
		useEffect(() => {
			if (!isDragging || (dragType !== 'sprite' && dragType !== 'sprites') || !thing || !canvasRef.current || !onSpriteDrop)
				return;

			const handleGlobalMouseMove = (e: MouseEvent) => {
				const canvas = canvasRef.current;
				if (!canvas) return;

				const rect = canvas.getBoundingClientRect();

				// Check if mouse is within canvas bounds
				if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom) {
					const relX = e.clientX - rect.left;
					const relY = e.clientY - rect.top;

					// Convert to canvas coordinates
					const canvasX = relX * (canvasWidth / rect.width);
					const canvasY = relY * (canvasHeight / rect.height);

					// Calculate grid position
					const pixelsWidth = thing.width * SPRITE_SIZE;
					const pixelsHeight = thing.height * SPRITE_SIZE;

					const col = Math.floor(canvasX / pixelsWidth);
					const row = Math.floor(canvasY / pixelsHeight);

					// Calculate position within the cell
					const cellX = canvasX % pixelsWidth;
					const cellY = canvasY % pixelsHeight;

					// Snap to 32x32 grid
					const slotX = Math.floor(cellX / SPRITE_SIZE) * SPRITE_SIZE;
					const slotY = Math.floor(cellY / SPRITE_SIZE) * SPRITE_SIZE;

					const highlightX = col * pixelsWidth + slotX;
					const highlightY = row * pixelsHeight + slotY;

					const newHighlight = {
						x: highlightX,
						y: highlightY,
						w: SPRITE_SIZE,
						h: SPRITE_SIZE
					};

					currentHighlightRef.current = newHighlight;
					setHighlightedSlot(newHighlight);
				} else {
					currentHighlightRef.current = null;
					setHighlightedSlot(null);
				}
			};

			const handleGlobalMouseUp = () => {
				// If we have a highlighted slot, it means we are over a valid drop target
				if (currentHighlightRef.current) {
					// Perform drop logic
					const pixelsWidth = thing.width * SPRITE_SIZE;
					const pixelsHeight = thing.height * SPRITE_SIZE;

					const col = Math.floor(currentHighlightRef.current.x / pixelsWidth);
					const row = Math.floor(currentHighlightRef.current.y / pixelsHeight);

					const cellX = currentHighlightRef.current.x % pixelsWidth;
					const cellY = currentHighlightRef.current.y % pixelsHeight;

					const w = thing.width - 1 - Math.floor(cellX / SPRITE_SIZE);
					const h = thing.height - 1 - Math.floor(cellY / SPRITE_SIZE);

					const pY = row;
					const pZ = Math.floor(col / thing.patternX);
					const pX = col % thing.patternX;

					const currentFrame = thing.frames > 1 ? frame : 0;
					const targetLayer = layer || 0;

					const index = getSpriteIndex(thing, w, h, targetLayer, pX, pY, pZ, currentFrame);

					if (index >= 0 && index < thing.spriteIndex.length) {
						onSpriteDrop(index, draggedItem);
					}
				}
				setHighlightedSlot(null);
				currentHighlightRef.current = null;
			};

			window.addEventListener('mousemove', handleGlobalMouseMove);
			window.addEventListener('mouseup', handleGlobalMouseUp);

			return () => {
				window.removeEventListener('mousemove', handleGlobalMouseMove);
				window.removeEventListener('mouseup', handleGlobalMouseUp);
				setHighlightedSlot(null);
			};
		}, [isDragging, dragType, draggedItem, thing, canvasWidth, canvasHeight, onSpriteDrop, frame, layer]);

		// Track if current drag contains an image file (set on DRAG_ENTER, cleared on DRAG_LEAVE/DRAG_DROP)
		const isDraggingImageRef = useRef(false);

		useEffect(() => {
			const containerElement = containerRef.current;
			if (!containerElement || !allowFileDrop) return;

			const dragHasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).some((t) => t === 'Files');

			let windowDragDepth = 0;

			const onWindowDragEnter = (e: DragEvent) => {
				if (!dragHasFiles(e)) return;
				windowDragDepth++;
				if (windowDragDepth === 1) {
					isDraggingImageRef.current = true;
					setIsFileDragging(true);
				}
			};

			const onWindowDragLeave = (e: DragEvent) => {
				if (!dragHasFiles(e)) return;
				windowDragDepth--;
				if (windowDragDepth <= 0) {
					windowDragDepth = 0;
					isDraggingImageRef.current = false;
					setIsFileDragging(false);
					setIsFileDragOver(false);
				}
			};

			const onWindowDrop = () => {
				windowDragDepth = 0;
				isDraggingImageRef.current = false;
				setIsFileDragging(false);
				setIsFileDragOver(false);
			};

			const onDragOver = (e: DragEvent) => {
				if (!dragHasFiles(e)) return;
				e.preventDefault();
				e.stopPropagation();
				if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
				setIsFileDragOver(true);
			};

			const onDragLeave = (e: DragEvent) => {
				if (e.relatedTarget && containerElement.contains(e.relatedTarget as Node)) return;
				setIsFileDragOver(false);
			};

			const onDrop = async (e: DragEvent) => {
				if (!dragHasFiles(e)) return;
				e.preventDefault();
				e.stopPropagation();
				windowDragDepth = 0;
				isDraggingImageRef.current = false;
				setIsFileDragging(false);
				setIsFileDragOver(false);

				const files = Array.from(e.dataTransfer?.files ?? []);
				const imageFile = files.find((f) => /\.(png|bmp|jpg|jpeg)$/i.test(f.name));
				if (!imageFile || !thing || !data) return;

				const result = await importObjectSheet(thing, data, imageFile);
				if (result.success && result.updatedThing) {
					notifySpritesLoaded();
					if (notifyDataChanged && result.spriteIds) {
						notifyDataChanged(result.spriteIds);
					}
					notifySpriteImport();
				}
			};

			window.addEventListener('dragenter', onWindowDragEnter);
			window.addEventListener('dragleave', onWindowDragLeave);
			window.addEventListener('drop', onWindowDrop);

			containerElement.addEventListener('dragover', onDragOver);
			containerElement.addEventListener('dragleave', onDragLeave);
			containerElement.addEventListener('drop', onDrop);

			return () => {
				window.removeEventListener('dragenter', onWindowDragEnter);
				window.removeEventListener('dragleave', onWindowDragLeave);
				window.removeEventListener('drop', onWindowDrop);

				containerElement.removeEventListener('dragover', onDragOver);
				containerElement.removeEventListener('dragleave', onDragLeave);
				containerElement.removeEventListener('drop', onDrop);
			};
		}, [thing, data, allowFileDrop, notifySpritesLoaded, notifyDataChanged, notifySpriteImport]);

		const transformStyle = useMemo(() => {
			const baseStyle = {
				maxWidth: '100%',
				maxHeight: '100%',
				objectFit: 'contain' as const,
				imageRendering: 'pixelated' as const
			};

			// For list mode, don't apply pan transforms and ensure it fits
			if (renderMode === 'list') {
				// Calculate the actual rendered size
				const renderedWidth = canvasWidth * scale;
				const renderedHeight = canvasHeight * scale;

				return {
					...baseStyle,
					transform: 'none',
					width: `${renderedWidth} px`,
					height: `${renderedHeight} px`,
					// Ensure it never exceeds container
					boxSizing: 'border-box' as const
				};
			}

			// For preview mode, always center by exact size if available
			// Remove maxWidth/maxHeight constraints so sprites render at natural size
			if (renderMode === 'preview' && exactSizeCenter) {
				const canvasCenterX = canvasWidth / 2;
				const canvasCenterY = canvasHeight / 2;

				const offsetX = canvasCenterX - exactSizeCenter.x;
				const offsetY = canvasCenterY - exactSizeCenter.y;

				return {
					width: `${canvasWidth}px`,
					height: `${canvasHeight}px`,
					imageRendering: 'pixelated' as const,
					transformOrigin: `${exactSizeCenter.x}px ${exactSizeCenter.y}px`,
					transform: `translate(${panX}px, ${panY}px) translate(${offsetX}px, ${offsetY}px) scale(${scale})`
				};
			}

			// Full mode (items, effects): center on entire grid
			return {
				...baseStyle,
				width: `${canvasWidth}px`,
				height: `${canvasHeight}px`,
				transformOrigin: 'center center',
				transform: `translate(${panX}px, ${panY}px) scale(${scale})`
			};
		}, [canvasWidth, canvasHeight, scale, exactSizeCenter, panX, panY, renderMode]);

		// Drag and Drop handlers for internal sprite-to-sprite drops
		// File drops are handled by Tauri's native events (see useEffect above)
		const handleDragEnter = (e: React.DragEvent) => {
			// File drops are handled by Tauri native events, not HTML5
			if (e.dataTransfer.types.includes('Files')) {
				return;
			}
		};

		const handleDragOver = (e: React.DragEvent) => {
			// File drops are handled by Tauri native events, not HTML5
			if (e.dataTransfer.types.includes('Files')) {
				return;
			}

			if (!onSpriteDrop || !thing || !canvasRef.current) {
				// console.log('DragOver blocked:', { thing: !!thing, canvas: !!canvasRef.current, onSpriteDrop: !!onSpriteDrop });
				return;
			}
			e.preventDefault();
			e.dataTransfer.dropEffect = 'copy';
			// console.log('DragOver allowed');

			const canvas = canvasRef.current;
			const rect = canvas.getBoundingClientRect();
			const relX = e.clientX - rect.left;
			const relY = e.clientY - rect.top;

			// Convert to canvas coordinates
			const canvasX = relX * (canvasWidth / rect.width);
			const canvasY = relY * (canvasHeight / rect.height);

			// Check bounds
			if (canvasX < 0 || canvasX >= canvasWidth || canvasY < 0 || canvasY >= canvasHeight) {
				setHighlightedSlot(null);
				return;
			}

			// Calculate grid position
			const pixelsWidth = thing.width * SPRITE_SIZE;
			const pixelsHeight = thing.height * SPRITE_SIZE;

			const col = Math.floor(canvasX / pixelsWidth);
			const row = Math.floor(canvasY / pixelsHeight);

			// Calculate position within the cell
			const cellX = canvasX % pixelsWidth;
			const cellY = canvasY % pixelsHeight;

			// Snap to 32x32 grid
			const slotX = Math.floor(cellX / SPRITE_SIZE) * SPRITE_SIZE;
			const slotY = Math.floor(cellY / SPRITE_SIZE) * SPRITE_SIZE;

			const highlightX = col * pixelsWidth + slotX;
			const highlightY = row * pixelsHeight + slotY;

			setHighlightedSlot({
				x: highlightX,
				y: highlightY,
				w: SPRITE_SIZE,
				h: SPRITE_SIZE
			});
		};

		const handleDragLeave = () => {
			setHighlightedSlot(null);
		};

		const handleMouseDoubleClick = useCallback(
			(e: React.MouseEvent) => {
				if (!onSpriteDoubleClick || !thing) return;

				const rect = (e.target as HTMLElement).getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;

				const canvasX = x * (canvasWidth / rect.width);
				const canvasY = y * (canvasHeight / rect.height);

				const clickedSprite = spriteLayout.find((s) => {
					return canvasX >= s.x && canvasX < s.x + SPRITE_SIZE && canvasY >= s.y && canvasY < s.y + SPRITE_SIZE;
				});

				if (clickedSprite) {
					onSpriteDoubleClick(clickedSprite.spriteId);
				}
			},
			[onSpriteDoubleClick, thing, spriteLayout, canvasWidth, canvasHeight]
		);

		const handleMouseMove = useCallback(
			(e: React.MouseEvent) => {
				if (isDragging) return;
				if (!onSpriteHover || !thing) return;

				const rect = (e.target as HTMLElement).getBoundingClientRect();
				const x = e.clientX - rect.left;
				const y = e.clientY - rect.top;

				// Map visual coordinates to canvas coordinates
				// This works regardless of how the canvas is scaled or transformed
				const canvasX = x * (canvasWidth / rect.width);
				const canvasY = y * (canvasHeight / rect.height);

				const hoveredSprite = spriteLayout.find((s) => {
					return canvasX >= s.x && canvasX < s.x + SPRITE_SIZE && canvasY >= s.y && canvasY < s.y + SPRITE_SIZE;
				});

				if (hoveredSprite) {
					onSpriteHover(hoveredSprite.spriteId);
					setHoveredSlot({
						w: SPRITE_SIZE,
						h: SPRITE_SIZE,
						x: hoveredSprite.x,
						y: hoveredSprite.y
					});
				} else {
					onSpriteHover(null);
					setHoveredSlot(null);
				}
			},
			[onSpriteHover, thing, spriteLayout, canvasWidth, canvasHeight]
		);

		const handleMouseLeave = useCallback(() => {
			if (onSpriteHover) {
				onSpriteHover(null);
			}
			setHoveredSlot(null);
		}, [onSpriteHover]);

		const handleDrop = async (e: React.DragEvent) => {
			// File drops are now handled by Tauri's native drag-drop events (see useEffect above)
			// This allows file drops to work on Windows where HTML5 dataTransfer.files is empty
			// Only handle internal sprite-to-sprite drops here
			if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
				// Ignore - handled by Tauri event listener
				e.preventDefault();
				return;
			}

			if (!onSpriteDrop || !thing || !canvasRef.current || !highlightedSlot) return;
			e.preventDefault();
			setHighlightedSlot(null);

			let spriteIdStr = e.dataTransfer.getData('application/x-sprite-id');
			if (!spriteIdStr) {
				spriteIdStr = e.dataTransfer.getData('text/plain');
			}
			if (!spriteIdStr) return;

			const newSpriteId = parseInt(spriteIdStr, 10);
			if (isNaN(newSpriteId)) return;

			// Recalculate position (reuse logic or trust highlightedSlot if we want, but better to recalculate for safety)
			// Actually we can reverse map from highlightedSlot
			const pixelsWidth = thing.width * SPRITE_SIZE;
			const pixelsHeight = thing.height * SPRITE_SIZE;

			const col = Math.floor(highlightedSlot.x / pixelsWidth);
			const row = Math.floor(highlightedSlot.y / pixelsHeight);

			const cellX = highlightedSlot.x % pixelsWidth;
			const cellY = highlightedSlot.y % pixelsHeight;

			// Reverse map to Tibia coordinates
			// cellX = (width - w - 1) * 32
			// cellX / 32 = width - w - 1
			// w = width - 1 - cellX / 32
			const w = thing.width - 1 - Math.floor(cellX / SPRITE_SIZE);
			const h = thing.height - 1 - Math.floor(cellY / SPRITE_SIZE);

			// Pattern coordinates
			let pX, pY, pZ;

			if (renderMode === 'preview') {
				pX = patternX || 0;
				pY = patternY || 0;
				pZ = patternZ || 0;
			} else {
				// Full mode: calculate from grid position
				// col = x + z * patternX
				pY = row;
				pZ = Math.floor(col / thing.patternX);
				pX = col % thing.patternX;
			}

			const currentFrame = thing.frames > 1 ? frame : 0;

			// Use current layer (default to 0 if not specified)
			// In full mode, we see all layers, but usually edit the "current" one or top one.
			// We'll use the passed layer prop.
			const targetLayer = layer || 0;

			const index = getSpriteIndex(thing, w, h, targetLayer, pX, pY, pZ, currentFrame);

			if (index >= 0 && index < thing.spriteIndex.length) {
				onSpriteDrop(index, newSpriteId);
			}
		};

		// Overlay canvas for highlight rendering
		const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

		// Effect to draw highlight on overlay canvas
		useEffect(() => {
			const canvas = overlayCanvasRef.current;
			if (!canvas) return;

			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			// Clear overlay canvas
			ctx.clearRect(0, 0, canvasWidth, canvasHeight);

			// Draw Hover effect
			if (hoveredSlot) {
				ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
				ctx.fillRect(hoveredSlot.x, hoveredSlot.y, hoveredSlot.w, hoveredSlot.h);
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
				ctx.lineWidth = 1;
				ctx.strokeRect(hoveredSlot.x, hoveredSlot.y, hoveredSlot.w, hoveredSlot.h);
			}

			// Draw Highlight if enabled
			if (highlightedSlot) {
				ctx.fillStyle = 'rgba(250, 204, 21, 0.3)'; // yellow-400 with 0.3 opacity
				ctx.strokeStyle = '#facc15'; // yellow-400
				ctx.lineWidth = 2;

				ctx.fillRect(highlightedSlot.x, highlightedSlot.y, highlightedSlot.w, highlightedSlot.h);
				ctx.strokeRect(highlightedSlot.x, highlightedSlot.y, highlightedSlot.w, highlightedSlot.h);
			}
		}, [highlightedSlot, hoveredSlot, canvasWidth, canvasHeight]);

		return (
			<div
				ref={containerRef}
				onDrop={handleDrop}
				onDragOver={handleDragOver}
				onDragEnter={handleDragEnter}
				onDragLeave={handleDragLeave}
				style={{ cursor: isPanning ? 'grabbing' : onPanChange && (isPanEnabled || isPanning) ? 'grab' : 'default' }}
				className={cn(
					'relative flex items-center justify-center',
					// Ensure it fills the parent (CheckerBoard)
					'w-full h-full'
				)}
			>
				<div className="relative" style={transformStyle}>
					<canvas
						ref={canvasRef}
						width={canvasWidth}
						height={canvasHeight}
						className={cn(className, 'block w-full h-full')}
						style={{
							// OTClient's GL_LINEAR = bilinear interpolation when scaling
							// 'auto' enables browser's smooth scaling, 'pixelated' keeps sharp pixels
							imageRendering: smooth ? 'auto' : 'pixelated'
						}}
					/>
					<canvas
						width={canvasWidth}
						height={canvasHeight}
						ref={overlayCanvasRef}
						onMouseMove={handleMouseMove}
						onMouseDown={handleMouseDown}
						onMouseLeave={handleMouseLeave}
						onDoubleClick={handleMouseDoubleClick}
						className="absolute inset-0 w-full h-full"
						style={{ imageRendering: smooth ? 'auto' : 'pixelated' }}
						onContextMenu={(e) => {
							// Prevent context menu on middle mouse button
							if (e.button === 1) {
								e.preventDefault();
							}
						}}
					/>
				</div>
				{isLoading && renderMode !== 'list' && (
					<div
						className="absolute inset-0 flex items-center justify-center bg-black/20"
						style={{
							width: `${canvasWidth * scale} px`,
							height: `${canvasHeight * scale} px`
						}}
					>
						<Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
					</div>
				)}
				{/* Glowing border when dragging image file into window (not yet over canvas) */}
				{isFileDragging && !isFileDragOver && allowFileDrop && (
					<div className="absolute inset-0 z-10 pointer-events-none rounded-lg border-2 border-primary animate-pulse shadow-[0_0_20px_rgba(59,130,246,0.5)]" />
				)}
				{/* Full overlay when dragging over this canvas */}
				{isFileDragOver && (
					<div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/20 backdrop-blur-[1px] z-10 pointer-events-none rounded-lg border-2 border-dashed border-primary">
						<ImagePlus className="w-12 h-12 text-primary mb-2" />
						<span className="text-primary font-medium text-sm">Drop image to import</span>
					</div>
				)}
			</div>
		);
	}
);
