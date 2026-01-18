import { useState, useRef } from "react";
import { Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import CameraPreview, { CameraPreviewRef } from "@/components/CameraPreview";
import Teleprompter from "@/components/Teleprompter";
import Controls from "@/components/Controls";
import ScriptEditor from "@/components/ScriptEditor";
import VideoRecorder from "@/components/VideoRecorder";

const Index = () => {
  const [script, setScript] = useState("");
  const [speed, setSpeed] = useState(3);
  const [fontSize, setFontSize] = useState(32);
  const [position, setPosition] = useState<"top" | "center" | "bottom">("center");
  const [mirrorMode, setMirrorMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const cameraRef = useRef<CameraPreviewRef>(null);

  const handleStreamReady = (mediaStream: MediaStream) => {
    setStream(mediaStream);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const resetTeleprompter = () => {
    setIsPlaying(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
            Teleprompter Pro
          </h1>
          <p className="text-muted-foreground mt-1">
            Crie roteiros com IA e grave seus vídeos
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Script Editor */}
          <div className="space-y-6">
            <div className="bg-card rounded-xl border p-4 md:p-6">
              <ScriptEditor script={script} setScript={setScript} />
            </div>

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

            <div className="flex flex-wrap gap-3">
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

          {/* Right Column - Camera & Preview */}
          <div className="space-y-4">
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border-2 border-cyan-500/30">
              <CameraPreview ref={cameraRef} onStreamReady={handleStreamReady} />
              {script && (
                <Teleprompter
                  text={script}
                  speed={speed}
                  fontSize={fontSize}
                  position={position}
                  isPlaying={isPlaying}
                  mirrorMode={mirrorMode}
                />
              )}
            </div>

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
