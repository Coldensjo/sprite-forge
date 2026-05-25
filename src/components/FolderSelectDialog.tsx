import { join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import React, { useRef, useState, useEffect } from 'react';
import {
	readOtfiFile,
	readDatHeader,
	readSprHeader,
	type OtfiData,
	type DatHeader,
	type SprHeader,
	type ClientVersion
} from '@/lib/tibia';
import {
	X,
	Info,
	Home,
	Star,
	Image,
	Folder,
	Loader2,
	Monitor,
	Package,
	ArrowUp,
	Settings,
	Download,
	Computer,
	FileText,
	RefreshCw,
	HardDrive,
	ArrowLeft,
	ArrowRight,
	AlertCircle,
	ChevronDown,
	ChevronRight,
	CheckCircle2
} from 'lucide-react';

import { Label } from './ui/label';
import { Switch } from './ui/switch';

export interface LoadOptions {
	extended: boolean;
	folderPath: string;
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
}

interface DirEntry {
	name: string;
	path: string;
	is_dir: boolean;
	size: null | number;
	modified_ms: null | number;
}

interface DriveInfo {
	label: string;
	letter: string;
}

interface FavoriteFolder {
	name: string;
	path: string;
}

interface SystemDirectory {
	name: string;
	path: string;
}

interface FolderSelectDialogProps {
	open: boolean;
	title?: string;
	onOpenChange: (open: boolean) => void;
	onLoad?: (options: LoadOptions) => void;
	onFolderSelected?: (path: string) => void;
	onSelect?: (path: string, transparency: boolean) => void;
}

interface AssetInfo {
	error: null | string;
	otfi: null | OtfiData;
	datHeader: null | DatHeader;
	sprHeader: null | SprHeader;
	version: null | ClientVersion;
}

const EXIT_MS = 160;

function pathString(segments: string[]): string {
	if (segments.length === 0) return '';
	if (segments.length === 1) {
		const seg = segments[0];
		return /^[A-Za-z]:$/.test(seg) ? seg + '\\' : seg;
	}
	const head = /^[A-Za-z]:$/.test(segments[0]) ? segments[0] + '\\' : segments[0];
	return [head, ...segments.slice(1)].join('\\').replace(/\\+/g, '\\');
}

function pathSegments(p: string): string[] {
	return p.split(/[\\/]+/).filter(Boolean);
}

function pathsEqual(a: string, b: string): boolean {
	const norm = (s: string) =>
		s
			.replace(/[\\/]+$/, '')
			.replace(/[\\/]+/g, '/')
			.toLowerCase();
	return norm(a) === norm(b);
}

function driveLabel(letter: string, drives: DriveInfo[]): string {
	return drives.find((d) => d.letter === letter)?.label ?? letter;
}

function getFolderName(path: string): string {
	const segs = pathSegments(path);
	return segs[segs.length - 1] || path;
}

const dateFmt = new Intl.DateTimeFormat(undefined, {
	day: '2-digit',
	year: 'numeric',
	hour: '2-digit',
	month: '2-digit',
	minute: '2-digit'
});

function formatModified(ms: null | number): string {
	if (ms === null) return '';
	return dateFmt.format(new Date(ms));
}

function formatSize(bytes: null | number): string {
	if (bytes === null) return '';
	if (bytes < 1024) return `${bytes} B`;
	const kb = bytes / 1024;
	if (kb < 1024) return `${kb.toFixed(1)} KB`;
	const mb = kb / 1024;
	if (mb < 1024) return `${mb.toFixed(1)} MB`;
	const gb = mb / 1024;
	return `${gb.toFixed(1)} GB`;
}

function entryType(entry: DirEntry): string {
	if (entry.is_dir) return 'File folder';
	const dot = entry.name.lastIndexOf('.');
	if (dot < 1) return 'File';
	return `${entry.name.slice(dot + 1).toUpperCase()} File`;
}

export const FolderSelectDialog = ({
	open,
	onLoad,
	onSelect,
	onOpenChange,
	onFolderSelected,
	title = 'Select Folder'
}: FolderSelectDialogProps) => {
	const assetMode = !!onLoad;
	const pathOnlyMode = !assetMode && !!onFolderSelected && !onSelect;

	const [mounted, setMounted] = useState(open);
	const [drives, setDrives] = useState<DriveInfo[]>([]);
	const [systemDirs, setSystemDirs] = useState<SystemDirectory[]>([]);
	const [favorites, setFavorites] = useState<FavoriteFolder[]>([]);
	const [history, setHistory] = useState<string[][]>([[]]);
	const [historyIndex, setHistoryIndex] = useState(0);
	const [entries, setEntries] = useState<DirEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<null | string>(null);
	const [selected, setSelected] = useState<null | string>(null);
	const [nameInput, setNameInput] = useState('');
	const [refreshTick, setRefreshTick] = useState(0);
	const [computerExpanded, setComputerExpanded] = useState(true);

	const [hasTibiaFiles, setHasTibiaFiles] = useState(false);
	const [assetLoading, setAssetLoading] = useState(false);
	const [assetInfo, setAssetInfo] = useState<AssetInfo>({
		otfi: null,
		error: null,
		version: null,
		datHeader: null,
		sprHeader: null
	});
	const [extended, setExtended] = useState(false);
	const [transparency, setTransparency] = useState(false);
	const [improvedAnimations, setImprovedAnimations] = useState(false);
	const [frameGroups, setFrameGroups] = useState(false);

	const path = history[historyIndex];
	const currentPathString = pathString(path);
	const isCurrentFavorited = favorites.some((f) => pathsEqual(f.path, currentPathString));

	useEffect(() => {
		if (open) {
			setMounted(true);
			return;
		}
		if (!mounted) return;
		const t = window.setTimeout(() => setMounted(false), EXIT_MS);
		return () => window.clearTimeout(t);
	}, [open, mounted]);

	useEffect(() => {
		if (!mounted) return;
		let cancelled = false;

		const init = async () => {
			try {
				const [d, favs, sysDirs] = await Promise.all([
					invoke<DriveInfo[]>('list_drives').catch(() => [] as DriveInfo[]),
					invoke<FavoriteFolder[]>('get_favorite_folders').catch(() => [] as FavoriteFolder[]),
					invoke<SystemDirectory[]>('get_system_directories').catch(() => [] as SystemDirectory[])
				]);
				if (cancelled) return;
				setDrives(d);
				setFavorites(favs);
				setSystemDirs(sysDirs);

				let startPath = '';
				try {
					const last = await invoke<null | string>('get_last_folder');
					if (last) startPath = last;
				} catch {
					/* ignore */
				}
				if (!startPath) {
					try {
						startPath = await invoke<string>('get_home_dir');
					} catch {
						startPath = '';
					}
				}
				if (cancelled) return;
				if (startPath) {
					setHistory([pathSegments(startPath)]);
					setHistoryIndex(0);
				} else {
					setHistory([[]]);
					setHistoryIndex(0);
				}
			} catch (e) {
				if (!cancelled) setError(String(e));
			}
		};

		void init();
		return () => {
			cancelled = true;
		};
	}, [mounted]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onOpenChange(false);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [open, onOpenChange]);

	useEffect(() => {
		if (path.length === 0) {
			setEntries(
				drives.map((d) => ({
					size: null,
					is_dir: true,
					name: d.label,
					path: d.letter,
					modified_ms: null
				}))
			);
			setLoading(false);
			setError(null);
			setHasTibiaFiles(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);
		const target = pathString(path);

		invoke<DirEntry[]>('list_directory', { path: target })
			.then((es) => {
				if (cancelled) return;
				setEntries(es);
				setLoading(false);
			})
			.catch((e) => {
				if (cancelled) return;
				setError(String(e));
				setEntries([]);
				setLoading(false);
			});

		invoke<boolean[]>('check_files_exist', { path: target, filenames: ['Tibia.dat', 'Tibia.spr'] })
			.then((res) => {
				if (cancelled) return;
				setHasTibiaFiles(res.length === 2 && res[0] && res[1]);
			})
			.catch(() => {
				if (!cancelled) setHasTibiaFiles(false);
			});

		return () => {
			cancelled = true;
		};
	}, [path, drives, refreshTick]);

	useEffect(() => {
		if (!assetMode || !hasTibiaFiles || !currentPathString) {
			setAssetInfo({ otfi: null, error: null, version: null, datHeader: null, sprHeader: null });
			setAssetLoading(false);
			return;
		}

		let cancelled = false;
		setAssetLoading(true);
		setAssetInfo({ otfi: null, error: null, version: null, datHeader: null, sprHeader: null });

		(async () => {
			try {
				const datPath = await join(currentPathString, 'Tibia.dat');
				const sprPath = await join(currentPathString, 'Tibia.spr');
				const [datHeader, sprHeaderRaw, otfi] = await Promise.all([
					readDatHeader(datPath),
					readSprHeader(sprPath),
					readOtfiFile(currentPathString)
				]);
				if (cancelled) return;
				const sprHeader: SprHeader = {
					extended: sprHeaderRaw.extended,
					signature: sprHeaderRaw.signature,
					spriteCount: sprHeaderRaw.spriteCount ?? (sprHeaderRaw as any).sprite_count
				};
				const version = datHeader.version;
				setAssetInfo({ otfi, version, datHeader, sprHeader, error: null });
				if (otfi) {
					setExtended(otfi.extended);
					setTransparency(otfi.transparency);
					setImprovedAnimations(otfi.frameDurations);
					setFrameGroups(otfi.frameGroups);
				} else if (version) {
					setExtended(version.supportsExtended);
					setTransparency(version.supportsAlphaChannel);
					setImprovedAnimations(version.supportsFrameDurations);
					setFrameGroups(version.supportsFrameDurations);
				}
			} catch (err) {
				if (!cancelled) {
					setAssetInfo({
						otfi: null,
						version: null,
						datHeader: null,
						sprHeader: null,
						error: err instanceof Error ? err.message : 'Failed to read file headers'
					});
				}
			} finally {
				if (!cancelled) setAssetLoading(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [assetMode, hasTibiaFiles, currentPathString]);

	const navigateTo = (next: string[]) => {
		const trimmed = history.slice(0, historyIndex + 1);
		trimmed.push(next);
		setHistory(trimmed);
		setHistoryIndex(trimmed.length - 1);
		setSelected(null);
		setNameInput('');
	};

	const goBack = () => {
		if (historyIndex > 0) {
			setHistoryIndex(historyIndex - 1);
			setSelected(null);
			setNameInput('');
		}
	};

	const goForward = () => {
		if (historyIndex < history.length - 1) {
			setHistoryIndex(historyIndex + 1);
			setSelected(null);
			setNameInput('');
		}
	};

	const goUp = () => {
		if (path.length > 0) navigateTo(path.slice(0, -1));
	};

	const onRowClick = (entry: DirEntry) => {
		setSelected(entry.path);
		setNameInput(entry.name);
	};

	const onRowDoubleClick = (entry: DirEntry) => {
		if (!entry.is_dir) return;
		if (path.length === 0) {
			navigateTo([entry.path]);
		} else {
			navigateTo([...path, entry.name]);
		}
	};

	const confirmCurrent = async () => {
		const target = currentPathString;
		if (!target) return;
		try {
			await invoke('set_last_folder', { path: target });
		} catch {
			/* */
		}
		if (assetMode && onLoad) {
			onLoad({ extended, frameGroups, transparency, improvedAnimations, folderPath: target });
		} else if (pathOnlyMode && onFolderSelected) {
			onFolderSelected(target);
		} else if (onSelect) {
			onSelect(target, transparency);
		}
		onOpenChange(false);
	};

	const canLoad = assetMode && hasTibiaFiles && !!assetInfo.datHeader && !!assetInfo.sprHeader && !assetLoading;

	const saveFavorites = async (next: FavoriteFolder[]) => {
		setFavorites(next);
		try {
			await invoke('set_favorite_folders', { folders: next });
		} catch {
			/* */
		}
	};

	const toggleFavorite = async (targetPath: string) => {
		const exists = favorites.some((f) => pathsEqual(f.path, targetPath));
		if (exists) {
			await saveFavorites(favorites.filter((f) => !pathsEqual(f.path, targetPath)));
		} else {
			await saveFavorites([...favorites, { path: targetPath, name: getFolderName(targetPath) }]);
		}
	};

	const reorderFavorites = (from: number, to: number) => {
		if (from === to) return;
		const next = [...favorites];
		const [item] = next.splice(from, 1);
		next.splice(from < to ? to - 1 : to, 0, item);
		void saveFavorites(next);
	};

	if (!mounted) return null;
	const closing = !open;

	return (
		<div onMouseDown={() => onOpenChange(false)} className={'fb-backdrop' + (closing ? ' fb-closing' : '')}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onMouseDown={(e) => e.stopPropagation()}
				className={'fb-dialog' + (closing ? ' fb-closing' : '')}
			>
				<header className="fb-titlebar">
					<span className="fb-title">{title}</span>
					<button aria-label="Close" className="fb-titlebar-close" onClick={() => onOpenChange(false)}>
						<X size={14} />
					</button>
				</header>

				<Toolbar
					path={path}
					onUp={goUp}
					drives={drives}
					onBack={goBack}
					onForward={goForward}
					canUp={path.length > 0}
					canBack={historyIndex > 0}
					canFavorite={path.length > 0}
					isFavorited={isCurrentFavorited}
					onCrumb={(i) => navigateTo(path.slice(0, i))}
					canForward={historyIndex < history.length - 1}
					onRefresh={() => setRefreshTick((t) => t + 1)}
					onToggleFavorite={() => toggleFavorite(currentPathString)}
				/>

				<div className="fb-body">
					<Sidebar
						drives={drives}
						currentPath={path}
						favorites={favorites}
						systemDirs={systemDirs}
						onNavigate={(p) => navigateTo(p)}
						computerExpanded={computerExpanded}
						onReorderFavorites={reorderFavorites}
						onRemoveFavorite={(p) => toggleFavorite(p)}
						onToggleComputer={() => setComputerExpanded((v) => !v)}
					/>
					{assetMode && hasTibiaFiles ? (
						<TibiaAssetPanel
							info={assetInfo}
							extended={extended}
							loading={assetLoading}
							frameGroups={frameGroups}
							transparency={transparency}
							onExtendedChange={setExtended}
							onFrameGroupsChange={setFrameGroups}
							onTransparencyChange={setTransparency}
							improvedAnimations={improvedAnimations}
							onImprovedAnimationsChange={setImprovedAnimations}
						/>
					) : (
						<FileList
							error={error}
							loading={loading}
							entries={entries}
							currentPath={path}
							selected={selected}
							favorites={favorites}
							onRowClick={onRowClick}
							onRowDoubleClick={onRowDoubleClick}
							onToggleFavorite={(p) => toggleFavorite(p)}
						/>
					)}
				</div>

				<footer className="fb-footer">
					<label className="fb-field">
						<span className="fb-field-label">Name:</span>
						<div className="fb-field-input">
							<input
								value={nameInput}
								className="fb-input"
								onChange={(e) => setNameInput(e.target.value)}
								placeholder={currentPathString || 'No folder selected'}
								onKeyDown={(e) => {
									if (e.key === 'Enter') void confirmCurrent();
								}}
							/>
							<button type="button" aria-label="History" className="fb-input-chevron">
								<ChevronDown size={12} />
							</button>
						</div>
					</label>
					{!pathOnlyMode && !assetMode && (
						<label className="fb-transparency">
							<input type="checkbox" checked={transparency} onChange={(e) => setTransparency(e.target.checked)} />
							<span>Enable Alpha Channel</span>
						</label>
					)}
					<div className="fb-footer-buttons">
						<button type="button" className="fb-btn" onClick={() => onOpenChange(false)}>
							Cancel
						</button>
						{assetMode ? (
							<button type="button" disabled={!canLoad} className="fb-btn fb-btn-primary" onClick={() => void confirmCurrent()}>
								{assetLoading ? (
									<span className="fb-btn-loading">
										<Loader2 size={14} className="fb-spin" />
										Reading…
									</span>
								) : (
									'Load'
								)}
							</button>
						) : (
							<button
								type="button"
								disabled={!currentPathString}
								className="fb-btn fb-btn-primary"
								onClick={() => void confirmCurrent()}
							>
								Select Folder
							</button>
						)}
					</div>
				</footer>
			</div>
		</div>
	);
};

/* ---------- Toolbar ---------- */

interface ToolbarProps {
	path: string[];
	canUp: boolean;
	canBack: boolean;
	onUp: () => void;
	onBack: () => void;
	drives: DriveInfo[];
	canForward: boolean;
	isFavorited: boolean;
	canFavorite: boolean;
	onForward: () => void;
	onRefresh: () => void;
	onCrumb: (i: number) => void;
	onToggleFavorite: () => void;
}

function Toolbar({
	path,
	onUp,
	canUp,
	drives,
	onBack,
	canBack,
	onCrumb,
	onForward,
	onRefresh,
	canForward,
	isFavorited,
	canFavorite,
	onToggleFavorite
}: ToolbarProps) {
	return (
		<div className="fb-toolbar">
			<div className="fb-nav-group">
				<button type="button" onClick={onBack} aria-label="Back" disabled={!canBack} className="fb-icon-button">
					<ArrowLeft size={14} />
				</button>
				<button type="button" onClick={onForward} aria-label="Forward" disabled={!canForward} className="fb-icon-button">
					<ArrowRight size={14} />
				</button>
				<button type="button" aria-label="Recent" className="fb-icon-button">
					<ChevronDown size={14} />
				</button>
				<button type="button" onClick={onUp} aria-label="Up" disabled={!canUp} className="fb-icon-button">
					<ArrowUp size={14} />
				</button>
			</div>

			<div className="fb-breadcrumb">
				<button type="button" className="fb-crumb" onClick={() => onCrumb(0)}>
					<Computer size={14} />
					<span>This PC</span>
				</button>
				{path.map((seg, i) => (
					<span key={i} className="fb-crumb-wrap">
						<ChevronRight size={14} className="fb-crumb-sep" />
						<button type="button" className="fb-crumb" onClick={() => onCrumb(i + 1)} title={pathString(path.slice(0, i + 1))}>
							{i === 0 ? driveLabel(seg, drives) : seg}
						</button>
					</span>
				))}
				<ChevronRight size={14} className="fb-crumb-sep" />
				<button type="button" aria-label="History" className="fb-crumb-history">
					<ChevronDown size={14} />
				</button>
			</div>

			<button
				type="button"
				disabled={!canFavorite}
				onClick={onToggleFavorite}
				aria-label="Favorite current folder"
				title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
				className={'fb-icon-button fb-fav-toggle' + (isFavorited ? ' fb-fav-toggle-active' : '')}
			>
				<Star size={14} fill={isFavorited ? 'currentColor' : 'none'} />
			</button>

			<button type="button" onClick={onRefresh} aria-label="Refresh" className="fb-icon-button">
				<RefreshCw size={14} />
			</button>
		</div>
	);
}

/* ---------- Sidebar ---------- */

interface SidebarProps {
	drives: DriveInfo[];
	currentPath: string[];
	computerExpanded: boolean;
	favorites: FavoriteFolder[];
	onToggleComputer: () => void;
	systemDirs: SystemDirectory[];
	onNavigate: (path: string[]) => void;
	onRemoveFavorite: (path: string) => void;
	onReorderFavorites: (from: number, to: number) => void;
}

const quickAccessIcons: Record<string, React.ReactNode> = {
	Home: <Home size={14} className="fb-tree-icon" />,
	Desktop: <Monitor size={14} className="fb-tree-icon" />,
	Documents: <FileText size={14} className="fb-tree-icon" />,
	Downloads: <Download size={14} className="fb-tree-icon" />
};

function Sidebar({
	drives,
	favorites,
	systemDirs,
	onNavigate,
	currentPath,
	onRemoveFavorite,
	computerExpanded,
	onToggleComputer,
	onReorderFavorites
}: SidebarProps) {
	const currentString = pathString(currentPath);
	const dragIdxRef = useRef<null | number>(null);
	const [dragIdx, setDragIdx] = useState<null | number>(null);
	const [dropIdx, setDropIdx] = useState<null | number>(null);
	const [dropAfter, setDropAfter] = useState(false);

	const onDragStart = (e: React.DragEvent, idx: number) => {
		dragIdxRef.current = idx;
		setDragIdx(idx);
		e.dataTransfer.effectAllowed = 'move';
		e.dataTransfer.setData('text/plain', String(idx));
	};

	const onDragOver = (e: React.DragEvent, idx: number) => {
		if (dragIdxRef.current === null) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'move';
		const rect = e.currentTarget.getBoundingClientRect();
		const after = e.clientY - rect.top > rect.height / 2;
		if (dropIdx !== idx || dropAfter !== after) {
			setDropIdx(idx);
			setDropAfter(after);
		}
	};

	const onDrop = (e: React.DragEvent, idx: number) => {
		e.preventDefault();
		const from = dragIdxRef.current;
		if (from === null) return;
		const target = dropAfter ? idx + 1 : idx;
		if (from !== idx) onReorderFavorites(from, target);
		dragIdxRef.current = null;
		setDragIdx(null);
		setDropIdx(null);
	};

	const onDragEnd = () => {
		dragIdxRef.current = null;
		setDragIdx(null);
		setDropIdx(null);
	};

	return (
		<aside className="fb-sidebar">
			<ul className="fb-tree">
				{favorites.map((fav, idx) => {
					const isDragging = dragIdx === idx;
					const showBefore = dropIdx === idx && !dropAfter && dragIdx !== null && dragIdx !== idx;
					const showAfter = dropIdx === idx && dropAfter && dragIdx !== null && dragIdx !== idx;
					return (
						<li key={fav.path}>
							<div
								draggable
								tabIndex={0}
								role="button"
								title={fav.path}
								onDragEnd={onDragEnd}
								onDrop={(e) => onDrop(e, idx)}
								onDragOver={(e) => onDragOver(e, idx)}
								onDragStart={(e) => onDragStart(e, idx)}
								onClick={() => onNavigate(pathSegments(fav.path))}
								onDragEnter={(e) => {
									if (dragIdxRef.current !== null) e.preventDefault();
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										onNavigate(pathSegments(fav.path));
									}
								}}
								className={
									'fb-tree-row' +
									(pathsEqual(fav.path, currentString) ? ' fb-tree-row-active' : '') +
									(isDragging ? ' fb-tree-row-dragging' : '') +
									(showBefore ? ' fb-tree-row-drop-before' : '') +
									(showAfter ? ' fb-tree-row-drop-after' : '')
								}
							>
								<span className="fb-caret-spacer" />
								<Folder size={15} className="fb-tree-icon fb-icon-folder" />
								<span className="fb-tree-label">{fav.name}</span>
								<button
									type="button"
									title="Remove from favorites"
									className="fb-tree-pin-button"
									aria-label="Remove from favorites"
									onClick={(e) => {
										e.stopPropagation();
										onRemoveFavorite(fav.path);
									}}
								>
									<X size={11} />
								</button>
							</div>
						</li>
					);
				})}

				{systemDirs.length > 0 && (
					<li className="fb-tree-section">
						<ul className="fb-tree-children">
							{systemDirs.map((dir) => {
								const isActive = pathsEqual(pathString(currentPath), dir.path);
								return (
									<li key={dir.path}>
										<button
											type="button"
											onClick={() => onNavigate(pathSegments(dir.path))}
											className={'fb-tree-row' + (isActive ? ' fb-tree-row-active' : '')}
										>
											<span className="fb-caret-spacer" />
											{quickAccessIcons[dir.name] ?? <Folder size={14} className="fb-tree-icon" />}
											<span>{dir.name}</span>
										</button>
									</li>
								);
							})}
						</ul>
					</li>
				)}

				<li className="fb-tree-section">
					<button type="button" onClick={onToggleComputer} className="fb-tree-row fb-tree-header">
						<Caret open={computerExpanded} />
						<Computer size={15} className="fb-tree-icon" />
						<span>This PC</span>
					</button>
					{computerExpanded && (
						<ul className="fb-tree-children">
							{drives.map((d) => {
								const isActive = currentPath.length === 1 && currentPath[0] === d.letter;
								return (
									<li key={d.letter}>
										<button
											type="button"
											onClick={() => onNavigate([d.letter])}
											className={'fb-tree-row' + (isActive ? ' fb-tree-row-active' : '')}
										>
											<span className="fb-caret-spacer" />
											<HardDrive size={14} className="fb-tree-icon" />
											<span>{d.label}</span>
										</button>
									</li>
								);
							})}
						</ul>
					)}
				</li>
			</ul>
		</aside>
	);
}

function Caret({ open }: { open: boolean }) {
	return (
		<span className={'fb-caret' + (open ? ' fb-caret-open' : '')}>
			<ChevronRight size={14} />
		</span>
	);
}

/* ---------- File list ---------- */

interface FileListProps {
	loading: boolean;
	entries: DirEntry[];
	error: null | string;
	currentPath: string[];
	selected: null | string;
	favorites: FavoriteFolder[];
	onRowClick: (e: DirEntry) => void;
	onRowDoubleClick: (e: DirEntry) => void;
	onToggleFavorite: (path: string) => void;
}

function FileList({
	error,
	entries,
	loading,
	selected,
	favorites,
	onRowClick,
	currentPath,
	onRowDoubleClick,
	onToggleFavorite
}: FileListProps) {
	return (
		<div className="fb-list">
			<div className="fb-list-header">
				<div className="fb-col fb-col-name">
					<span>Name</span>
				</div>
				<div className="fb-col fb-col-modified">Date modified</div>
				<div className="fb-col fb-col-type">Type</div>
				<div className="fb-col fb-col-size">Size</div>
			</div>
			<div className="fb-list-body">
				{error ? (
					<div className="fb-list-empty">Could not open this folder.</div>
				) : loading ? (
					<div className="fb-list-empty">Loading…</div>
				) : entries.length === 0 ? (
					<div className="fb-list-empty">This folder is empty.</div>
				) : (
					entries.map((entry) => {
						const entryPath = currentPath.length === 0 ? entry.path : pathString([...currentPath, entry.name]);
						const favorited = entry.is_dir && favorites.some((f) => pathsEqual(f.path, entryPath));
						const disabled = !entry.is_dir;
						return (
							<div
								key={entry.path}
								onClick={() => onRowClick(entry)}
								onDoubleClick={() => onRowDoubleClick(entry)}
								className={
									'fb-list-row' +
									(selected === entry.path ? ' fb-list-row-active' : '') +
									(disabled ? ' fb-list-row-disabled' : '')
								}
							>
								<div className="fb-col fb-col-name">
									{entry.is_dir ? (
										<Folder size={15} className="fb-row-icon fb-icon-folder" />
									) : (
										<FileText size={15} className="fb-row-icon" />
									)}
									<span className="fb-row-name">{entry.name}</span>
									{entry.is_dir && currentPath.length > 0 && (
										<button
											type="button"
											className={'fb-row-star' + (favorited ? ' fb-row-star-on' : '')}
											title={favorited ? 'Remove from favorites' : 'Add to favorites'}
											onClick={(e) => {
												e.stopPropagation();
												onToggleFavorite(entryPath);
											}}
										>
											<Star size={15} fill={favorited ? 'currentColor' : 'none'} />
										</button>
									)}
								</div>
								<div className="fb-col fb-col-modified">{formatModified(entry.modified_ms)}</div>
								<div className="fb-col fb-col-type">{entryType(entry)}</div>
								<div className="fb-col fb-col-size">{formatSize(entry.size)}</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

/* ---------- Tibia asset panel ---------- */

interface TibiaAssetPanelProps {
	info: AssetInfo;
	loading: boolean;
	extended: boolean;
	frameGroups: boolean;
	transparency: boolean;
	improvedAnimations: boolean;
	onExtendedChange: (v: boolean) => void;
	onFrameGroupsChange: (v: boolean) => void;
	onTransparencyChange: (v: boolean) => void;
	onImprovedAnimationsChange: (v: boolean) => void;
}

function formatSignature(sig: number): string {
	return sig.toString(16).toUpperCase();
}

function TibiaAssetPanel({
	info,
	loading,
	extended,
	frameGroups,
	transparency,
	onExtendedChange,
	improvedAnimations,
	onFrameGroupsChange,
	onTransparencyChange,
	onImprovedAnimationsChange
}: TibiaAssetPanelProps) {
	return (
		<div className="fb-asset-panel">
			<div className="fb-asset-header">
				<Package size={15} className="fb-asset-header-icon" />
				<h3 className="fb-asset-header-title">Asset Information</h3>
			</div>
			<div className="fb-asset-row">
				<div className="fb-asset-field">
					<Label className="fb-asset-label">
						<Info size={13} className="fb-asset-label-icon" />
						Version
					</Label>
					<div className="fb-asset-value">
						{loading ? (
							<span className="fb-asset-value-muted">
								<Loader2 size={12} className="fb-spin" />
								Detecting…
							</span>
						) : info.version ? (
							<span className="fb-asset-value-ok">
								<CheckCircle2 size={13} />
								{info.version.label}
							</span>
						) : (
							<span className="fb-asset-value-muted">Unknown</span>
						)}
					</div>
				</div>
				<div className="fb-asset-field">
					<Label className="fb-asset-label">Sprite Dimension</Label>
					<div className="fb-asset-value">
						<span>32×32</span>
					</div>
				</div>
			</div>

			<div className="fb-asset-field">
				<Label className="fb-asset-label">
					<Settings size={13} className="fb-asset-label-icon" />
					Options
					{!loading && info.otfi && (
						<span className="fb-asset-otfi-badge">
							<FileText size={11} />
							from OTFI
						</span>
					)}
				</Label>
				<div className="fb-asset-options">
					<label className="fb-asset-toggle">
						<span>Extended</span>
						<Switch checked={extended} disabled={loading} className="scale-75" onCheckedChange={onExtendedChange} />
					</label>
					<label className="fb-asset-toggle">
						<span>Transparency</span>
						<Switch disabled={loading} className="scale-75" checked={transparency} onCheckedChange={onTransparencyChange} />
					</label>
					<label className="fb-asset-toggle">
						<span>Improved animations</span>
						<Switch
							disabled={loading}
							className="scale-75"
							checked={improvedAnimations}
							onCheckedChange={onImprovedAnimationsChange}
						/>
					</label>
					<label className="fb-asset-toggle">
						<span>Frame Groups</span>
						<Switch disabled={loading} className="scale-75" checked={frameGroups} onCheckedChange={onFrameGroupsChange} />
					</label>
				</div>
			</div>

			<div className="fb-asset-row">
				<div className="fb-asset-card">
					<Label className="fb-asset-label fb-asset-card-label">
						<span className="fb-asset-card-title">
							<Package size={13} className="fb-asset-label-icon" />
							DAT File
						</span>
						{!loading && info.datHeader && (
							<span className="fb-asset-value-ok">
								<CheckCircle2 size={12} />
								Valid
							</span>
						)}
					</Label>
					<div className="fb-asset-card-body">
						{loading ? (
							<span className="fb-asset-value-muted">
								<Loader2 size={13} className="fb-spin" />
								Reading…
							</span>
						) : info.datHeader ? (
							<dl className="fb-asset-stats">
								<dt>Signature:</dt>
								<dd className="fb-asset-stat-primary font-mono">{formatSignature(info.datHeader.signature)}</dd>
								<dt>Items:</dt>
								<dd className="font-mono">{info.datHeader.itemsCount.toLocaleString()}</dd>
								<dt>Outfits:</dt>
								<dd className="font-mono">{info.datHeader.outfitsCount.toLocaleString()}</dd>
								<dt>Effects:</dt>
								<dd className="font-mono">{info.datHeader.effectsCount.toLocaleString()}</dd>
								<dt>Missiles:</dt>
								<dd className="font-mono">{info.datHeader.missilesCount.toLocaleString()}</dd>
							</dl>
						) : (
							<span className="fb-asset-value-error">
								<AlertCircle size={13} />
								{info.error || 'Not found'}
							</span>
						)}
					</div>
				</div>
				<div className="fb-asset-card">
					<Label className="fb-asset-label fb-asset-card-label">
						<span className="fb-asset-card-title">
							<Image size={13} className="fb-asset-label-icon" />
							SPR File
						</span>
						{!loading && info.sprHeader && (
							<span className="fb-asset-value-ok">
								<CheckCircle2 size={12} />
								Valid
							</span>
						)}
					</Label>
					<div className="fb-asset-card-body">
						{loading ? (
							<span className="fb-asset-value-muted">
								<Loader2 size={13} className="fb-spin" />
								Reading…
							</span>
						) : info.sprHeader ? (
							<dl className="fb-asset-stats">
								<dt>Signature:</dt>
								<dd className="fb-asset-stat-primary font-mono">{formatSignature(info.sprHeader.signature)}</dd>
								<dt>Sprites:</dt>
								<dd className="font-mono">{info.sprHeader.spriteCount.toLocaleString()}</dd>
							</dl>
						) : (
							<span className="fb-asset-value-error">
								<AlertCircle size={13} />
								{info.error || 'Not found'}
							</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
