import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ControlsProps {
  speed: number;
  setSpeed: (value: number) => void;
  fontSize: number;
  setFontSize: (value: number) => void;
  position: "top" | "center" | "bottom";
  setPosition: (value: "top" | "center" | "bottom") => void;
  mirrorMode: boolean;
  setMirrorMode: (value: boolean) => void;
}

const Controls = ({
  speed,
  setSpeed,
  fontSize,
  setFontSize,
  position,
  setPosition,
  mirrorMode,
  setMirrorMode,
}: ControlsProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-card rounded-lg border">
      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Velocidade: {speed}x
        </Label>
        <Slider
          value={[speed]}
          onValueChange={([value]) => setSpeed(value)}
          min={1}
          max={10}
          step={0.5}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Tamanho da Fonte: {fontSize}px
        </Label>
        <Slider
          value={[fontSize]}
          onValueChange={([value]) => setFontSize(value)}
          min={16}
          max={72}
          step={2}
          className="w-full"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">Posição do Texto</Label>
        <Select value={position} onValueChange={(value: "top" | "center" | "bottom") => setPosition(value)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="top">Topo</SelectItem>
            <SelectItem value="center">Centro</SelectItem>
            <SelectItem value="bottom">Rodapé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between sm:flex-col sm:items-start space-y-0 sm:space-y-2">
        <Label className="text-sm font-medium">Modo Espelho</Label>
        <Switch
          checked={mirrorMode}
          onCheckedChange={setMirrorMode}
        />
      </div>
    </div>
  );
};

export default Controls;
