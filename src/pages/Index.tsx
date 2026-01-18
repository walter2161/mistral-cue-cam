import { useState, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, SkipBack, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import CameraPreview, { CameraPreviewRef } from "@/components/CameraPreview";
import SmartTeleprompter, { SmartTeleprompterRef } from "@/components/SmartTeleprompter";
import Controls from "@/components/Controls";
import ScriptEditor from "@/components/ScriptEditor";
import VideoRecorder from "@/components/VideoRecorder";
import AIReadingAssistant from "@/components/AIReadingAssistant";

interface WordStatus {
  word: string;
  index: number;
  status: "pending" | "current" | "correct" | "incorrect";
}

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
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [wordStatuses, setWordStatuses] = useState<WordStatus[]>([]);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const cameraRef = useRef<CameraPreviewRef>(null);
  const teleprompterRef = useRef<SmartTeleprompterRef>(null);

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
    setWordStatuses([]);
  };

  // Detect chapters - lines starting with #, numbers like "1.", "Capítulo", or all caps lines
  const getChapterPositions = useCallback(() => {
    const lines = script.split('\n');
    const chapters: { index: number; wordIndex: number; title: string }[] = [];
    let wordCount = 0;
    
    lines.forEach((line, lineIndex) => {
      const trimmed = line.trim();
      const isChapter = 
        trimmed.startsWith('#') ||
        /^(\d+[\.\):]|\[.*\]|capítulo|capitulo|parte|seção|secao)/i.test(trimmed) ||
        (trimmed.length > 3 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed));
      
      if (isChapter && trimmed.length > 0) {
        chapters.push({
          index: lineIndex,
          wordIndex: wordCount,
          title: trimmed.substring(0, 30)
        });
      }
      wordCount += line.split(/\s+/).filter(w => w.length > 0).length;
    });
    
    return chapters;
  }, [script]);

  const goToPreviousChapter = useCallback(() => {
    setIsPlaying(false);
    const chapters = getChapterPositions();
    
    if (chapters.length === 0) {
      resetTeleprompter();
      return;
    }

    // Find current chapter based on word statuses
    const currentWordIndex = wordStatuses.find(s => s.status === "current")?.index || 0;
    
    // Find the chapter we're currently in or past
    let targetChapterIdx = 0;
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].wordIndex < currentWordIndex - 5) {
        targetChapterIdx = i;
        break;
      }
    }

    // Go to that chapter
    const targetChapter = chapters[targetChapterIdx];
    if (targetChapter && teleprompterRef.current) {
      teleprompterRef.current.scrollToWord(targetChapter.wordIndex);
      setCurrentChapterIndex(targetChapterIdx);
    }
  }, [getChapterPositions, wordStatuses, resetTeleprompter]);

  const handleScrollProgressChange = (value: number[]) => {
    setScrollProgress(value[0]);
    teleprompterRef.current?.setScrollPosition(value[0]);
  };

  const handleProgressUpdate = (progress: number) => {
    setScrollProgress(progress);
  };

  const handleWordStatusChange = useCallback((statuses: WordStatus[]) => {
    setWordStatuses(statuses);
    // Auto-scroll to current word when AI assist is enabled
    const currentWord = statuses.find(s => s.status === "current");
    if (currentWord && aiAssistEnabled) {
      teleprompterRef.current?.scrollToWord(currentWord.index);
    }
  }, [aiAssistEnabled]);

  const handleAIControlCommand = useCallback((command: "pause" | "play" | "back" | "forward") => {
    switch (command) {
      case "pause":
        setIsPlaying(false);
        break;
      case "play":
        setIsPlaying(true);
        break;
      case "back":
        // Scroll back a bit
        setScrollProgress(prev => Math.max(0, prev - 10));
        teleprompterRef.current?.setScrollPosition(Math.max(0, scrollProgress - 10));
        break;
      case "forward":
        setScrollProgress(prev => Math.min(100, prev + 5));
        teleprompterRef.current?.setScrollPosition(Math.min(100, scrollProgress + 5));
        break;
    }
  }, [scrollProgress]);

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
              <SmartTeleprompter
                ref={teleprompterRef}
                key={resetKey}
                text={script}
                speed={speed}
                fontSize={fontSize}
                position={position}
                isPlaying={isPlaying}
                mirrorMode={mirrorMode}
                onProgressUpdate={handleProgressUpdate}
                wordStatuses={wordStatuses}
                aiAssistEnabled={aiAssistEnabled}
              />
            )}

            {/* Vertical Scrollbar - Right side, top -> bottom */}
            {script && (
              <div className="absolute right-3 top-3 bottom-3 z-20 flex items-center pointer-events-auto">
                <Slider
                  value={[scrollProgress]}
                  onValueChange={handleScrollProgressChange}
                  min={0}
                  max={100}
                  step={1}
                  orientation="vertical"
                  inverted
                  className="h-full"
                  aria-label="Posição do texto"
                />
              </div>
            )}
          </div>

          {/* Play Controls and Recording */}
          <div className="flex flex-wrap justify-center items-center gap-3 mt-3">
            <Button
              onClick={resetTeleprompter}
              variant="outline"
              size="lg"
              className="gap-2"
              title="Voltar ao início"
            >
              <SkipBack className="w-5 h-5" />
              Início
            </Button>
            <Button
              onClick={goToPreviousChapter}
              variant="outline"
              size="lg"
              className="gap-2"
              title="Voltar ao capítulo anterior"
              disabled={!script.trim()}
            >
              <BookOpen className="w-5 h-5" />
              Capítulo
            </Button>
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
            <VideoRecorder stream={stream} />
          </div>
        </div>

        {/* Controls and Editor Section */}
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-4">
          {/* Script Editor */}
          <div className="bg-card rounded-xl border p-4">
            <ScriptEditor script={script} setScript={setScript} />
          </div>

          {/* Right Side - Controls */}
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
            
            {/* AI Reading Assistant */}
            <div className="bg-card rounded-xl border p-4">
              <AIReadingAssistant
                script={script}
                isEnabled={aiAssistEnabled}
                setIsEnabled={setAiAssistEnabled}
                onWordStatusChange={handleWordStatusChange}
                onControlCommand={handleAIControlCommand}
                isPlaying={isPlaying}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;