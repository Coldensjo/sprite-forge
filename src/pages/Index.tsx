import { Toolbar } from "@/components/Toolbar";
import { ItemList } from "@/components/ItemList";
import { PropertiesPanel } from "@/components/PropertiesPanel";
import { SpriteList } from "@/components/SpriteList";

const Index = () => {
  return (
    <div className="h-screen flex flex-col bg-background">
      <Toolbar />
      
      <div className="flex-1 flex overflow-hidden">
        <ItemList />
        <PropertiesPanel />
        <SpriteList />
      </div>
    </div>
  );
};

export default Index;
