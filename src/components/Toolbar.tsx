import { FileUp, Save, FolderOpen, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export const Toolbar = () => {
  return (
    <div className="h-11 bg-toolbar-bg border-b border-border/50 flex items-center px-3 gap-3">
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
          <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
          Open Project
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
          <FileUp className="h-3.5 w-3.5 mr-1.5" />
          Import Sprites
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-xs font-medium">
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save
        </Button>
      </div>
      
      <div className="h-5 w-px bg-border/50" />
      
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input 
          placeholder="Search items or sprites..." 
          className="pl-8 h-8 bg-secondary/50 border-border/50 text-xs rounded-lg"
        />
      </div>
      
      <div className="ml-auto text-[11px] text-muted-foreground">
        <span className="font-mono">v8.60 v2</span>
      </div>
    </div>
  );
};
