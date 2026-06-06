import type { ToolbarProps } from './types';

import { pathString, driveLabel } from '@/usecase/util/fileBrowserUtils';
import { Star, ArrowUp, Computer, RefreshCw, ArrowLeft, ArrowRight, ChevronDown, ChevronRight } from 'lucide-react';

export const Toolbar = ({
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
}: ToolbarProps) => {
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
};
