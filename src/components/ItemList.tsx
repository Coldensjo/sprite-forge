import { useState } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";

interface Item {
  id: number;
  name: string;
  color: string;
}

const mockItems: Item[] = [
  { id: 100, name: "Fire Sword", color: "#ff4500" },
  { id: 101, name: "Brown Mushroom", color: "#8b4513" },
  { id: 102, name: "Stone Wall", color: "#696969" },
  { id: 103, name: "Wood Floor", color: "#8b7355" },
  { id: 104, name: "Silver Coin", color: "#c0c0c0" },
  { id: 105, name: "Green Poison", color: "#32cd32" },
  { id: 106, name: "Health Potion", color: "#ff1493" },
  { id: 107, name: "Bow", color: "#daa520" },
  { id: 108, name: "Grass Tile", color: "#228b22" },
  { id: 109, name: "Dark Grass", color: "#006400" },
  { id: 110, name: "Shield", color: "#708090" },
  { id: 111, name: "Demon Armor", color: "#8b0000" },
  { id: 112, name: "Torch", color: "#ffa500" },
  { id: 113, name: "Skull", color: "#f5f5dc" },
  { id: 114, name: "Magic Staff", color: "#4169e1" },
  { id: 115, name: "Book", color: "#4682b4" },
  { id: 116, name: "Gold Bar", color: "#ffd700" },
  { id: 117, name: "Gold Coin", color: "#ffb90f" },
  { id: 118, name: "Gold Nugget", color: "#daa520" },
  { id: 119, name: "Portal", color: "#9370db" },
  { id: 120, name: "Nature Spell", color: "#00fa9a" },
];

export const ItemList = () => {
  const [selectedId, setSelectedId] = useState<number>(100);

  return (
    <div className="w-64 bg-panel border-r border-panel-border flex flex-col">
      <div className="h-10 px-3 flex items-center border-b border-panel-border">
        <h2 className="text-sm font-semibold text-foreground">Items</h2>
        <span className="ml-auto text-xs text-muted-foreground">{mockItems.length}</span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {mockItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-1.5 rounded transition-colors",
                "hover:bg-item-hover",
                selectedId === item.id && "bg-primary/20 border border-primary"
              )}
            >
              <div 
                className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: item.color }}
              >
                <span className="text-[10px] font-bold text-white drop-shadow">
                  {item.id}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs text-foreground truncate">{item.name}</div>
                <div className="text-[10px] text-muted-foreground">ID: {item.id}</div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
