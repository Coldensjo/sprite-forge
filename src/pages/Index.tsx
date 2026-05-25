import { Toolbar } from '@/components/Toolbar';
import { ItemList } from '@/components/ItemList';
import { useTheme } from '@/contexts/ThemeContext';
import { SpriteList } from '@/components/SpriteList';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { OpenedItemsPanel } from '@/components/OpenedItemsPanel';
import { usePanelSettings } from '@/contexts/PanelSettingsContext';
import { VisualizationPanel } from '@/components/VisualizationPanel';

const Index = () => {
	const { settings } = usePanelSettings();
	const { acrylic, isWindows } = useTheme();

	const isMac = navigator.userAgent.includes('Mac');
	const transparentRoot = (isWindows && acrylic) || isMac;

	return (
		<div
			className={`h-screen flex flex-col ${transparentRoot ? 'bg-transparent' : 'bg-background'} ${isMac ? 'rounded-xl overflow-hidden border border-white/10 shadow-2xl' : ''}`}
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
