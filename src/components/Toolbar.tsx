import { useState } from "react";
import { Save, FolderOpen, Minus, Square, X, Search, Eye, List } from "lucide-react";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTibiaData } from "@/contexts/TibiaDataContext";
import { usePanelSettings } from "@/contexts/PanelSettingsContext";
import { loadTibiaData } from "@/lib/tibia";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LoadingDialog } from "./LoadingDialog";
import { FindDialog } from "./FindDialog";
import { FolderSelectDialog } from "./FolderSelectDialog";

export const Toolbar = () => {
  const { data, setData, setLoading, setError, isLoading, loadingProgress } = useTibiaData();
  const { settings, togglePanel } = usePanelSettings();
  const { toast } = useToast();
  const [findDialogOpen, setFindDialogOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);

  const handleFolderSelect = async (selectedPath: string) => {
    try {
      setLoading(true);
      setError(null);

      const datPath = `${selectedPath}\\Tibia.dat`;
      const sprPath = `${selectedPath}\\Tibia.spr`;

      const tibiaData = await loadTibiaData(
        datPath,
        sprPath,
        undefined,
        (stage, current, total) => {
          setLoading(true, { stage, current, total });
        }
      );

      setData(tibiaData, null as any);
      setLoading(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load files';
      setError(errorMessage);
      setLoading(false);

      toast({
        variant: "destructive",
        title: "Error loading files",
        description: errorMessage,
      });
    }
  };

  const handleOpenFiles = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFolderDialogOpen(true);
  };

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
    <>
      <LoadingDialog
        open={isLoading}
        stage={loadingProgress?.stage}
        current={loadingProgress?.current}
        total={loadingProgress?.total}
      />

      <div className="h-11 bg-toolbar-bg border-b border-border/50 flex items-center px-3 gap-1" data-tauri-drag-region>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-medium"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={handleOpenFiles}
            disabled={isLoading}
          >
            <FolderOpen className="h-3.5 w-3.5 mr-1.5" />
            Open Files
          </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs font-medium"
          onMouseDown={(e) => e.stopPropagation()}
          disabled={!data}
        >
          <Save className="h-3.5 w-3.5 mr-1.5" />
          Save
        </Button>
        </div>

        <div className="h-5 w-px bg-border/50 flex-shrink-0"/>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs font-medium"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => setFindDialogOpen(true)}
          disabled={!data}
        >
          <Search className="h-3.5 w-3.5 mr-1.5" />
          Find
        </Button>

        <div className="h-5 w-px bg-border/50 flex-shrink-0"/>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  settings.showVisualization && "bg-primary/20 text-primary"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => togglePanel('showVisualization')}
              >
                <Eye className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Visualization Panel</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-8 w-8",
                  settings.showOpenedItems && "bg-primary/20 text-primary"
                )}
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => togglePanel('showOpenedItems')}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle Opened Objects Panel</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="ml-auto text-[11px] text-muted-foreground flex-shrink-0" >
          <span className="font-mono">
            {data ? `v${data.version.label} | ${data.itemsCount} items` : 'No files loaded'}
          </span>
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

      <FindDialog open={findDialogOpen} onOpenChange={setFindDialogOpen} />
      <FolderSelectDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        onSelect={handleFolderSelect}
        title="Select folder containing Tibia.dat and Tibia.spr"
      />
    </>
  );
};
