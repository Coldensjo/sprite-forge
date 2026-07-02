import React from 'react';

import { Toolbar } from '~/components/Toolbar';
import { useDock } from '~/usecase/hooks/useDock';
import { Workspace } from '~/components/Workspace';
import { ItemList } from '~/components/Panels/ItemList';
import { useLuaTrees } from '~/usecase/lua/useLuaTrees';
import { LuaDockPanel } from '~/components/LuaDockPanel';
import { useTheme } from '~/usecase/context/ThemeContext';
import { TimelinePanel } from '~/components/TimelinePanel';
import { SpriteList } from '~/components/Panels/SpriteList';
import { useLuaPanels } from '~/usecase/lua/LuaPanelsContext';
import { PropertiesPanel } from '~/components/PropertiesPanel';
import { OpenedItemsPanel } from '~/components/OpenedItemsPanel';
import { RecentExportsPanel } from '~/components/RecentExportsPanel';
import { VisualizationPanel } from '~/components/VisualizationPanel';
import { usePanelSettings } from '~/usecase/context/PanelSettingsContext';
import { PanelId, panelMeta, DragHandleProps, registerExtraPanels } from '~/usecase/util/dock';

const Index = () => {
	const { settings } = usePanelSettings();
	const { acrylic, isWindows } = useTheme();
	const { panels: luaPanels, isVisible: luaVisible } = useLuaPanels();
	const { trees: luaTrees, dispatch: luaDispatch } = useLuaTrees();

	const isMac = navigator.userAgent.includes('Mac');
	const transparentRoot = (isWindows && acrylic) || isMac;

	const isLua = (id: PanelId) => luaPanels.some((p) => p.id === id);

	const isContentReady = (id: PanelId) => {
		if (id === 'visualization') return settings.showVisualization;
		if (id === 'openedItems') return settings.showOpenedItems;
		if (id === 'recentExports') return settings.showExports;
		if (id === 'timeline') return settings.showTimeline;
		if (id === 'itemList' || id === 'spriteList') return true;
		if (isLua(id)) return luaVisible(id) && luaTrees.has(id);
		return false;
	};

	const dock = useDock(isContentReady);
	const { ensurePanels } = dock;

	React.useEffect(() => {
		registerExtraPanels(luaPanels.map((p) => ({ id: p.id, title: p.title })));
		ensurePanels(luaPanels.map((p) => p.id));
	}, [luaPanels, ensurePanels]);

	const renderPanel = (id: PanelId, handle?: DragHandleProps) => {
		if (id === 'visualization') return <VisualizationPanel dragHandle={handle} />;
		if (id === 'openedItems') return <OpenedItemsPanel dragHandle={handle} />;
		if (id === 'itemList') return <ItemList dragHandle={handle} />;
		if (id === 'spriteList') return <SpriteList dragHandle={handle} />;
		if (id === 'recentExports') return <RecentExportsPanel dragHandle={handle} />;
		if (id === 'timeline') return <TimelinePanel dragHandle={handle} />;
		const tree = luaTrees.get(id);
		if (tree) return <LuaDockPanel tree={tree} dragHandle={handle} dispatch={luaDispatch} title={panelMeta(id).title} />;
		return null;
	};

	return (
		<div
			className={`h-screen flex flex-col ${transparentRoot ? 'bg-transparent' : 'bg-background'} ${isMac ? 'rounded-xl overflow-hidden border border-white/10 shadow-2xl' : ''}`}
		>
			<Toolbar />

			<Workspace dock={dock} renderPanel={renderPanel}>
				<PropertiesPanel />
			</Workspace>
		</div>
	);
};

export default Index;
