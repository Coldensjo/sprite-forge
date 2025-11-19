import { useState, useMemo } from "react";
import { ScrollArea } from "./ui/scroll-area";
import { cn } from "@/lib/utils";
import { SkipBack, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, SkipForward } from "lucide-react";

interface Sprite {
  id: number;
  color: string;
  icon?: string;
}

const mockSprites: Sprite[] = [
  { id: 0, color: "#1e3a8a" },
  { id: 1, color: "#4b5563" },
  { id: 2, color: "#10b981", icon: "✓" },
  { id: 3, color: "#f3f4f6", icon: "✏️" },
  { id: 4, color: "#3b82f6", icon: "💎" },
  { id: 5, color: "#6b7280" },
  { id: 6, color: "#f59e0b", icon: "⚔️" },
  { id: 7, color: "#8b5cf6" },
  { id: 8, color: "#d1d5db", icon: "⭐" },
  { id: 9, color: "#9ca3af", icon: "🔧" },
  { id: 10, color: "#ef4444" },
  { id: 11, color: "#dc2626" },
  { id: 12, color: "#b91c1c" },
  { id: 13, color: "#991b1b" },
  { id: 14, color: "#7f1d1d" },
  { id: 15, color: "#6b7280" },
  { id: 16, color: "#b91c1c" },
  { id: 17, color: "#991b1b" },
  { id: 18, color: "#4b5563" },
  { id: 19, color: "#374151" },
  { id: 20, color: "#1f2937" },
];

export const SpriteList = () => {
  const [selectedId, setSelectedId] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 100;

  const totalPages = Math.ceil(mockSprites.length / itemsPerPage);
  const paginatedSprites = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return mockSprites.slice(start, end);
  }, [currentPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="w-64 bg-card rounded-lg shadow-island flex flex-col overflow-hidden relative">
      <div className="h-10 px-3 flex items-center border-b border-border/50 bg-secondary/50">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprites</h2>
        <span className="ml-auto text-xs text-muted-foreground font-mono">{mockSprites.length}</span>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1 pb-16">
          {paginatedSprites.map((sprite) => (
            <button
              key={sprite.id}
              onClick={() => setSelectedId(sprite.id)}
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-md transition-all",
                "hover:bg-item-hover",
                selectedId === sprite.id && "bg-primary/15 ring-1 ring-primary/50"
              )}
            >
              <div 
                className="w-9 h-9 rounded-md border border-border/50 flex items-center justify-center flex-shrink-0 text-base shadow-sm"
                style={{ backgroundColor: sprite.color }}
              >
                {sprite.icon}
              </div>
              <div className="flex-1 text-left">
                <div className="text-xs text-muted-foreground font-mono">Sprite {sprite.id}</div>
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
