import { Toolbar } from '@/components/Toolbar';
import { ItemList } from '@/components/ItemList';
import { SpriteList } from '@/components/SpriteList';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { OpenedItemsPanel } from '@/components/OpenedItemsPanel';
import { usePanelSettings } from '@/contexts/PanelSettingsContext';
import { VisualizationPanel } from '@/components/VisualizationPanel';

const Index = () => {
	const { settings } = usePanelSettings();

	const isMac = navigator.userAgent.includes('Mac');

	return (
		<div
			className={`h-screen flex flex-col bg-background ${isMac ? 'rounded-xl overflow-hidden border border-white/10 shadow-2xl' : ''}`}
		>
			<Toolbar />

			<div className="flex-1 flex overflow-hidden p-2 gap-2">
				<div className="flex flex-col gap-2 w-[216px] flex-shrink-0">
					{settings.showVisualization && <VisualizationPanel />}
					{settings.showOpenedItems && <OpenedItemsPanel />}
					<div className="flex-1 min-h-0">
						<ItemList />
					</div>
				</div>
				<PropertiesPanel />
				<SpriteList />
			</div>
		</div>
	);
};

export default Index;
