import { FileUp, Save, FolderOpen, Search } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export const Toolbar = () => {
  return (
    <div className="h-12 bg-toolbar-bg border-b border-border flex items-center px-4 gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8">
          <FolderOpen className="h-4 w-4 mr-2" />
          Open Project
        </Button>
        <Button variant="ghost" size="sm" className="h-8">
          <FileUp className="h-4 w-4 mr-2" />
          Import Sprites
        </Button>
        <Button variant="ghost" size="sm" className="h-8">
          <Save className="h-4 w-4 mr-2" />
          Save
        </Button>
      </div>
      
      <div className="h-6 w-px bg-border" />
      
      <div className="flex-1 max-w-md relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search items or sprites..." 
          className="pl-9 h-8 bg-secondary border-border"
        />
      </div>
      
      <div className="ml-auto text-xs text-muted-foreground">
        <span className="font-mono">v8.60 v2</span>
      </div>
    </div>
  );
};
