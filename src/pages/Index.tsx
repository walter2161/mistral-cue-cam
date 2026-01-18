import { useState, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import CameraPreview, { CameraPreviewRef } from "@/components/CameraPreview";
import Teleprompter, { TeleprompterRef } from "@/components/Teleprompter";
import Controls from "@/components/Controls";
import ScriptEditor from "@/components/ScriptEditor";
import VideoRecorder from "@/components/VideoRecorder";

const Index = () => {
  const [script, setScript] = useState("");
  const [speed, setSpeed] = useState(3);
  const [fontSize, setFontSize] = useState(32);
  const [position, setPosition] = useState<"top" | "center" | "bottom">("top");
  const [resetKey, setResetKey] = useState(0);
  const [mirrorMode, setMirrorMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const cameraRef = useRef<CameraPreviewRef>(null);
  const teleprompterRef = useRef<TeleprompterRef>(null);

  const handleStreamReady = (mediaStream: MediaStream) => {
    setStream(mediaStream);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const resetTeleprompter = () => {
    setIsPlaying(false);
    setResetKey(prev => prev + 1);
    setScrollProgress(0);
  };

  const handleScrollProgressChange = (value: number[]) => {
    setScrollProgress(value[0]);
    teleprompterRef.current?.setScrollPosition(value[0]);
  };

  const handleProgressUpdate = (progress: number) => {
    setScrollProgress(progress);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-4">
        <header className="mb-4 text-center">
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Teleprompter Pro
          </h1>
          <p className="text-muted-foreground text-sm">
            Crie roteiros com IA e grave seus vídeos
          </p>
        </header>

        {/* Camera Preview - Centered at Top */}
        <div className="max-w-4xl mx-auto mb-4">
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-cyan-500/30">
            <CameraPreview ref={cameraRef} onStreamReady={handleStreamReady} />
            
            {/* Translucent overlay filter */}
            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
            
            {script && (
              <Teleprompter
                ref={teleprompterRef}
                key={resetKey}
                text={script}
                speed={speed}
                fontSize={fontSize}
                position={position}
                isPlaying={isPlaying}
                mirrorMode={mirrorMode}
                onProgressUpdate={handleProgressUpdate}
              />
            )}
          </div>

          {/* Scroll Progress Bar */}
          {script && (
            <div className="mt-3 px-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Posição do texto</span>
                <Slider
                  value={[scrollProgress]}
                  onValueChange={handleScrollProgressChange}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-10 text-right">{Math.round(scrollProgress)}%</span>
              </div>
            </div>
          )}

          {/* Play Controls */}
          <div className="flex justify-center gap-3 mt-3">
            <Button
              onClick={togglePlay}
              size="lg"
              className="gap-2"
              disabled={!script.trim()}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-5 h-5" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  Iniciar
                </>
              )}
            </Button>
            <Button
              onClick={resetTeleprompter}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Reiniciar
            </Button>
          </div>
        </div>

        {/* Controls and Editor Section */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          {/* Script Editor */}
          <div className="bg-card rounded-xl border p-4">
            <ScriptEditor script={script} setScript={setScript} />
          </div>

          {/* Right Side - Controls and Recording */}
          <div className="space-y-4">
            <Controls
              speed={speed}
              setSpeed={setSpeed}
              fontSize={fontSize}
              setFontSize={setFontSize}
              position={position}
              setPosition={setPosition}
              mirrorMode={mirrorMode}
              setMirrorMode={setMirrorMode}
            />

            <div className="bg-card rounded-xl border p-4">
              <h3 className="text-lg font-semibold mb-3">Gravação</h3>
              <VideoRecorder stream={stream} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;