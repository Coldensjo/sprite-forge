import { useState } from "react";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Separator } from "./ui/separator";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { SkipBack, ChevronLeft, Play, ChevronRight, SkipForward, ChevronUp, ChevronDown } from "lucide-react";

export const PropertiesPanel = () => {
  const [offsetEnabled, setOffsetEnabled] = useState(false);
  const [lightEnabled, setLightEnabled] = useState(true);
  const [lightIntensity, setLightIntensity] = useState(3);


  return (
    <div className="flex-1 bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
      <div className="h-10 px-4 flex items-center border-b border-border/50 bg-secondary/50">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Item Properties</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
        <div className="flex gap-4 mb-4">
          <div className="flex-shrink-0 w-[360px]">
            <div className="flex flex-col items-center justify-between space-y-4">
              <div className="relative w-full">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-secondary/90 backdrop-blur-sm rounded-md p-1 border border-border/50 shadow-lg">
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-secondary/50">
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-secondary/50">
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 bg-secondary border border-border hover:bg-secondary/80">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-secondary/50">
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
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

          <div className="flex flex-col gap-4 flex-1">
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-4 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Dimensions</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="width" className="text-xs whitespace-nowrap text-foreground">
                    Width
                  </Label>
                  <Input
                    id="width"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="1"
                    className="h-8 w-16 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="height" className="text-xs whitespace-nowrap text-foreground">
                    Height
                  </Label>
                  <Input
                    id="height"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="1"
                    className="h-8 w-16 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="crop-size" className="text-xs whitespace-nowrap text-foreground">
                    Crop Size
                  </Label>
                  <Input
                    id="crop-size"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="32"
                    className="h-8 w-16 text-xs font-mono text-right bg-background/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="layers" className="text-xs whitespace-nowrap text-foreground">
                    Layers
                  </Label>
                  <Input
                    id="layers"
                    type="number"
                    min="1"
                    max="128"
                    defaultValue="1"
                    className="h-8 w-16 text-xs font-mono text-right bg-background/50"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-4 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Pattern & Frames</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pattern-x" className="text-xs whitespace-nowrap text-foreground">
                    Pattern X
                  </Label>
                  <Input
                    id="pattern-x"
                    type="number"
                    defaultValue="4"
                    className="h-8 w-16 text-xs font-mono text-center bg-background/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pattern-y" className="text-xs whitespace-nowrap text-foreground">
                    Pattern Y
                  </Label>
                  <Input
                    id="pattern-y"
                    type="number"
                    defaultValue="4"
                    className="h-8 w-16 text-xs font-mono text-center bg-background/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pattern-z" className="text-xs whitespace-nowrap text-foreground">
                    Pattern Z
                  </Label>
                  <Input
                    id="pattern-z"
                    type="number"
                    defaultValue="1"
                    className="h-8 w-16 text-xs font-mono text-center bg-background/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="frames" className="text-xs whitespace-nowrap text-foreground">
                    Frames
                  </Label>
                  <Input
                    id="frames"
                    type="number"
                    defaultValue="1"
                    className="h-8 w-16 text-xs font-mono text-right bg-background/50"
                  />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center justify-between pb-2 mb-4 border-b border-border/30">
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
              <div className="flex items-center justify-between pb-2 mb-4 border-b border-border/30">
                <div className="flex items-center gap-1.5">
                  <div className="w-0.5 h-3 bg-primary rounded-full" />
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Light Settings</h3>
                </div>
                <Switch id="light-enabled" checked={lightEnabled} onCheckedChange={setLightEnabled} />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="light-color" className="text-xs whitespace-nowrap">
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
                  <Label htmlFor="light-intensity" className="text-xs whitespace-nowrap">
                    Intensity
                  </Label>
                  <div className="flex gap-2 items-center flex-1 max-w-[180px]">
                    <Slider
                      value={[lightIntensity]}
                      onValueChange={(value) => setLightIntensity(value[0])}
                      max={5}
                      step={1}
                      disabled={!lightEnabled}
                      className="flex-1"
                    />
                    <Input
                      id="light-intensity"
                      type="number"
                      min="0"
                      max="5"
                      value={lightIntensity}
                      onChange={(e) => setLightIntensity(Number(e.target.value))}
                      disabled={!lightEnabled}
                      className="h-8 w-12 text-xs font-mono text-right bg-background/50"
                    />
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

          </div>

          <div className="flex-1 space-y-4 min-w-0">
            <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-md p-3 border border-border/40">
              <div className="flex items-center gap-1.5 pb-2 mb-3 border-b border-border/30">
                <div className="w-0.5 h-3 bg-primary rounded-full" />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Object Settings</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="type" className="text-xs">
                    Item Type
                  </Label>
                  <Select defaultValue="ground">
                    <SelectTrigger className="h-8 w-32">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="elevation" className="text-xs">
                    Elevation
                  </Label>
                  <Input id="elevation" type="number" defaultValue="0" className="h-8 w-20 text-xs font-mono text-right bg-background/50" />
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
      </ScrollArea>
    </div>
  );
};
