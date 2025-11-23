import { useState } from 'react';
import { cn } from '@/lib/utils';
import { loadTibiaData } from '@/lib/tibia';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { usePanelSettings } from '@/contexts/PanelSettingsContext';
import { X, Eye, Save, List, Info, Minus, Square, Search, Palette, FolderOpen } from 'lucide-react';

import { Button } from './ui/button';
import { FindDialog } from './FindDialog';
import { LoadingDialog } from './LoadingDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { ThemeSettingsDialog } from './ThemeSettingsDialog';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';

export const Toolbar = () => {
	const { data, setData, setError, isLoading, setLoading, loadingProgress } = useTibiaData();
	const { settings, togglePanel } = usePanelSettings();
	const { toast } = useToast();
	const [findDialogOpen, setFindDialogOpen] = useState(false);
	const [folderDialogOpen, setFolderDialogOpen] = useState(false);
	const [themeDialogOpen, setThemeDialogOpen] = useState(false);

	const handleFolderSelect = async (selectedPath: string) => {
		try {
			setLoading(true);
			setError(null);

			const datPath = `${selectedPath}\\Tibia.dat`;
			const sprPath = `${selectedPath}\\Tibia.spr`;

			const tibiaData = await loadTibiaData(datPath, sprPath, undefined, (stage, current, total) => {
				setLoading(true, { stage, total, current });
			});

			setData(tibiaData, null as any);
			// Don't set loading false here - let the context handle sprite preloading first
			// setLoading(false);
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

	return (
		<>
			<LoadingDialog
				open={isLoading}
				stage={loadingProgress?.stage}
				total={loadingProgress?.total}
				current={loadingProgress?.current}
			/>

			<div data-tauri-drag-region className="h-11 bg-toolbar-bg border-b border-border/50 flex items-center px-3 gap-1">
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
						disabled={!data}
						className="h-8 text-xs font-medium"
						onMouseDown={(e) => e.stopPropagation()}
					>
						<Save className="h-3.5 w-3.5 mr-1.5" />
						Save
					</Button>
				</div>

				<div className="h-5 w-px bg-border/50 flex-shrink-0" />

				<Button
					size="sm"
					variant="ghost"
					disabled={!data}
					className="h-8 text-xs font-medium"
					onClick={() => setFindDialogOpen(true)}
					onMouseDown={(e) => e.stopPropagation()}
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
			</div>

			<FindDialog open={findDialogOpen} onOpenChange={setFindDialogOpen} />
			<FolderSelectDialog
				open={folderDialogOpen}
				onSelect={handleFolderSelect}
				onOpenChange={setFolderDialogOpen}
				title="Select folder containing Tibia.dat and Tibia.spr"
			/>
			<ThemeSettingsDialog open={themeDialogOpen} onOpenChange={setThemeDialogOpen} />
		</>
	);
};
