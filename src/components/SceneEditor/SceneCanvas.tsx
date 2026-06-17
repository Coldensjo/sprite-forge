import { memo, useRef, useEffect } from 'react';
import { SPRITE_SIZE, isValidSpriteId } from '@/lib/formats/tibia';
import { useAssetData } from '@/usecase/context/AssetDataContext';

// Collect all sprite IDs needed for scene items
function collectSceneSpriteIds(
	tiles: SceneTile[][],
	items: Map<number, { spriteIndex: number[] }>,
	spritesCount?: number
): number[] {
	const spriteIds = new Set<number>();

	for (const row of tiles) {
		if (!row) continue;
		for (const tile of row) {
			if (!tile) continue;
			for (const sceneItem of tile.items) {
				const thing = items.get(sceneItem.id);
				if (!thing) continue;
				// Collect first sprite (for simple rendering)
				const spriteId = thing.spriteIndex[0];
				if (isValidSpriteId(spriteId)) {
					spriteIds.add(spriteId);
				}
			}
		}
	}

	return Array.from(spriteIds);
}

interface SceneItem {
	id: number; // Client ID
	count?: number;
}

interface SceneTile {
	items: SceneItem[];
}

interface SceneCanvasProps {
	width: number;
	height: number;
	scale?: number;
	tiles: SceneTile[][];
	onTileClick?: (x: number, y: number) => void;
}

export const SceneCanvas = memo(({ width, tiles, height, scale = 1, onTileClick }: SceneCanvasProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const { data, getSprite, notifySpritesLoaded } = useAssetData();
	const offscreenCanvasRef = useRef<null | HTMLCanvasElement>(null);

	// Preload sprites for all items in the scene
	useEffect(() => {
		if (!data || !data.sprPath || tiles.length === 0) return;

		const loadSceneSprites = async () => {
			const spriteIds = collectSceneSpriteIds(tiles, data.items, data.spritesCount);
			if (spriteIds.length === 0) return;

			// Filter out already loaded sprites
			const missingIds = spriteIds.filter((id) => !data.sprites.has(id));
			if (missingIds.length === 0) return;

			// Load missing sprites
			const { loadSpriteIds } = await import('@/lib/formats/tibia');
			await loadSpriteIds(data.sprPath, missingIds, data.transparency, data.sprites);
			notifySpritesLoaded();
		};

		loadSceneSprites();
	}, [data, tiles, notifySpritesLoaded]);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Initialize offscreen canvas
		if (!offscreenCanvasRef.current) {
			offscreenCanvasRef.current = document.createElement('canvas');
			offscreenCanvasRef.current.width = SPRITE_SIZE;
			offscreenCanvasRef.current.height = SPRITE_SIZE;
		}
		const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
		if (!offscreenCtx) return;

		// Clear canvas
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.imageSmoothingEnabled = false;

		// Render tiles
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const tile = tiles[y]?.[x];
				if (!tile) continue;

				const posX = x * SPRITE_SIZE * scale;
				const posY = y * SPRITE_SIZE * scale;

				// Draw grid background
				ctx.strokeStyle = '#333';
				ctx.strokeRect(posX, posY, SPRITE_SIZE * scale, SPRITE_SIZE * scale);

				let elevation = 0;

				// Render items in stack
				tile.items.forEach((item) => {
					const thing = data?.items.get(item.id);
					if (!thing) return;

					// Simple rendering of first sprite of the item
					// TODO: Handle multi-sprite items, animations, etc.
					const spriteIndex = thing.spriteIndex[0];
					if (isValidSpriteId(spriteIndex)) {
						const sprite = getSprite(spriteIndex);
						if (sprite && !sprite.isEmpty) {
							if (!sprite.imageData) {
								const imageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
								imageData.data.set(sprite.rgbaPixels);
								sprite.imageData = imageData;
							}
							offscreenCtx.putImageData(sprite.imageData, 0, 0);

							// Apply elevation offset (up and left)
							const drawX = posX - elevation * scale;
							const drawY = posY - elevation * scale;

							ctx.drawImage(offscreenCanvasRef.current, drawX, drawY, SPRITE_SIZE * scale, SPRITE_SIZE * scale);
						}
					}

					if (thing.elevation > 0) {
						elevation += thing.elevation;
					}
				});
			}
		}
	}, [width, height, tiles, scale, data, getSprite]);

	const isDrawingRef = useRef(false);
	const lastPaintedTileRef = useRef<null | { x: number; y: number }>(null);

	const paintTile = (clientX: number, clientY: number) => {
		if (!onTileClick || !canvasRef.current) return;

		const rect = canvasRef.current.getBoundingClientRect();
		const x = Math.floor((clientX - rect.left) / (SPRITE_SIZE * scale));
		const y = Math.floor((clientY - rect.top) / (SPRITE_SIZE * scale));

		if (x >= 0 && x < width && y >= 0 && y < height) {
			// Only paint if it's a different tile than the last one we painted in this stroke
			if (!lastPaintedTileRef.current || lastPaintedTileRef.current.x !== x || lastPaintedTileRef.current.y !== y) {
				onTileClick(x, y);
				lastPaintedTileRef.current = { x, y };
			}
		}
	};

	const handleMouseDown = (e: React.MouseEvent) => {
		isDrawingRef.current = true;
		lastPaintedTileRef.current = null; // Reset for new stroke
		paintTile(e.clientX, e.clientY);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		if (isDrawingRef.current) {
			paintTile(e.clientX, e.clientY);
		}
	};

	const handleMouseUp = () => {
		isDrawingRef.current = false;
		lastPaintedTileRef.current = null;
	};

	const handleMouseLeave = () => {
		isDrawingRef.current = false;
		lastPaintedTileRef.current = null;
	};

	return (
		<canvas
			ref={canvasRef}
			onMouseUp={handleMouseUp}
			onMouseDown={handleMouseDown}
			onMouseMove={handleMouseMove}
			onMouseLeave={handleMouseLeave}
			width={width * SPRITE_SIZE * scale}
			height={height * SPRITE_SIZE * scale}
			className="border border-border bg-background"
		/>
	);
});
