import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Separator } from "./ui/separator";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "./ui/resizable";

export const PropertiesPanel = () => {
  return (
    <div className="flex-1 bg-card rounded-lg shadow-island-lg flex flex-col overflow-hidden">
      <div className="h-10 px-4 flex items-center border-b border-border/50 bg-secondary/50">
        <h2 className="text-xs font-semibold text-foreground uppercase tracking-wide">Item Properties</h2>
      </div>

      <Tabs defaultValue="appearance" className="flex-1 flex flex-col">
        <TabsList className="mx-4 mt-2 w-auto">
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="properties">Properties</TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
              <div className="h-full flex flex-col items-center justify-center p-6">
                <div className="relative w-full max-w-md">
                  <div className="w-full aspect-square bg-secondary/30 border border-border/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <div className="w-3/4 h-3/4 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-island-lg" 
                         style={{ 
                           boxShadow: "0 0 40px rgba(251, 146, 60, 0.4)",
                           transform: "rotate(-5deg)"
                         }} 
                    />
                  </div>
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-secondary/90 backdrop-blur-sm px-3 py-1 rounded-md text-xs text-muted-foreground font-mono border border-border/50">
                    32x32 pixels
                  </div>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={60} minSize={40}>
              <div className="h-full overflow-auto p-3">
                <div className="space-y-3 max-w-sm mx-auto">
                  <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-lg p-3 space-y-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/30">
                      <div className="w-0.5 h-3 bg-primary rounded-full" />
                      <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Dimensions</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="width" className="text-[10px] font-medium text-muted-foreground/90">Width</Label>
                        <Input id="width" type="number" min="1" max="128" defaultValue="1" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="height" className="text-[10px] font-medium text-muted-foreground/90">Height</Label>
                        <Input id="height" type="number" min="1" max="128" defaultValue="1" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="crop-size" className="text-[10px] font-medium text-muted-foreground/90">Crop Size</Label>
                        <Input id="crop-size" type="number" min="1" max="128" defaultValue="32" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="layers" className="text-[10px] font-medium text-muted-foreground/90">Layers</Label>
                        <Input id="layers" type="number" min="1" max="128" defaultValue="1" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-lg p-3 space-y-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/30">
                      <div className="w-0.5 h-3 bg-primary rounded-full" />
                      <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Pattern</h3>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="pattern-x" className="text-[10px] font-medium text-muted-foreground/90 block text-center">X</Label>
                        <Input id="pattern-x" type="number" min="1" max="128" defaultValue="4" className="h-7 w-full text-xs font-mono text-center bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="pattern-y" className="text-[10px] font-medium text-muted-foreground/90 block text-center">Y</Label>
                        <Input id="pattern-y" type="number" min="1" max="128" defaultValue="4" className="h-7 w-full text-xs font-mono text-center bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="pattern-z" className="text-[10px] font-medium text-muted-foreground/90 block text-center">Z</Label>
                        <Input id="pattern-z" type="number" min="1" max="128" defaultValue="1" className="h-7 w-full text-xs font-mono text-center bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-lg p-3 space-y-2.5 border border-border/40">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-border/30">
                      <div className="w-0.5 h-3 bg-primary rounded-full" />
                      <h3 className="text-[10px] font-bold text-foreground uppercase tracking-wider">Animation</h3>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="animations" className="text-[10px] font-medium text-muted-foreground/90">Frame Count</Label>
                      <Input id="animations" type="number" min="1" max="128" defaultValue="1" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                    </div>

                    <Separator className="my-2 bg-border/50" />

                    <div className="space-y-2">
                      <div className="text-[10px] font-semibold text-muted-foreground/80 uppercase tracking-wider">Position Offset</div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="offset-x" className="text-[10px] font-medium text-muted-foreground/90">X</Label>
                          <Input id="offset-x" type="number" min="-128" max="128" defaultValue="0" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="offset-y" className="text-[10px] font-medium text-muted-foreground/90">Y</Label>
                          <Input id="offset-y" type="number" min="-128" max="128" defaultValue="0" className="h-7 w-full text-xs font-mono text-right bg-background/50 border-border/50 hover:border-primary/50 transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="properties" className="flex-1 p-4 space-y-4 overflow-auto">
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Floor Settings</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="floor" className="text-xs">Is Floor</Label>
              <Switch id="floor" />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="light" className="text-xs">Has Light</Label>
              <Switch id="light" defaultChecked />
            </div>

            <div className="space-y-2">
              <Label htmlFor="light-color" className="text-xs">Light Color</Label>
              <div className="flex gap-2">
                <Input id="light-color" type="number" defaultValue="156" className="h-8" />
                <div className="w-8 h-8 rounded border border-border bg-orange-500" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="light-intensity" className="text-xs">Light Intensity</Label>
              <div className="flex gap-3 items-center">
                <Slider defaultValue={[3]} max={5} step={1} className="flex-1" />
                <span className="text-xs text-muted-foreground w-8">3</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Object Settings</h3>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="appears-minimap" className="text-xs">Appears on Minimap</Label>
              <Switch id="appears-minimap" />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="has-displacement" className="text-xs">Has Displacement</Label>
              <Switch id="has-displacement" />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="has-elevation" className="text-xs">Has Elevation</Label>
              <Switch id="has-elevation" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="elevation" className="text-xs">Elevation</Label>
              <Input id="elevation" type="number" defaultValue="0" className="h-8" />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Flags</h3>
            
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

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Reading/Writing</h3>
            
            <div className="flex items-center justify-between">
              <Label className="text-xs">Can Read</Label>
              <Switch />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Can Write Once</Label>
              <Switch />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-chars" className="text-xs">Max Characters</Label>
              <Input id="max-chars" type="number" defaultValue="0" className="h-8" />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Type</h3>
            
            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs">Item Type</Label>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
