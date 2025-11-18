import { useState, useRef, useEffect } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { SkipBack, ChevronLeft, Play, ChevronRight, SkipForward, GripVertical } from "lucide-react";

export const PropertiesPanel = () => {
  const [leftWidth, setLeftWidth] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [offsetEnabled, setOffsetEnabled] = useState(false);
  const [lightEnabled, setLightEnabled] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      const minWidth = 200;
      const maxWidth = containerRect.width - 200;
      setLeftWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  return (
    <div className="flex-1 bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
      <div className="h-10 px-4 flex items-center border-b border-border/50 bg-secondary/50">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Item Properties</h2>
      </div>

      <div className="flex-1 overflow-auto p-4" ref={containerRef}>
        <div className="flex gap-4 mb-4">
          <div className="flex-shrink-0" style={{ width: `${leftWidth}px` }}>
            <div className="flex flex-col items-center justify-between space-y-4">
              <div className="relative w-full">
                <div className="w-full aspect-square bg-secondary/30 border border-border/50 rounded-lg flex items-center justify-center">
                  <div
                    className="w-3/4 h-3/4 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg"
                    style={{ boxShadow: "0 0 40px rgba(251, 146, 60, 0.4)", transform: "rotate(-5deg)" }}
                  />
                </div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-secondary/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-muted-foreground font-mono border border-border/50">
                  32x32
                </div>
              </div>
              <div className="w-full flex flex-col items-center gap-2">
                <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 border border-border/50">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary">
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/20">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-secondary">
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                <div className="bg-secondary/50 backdrop-blur-sm px-3 py-1 rounded text-xs text-muted-foreground font-mono border border-border/50">
                  Frame 1/8
                </div>
              </div>
            </div>
          </div>

          <div
            className="relative flex items-center justify-center w-4 flex-shrink-0 cursor-col-resize group"
            onMouseDown={() => setIsResizing(true)}
          >
            <div className="absolute inset-y-0 left-1/2 w-px bg-border/50 group-hover:bg-primary/30 transition-colors" />
            <div className="relative z-10 flex h-10 w-3 items-center justify-center rounded-md border border-border/50 bg-secondary/80 group-hover:bg-secondary group-hover:border-primary/50 transition-all shadow-sm">
              <GripVertical className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-w-0">
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Dimensions & Pattern</h3>
              </div>
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="space-y-1">
                  <Label htmlFor="width" className="text-xs font-medium text-muted-foreground/90">
                    Width
                  </Label>
                  <Input
                    id="width"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="1"
                    className="h-8 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="height" className="text-xs font-medium text-muted-foreground/90">
                    Height
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="1"
                    className="h-8 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="crop-size" className="text-xs font-medium text-muted-foreground/90">
                    Crop Size
                  </Label>
                  <Input
                    id="crop-size"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="32"
                    className="h-8 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="layers" className="text-xs font-medium text-muted-foreground/90">
                    Layers
                  </Label>
                  <Input
                    id="layers"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="1"
                    className="h-8 text-xs font-mono text-right bg-background/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="pattern-x" className="text-xs font-medium text-muted-foreground/90">
                    Pattern X
                  </Label>
                  <Input
                    id="pattern-x"
                    type="number"
                    defaultValue="4"
                    className="h-8 text-xs font-mono text-center bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pattern-y" className="text-xs font-medium text-muted-foreground/90">
                    Pattern Y
                  </Label>
                  <Input
                    id="pattern-y"
                    type="number"
                    defaultValue="4"
                    className="h-8 text-xs font-mono text-center bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="pattern-z" className="text-xs font-medium text-muted-foreground/90">
                    Pattern Z
                  </Label>
                  <Input
                    id="pattern-z"
                    type="number"
                    defaultValue="1"
                    className="h-8 text-xs font-mono text-center bg-background/50"
                  />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Animation</h3>
              </div>
              <div className="space-y-1">
                <Label htmlFor="animations" className="text-xs font-medium text-muted-foreground/90">
                  Frames
                </Label>
                <Input
                  id="animations"
                  type="number"
                  defaultValue="1"
                  className="h-8 text-xs font-mono text-right bg-background/50"
                />
              </div>
            </div>
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-0.5 h-3 bg-primary rounded-full" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Offset</h3>
                </div>
                <Switch id="offset-enabled" checked={offsetEnabled} onCheckedChange={setOffsetEnabled} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="offset-x" className="text-xs font-medium text-muted-foreground/90">
                    Offset X
                  </Label>
                  <Input
                    id="offset-x"
                    type="number"
                    defaultValue="0"
                    disabled={!offsetEnabled}
                    className="h-8 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="offset-y" className="text-xs font-medium text-muted-foreground/90">
                    Offset Y
                  </Label>
                  <Input
                    id="offset-y"
                    type="number"
                    defaultValue="0"
                    disabled={!offsetEnabled}
                    className="h-8 text-xs font-mono text-right bg-background/50"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* properties panel */}
        <div className="flex gap-4 mt-4">
          <div className="flex-1 space-y-4 min-w-0">
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Floor Settings</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="floor" className="text-xs">
                    Is Floor
                  </Label>
                  <Switch id="floor" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-0.5 h-3 bg-primary rounded-full" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Light Settings</h3>
                </div>
                <Switch id="light-enabled" checked={lightEnabled} onCheckedChange={setLightEnabled} />
              </div>
              <div className="space-y-3.5">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="light-color" className="text-xs font-medium text-muted-foreground/90 whitespace-nowrap">
                    Light Color
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      id="light-color" 
                      type="number" 
                      defaultValue="156" 
                      disabled={!lightEnabled}
                      className="h-8 w-20 text-xs font-mono text-right bg-background/50" 
                    />
                    <div className="w-8 h-8 rounded border border-border bg-orange-500 flex-shrink-0" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="light-intensity" className="text-xs font-medium text-muted-foreground/90 whitespace-nowrap">
                    Intensity
                  </Label>
                  <div className="flex gap-3 items-center flex-1 max-w-[180px]">
                    <Slider 
                      defaultValue={[3]} 
                      max={5} 
                      step={1} 
                      disabled={!lightEnabled}
                      className="flex-1" 
                    />
                    <span className="text-xs text-muted-foreground font-mono w-6 text-right">3</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Flags</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Can Be Grabbed</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Stackable</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Blocks Path</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Full Ground</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Ignore Look</Label>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Type</h3>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-xs">
                  Item Type
                </Label>
                <Select defaultValue="ground">
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ground">Ground</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                    <SelectItem value="weapon">Weapon</SelectItem>
                    <SelectItem value="armor">Armor</SelectItem>
                    <SelectItem value="effect">Effect</SelectItem>
                    <SelectItem value="projectile">Projectile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Object Settings</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="appears-minimap" className="text-xs">
                    Appears on Minimap
                  </Label>
                  <Switch id="appears-minimap" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has-displacement" className="text-xs">
                    Has Displacement
                  </Label>
                  <Switch id="has-displacement" />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="has-elevation" className="text-xs">
                    Has Elevation
                  </Label>
                  <Switch id="has-elevation" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="elevation" className="text-xs">
                    Elevation
                  </Label>
                  <Input id="elevation" type="number" defaultValue="0" className="h-8" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Reading/Writing</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Can Read</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Can Write Once</Label>
                  <Switch />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-chars" className="text-xs">
                    Max Characters
                  </Label>
                  <Input id="max-chars" type="number" defaultValue="0" className="h-8" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
