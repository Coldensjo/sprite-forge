import type { SidebarProps } from './types';

import React, { useRef, useState } from 'react';
import { X, Folder, Computer, HardDrive } from 'lucide-react';
import { pathString, pathsEqual, pathSegments } from '@/usecase/util/fileBrowserUtils';

import { Caret } from './Caret';
import { quickAccessIcons } from './constants';

export const Sidebar = ({
	drives,
	favorites,
	systemDirs,
	onNavigate,
	currentPath,
	onRemoveFavorite,
	computerExpanded,
	onToggleComputer,
	onReorderFavorites
}: SidebarProps) => {
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
};
