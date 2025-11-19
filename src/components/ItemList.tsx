import { useState, useMemo } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { SkipBack, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, SkipForward } from "lucide-react";

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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 100;

  const totalPages = Math.ceil(mockItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return mockItems.slice(start, end);
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="w-64 bg-card rounded-lg shadow-island flex flex-col overflow-hidden relative">
      <div className="h-10 px-3 flex items-center border-b border-border/50 bg-secondary/50">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Items</h2>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{mockItems.length}</span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1 pb-16">
          {paginatedItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all",
                "hover:bg-item-hover",
                selectedId === item.id && "bg-primary/15 ring-1 ring-primary/50"
              )}
            >
              <div 
                className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 shadow-sm"
                style={{ backgroundColor: item.color }}
              >
                <span className="text-[9px] font-mono font-bold text-white/90 drop-shadow">
                  {item.id}
                </span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs text-foreground truncate font-medium">{item.name}</div>
                <div className="text-[10px] text-muted-foreground font-mono">ID: {item.id}</div>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>

      <div className="absolute bottom-0 left-0 right-0 p-2 bg-card/95 backdrop-blur-sm border-t border-border/50">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors",
              currentPage === 1 && "opacity-50 cursor-not-allowed"
            )}
          >
            <SkipBack className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 5)}
            disabled={currentPage <= 5}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors",
              currentPage <= 5 && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronsLeft className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors",
              currentPage === 1 && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronLeft className="w-3.5 h-3.5 text-foreground" />
          </button>
          <div className="w-12 h-7 flex items-center justify-center rounded bg-secondary/50 text-xs font-mono text-foreground mx-1">
            {currentPage}
          </div>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors",
              currentPage === totalPages && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronRight className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 5)}
            disabled={currentPage + 5 > totalPages}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors",
              currentPage + 5 > totalPages && "opacity-50 cursor-not-allowed"
            )}
          >
            <ChevronsRight className="w-3.5 h-3.5 text-foreground" />
          </button>
          <button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage === totalPages}
            className={cn(
              "w-7 h-7 flex items-center justify-center rounded bg-secondary hover:bg-secondary/80 transition-colors",
              currentPage === totalPages && "opacity-50 cursor-not-allowed"
            )}
          >
            <SkipForward className="w-3.5 h-3.5 text-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};
