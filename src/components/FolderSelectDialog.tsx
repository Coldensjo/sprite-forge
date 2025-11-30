import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { X, Home, Star, Folder, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogTitle, DialogContent, DialogDescription } from './ui/dialog';

interface DirEntry {
	name: string;
	path: string;
	is_dir: boolean;
}

interface SystemDirectory {
	name: string;
	path: string;
}

interface FavoriteFolder {
	name: string;
	path: string;
}

interface FolderSelectDialogProps {
	open: boolean;
	title?: string;
	onOpenChange: (open: boolean) => void;
	// Option 2: Return path only (for new two-step flow)
	onFolderSelected?: (path: string) => void;
	// Option 1: Direct load with transparency (legacy mode)
	onSelect?: (path: string, transparency: boolean) => void;
}

export const FolderSelectDialog = ({
	open,
	onSelect,
	onOpenChange,
	onFolderSelected,
	title = 'Select Folder'
}: FolderSelectDialogProps) => {
	// Determine if we're in path-only mode (new two-step flow)
	const pathOnlyMode = !!onFolderSelected && !onSelect;
	const [currentPath, setCurrentPath] = useState<string>('');
	const [entries, setEntries] = useState<DirEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<null | string>(null);
	const [pathHistory, setPathHistory] = useState<string[]>([]);
	const [historyIndex, setHistoryIndex] = useState(-1);
	const [systemDirs, setSystemDirs] = useState<SystemDirectory[]>([]);
	const [selectedSystemDir, setSelectedSystemDir] = useState<null | string>(null);
	const [hasTibiaFiles, setHasTibiaFiles] = useState(false);
	const [favorites, setFavorites] = useState<FavoriteFolder[]>([]);
	const [isFavorite, setIsFavorite] = useState(false);
	const [transparency, setTransparency] = useState(false);

	const checkTibiaFiles = async (path: string) => {
		try {
			const results = await invoke<boolean[]>('check_files_exist', {
				path,
				filenames: ['Tibia.dat', 'Tibia.spr']
			});
			setHasTibiaFiles(results.length === 2 && results[0] && results[1]);
		} catch {
			setHasTibiaFiles(false);
		}
	};

	const loadDirectory = async (path: string) => {
		setLoading(true);
		setError(null);
		try {
			const result = await invoke<DirEntry[]>('list_directory', { path });
			setEntries(result);
			setCurrentPath(path);
			await checkTibiaFiles(path);
			// Check if current path is in favorites
			try {
				const currentFavorites = await invoke<FavoriteFolder[]>('get_favorite_folders');
				setIsFavorite(currentFavorites.some((f) => f.path === path));
			} catch {
				setIsFavorite(false);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load directory';
			setError(errorMessage);
			setEntries([]);
			setHasTibiaFiles(false);
			setIsFavorite(false);
		} finally {
			setLoading(false);
		}
	};

	const loadFavorites = async () => {
		try {
			const favorites = await invoke<FavoriteFolder[]>('get_favorite_folders');
			setFavorites(favorites);
		} catch (err) {
			console.error('Failed to load favorites:', err);
			setFavorites([]);
		}
	};

	const saveFavorites = async (newFavorites: FavoriteFolder[]) => {
		try {
			await invoke('set_favorite_folders', { folders: newFavorites });
			setFavorites(newFavorites);
		} catch (err) {
			console.error('Failed to save favorites:', err);
		}
	};

	const getFolderName = (path: string): string => {
		const separator = path.includes('\\') ? '\\' : '/';
		const parts = path.split(separator).filter(Boolean);
		return parts[parts.length - 1] || path;
	};

	const toggleFavorite = async () => {
		if (!currentPath) return;

		const folderName = getFolderName(currentPath);
		const favorite: FavoriteFolder = { name: folderName, path: currentPath };

		if (isFavorite) {
			const newFavorites = favorites.filter((f) => f.path !== currentPath);
			await saveFavorites(newFavorites);
			setIsFavorite(false);
		} else {
			const newFavorites = [...favorites, favorite];
			await saveFavorites(newFavorites);
			setIsFavorite(true);
		}
	};

	const removeFavorite = async (path: string, e: React.MouseEvent) => {
		e.stopPropagation();
		const newFavorites = favorites.filter((f) => f.path !== path);
		await saveFavorites(newFavorites);
		if (currentPath === path) {
			setIsFavorite(false);
		}
	};

	const initializePath = async () => {
		try {
			const lastFolder = await invoke<null | string>('get_last_folder');
			if (lastFolder) {
				try {
					await loadDirectory(lastFolder);
					return;
				} catch {
					// If last folder doesn't exist, fall through to home
				}
			}
			const homeDir = await invoke<string>('get_home_dir');
			await loadDirectory(homeDir);
		} catch {
			await loadDirectory('C:\\');
		}
	};

	useEffect(() => {
		if (open) {
			loadFavorites();
			setPathHistory([]);
			setHistoryIndex(-1);
			loadSystemDirectories();
			initializePath();
		}
	}, [open]);

	const loadSystemDirectories = async () => {
		try {
			const dirs = await invoke<SystemDirectory[]>('get_system_directories');
			setSystemDirs(dirs);
		} catch (err) {
			console.error('Failed to load system directories:', err);
		}
	};

	const handleSystemDirClick = async (dir: SystemDirectory) => {
		setSelectedSystemDir(dir.path);
		const newHistory = pathHistory.slice(0, historyIndex + 1);
		newHistory.push(currentPath);
		setPathHistory(newHistory);
		setHistoryIndex(newHistory.length - 1);
		await loadDirectory(dir.path);
	};

	const handleEntryClick = async (entry: DirEntry) => {
		if (entry.is_dir) {
			setSelectedSystemDir(null);
			const newHistory = pathHistory.slice(0, historyIndex + 1);
			newHistory.push(currentPath);
			setPathHistory(newHistory);
			setHistoryIndex(newHistory.length - 1);
			await loadDirectory(entry.path);
		}
	};

	const handleBack = async () => {
		if (historyIndex >= 0 && pathHistory[historyIndex]) {
			setSelectedSystemDir(null);
			const targetPath = pathHistory[historyIndex];
			const newHistory = pathHistory.slice(0, historyIndex);
			setPathHistory(newHistory);
			setHistoryIndex(newHistory.length - 1);
			await loadDirectory(targetPath);
		}
	};

	const handlePathInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			setSelectedSystemDir(null);
			const targetPath = e.currentTarget.value;
			await loadDirectory(targetPath);
		}
	};

	const handleSelect = async () => {
		try {
			await invoke('set_last_folder', { path: currentPath });
		} catch (err) {
			console.error('Failed to save last folder:', err);
		}

		if (pathOnlyMode && onFolderSelected) {
			onFolderSelected(currentPath);
		} else if (onSelect) {
			onSelect(currentPath, transparency);
		}
		onOpenChange(false);
	};

	const handleFavoriteClick = async (favorite: FavoriteFolder) => {
		setSelectedSystemDir(null);
		const newHistory = pathHistory.slice(0, historyIndex + 1);
		newHistory.push(currentPath);
		setPathHistory(newHistory);
		setHistoryIndex(newHistory.length - 1);
		await loadDirectory(favorite.path);
	};

	const canGoBack = historyIndex >= 0;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl h-[600px] p-0 gap-0 flex flex-col [&>button]:hidden">
				<DialogTitle className="sr-only">{title}</DialogTitle>
				<DialogDescription className="sr-only">Browse and select a folder containing Tibia files</DialogDescription>
				<div className="border-b border-border px-4 py-3 flex items-center justify-between">
					<h2 className="text-lg font-semibold">{title}</h2>
					<button
						onClick={() => onOpenChange(false)}
						className="w-6 h-6 flex items-center justify-center hover:bg-accent rounded transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				<div className="flex flex-1 overflow-hidden">
					<div className="w-48 border-r border-border bg-muted/30 flex flex-col">
						<div className="px-4 h-[49px] border-b border-border flex items-center">
							<h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Access</h3>
						</div>
						<ScrollArea className="flex-1">
							<div className="py-2">
								{favorites.length > 0 && (
									<>
										<div className="px-3 py-1.5">
											<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Favorites</h4>
										</div>
										{favorites.map((favorite) => (
											<button
												key={favorite.path}
												onClick={() => handleFavoriteClick(favorite)}
												className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left group ${
													currentPath === favorite.path ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
												}`}
											>
												<Star className="h-4 w-4 flex-shrink-0 fill-yellow-500 text-yellow-500" />
												<span className="truncate flex-1">{favorite.name}</span>
												<span
													tabIndex={0}
													role="button"
													title="Remove favorite"
													onClick={(e) => removeFavorite(favorite.path, e)}
													className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-destructive/20 rounded cursor-pointer"
													onKeyDown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															removeFavorite(favorite.path, e as any);
														}
													}}
												>
													<X className="h-3 w-3" />
												</span>
											</button>
										))}
										<div className="h-px bg-border mx-3 my-2" />
									</>
								)}
								<div className="px-3 py-1.5">
									<h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System</h4>
								</div>
								{systemDirs.map((dir) => (
									<button
										key={dir.path}
										onClick={() => handleSystemDirClick(dir)}
										className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left ${
											selectedSystemDir === dir.path ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
										}`}
									>
										<Folder className="h-4 w-4 flex-shrink-0" />
										<span className="truncate">{dir.name}</span>
									</button>
								))}
							</div>
						</ScrollArea>
					</div>

					<div className="flex-1 flex flex-col overflow-hidden">
						<div className="px-4 h-[49px] border-b border-border flex items-center gap-2">
							<Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleBack} disabled={!canGoBack}>
								<ChevronLeft className="h-4 w-4" />
							</Button>
							<Input
								value={currentPath}
								onKeyDown={handlePathInput}
								placeholder="Enter path..."
								className="flex-1 h-8 text-sm font-mono"
								onChange={(e) => setCurrentPath(e.target.value)}
							/>
							{hasTibiaFiles && (
								<Badge variant="default" className="bg-green-600 hover:bg-green-600 text-white gap-1.5">
									<CheckCircle2 className="h-3 w-3" />
									<span className="text-xs">Tibia.dat & Tibia.spr</span>
								</Badge>
							)}
							<Button
								size="icon"
								variant="ghost"
								onClick={toggleFavorite}
								className={`h-8 w-8 ${isFavorite ? 'text-yellow-500' : ''}`}
								title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
							>
								<Star className={`h-4 w-4 ${isFavorite ? 'fill-yellow-500' : ''}`} />
							</Button>
							<Button size="icon" variant="ghost" className="h-8 w-8" onClick={initializePath} title="Go to home directory">
								<Home className="h-4 w-4" />
							</Button>
						</div>

						<ScrollArea className="flex-1 px-4">
							{loading ? (
								<div className="flex items-center justify-center h-32 text-muted-foreground">Loading...</div>
							) : error ? (
								<div className="flex items-center justify-center h-32 text-destructive">{error}</div>
							) : entries.length === 0 ? (
								<div className="flex items-center justify-center h-32 text-muted-foreground">No entries found</div>
							) : (
								<div className="py-2 space-y-1">
									{entries
										.filter((entry) => entry.is_dir)
										.map((entry) => (
											<button
												key={entry.path}
												onClick={() => handleEntryClick(entry)}
												className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent transition-colors text-left"
											>
												<Folder className="h-4 w-4 text-blue-500" />
												<span className="flex-1 text-sm">{entry.name}</span>
												<ChevronRight className="h-4 w-4 text-muted-foreground" />
											</button>
										))}
								</div>
							)}
						</ScrollArea>
					</div>
				</div>

				<div className="border-t border-border px-4 py-3 flex items-center justify-end gap-2">
					{!pathOnlyMode && (
						<div className="flex items-center gap-2 mr-2">
							<Checkbox
								id="transparency"
								checked={transparency}
								onCheckedChange={(checked) => setTransparency(checked === true)}
							/>
							<Label
								htmlFor="transparency"
								className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								Enable Alpha Channel
							</Label>
						</div>
					)}
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button onClick={handleSelect} disabled={!currentPath}>
						Select Folder
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
};
