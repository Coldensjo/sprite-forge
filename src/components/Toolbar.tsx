import { FileUp, Save, FolderOpen, Search, Minus, Square, X } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const Toolbar = () => {
  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const appWindow = getCurrentWindow();
    await appWindow.minimize();
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const appWindow = getCurrentWindow();
    await appWindow.toggleMaximize();
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const appWindow = getCurrentWindow();
    await appWindow.close();
  };

  return (
    <div className="h-11 bg-toolbar-bg border-b border-border/50 flex items-center px-3 gap-3" data-tauri-drag-region>
      <div className="flex items-center gap-1">
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs font-medium"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          Open Project
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs font-medium"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <FileUp className="h-3.5 w-3.5 mr-1.5" />
          Import Sprites
        </Button>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-8 text-xs font-medium"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save
        </Button>
      </div>
      
      <div className="h-5 w-px bg-border/50 flex-shrink-0"/>
      
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none z-10" />
        <Input 
          placeholder="Search items or sprites..." 
          className="pl-8 h-8 bg-secondary/50 border-border/50 text-xs rounded-lg relative z-10"
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      
      <div className="ml-auto text-[11px] text-muted-foreground flex-shrink-0" >
        <span className="font-mono">v8.60 v2</span>
      </div>

      <div className="ml-2 flex items-center flex-shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-secondary/50"
          onClick={handleMinimize}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-secondary/50"
          onClick={handleMaximize}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
          onClick={handleClose}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
