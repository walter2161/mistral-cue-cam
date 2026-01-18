import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Settings2, ChevronDown, RotateCcw, Volume2 } from "lucide-react";

export interface CalibrationSettings {
  // Tolerância de matching
  levenshteinTolerance: number; // 1-5 (quantas letras podem diferir)
  matchThreshold: number; // 0-100% (porcentagem mínima de similaridade)
  
  // Timing
  analysisDelay: number; // ms antes de chamar Mistral
  wordAdvanceDelay: number; // ms antes de avançar palavra
  
  // Comportamento
  pauseOnError: boolean;
  autoResumeAfterCorrection: boolean;
  wordsLookAhead: number; // quantas palavras olhar à frente
  wordsLookBehind: number; // quantas palavras olhar para trás
  
  // Áudio feedback
  audioFeedback: boolean;
}

interface CalibrationPanelProps {
  settings: CalibrationSettings;
  onSettingsChange: (settings: CalibrationSettings) => void;
  onReset: () => void;
}

export const defaultCalibrationSettings: CalibrationSettings = {
  levenshteinTolerance: 2,
  matchThreshold: 70,
  analysisDelay: 1500,
  wordAdvanceDelay: 200,
  pauseOnError: true,
  autoResumeAfterCorrection: false,
  wordsLookAhead: 3,
  wordsLookBehind: 2,
  audioFeedback: false,
};

const CalibrationPanel = ({
  settings,
  onSettingsChange,
  onReset,
}: CalibrationPanelProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const updateSetting = <K extends keyof CalibrationSettings>(
    key: K,
    value: CalibrationSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const playTestSound = (type: "correct" | "incorrect") => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === "correct") {
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.type = "sine";
    } else {
      oscillator.frequency.setValueAtTime(220, audioContext.currentTime);
      oscillator.type = "square";
    }
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            <span>Calibração do Assistente</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-4 pt-4">
        {/* Tolerância de Matching */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Tolerância de Pronúncia: {settings.levenshteinTolerance}
          </Label>
          <p className="text-xs text-muted-foreground">
            Quantas letras podem diferir entre o falado e esperado
          </p>
          <Slider
            value={[settings.levenshteinTolerance]}
            onValueChange={([val]) => updateSetting("levenshteinTolerance", val)}
            min={0}
            max={5}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Estrito</span>
            <span>Flexível</span>
          </div>
        </div>

        {/* Limiar de Correspondência */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Similaridade Mínima: {settings.matchThreshold}%
          </Label>
          <p className="text-xs text-muted-foreground">
            Porcentagem de similaridade para aceitar a palavra
          </p>
          <Slider
            value={[settings.matchThreshold]}
            onValueChange={([val]) => updateSetting("matchThreshold", val)}
            min={40}
            max={100}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>40% Tolerante</span>
            <span>100% Exato</span>
          </div>
        </div>

        {/* Tempo de Análise */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Tempo de Análise: {settings.analysisDelay}ms
          </Label>
          <p className="text-xs text-muted-foreground">
            Quanto tempo esperar antes de chamar IA para análise
          </p>
          <Slider
            value={[settings.analysisDelay]}
            onValueChange={([val]) => updateSetting("analysisDelay", val)}
            min={500}
            max={3000}
            step={100}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Rápido</span>
            <span>Lento</span>
          </div>
        </div>

        {/* Look Ahead / Behind */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Olhar à Frente: {settings.wordsLookAhead}
            </Label>
            <Slider
              value={[settings.wordsLookAhead]}
              onValueChange={([val]) => updateSetting("wordsLookAhead", val)}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Olhar para Trás: {settings.wordsLookBehind}
            </Label>
            <Slider
              value={[settings.wordsLookBehind]}
              onValueChange={([val]) => updateSetting("wordsLookBehind", val)}
              min={0}
              max={5}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        {/* Comportamento */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Pausar em Erros</Label>
              <p className="text-xs text-muted-foreground">
                Pausar automaticamente quando detectar erro
              </p>
            </div>
            <Switch
              checked={settings.pauseOnError}
              onCheckedChange={(val) => updateSetting("pauseOnError", val)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Retomar Automático</Label>
              <p className="text-xs text-muted-foreground">
                Continuar após correção bem-sucedida
              </p>
            </div>
            <Switch
              checked={settings.autoResumeAfterCorrection}
              onCheckedChange={(val) =>
                updateSetting("autoResumeAfterCorrection", val)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Feedback Sonoro</Label>
              <p className="text-xs text-muted-foreground">
                Sons para acertos e erros
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={settings.audioFeedback}
                onCheckedChange={(val) => updateSetting("audioFeedback", val)}
              />
              {settings.audioFeedback && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    playTestSound("correct");
                    setTimeout(() => playTestSound("incorrect"), 300);
                  }}
                >
                  <Volume2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Reset */}
        <Button
          variant="outline"
          className="w-full"
          onClick={onReset}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Restaurar Padrões
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default CalibrationPanel;
