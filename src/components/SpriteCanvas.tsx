import { useEffect, useRef, useState, useMemo } from 'react';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { decompressPixels, SPRITE_SIZE, isValidSpriteId, getSpriteIndex, getTextureIndex, type ThingType } from '@/lib/tibia';
import { blendOutfit } from '@/lib/tibia/outfit';
import { logger, EventCode } from '@/lib/debug';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpriteCanvasProps {
  spriteId?: number;
  spriteIds?: number[];
  width?: number;
  height?: number;
  scale?: number;
  panX?: number;
  panY?: number;
  onPanChange?: (x: number, y: number) => void;
  className?: string;
  showEmpty?: boolean;
  showGrid?: boolean;
  showExactSize?: boolean;

  // Pattern/Frame support for full rendering mode
  renderMode?: 'list' | 'full' | 'preview';
  thing?: ThingType;
  patternX?: number;
  patternY?: number;
  patternZ?: number;
  frame?: number;
  layer?: number;

  // Outfit data for colorization and addons
  outfitData?: {
    head: number;
    body: number;
    legs: number;
    feet: number;
    addons: boolean[]; // [addon1, addon2]
  };
}

export const SpriteCanvas = ({
  spriteId,
  spriteIds,
  width = 1,
  height = 1,
  scale = 1,
  panX = 0,
  panY = 0,
  onPanChange,
  className = '',
  showEmpty = false,
  showGrid = false,
  showExactSize = false,
  renderMode = 'full',
  thing,
  patternX = 0,
  patternY = 0,
  patternZ = 0,
  frame = 0,
  layer = 0,
  outfitData,
}: SpriteCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getSprite, spriteLoadVersion, data } = useTibiaData();
  const [isLoading, setIsLoading] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Memoize sprite layout calculation to prevent unnecessary recalculations
  const { canvasWidth, canvasHeight, spriteLayout } = useMemo(() => {
    let canvasW: number;
    let canvasH: number;
    const layout: Array<{ spriteId: number; x: number; y: number; layer: number; patternY: number }> = [];

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
              spriteId: thing.spriteIndex[index],
              x: posX,
              y: posY,
              layer: 0,
              patternY: 0
            });
          }
        }
      }
    } else if (renderMode === 'preview' && thing) {
      // Preview mode: Render specific pattern/frame configuration
      // Used for PropertiesPanel to show the current state
      canvasW = thing.width * SPRITE_SIZE;
      canvasH = thing.height * SPRITE_SIZE;

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

      // Render all layers for each patternY (stacked on top of each other)
      for (const py of patternYsToRender) {
        for (let l = 0; l < thing.layers; l++) {
          for (let h = 0; h < thing.height; h++) {
            for (let w = 0; w < thing.width; w++) {
              const index = getSpriteIndex(thing, w, h, l, patternX, py, patternZ, currentFrame);
              if (index < thing.spriteIndex.length) {
                const posX = (thing.width - w - 1) * SPRITE_SIZE;
                const posY = (thing.height - h - 1) * SPRITE_SIZE;
                layout.push({
                  spriteId: thing.spriteIndex[index],
                  x: posX,
                  y: posY,
                  layer: l,
                  patternY: py
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

      canvasW = (cols * thing.width) * SPRITE_SIZE;
      canvasH = (rows * thing.height) * SPRITE_SIZE;

      const pixelsWidth = thing.width * SPRITE_SIZE;
      const pixelsHeight = thing.height * SPRITE_SIZE;

      // Use current frame if animated, otherwise use frame 0
      const currentFrame = thing.frames > 1 ? frame : 0;

      // Loop through patterns
      for (let z = 0; z < thing.patternZ; z++) {
        for (let y = 0; y < thing.patternY; y++) {
          for (let x = 0; x < thing.patternX; x++) {

            // Calculate position in grid
            const col = x + (z * thing.patternX);
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
                      x: px + fx,
                      y: py + fy,
                      layer: l,
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
              spriteId: spritesToRender[index],
              x: posX,
              y: posY,
              layer: 0,
              patternY: 0
            });
          }
        }
      }
    }

    return { canvasWidth: canvasW, canvasHeight: canvasH, spriteLayout: layout };
  }, [thing, frame, renderMode, spriteId, spriteIds, width, height, patternX, patternY, patternZ, layer, outfitData]);

  // Offscreen canvas for compositing ImageData
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

    // Clear canvas (transparent, checkerboard shows through)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

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
      const spritesByPatternAndPos = new Map<number, Map<string, { x: number, y: number, layer0?: any, layer1?: any }>>();

      // First pass: Collect and organize sprites
      for (const { spriteId: currentSpriteId, x: posX, y: posY, layer, patternY } of spriteLayout) {
        const isValid = isValidSpriteId(currentSpriteId, data?.spritesCount);
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

        // OPTIMIZATION: Decompress and cache ImageData only ONCE
        if (!sprite.pixels) {
          sprite.pixels = decompressPixels(sprite.compressedPixels, sprite.transparent);
        }

        // OPTIMIZATION: Cache ImageData permanently
        if (!sprite.imageData) {
          const imageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
          const pixels = sprite.pixels;
          for (let i = 0; i < SPRITE_SIZE * SPRITE_SIZE; i++) {
            const dstOffset = i * 4;
            imageData.data[dstOffset] = pixels[i * 4 + 1];     // R
            imageData.data[dstOffset + 1] = pixels[i * 4 + 2]; // G
            imageData.data[dstOffset + 2] = pixels[i * 4 + 3]; // B
            imageData.data[dstOffset + 3] = pixels[i * 4];     // A
          }
          sprite.imageData = imageData;
        }

        // Organize into map
        if (!spritesByPatternAndPos.has(patternY)) {
          spritesByPatternAndPos.set(patternY, new Map());
        }
        const patternGroup = spritesByPatternAndPos.get(patternY)!;
        const key = `${posX},${posY}`;

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
            const blendedPixels = blendOutfit(
              entry.layer0.imageData.data,
              entry.layer1.imageData.data,
              colors
            );
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
      for (const { spriteId: currentSpriteId, x: posX, y: posY } of spriteLayout) {
        const isValid = isValidSpriteId(currentSpriteId, data?.spritesCount);

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

        // OPTIMIZATION: Decompress and create ImageData only ONCE per sprite
        // This is cached forever and never recreated (Object Builder pattern)
        if (!sprite.pixels) {
          sprite.pixels = decompressPixels(sprite.compressedPixels, sprite.transparent);
        }

        // OPTIMIZATION: Cache ImageData permanently - never recreate it
        if (!sprite.imageData) {
          const imageData = offscreenCtx.createImageData(SPRITE_SIZE, SPRITE_SIZE);
          const pixels = sprite.pixels;

          // Convert ARGB to RGBA once and cache forever
          for (let i = 0; i < SPRITE_SIZE * SPRITE_SIZE; i++) {
            const dstOffset = i * 4;
            imageData.data[dstOffset] = pixels[i * 4 + 1];     // R
            imageData.data[dstOffset + 1] = pixels[i * 4 + 2]; // G
            imageData.data[dstOffset + 2] = pixels[i * 4 + 3]; // B
            imageData.data[dstOffset + 3] = pixels[i * 4];     // A
          }

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
          ids: spriteLayout.slice(0, 3).map(s => s.spriteId),
          n: spriteLayout.length,
          miss: missingSprites > 0,
          loaded: loadedSprites,
          v: spriteLoadVersion
        });
      } catch (e) {
        // Ignore logger errors - don't break rendering
      }
    }
  }, [spriteLayout, spriteLoadVersion, canvasWidth, canvasHeight, data, showGrid, showExactSize, thing, outfitData, renderMode]);

  const exactSizeCenter = useMemo(() => {
    if (!thing || renderMode !== 'preview') return null;

    const exactSize = thing.exactSize || SPRITE_SIZE;
    const pixelsWidth = thing.width * SPRITE_SIZE;
    const pixelsHeight = thing.height * SPRITE_SIZE;

    const exactSizeCenterX = pixelsWidth - exactSize / 2;
    const exactSizeCenterY = pixelsHeight - exactSize / 2;

    return { x: exactSizeCenterX, y: exactSizeCenterY };
  }, [thing, renderMode]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || !onPanChange) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
    e.preventDefault();
  };

  useEffect(() => {
    if (!isPanning || !onPanChange) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPanX = e.clientX - panStart.x;
      const newPanY = e.clientY - panStart.y;
      onPanChange(newPanX, newPanY);
    };

    const handleMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, panStart, onPanChange, panX, panY]);

  const transformStyle = useMemo(() => {
    const baseStyle = {
      imageRendering: 'pixelated' as const,
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain' as const,
    };

    // For list mode, don't apply pan transforms and ensure it fits
    if (renderMode === 'list') {
      // Calculate the actual rendered size
      const renderedWidth = canvasWidth * scale;
      const renderedHeight = canvasHeight * scale;

      return {
        ...baseStyle,
        width: `${renderedWidth}px`,
        height: `${renderedHeight}px`,
        transform: 'none',
        // Ensure it never exceeds container
        boxSizing: 'border-box' as const,
      };
    }

    // For preview mode, always center by exact size if available
    if (renderMode === 'preview' && exactSizeCenter) {
      const canvasCenterX = canvasWidth / 2;
      const canvasCenterY = canvasHeight / 2;

      const offsetX = (canvasCenterX - exactSizeCenter.x);
      const offsetY = (canvasCenterY - exactSizeCenter.y);

      return {
        ...baseStyle,
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        transform: `translate(${panX}px, ${panY}px) translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        transformOrigin: `${exactSizeCenter.x}px ${exactSizeCenter.y}px`,
      };
    }

    if (!exactSizeCenter || scale === 1) {
      return {
        ...baseStyle,
        width: `${canvasWidth * scale}px`,
        height: `${canvasHeight * scale}px`,
        transform: `translate(${panX}px, ${panY}px)`,
      };
    }

    const canvasCenterX = canvasWidth / 2;
    const canvasCenterY = canvasHeight / 2;

    const offsetX = (canvasCenterX - exactSizeCenter.x);
    const offsetY = (canvasCenterY - exactSizeCenter.y);

    return {
      ...baseStyle,
      width: `${canvasWidth}px`,
      height: `${canvasHeight}px`,
      transform: `translate(${panX}px, ${panY}px) translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
      transformOrigin: `${exactSizeCenter.x}px ${exactSizeCenter.y}px`,
    };
  }, [canvasWidth, canvasHeight, scale, exactSizeCenter, panX, panY, renderMode]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-block",
        renderMode === 'list' && "w-full h-full flex items-center justify-center overflow-hidden"
      )}
      onMouseDown={handleMouseDown}
      style={{ cursor: isPanning ? 'grabbing' : onPanChange ? 'grab' : 'default' }}
    >
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className={cn(className, renderMode === 'list' && "block")}
        style={transformStyle}
      />
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-black/20"
          style={{
            width: `${canvasWidth * scale}px`,
            height: `${canvasHeight * scale}px`,
          }}
        >
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
};
