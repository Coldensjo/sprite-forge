import { useState } from 'react';
import { cn } from '@/lib/utils';
import { loadTibiaData } from '@/lib/tibia';
import { useToast } from '@/hooks/use-toast';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTibiaData } from '@/contexts/TibiaDataContext';
import { usePanelSettings } from '@/contexts/PanelSettingsContext';
import { X, Eye, Save, List, Minus, Square, Search, FolderOpen } from 'lucide-react';

import { Button } from './ui/button';
import { FindDialog } from './FindDialog';
import { LoadingDialog } from './LoadingDialog';
import { FolderSelectDialog } from './FolderSelectDialog';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip';

export const Toolbar = () => {
	const { data, setData, setError, isLoading, setLoading, loadingProgress } = useTibiaData();
	const { settings, togglePanel } = usePanelSettings();
	const { toast } = useToast();
	const [findDialogOpen, setFindDialogOpen] = useState(false);
	const [folderDialogOpen, setFolderDialogOpen] = useState(false);

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
				</TooltipProvider>

				<div className="ml-auto text-[11px] text-muted-foreground flex-shrink-0">
					<span className="font-mono">{data ? `v${data.version.label} | ${data.itemsCount} items` : 'No files loaded'}</span>
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
		</>
	);
};
