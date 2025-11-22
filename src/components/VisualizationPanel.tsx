import { ThingCategory } from '@/lib/tibia';
import { FileQuestion } from 'lucide-react';
import { useTibiaData } from '@/contexts/TibiaDataContext';

import { SpriteCanvas } from './SpriteCanvas';
import { CheckerBoard } from './CheckerBoard';

export const VisualizationPanel = () => {
	const { data, getThing, selectedCategory, highlightedItemId } = useTibiaData();
	const item = highlightedItemId ? getThing(highlightedItemId, selectedCategory) : null;

	if (!data || !item) {
		return (
			<div className="w-[216px] min-h-[150px] max-h-[200px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
				<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/50 flex-shrink-0">
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

	return (
		<div className="w-[216px] min-h-[150px] max-h-[200px] bg-card rounded-lg shadow-island flex flex-col overflow-hidden flex-shrink-0">
			<div className="h-8 px-3 flex items-center border-b border-border/50 bg-secondary/50 flex-shrink-0">
				<h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Visualization</h2>
			</div>
			<div className="flex-1 min-h-0 p-2">
				<CheckerBoard className="w-full h-full border border-border/50 rounded-lg flex items-center justify-center overflow-hidden">
					{item.spriteIndex && item.spriteIndex.length > 0 ? (
						<SpriteCanvas
							scale={1}
							showEmpty
							frame={0}
							layer={0}
							thing={item}
							patternY={0}
							patternZ={0}
							width={item.width}
							renderMode="preview"
							height={item.height}
							patternX={item.category === ThingCategory.OUTFIT ? 2 : 0}
							outfitData={
								item.category === ThingCategory.OUTFIT && item.layers > 1
									? {
											head: 0,
											body: 0,
											legs: 0,
											feet: 0,
											addons: item.patternY > 1 ? Array(item.patternY - 1).fill(false) : [false, false]
										}
									: undefined
							}
						/>
					) : (
						<div className="text-muted-foreground text-xs">No sprite</div>
					)}
				</CheckerBoard>
			</div>
		</div>
	);
};
