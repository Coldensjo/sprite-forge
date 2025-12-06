import { Play, Pause, FileQuestion } from 'lucide-react';
import { ThingCategory, loadSpriteIds } from '@/lib/tibia';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { useRef, useMemo, useState, useEffect } from 'react';

import { Button } from './ui/button';
import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';

export const VisualizationPanel = () => {
	const { data, getThing, selectedCategory, highlightedItemId, notifySpritesLoaded } = useTibiaData();
	const item = highlightedItemId ? getThing(highlightedItemId, selectedCategory) : null;

	// Animation state
	const [currentFrame, setCurrentFrame] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	// Use ref to avoid stale closure issues in animation loop
	const itemRef = useRef(item);
	itemRef.current = item;

	// Animation timing refs
	const animationState = useRef({
		frames: 0,
		lastTime: 0,
		timeRemaining: 0,
		skipFirstFrame: false,
		durations: [] as number[]
	});
	const requestRef = useRef<number>();

	// Reset animation when item changes
	useEffect(() => {
		setCurrentFrame(0);
		setIsPlaying(false);
		animationState.current = {
			frames: 0,
			lastTime: 0,
			durations: [],
			timeRemaining: 0,
			skipFirstFrame: false
		};
		if (requestRef.current) {
			cancelAnimationFrame(requestRef.current);
		}
	}, [highlightedItemId, selectedCategory]);

	// Fast load walking sprites when outfit is highlighted
	// This enables immediate animation playback in the visualization panel
	useEffect(() => {
		if (!data?.sprPath || !item) return;

		// Only for outfits with walking frame groups
		if (item.category !== ThingCategory.OUTFIT || !item.frameGroupsData || item.frameGroupsData.length < 2) {
			return;
		}

		const walkingGroup = item.frameGroupsData[1];
		if (!walkingGroup?.spriteIndex || walkingGroup.spriteIndex.length === 0) {
			return;
		}

		// Check if walking sprites are already cached
		const uncachedIds = walkingGroup.spriteIndex.filter((id) => id > 0 && !data.sprites.has(id));

		if (uncachedIds.length === 0) {
			return; // Already loaded
		}

		// Load walking sprites immediately (small batch - ~24 sprites max)
		// Use non-LZ4 version since batch is small - less overhead
		loadSpriteIds(data.sprPath, uncachedIds, data.transparency, data.sprites).then(() => {
			notifySpritesLoaded();
		});
	}, [highlightedItemId, item, data, notifySpritesLoaded]);

	// Determine which frame group to use for animation
	// For outfits with frame groups, use walking group (index 1) if it has animation
	const getAnimationFrameGroup = () => {
		if (!item) return null;

		// Check if outfit has frame groups with walking animation
		if (item.category === ThingCategory.OUTFIT && item.frameGroupsData && item.frameGroupsData.length > 1) {
			const walkingGroup = item.frameGroupsData[1];
			if (walkingGroup && walkingGroup.frames > 1) {
				return { index: 1, group: walkingGroup };
			}
		}

		// Fallback to first frame group
		const idleGroup = item.frameGroupsData?.[0];
		if (idleGroup && idleGroup.frames > 1) {
			return { index: 0, group: idleGroup };
		}

		// Use top-level frames if no frame groups
		if (item.frames > 1) {
			return { index: -1, group: null };
		}

		return null;
	};

	const animationInfo = getAnimationFrameGroup();
	const hasAnimation = animationInfo !== null;

	// Create synthetic thing with correct frame group's sprite data for animation
	const displayThing = useMemo(() => {
		if (!item) return null;

		// If using a specific frame group for animation, override sprite data
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

	// Auto-play animation for animated items
	useEffect(() => {
		if (item && hasAnimation) {
			// Small delay before auto-playing to avoid flickering during quick hovers
			const timer = setTimeout(() => {
				setIsPlaying(true);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [item, hasAnimation]);

	// Animation loop - uses refs to avoid stale closures
	const animate = (time: number) => {
		const state = animationState.current;

		// Check if we should continue
		if (state.frames === 0 || state.durations.length === 0) {
			return;
		}

		// Initialize lastTime if needed
		if (state.lastTime === 0) {
			state.lastTime = time;
			requestRef.current = requestAnimationFrame(animate);
			return;
		}

		const elapsed = time - state.lastTime;
		state.lastTime = time;

		// Frame advance logic (from Animator.as)
		if (elapsed >= state.timeRemaining) {
			setCurrentFrame((prevFrame) => {
				let nextFrame = prevFrame + 1;

				// Loop logic
				if (nextFrame >= state.frames) {
					nextFrame = 0;
				}

				// Skip first frame logic for outfits
				if (state.skipFirstFrame && nextFrame === 0) {
					nextFrame = 1 % state.frames;
				}

				// Update duration for the new frame with overshoot compensation
				const nextDuration = state.durations[nextFrame] || 200;
				state.timeRemaining = nextDuration - (elapsed - state.timeRemaining);
				if (state.timeRemaining < 0) state.timeRemaining = 0;

				return nextFrame;
			});
		} else {
			state.timeRemaining -= elapsed;
		}

		requestRef.current = requestAnimationFrame(animate);
	};

	// Animation setup effect
	useEffect(() => {
		if (isPlaying && item && hasAnimation && animationInfo) {
			// Get base durations
			let durations: number[] = [];

			// Use the correct frame group (walking for outfits with frame groups)
			const currentGroup = animationInfo.group;
			const frameCount = currentGroup?.frames ?? item.frames;
			const groupDurations = currentGroup?.frameDurations;

			if (groupDurations && groupDurations.length > 0) {
				durations = groupDurations.map((d) => d.minimum);
			} else if (item.frameDurations && item.frameDurations.length > 0) {
				durations = item.frameDurations.map((d) => d.minimum);
			} else {
				// Default durations matching Object Builder
				let defaultDuration = 500; // Item default
				if (item.category === ThingCategory.OUTFIT) {
					defaultDuration = 300;
				} else if (item.category === ThingCategory.EFFECT) {
					defaultDuration = 100;
				} else if (item.category === ThingCategory.MISSILE) {
					defaultDuration = 150;
				}
				durations = new Array(frameCount).fill(defaultDuration);
			}

			// Walking override for outfits (only for walking frame groups)
			const isGroupWalking = currentGroup?.type === 1;
			if (isGroupWalking && frameCount > 2) {
				const calculatedDuration = Math.floor(1000 / frameCount);
				durations = durations.map(() => calculatedDuration);
			}

			// Sanity check: minimum 50ms per frame
			durations = durations.map((d) => Math.max(d, 50));

			// Setup animator state
			animationState.current.durations = durations;
			animationState.current.frames = frameCount;

			// Skip first frame for outfits in idle mode
			const isOutfit = item.category === ThingCategory.OUTFIT;
			const animateAlways = item.animateAlways;
			const isIdle = currentGroup?.type !== 1;
			animationState.current.skipFirstFrame = isOutfit && !animateAlways && isIdle;

			// Initialize time remaining
			animationState.current.timeRemaining = durations[currentFrame] || 200;
			animationState.current.lastTime = 0;

			// Start loop
			requestRef.current = requestAnimationFrame(animate);
		} else {
			// Stop animation
			animationState.current.frames = 0;
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		}

		return () => {
			if (requestRef.current) cancelAnimationFrame(requestRef.current);
		};
	}, [isPlaying, item, hasAnimation, animationInfo]);

	const handlePlayPause = () => {
		if (!isPlaying) {
			// Starting animation - skip first frame for outfits
			const isOutfit = item?.category === ThingCategory.OUTFIT;
			const frameCount = animationInfo?.group?.frames ?? item?.frames ?? 0;
			if (isOutfit && item && !item.animateAlways && currentFrame === 0 && frameCount > 1) {
				setCurrentFrame(1);
			}
			setIsPlaying(true);
		} else {
			setIsPlaying(false);
			// Reset to frame 0 for outfits
			if (item?.category === ThingCategory.OUTFIT) {
				setCurrentFrame(0);
			}
		}
	};

	if (!data || !item) {
		return (
			<div className="w-[216px] h-[150px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
				<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0">
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

	// hasAnimation is already computed above with getAnimationFrameGroup()

	return (
		<div className="w-[216px] h-[150px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
			<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/80 flex-shrink-0">
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
							patternX={displayThing.category === ThingCategory.OUTFIT ? Math.min(2, displayThing.patternX - 1) : 0}
							outfitData={
								displayThing.category === ThingCategory.OUTFIT && displayThing.layers > 1
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
							thing={displayThing!} // Assume displayThing exists but is empty
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
