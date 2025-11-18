import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Slider } from "./ui/slider";
import { Separator } from "./ui/separator";

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

        <TabsContent value="appearance" className="flex-1 p-4 space-y-6">
          <div className="flex justify-center items-center py-8">
            <div className="relative">
              <div className="w-64 h-64 bg-secondary/30 border border-border/50 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <div className="w-32 h-32 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-island-lg" 
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

          <Separator />

          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Sprite Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width" className="text-xs">Width</Label>
                <Input id="width" type="number" defaultValue="1" className="h-8" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height" className="text-xs">Height</Label>
                <Input id="height" type="number" defaultValue="1" className="h-8" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="layers" className="text-xs">Layers</Label>
              <Input id="layers" type="number" defaultValue="1" className="h-8" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern-x" className="text-xs">Pattern X</Label>
              <Input id="pattern-x" type="number" defaultValue="4" className="h-8" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern-y" className="text-xs">Pattern Y</Label>
              <Input id="pattern-y" type="number" defaultValue="4" className="h-8" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="animations" className="text-xs">Animations</Label>
              <Input id="animations" type="number" defaultValue="1" className="h-8" />
            </div>
          </div>
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
