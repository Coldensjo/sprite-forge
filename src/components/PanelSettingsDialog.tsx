import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";
import { Switch } from "./ui/switch";
import { usePanelSettings } from "@/contexts/PanelSettingsContext";

interface PanelSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PanelSettingsDialog = ({ open, onOpenChange }: PanelSettingsDialogProps) => {
  const { settings, togglePanel } = usePanelSettings();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Panel Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="visualization" className="text-sm">
              Show Visualization Panel
            </Label>
            <Switch
              id="visualization"
              checked={settings.showVisualization}
              onCheckedChange={() => togglePanel('showVisualization')}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="opened-items" className="text-sm">
              Show Opened Items Panel
            </Label>
            <Switch
              id="opened-items"
              checked={settings.showOpenedItems}
              onCheckedChange={() => togglePanel('showOpenedItems')}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

