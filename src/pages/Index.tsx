import { Toolbar } from '@/components/Toolbar';
import { ItemList } from '@/components/ItemList';
import { useTheme } from '@/contexts/ThemeContext';
import { SpriteList } from '@/components/SpriteList';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { OpenedItemsPanel } from '@/components/OpenedItemsPanel';
import { usePanelSettings } from '@/contexts/PanelSettingsContext';
import { VisualizationPanel } from '@/components/VisualizationPanel';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

const ResizeHandle = () => (
	<PanelResizeHandle className="group relative w-2 flex-shrink-0 outline-none">
		<div
			style={{
				background: 'linear-gradient(to bottom, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)'
			}}
			className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-data-[resize-handle-state=hover]:opacity-100 group-data-[resize-handle-state=drag]:opacity-100"
		/>
	</PanelResizeHandle>
);

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

			<div className="flex-1 overflow-hidden p-2">
				<PanelGroup direction="horizontal" autoSaveId="sprite-forge-main-layout">
					<Panel minSize={12} maxSize={40} defaultSize={17}>
						<div className="flex flex-col gap-2 h-full">
							{settings.showVisualization && <VisualizationPanel />}
							{settings.showOpenedItems && <OpenedItemsPanel />}
							<div className="flex-1 min-h-0">
								<ItemList />
							</div>
						</div>
					</Panel>
					<ResizeHandle />
					<Panel minSize={30} defaultSize={66}>
						<PropertiesPanel />
					</Panel>
					<ResizeHandle />
					<Panel minSize={12} maxSize={40} defaultSize={17}>
						<SpriteList />
					</Panel>
				</PanelGroup>
			</div>
		</div>
	);
};

export default Index;
