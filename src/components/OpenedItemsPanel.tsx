import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThingCategory } from '@/lib/tibia';
import { useTibiaData } from '@/contexts/TibiaDataContext';

import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';

export const OpenedItemsPanel = () => {
	const { data, openedItems, openedItemId, setOpenedItemId, removeOpenedItem, selectedCategory, setSelectedCategoryAndItem } =
		useTibiaData();

	if (!data) {
		return (
			<div className="w-[216px] max-h-[200px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
				<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/50 flex-shrink-0">
					<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Opened Objects</h2>
				</div>
				<div className="flex-1 flex items-center justify-center p-4 min-h-0">
					<div className="text-center text-muted-foreground">
						<p className="text-xs">No files loaded</p>
					</div>
				</div>
			</div>
		);
	}

	const handleItemClick = (item: { id: number; category: ThingCategory }) => {
		// Use the combined function to set both category and item atomically
		setSelectedCategoryAndItem(item.category, item.id);
	};

	const getCategoryLabel = (category: ThingCategory) => {
		switch (category) {
			case ThingCategory.ITEM:
				return 'Item';
			case ThingCategory.OUTFIT:
				return 'Outfit';
			case ThingCategory.EFFECT:
				return 'Effect';
			case ThingCategory.MISSILE:
				return 'Missile';
			default:
				return '';
		}
	};

	return (
		<div className="w-[216px] max-h-[200px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
			<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/50 flex-shrink-0">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Opened Objects</h2>
				{openedItems.length > 0 && <span className="ml-auto text-xs text-muted-foreground font-mono">{openedItems.length}</span>}
			</div>
			<ScrollArea className="flex-1 min-h-0">
				<div className="p-2 space-y-0.5">
					{openedItems.length === 0 ? (
						<div className="text-center text-muted-foreground text-xs py-8">No opened objects</div>
					) : (
						openedItems.map((item) => (
							<div
								key={`${item.category}-${item.id}`}
								onClick={() => handleItemClick(item)}
								className={cn(
									'w-full rounded-md px-2 py-1 hover:bg-item-hover transition-colors text-left cursor-pointer',
									'flex items-center justify-between',
									openedItemId === item.id && 'bg-primary/15 ring-1 ring-primary/50'
								)}
							>
								<div className="flex items-center gap-2 min-w-0">
									<div className="text-[11px] font-mono font-medium text-foreground">{item.id}</div>
									<div className="text-[10px] text-muted-foreground truncate">{getCategoryLabel(item.category)}</div>
								</div>
								<Button
									size="icon"
									variant="ghost"
									className="h-4 w-4 flex-shrink-0 hover:bg-destructive/20 hover:text-destructive"
									onClick={(e) => {
										e.stopPropagation();
										if (item.id === openedItemId) {
											setOpenedItemId(null);
										}
										removeOpenedItem(item.id, item.category);
									}}
								>
									<X className="h-3 w-3" />
								</Button>
							</div>
						))
					)}
				</div>
			</ScrollArea>
		</div>
	);
};
