import { Toolbar } from "@/components/Toolbar";
import { ItemList } from "@/components/ItemList";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { SpriteList } from "@/components/SpriteList";
import { VisualizationPanel } from "@/components/VisualizationPanel";
import { OpenedItemsPanel } from "@/components/OpenedItemsPanel";
import { usePanelSettings } from "@/contexts/PanelSettingsContext";

const Index = () => {
  const { settings } = usePanelSettings();

  return (
    <div className="h-screen flex flex-col bg-background">
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
