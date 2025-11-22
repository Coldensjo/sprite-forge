import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { generateOutfitColorPalette } from '@/lib/tibia/outfit';

interface TibiaColorPickerProps {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
    className?: string;
}

// Generate the exact Tibia outfit color palette (133 colors using HSI model)
const OUTFIT_COLORS = generateOutfitColorPalette();

export const TibiaColorPicker = ({ value, onChange, disabled, className }: TibiaColorPickerProps) => {
    // Ensure value is within 0-132 range (133 total outfit colors)
    const displayColor = value >= 0 && value < OUTFIT_COLORS.length ? OUTFIT_COLORS[value] : 'transparent';

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <Input
                type="number"
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                disabled={disabled}
                className="h-7 w-16 text-xs font-mono text-right bg-background/50 shadow-sm hover:bg-background/80 transition-colors px-1"
            />
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-7 h-7 p-0 shrink-0 border-border bg-background/50"
                        disabled={disabled}
                        style={{ backgroundColor: displayColor }}
                    >
                        <span className="sr-only">Pick color</span>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2">
                    <div className="grid grid-cols-12 gap-1">
                        {OUTFIT_COLORS.map((color, index) => (
                            <button
                                key={index}
                                className={cn(
                                    "w-4 h-4 rounded-sm border border-border/50 hover:scale-125 transition-transform",
                                    value === index && "ring-2 ring-primary border-primary"
                                )}
                                style={{ backgroundColor: color }}
                                onClick={() => onChange(index)}
                                title={`Color ID: ${index}`}
                            />
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};
