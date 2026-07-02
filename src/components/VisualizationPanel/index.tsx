import { useMemo, useEffect } from 'react';
import { Play, Pause, FileQuestion } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Button } from '~/components/ui/button';
import { loadSprites } from '~/lib/formats/sprites';
import { DragHandleProps } from '~/usecase/util/dock';
import { CheckerBoard } from '~/components/CheckerBoard';
import { getCategoryRenderConfig } from '~/lib/formats/tibia';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { useAnimation } from '~/usecase/context/AnimationContext';
import { useAssetData } from '~/usecase/context/AssetDataContext';

export const VisualizationPanel = ({ dragHandle }: { dragHandle?: DragHandleProps }) => {
	const { data, getThing, formatConfig, selectedCategory, highlightedItemId, notifySpritesLoaded } = useAssetData();
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};
	const item = highlightedItemId ? getThing(highlightedItemId, selectedCategory) : null;

	const { isPlaying, currentFrame, setPlaying: setIsPlaying } = useAnimation();

	useEffect(() => {
		if (!data?.sprPath || !item) return;

		const spriteIds = new Set<number>();
		for (const id of item.spriteIndex ?? []) {
			if (id > 0 && !data.sprites.has(id)) spriteIds.add(id);
		}
		if (item.frameGroupsData) {
			for (const group of item.frameGroupsData) {
				for (const id of group.spriteIndex ?? []) {
					if (id > 0 && !data.sprites.has(id)) spriteIds.add(id);
				}
			}
		}

		if (spriteIds.size === 0) return;

		loadSprites(data, Array.from(spriteIds)).then(() => {
			notifySpritesLoaded();
		});
	}, [highlightedItemId, item, data, notifySpritesLoaded]);

	const itemRenderConfig = useMemo(
		() => (item ? getCategoryRenderConfig(formatConfig, item.category) : undefined),
		[item, formatConfig]
	);

	const animationInfo = useMemo(() => {
		if (!item) return null;

		if (itemRenderConfig?.frameGroups && item.frameGroupsData && item.frameGroupsData.length > 1) {
			const walkingGroup = item.frameGroupsData[1];
			if (walkingGroup && walkingGroup.frames > 1) {
				return { index: 1, group: walkingGroup };
			}
		}

		const idleGroup = item.frameGroupsData?.[0];
		if (idleGroup && idleGroup.frames > 1) {
			return { index: 0, group: idleGroup };
		}

		if (item.frames > 1) {
			return { index: -1, group: null };
		}

		return null;
	}, [item, itemRenderConfig]);
	const hasAnimation = animationInfo !== null;

	const displayThing = useMemo(() => {
		if (!item) return null;

		if (animationInfo?.group && animationInfo.index >= 0) {
			const group = animationInfo.group;
			return {
				...item,
				width: group.width,
				height: group.height,
				frames: group.frames,
				layers: group.layers,
				patternX: group.patternX,
				patternY: group.patternY,
				patternZ: group.patternZ,
				spriteIndex: group.spriteIndex
			};
		}

		return item;
	}, [item, animationInfo]);

	useEffect(() => {
		if (item && hasAnimation) {
			const timer = setTimeout(() => {
				setIsPlaying(true);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [item, hasAnimation]);

	const handlePlayPause = () => {
		setIsPlaying(!isPlaying);
	};

	if (!data || !item) {
		return (
			<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
				<div
					{...handleProps}
					className={cn(
						'h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0',
						dragHandle && 'cursor-grab active:cursor-grabbing'
					)}
				>
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Visualization</h2>
				</div>
				<div className="flex-1 flex items-center justify-center p-4 min-h-0">
					<div className="text-center text-muted-foreground">
						<FileQuestion className="h-16 w-16 mx-auto mb-3 opacity-50" />
						<p className="text-xs">No item selected</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-full bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
			<div
				{...handleProps}
				className={cn(
					'h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0',
					dragHandle && 'cursor-grab active:cursor-grabbing'
				)}
			>
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Visualization</h2>
			</div>
			<div className="flex-1 min-h-0 p-2 relative">
				<CheckerBoard className="w-full h-full border border-border/50 rounded-lg flex items-center justify-center overflow-hidden">
					{displayThing?.spriteIndex && displayThing.spriteIndex.length > 0 ? (
						<SpriteCanvas
							scale={1}
							showEmpty
							layer={0}
							patternY={0}
							patternZ={0}
							frame={currentFrame}
							thing={displayThing}
							renderMode="preview"
							width={displayThing.width}
							height={displayThing.height}
							patternX={
								itemRenderConfig?.listPatternXClamp ? Math.min(itemRenderConfig.listPatternXClamp, displayThing.patternX - 1) : 0
							}
							outfitData={
								itemRenderConfig?.layerCompositing && displayThing.layers > 1
									? {
											head: 0,
											body: 0,
											legs: 0,
											feet: 0,
											addons: displayThing.patternY > 1 ? Array(displayThing.patternY - 1).fill(false) : [false, false]
										}
									: undefined
							}
						/>
					) : (
						<SpriteCanvas
							scale={1}
							showEmpty
							renderMode="preview"
							thing={displayThing!}
							width={displayThing?.width || 1}
							height={displayThing?.height || 1}
						/>
					)}
				</CheckerBoard>

				{/* Play/Pause button overlay for animated items */}
				{hasAnimation && (
					<Button
						size="icon"
						variant="secondary"
						onClick={handlePlayPause}
						title={isPlaying ? 'Pause animation' : 'Play animation'}
						className="absolute bottom-3 right-3 h-6 w-6 opacity-70 hover:opacity-100 transition-opacity"
					>
						{isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
					</Button>
				)}
			</div>
		</div>
	);
};
