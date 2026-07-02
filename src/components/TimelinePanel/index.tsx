import type { ThingType, FrameDuration } from '~/lib/formats/tibia';

import React from 'react';
import { Play, Pause, Timer, Repeat, SkipBack, SkipForward, ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '~/lib/utils';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { Switch } from '~/components/ui/switch';
import { DragHandleProps } from '~/usecase/util/dock';
import { getCategoryRenderConfig } from '~/lib/formats/tibia';
import { SpriteCanvas } from '~/components/commons/SpriteCanvas';
import { useAnimation } from '~/usecase/context/AnimationContext';
import { useAssetData } from '~/usecase/context/AssetDataContext';
import { AnimationMode, getDefaultDuration } from '~/lib/formats/tibia/animation';

interface TimelinePanelProps {
	dragHandle?: DragHandleProps;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

const durationsOf = (thing: ThingType, defaultMs: number): FrameDuration[] => {
	const list = thing.frameDurations ?? [];
	if (list.length === thing.frames) return list;
	const filled: FrameDuration[] = [];
	for (let i = 0; i < thing.frames; i++) {
		filled.push(list[i] ?? { minimum: defaultMs, maximum: defaultMs });
	}
	return filled;
};

export const TimelinePanel = ({ dragHandle }: TimelinePanelProps) => {
	const { data, getThing, updateThing, openedItemId, formatConfig, openedItemCategory, markUnsavedChanges } = useAssetData();
	const handleProps = dragHandle ? { ref: dragHandle.ref, ...dragHandle.attributes, ...dragHandle.listeners } : {};

	const item = openedItemId && openedItemCategory ? getThing(openedItemId, openedItemCategory) : null;
	const supports = !!data?.version.supportsFrameDurations;
	const defaultMs = openedItemCategory ? getDefaultDuration(openedItemCategory) : 500;

	const { setPlaying, currentFrame, setCurrentFrame, isPlaying: playing } = useAnimation();
	const selected = currentFrame;

	const renderConfig = React.useMemo(
		() => (item ? getCategoryRenderConfig(formatConfig, item.category) : undefined),
		[item, formatConfig]
	);

	const displayThing = React.useMemo(() => {
		if (!item) return null;
		if (renderConfig?.frameGroups && item.frameGroupsData && item.frameGroupsData.length > 1) {
			const walking = item.frameGroupsData[1];
			if (walking && walking.frames > 1) return { ...item, ...walking };
		}
		const idle = item.frameGroupsData?.[0];
		if (idle && idle.frames > 1) return { ...item, ...idle };
		return item;
	}, [item, renderConfig]);

	const frames = displayThing?.frames ?? 0;
	const durations = React.useMemo(() => (displayThing ? durationsOf(displayThing, defaultMs) : []), [displayThing, defaultMs]);

	const outfitData = React.useMemo(() => {
		if (!displayThing || !renderConfig?.layerCompositing || displayThing.layers <= 1) return undefined;
		return {
			head: 0,
			body: 0,
			legs: 0,
			feet: 0,
			addons: displayThing.patternY > 1 ? Array(displayThing.patternY - 1).fill(false) : [false, false]
		};
	}, [displayThing, renderConfig]);

	const previewPatternX = renderConfig?.listPatternXClamp
		? Math.min(renderConfig.listPatternXClamp, (displayThing?.patternX ?? 1) - 1)
		: 0;

	const write = (updates: Partial<ThingType>) => {
		if (!openedItemId || !openedItemCategory) return;
		updateThing(openedItemId, openedItemCategory, updates);
		markUnsavedChanges(openedItemId, openedItemCategory, true);
	};

	const setDuration = (idx: number, minimum: number, maximum: number) => {
		const next = durations.map((d, i) => (i === idx ? { minimum, maximum } : d));
		write({ frameDurations: next });
	};

	const applyToAll = (minimum: number, maximum: number) => {
		const next = durations.map(() => ({ minimum, maximum }));
		write({ frameDurations: next });
	};

	const totalMs = durations.reduce((s, d) => s + d.minimum, 0);

	const canControl = frames > 1;
	const step = (delta: number) => setCurrentFrame((f) => Math.max(0, Math.min(frames - 1, f + delta)));
	const goto = (n: number) => setCurrentFrame(Math.max(0, Math.min(frames - 1, n)));
	const togglePlay = () => setPlaying((p) => !p);

	const ctrlBtn =
		'h-6 w-6 rounded-md border border-border/60 bg-background/60 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40';

	const sel = durations[selected] ?? { minimum: defaultMs, maximum: defaultMs };

	const header = (
		<div className="flex h-8 flex-shrink-0 items-stretch border-b border-border/50 bg-secondary/80">
			<div className="flex items-center px-3">
				<h2 className="text-xs font-semibold uppercase tracking-wide text-foreground">Timeline</h2>
			</div>
			<div className="my-1 w-px bg-border/60" />
			<div className="flex items-center gap-0.5 px-2 py-1">
				<Button
					size="icon"
					variant="ghost"
					className={ctrlBtn}
					title="First frame"
					disabled={!canControl}
					onClick={() => goto(0)}
				>
					<SkipBack className="h-3.5 w-3.5" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					className={ctrlBtn}
					disabled={!canControl}
					title="Previous frame"
					onClick={() => step(-1)}
				>
					<ChevronLeft className="h-3.5 w-3.5" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					onClick={togglePlay}
					disabled={!canControl}
					title={playing ? 'Pause' : 'Play'}
					className={cn(ctrlBtn, 'text-foreground')}
				>
					{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
				</Button>
				<Button size="icon" variant="ghost" title="Next frame" className={ctrlBtn} disabled={!canControl} onClick={() => step(1)}>
					<ChevronRight className="h-3.5 w-3.5" />
				</Button>
				<Button
					size="icon"
					variant="ghost"
					title="Last frame"
					className={ctrlBtn}
					disabled={!canControl}
					onClick={() => goto(frames - 1)}
				>
					<SkipForward className="h-3.5 w-3.5" />
				</Button>
			</div>
			<div
				{...handleProps}
				className={cn('flex flex-1 items-center gap-3 px-3', dragHandle && 'cursor-grab active:cursor-grabbing')}
			>
				{item && (
					<span className="text-[11px] text-muted-foreground">
						ID {item.id} · {frames} frame{frames === 1 ? '' : 's'} · {totalMs}ms
					</span>
				)}
			</div>
			{item && supports && (
				<div className="flex items-center px-2 py-1">
					<Button
						size="sm"
						variant="default"
						className="h-6 px-3 text-[11px]"
						title="Apply selected frame duration to all frames"
						onClick={() => applyToAll(sel.minimum, sel.maximum)}
					>
						Apply to all
					</Button>
				</div>
			)}
		</div>
	);

	if (!item) {
		return (
			<div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-card shadow-island">
				{header}
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
					Open an object to edit its timeline
				</div>
			</div>
		);
	}

	if (frames < 1) {
		return (
			<div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-card shadow-island">
				{header}
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">This object has no frames</div>
			</div>
		);
	}

	return (
		<div className="flex h-full w-full flex-col overflow-hidden rounded-lg bg-card shadow-island">
			{header}
			<div className="flex min-h-0 flex-1">
				<div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
					<div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
						<div className="flex h-full items-stretch gap-1">
							{durations.map((d, i) => {
								const active = i === currentFrame;
								return (
									<button
										key={i}
										onClick={() => setCurrentFrame(i)}
										className={cn(
											'group flex h-full w-16 flex-shrink-0 flex-col items-stretch overflow-hidden rounded-md border text-[10px] transition-colors',
											active ? 'border-primary bg-primary/20' : 'border-border bg-secondary/40 hover:bg-secondary/70'
										)}
									>
										<span
											className={cn(
												'border-b border-border/40 py-0.5 font-mono',
												active ? 'text-primary-foreground' : 'text-muted-foreground'
											)}
										>
											#{i}
										</span>
										<div className="flex min-h-0 flex-1 items-center justify-center bg-black/20 p-1">
											<div className="aspect-square h-full w-full max-h-14 max-w-14">
												<SpriteCanvas
													showEmpty
													layer={0}
													scale={1}
													frame={i}
													patternY={0}
													patternZ={0}
													renderMode="preview"
													thing={displayThing!}
													outfitData={outfitData}
													patternX={previewPatternX}
													width={displayThing!.width}
													height={displayThing!.height}
												/>
											</div>
										</div>
										<span
											className={cn(
												'border-t border-border/40 py-0.5 font-mono',
												active ? 'text-primary-foreground' : 'text-muted-foreground'
											)}
										>
											{d.minimum}ms
										</span>
									</button>
								);
							})}
						</div>
					</div>

					{supports && (
						<div className="flex flex-shrink-0 items-center gap-x-3 overflow-x-auto whitespace-nowrap border-t border-border/40 pt-2 text-[10px] uppercase tracking-wide text-muted-foreground [&>*]:flex-shrink-0">
							<span className="inline-block w-9 text-center font-mono normal-case text-foreground">#{selected}</span>
							<label className="flex items-center gap-1.5">
								Min
								<Input
									min={1}
									max={60000}
									type="number"
									value={sel.minimum}
									className="h-6 w-20 text-xs"
									onChange={(e) => {
										const v = clamp(parseInt(e.target.value) || 0, 1, 60000);
										setDuration(selected, v, Math.max(v, sel.maximum));
									}}
								/>
							</label>
							<label className="flex items-center gap-1.5">
								Max
								<Input
									min={1}
									max={60000}
									type="number"
									value={sel.maximum}
									className="h-6 w-20 text-xs"
									onChange={(e) => {
										const v = clamp(parseInt(e.target.value) || 0, 1, 60000);
										setDuration(selected, Math.min(sel.minimum, v), v);
									}}
								/>
							</label>
							<div className="h-5 w-px bg-border/60" />
							<label title="0 = infinite" className="flex items-center gap-1.5">
								<Repeat className="h-3 w-3" /> Loop
								<Input
									min={0}
									max={65535}
									type="number"
									value={item.loopCount}
									className="h-6 w-16 text-xs"
									onChange={(e) => write({ loopCount: clamp(parseInt(e.target.value) || 0, 0, 65535) })}
								/>
							</label>
							<label title="-1 = random" className="flex items-center gap-1.5">
								<Timer className="h-3 w-3" /> Start
								<Input
									min={-1}
									type="number"
									value={item.startFrame}
									className="h-6 w-16 text-xs"
									max={Math.max(0, frames - 1)}
									onChange={(e) => write({ startFrame: clamp(parseInt(e.target.value) || 0, -1, Math.max(0, frames - 1)) })}
								/>
							</label>
							<div className="h-5 w-px bg-border/60" />
							<label className="flex items-center gap-1.5">
								Sync
								<Switch
									className="scale-75"
									checked={item.animationMode === AnimationMode.SYNCHRONOUS}
									onCheckedChange={(v) => write({ animationMode: v ? AnimationMode.SYNCHRONOUS : AnimationMode.ASYNCHRONOUS })}
								/>
							</label>
							<label className="flex items-center gap-1.5">
								Always
								<Switch className="scale-75" checked={item.animateAlways} onCheckedChange={(v) => write({ animateAlways: v })} />
							</label>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
