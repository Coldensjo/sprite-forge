import { cn } from '@/lib/utils';
import { join } from '@tauri-apps/api/path';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorToString } from '@/lib/errorMessage';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { useErrorDialog } from '@/contexts/ErrorDialogContext';
import { usePanelSettings } from '@/contexts/PanelSettingsContext';
import { loadTibiaData, type ThingType, optimizeSprites } from '@/lib/tibia';
import {
	X,
	Eye,
	List,
	Info,
	Minus,
	Square,
	Search,
	Palette,
	History,
	Grid3x3,
	Sparkles,
	HardDrive,
	FolderOpen
} from 'lucide-react';

import { Button } from './ui/button';
import { LoadingDialog } from './LoadingDialog';
import { LoadOptions } from './FolderSelectDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { ThemeSettingsDialog } from './ThemeSettingsDialog';
import { VersionHistoryDialog } from './VersionHistoryDialog';
import { SpriteOptimizerDialog } from './SpriteOptimizerDialog';
import { SceneEditorDialog } from './SceneEditor/SceneEditorDialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';

export const Toolbar = () => {
	const { data, setData, setError, isLoading, setLoading, compileFiles, loadingProgress, hasModifiedItems, notifyDataChanged } =
		useTibiaData();
	const { settings, togglePanel } = usePanelSettings();
	const { showError } = useErrorDialog();
	const { toast } = useToast();
	const [folderDialogOpen, setFolderDialogOpen] = useState(false);
	const [themeDialogOpen, setThemeDialogOpen] = useState(false);
	const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
	const [optimizerOpen, setOptimizerOpen] = useState(false);
	const [isOptimizing, setIsOptimizing] = useState(false);
	const [optimizerProgress, setOptimizerProgress] = useState({ total: 0, current: 0, message: '' });
	const [optimizerResult, setOptimizerResult] = useState<null | { oldTotal: number; newTotal: number; removedCount: number }>(
		null
	);
	const [sceneEditorOpen, setSceneEditorOpen] = useState(false);
	const [itemToAdd, setItemToAdd] = useState<null | ThingType>(null);
	const [isMac, setIsMac] = useState(false);

	const [originalSprPath, setOriginalSprPath] = useState<null | string>(null);

	useEffect(() => {
		setIsMac(navigator.userAgent.includes('Mac'));

		const handleOpenScene = (e: CustomEvent<{ item: ThingType }>) => {
			setItemToAdd(e.detail.item);
			setSceneEditorOpen(true);
		};

		window.addEventListener('open-scene-editor', handleOpenScene as EventListener);
		return () => {
			window.removeEventListener('open-scene-editor', handleOpenScene as EventListener);
		};
	}, []);

	const handleOptimize = () => {
		setOptimizerOpen(true);
		setOptimizerResult(null);
		setOptimizerProgress({ total: 0, current: 0, message: 'Ready to optimize' });
	};

	const runOptimization = async () => {
		if (!data) return;

		setIsOptimizing(true);
		// Store original path before optimization if not already stored
		if (!originalSprPath) {
			setOriginalSprPath(data.sprPath);
		}

		try {
			const result = await optimizeSprites(data, (message, current, total) => {
				setOptimizerProgress({ total, message, current });
			});

			setOptimizerResult(result);

			// Create new data object to avoid mutating state directly
			// and to ensure setData closes the OLD path correctly
			const newData = { ...data };
			newData.sprPath = result.tempPath;
			newData.spritesCount = result.newTotal;

			// Update data reference to trigger re-render with new temp path
			setData(newData, null as any);

			toast({
				title: 'Optimization Complete',
				description: `Removed ${result.removedCount} sprites. New total: ${result.newTotal}. Click Compile to save changes.`
			});

			// Mark as modified so Compile button is enabled
			if (newData) {
				notifyDataChanged();
			}
		} catch (error) {
			toast({
				variant: 'destructive',
				title: 'Optimization Failed',
				description: error instanceof Error ? error.message : 'Unknown error'
			});
			setOptimizerOpen(false);
		} finally {
			setIsOptimizing(false);
		}
	};

	// Effect to notify data changed when optimization completes successfully
	// We do this in a separate effect or just call it if we extract it from context

	// We can't call hook inside function, so we use the one from top level
	// But runOptimization is inside component, so it has access to notifyDataChanged from line 22

	// Let's update runOptimization to call notifyDataChanged
	// Re-declaring runOptimization to include notifyDataChanged call

	const handleFolderSelect = async (selectedPath: string, transparency: boolean) => {
		try {
			setLoading(true);
			setError(null);
			setOriginalSprPath(null); // Reset original path on new load

			const datPath = await join(selectedPath, 'Tibia.dat');
			const sprPath = await join(selectedPath, 'Tibia.spr');

			const tibiaData = await loadTibiaData(
				datPath,
				sprPath,
				undefined,
				transparency ? true : undefined,
				(stage, current, total) => {
					setLoading(true, { stage, total, current });
				}
			);

			setData(tibiaData, null as any);

			// Check if files are in a protected location
			const protectedPaths = ['Program Files', 'Program Files (x86)', 'Windows', 'System32', 'ProgramData'];

			const isProtectedLocation = protectedPaths.some((protectedPath) =>
				selectedPath.toLowerCase().includes(protectedPath.toLowerCase())
			);

			if (isProtectedLocation) {
				toast({
					duration: 8000,
					variant: 'default',
					title: 'Warning: Protected Location',
					description:
						'Files are in a protected folder. You may need Administrator privileges to compile changes. Consider copying files to Documents folder.'
				});
			}

			// Loading complete - sprite preloading already happened in loadTibiaData()
			setLoading(false);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
			setError(errorMessage);
			setLoading(false);

			toast({
				variant: 'destructive',
				description: errorMessage,
				title: 'Error loading files'
			});
		}
	};

	const handleOpenFiles = (e: React.MouseEvent) => {
		e.stopPropagation();
		setFolderDialogOpen(true);
	};

	const handleLoadWithOptions = async (options: LoadOptions) => {
		setFolderDialogOpen(false);
		await handleFolderSelect(options.folderPath, options.transparency);
	};

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

	const handleClose = async (e: React.MouseEvent) => {
		e.stopPropagation();
		const appWindow = getCurrentWindow();
		await appWindow.close();
	};

	const handleCompile = async (e: React.MouseEvent) => {
		e.stopPropagation();

		if (!hasModifiedItems() && !originalSprPath) {
			toast({
				title: 'No changes to compile',
				description: 'Make some changes to items before compiling.'
			});
			return;
		}

		try {
			// If we have an optimized temp file, apply it to the original path first
			if (originalSprPath && data) {
				const { invoke } = await import('@tauri-apps/api/core');

				// 1. Close the TEMP file handle in the backend
				await invoke('close_spr_file', { path: data.sprPath });

				// 2. Apply optimization (swap files)
				await invoke('apply_optimization', {
					tempPath: data.sprPath,
					originalPath: originalSprPath
				});

				// 3. Update data to point back to original path
				data.sprPath = originalSprPath;
				setOriginalSprPath(null);

				// 4. Re-open the ORIGINAL file (now containing optimized data)
				// This is crucial because compileFiles might need to read from it
				await invoke('open_spr_file', {
					path: data.sprPath,
					extended: data.extended
				});

				// We still need to run compileFiles to save the DAT file (which has updated IDs)
				// and any other changes
			}

			await compileFiles();

			toast({
				title: 'Compile successful',
				description: 'Files have been compiled and a version was created.'
			});
		} catch (err) {
			const errorMessage = errorToString(err);
			console.error('Compile error details:', err);

			// Check for permission errors
			const isPermissionError =
				errorMessage.includes('Acesso negado') ||
				errorMessage.includes('Access denied') ||
				errorMessage.includes('Permission denied') ||
				errorMessage.includes('os error 5');

			// Check for memory/timeout errors
			const isMemoryError =
				errorMessage.includes('out of memory') ||
				errorMessage.includes('allocation') ||
				errorMessage.includes('too large') ||
				errorMessage.includes('timeout');

			if (isPermissionError) {
				toast({
					duration: 10000, // Show longer for important message
					variant: 'destructive',
					title: 'Permission Denied',
					description:
						'Cannot write to files. Please run the application as Administrator or move the files to a writable location (e.g., Documents folder).'
				});
			} else if (isMemoryError) {
				toast({
					duration: 10000,
					variant: 'destructive',
					title: 'Compile failed',
					description:
						'File is too large or system ran out of memory. Try closing other applications or compiling fewer changes at once.'
				});
			} else {
				showError('Compile failed', err);
			}
		}
	};

	const renderWindowControls = () => {
		if (isMac) {
			return (
				<div className="flex items-center gap-2 mr-4 group ml-2">
					<div
						onClick={handleClose}
						onMouseDown={(e) => e.stopPropagation()}
						className="w-3 h-3 rounded-full bg-[#FF5F56] hover:bg-[#FF5F56]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
					>
						<X className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
					</div>
					<div
						onClick={handleMinimize}
						onMouseDown={(e) => e.stopPropagation()}
						className="w-3 h-3 rounded-full bg-[#FFBD2E] hover:bg-[#FFBD2E]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
					>
						<Minus className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
					</div>
					<div
						onClick={handleMaximize}
						onMouseDown={(e) => e.stopPropagation()}
						className="w-3 h-3 rounded-full bg-[#27C93F] hover:bg-[#27C93F]/80 cursor-pointer flex items-center justify-center border border-black/10 transition-colors"
					>
						<Square className="w-2 h-2 text-black/50 opacity-0 group-hover:opacity-100" />
					</div>
				</div>
			);
		}

		return (
			<div className="ml-2 flex items-center flex-shrink-0">
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
		);
	};

	return (
		<>
			<LoadingDialog
				open={isLoading}
				stage={loadingProgress?.stage}
				total={loadingProgress?.total}
				current={loadingProgress?.current}
			/>

			<div data-tauri-drag-region className="h-11 bg-toolbar-bg border-b border-border/50 flex items-center px-3 gap-1">
				{isMac && renderWindowControls()}
				<div className="flex items-center gap-0.5">
					<Button
						size="sm"
						variant="ghost"
						disabled={isLoading}
						onClick={handleOpenFiles}
						className="h-8 text-xs font-medium"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<FolderOpen className="h-3.5 w-3.5 mr-1.5" />
						Open Files
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={handleCompile}
						disabled={!data || !hasModifiedItems()}
						onMouseDown={(e) => e.stopPropagation()}
						className={cn('h-8 text-xs font-medium', hasModifiedItems() && 'text-primary')}
					>
						<HardDrive className="h-3.5 w-3.5 mr-1.5" />
						Compile
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={!data}
						className="h-8 text-xs font-medium"
						onMouseDown={(e) => e.stopPropagation()}
						onClick={() => setVersionHistoryOpen(true)}
					>
						<History className="h-3.5 w-3.5 mr-1.5" />
						History
					</Button>
					<Button
						size="sm"
						variant="ghost"
						onClick={handleOptimize}
						disabled={!data || isLoading}
						className="h-8 text-xs font-medium"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<Sparkles className="h-3.5 w-3.5 mr-1.5" />
						Optimize
					</Button>
					<Button
						size="sm"
						variant="ghost"
						disabled={!data}
						className="h-8 text-xs font-medium"
						onClick={() => setSceneEditorOpen(true)}
						onMouseDown={(e) => e.stopPropagation()}
					>
						<Grid3x3 className="h-3.5 w-3.5 mr-1.5" />
						Scene
					</Button>
				</div>

				<div className="h-5 w-px bg-border/50 flex-shrink-0" />

				<Button
					size="sm"
					variant="ghost"
					disabled={!data}
					className="h-8 text-xs font-medium"
					onMouseDown={(e) => e.stopPropagation()}
					onClick={async () => {
						try {
							// Try to get existing window first
							const existingWindow = await WebviewWindow.getByLabel('find');

							if (existingWindow) {
								// Window exists, just show and focus it
								await existingWindow.show();
								await existingWindow.setFocus();
							} else {
								// Window doesn't exist, create it
								const newWindow = new WebviewWindow('find', {
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

								// Listen for creation success/error
								newWindow.once('tauri://error', () => {
									toast({
										title: 'Error',
										variant: 'destructive',
										description: 'Failed to create find window'
									});
								});
							}
						} catch (error: any) {
							toast({
								title: 'Error',
								variant: 'destructive',
								description: error instanceof Error ? error.message : String(error) || 'Failed to open find window'
							});
						}
					}}
				>
					<Search className="h-3.5 w-3.5 mr-1.5" />
					Find
				</Button>

				<div className="h-5 w-px bg-border/50 flex-shrink-0" />

				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								onMouseDown={(e) => e.stopPropagation()}
								onClick={() => togglePanel('showVisualization')}
								className={cn('h-8 w-8', settings.showVisualization && 'bg-primary/20 text-primary')}
							>
								<Eye className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Toggle Visualization Panel</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								onMouseDown={(e) => e.stopPropagation()}
								onClick={() => togglePanel('showOpenedItems')}
								className={cn('h-8 w-8', settings.showOpenedItems && 'bg-primary/20 text-primary')}
							>
								<List className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Toggle Opened Objects Panel</p>
						</TooltipContent>
					</Tooltip>

					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								size="icon"
								variant="ghost"
								className="h-8 w-8"
								onMouseDown={(e) => e.stopPropagation()}
								onClick={() => setThemeDialogOpen(true)}
							>
								<Palette className="h-4 w-4" />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Theme Settings</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<div className="ml-auto text-[11px] text-muted-foreground flex-shrink-0 flex items-center gap-2">
					<span className="font-mono">{data ? `v${data.version.label} | ${data.itemsCount} items` : 'No files loaded'}</span>
					{data && (
						<Popover>
							<PopoverTrigger asChild>
								<Button
									size="icon"
									variant="ghost"
									title="Show file information"
									onMouseDown={(e) => e.stopPropagation()}
									className="h-6 w-6 hover:bg-primary/20 hover:text-primary transition-colors"
								>
									<Info className="h-3.5 w-3.5" />
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" side="bottom" className="w-auto min-w-[240px] p-2.5">
								<div className="space-y-0.5 text-xs">
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Version:</span>
										<span className="font-mono text-foreground text-right">{data.version.label}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Sprite Dimension:</span>
										<span className="font-mono text-foreground text-right">32x32</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Dat:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.datSignature.toString(16).toUpperCase()}
										</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Items:</span>
										<span className="font-mono text-foreground text-right">{data.items.size}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Outfits:</span>
										<span className="font-mono text-foreground text-right">{data.outfits.size}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Effects:</span>
										<span className="font-mono text-foreground text-right">{data.effects.size}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Missiles:</span>
										<span className="font-mono text-foreground text-right">{data.missiles.size}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Spr:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.sprSignature.toString(16).toUpperCase()}
										</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Sprites:</span>
										<span className="font-mono text-foreground text-right">{data.spritesCount}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Extended:</span>
										<span className="font-mono text-foreground text-right">{data.extended ? 'Yes' : 'No'}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Transparency:</span>
										<span className="font-mono text-foreground text-right">{data.transparency ? 'Yes' : 'No'}</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Improv. Anim.:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.supportsFrameDurations ? 'Yes' : 'No'}
										</span>
									</div>
									<div className="flex justify-between items-center gap-4">
										<span className="text-muted-foreground whitespace-nowrap">Frame Groups:</span>
										<span className="font-mono text-foreground text-right">
											{data.version.supportsFrameDurations ? 'Yes' : 'No'}
										</span>
									</div>
								</div>
							</PopoverContent>
						</Popover>
					)}
				</div>

				{!isMac && renderWindowControls()}
			</div>

			<FolderSelectDialog
				open={folderDialogOpen}
				onLoad={handleLoadWithOptions}
				onOpenChange={setFolderDialogOpen}
				title="Select folder containing Tibia.dat and Tibia.spr"
			/>
			<ThemeSettingsDialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} />
			<VersionHistoryDialog open={versionHistoryOpen} onOpenChange={setVersionHistoryOpen} />
			<SpriteOptimizerDialog
				open={optimizerOpen}
				result={optimizerResult}
				isOptimizing={isOptimizing}
				onOptimize={runOptimization}
				progress={optimizerProgress}
				onOpenChange={(open) => {
					if (isOptimizing) return;
					setOptimizerOpen(open);
				}}
			/>
			<SceneEditorDialog
				itemToAdd={itemToAdd}
				open={sceneEditorOpen}
				onOpenChange={setSceneEditorOpen}
				onItemAdded={() => setItemToAdd(null)}
			/>
		</>
	);
};
