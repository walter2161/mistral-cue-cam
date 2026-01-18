import { useState, useRef, useCallback } from "react";
import { Circle, Square, Play, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface VideoRecorderProps {
  stream: MediaStream | null;
}

const VideoRecorder = ({ stream }: VideoRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [showPlayback, setShowPlayback] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(() => {
    if (!stream) return;

    chunksRef.current = [];
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(url);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
  }, [stream]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const playRecording = () => {
    setShowPlayback(true);
  };

  const deleteRecording = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    setShowPlayback(false);
  };

  const downloadRecording = () => {
    if (recordedBlob) {
      const a = document.createElement("a");
      a.href = recordedUrl!;
      a.download = `gravacao-${new Date().toISOString()}.webm`;
      a.click();
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {!isRecording ? (
          <Button
            onClick={startRecording}
            disabled={!stream}
            variant="destructive"
            size="lg"
            className="gap-2"
          >
            <Circle className="w-4 h-4 fill-current" />
            Gravar
          </Button>
        ) : (
          <Button onClick={stopRecording} variant="outline" size="lg" className="gap-2 animate-pulse border-red-500 text-red-500">
            <Square className="w-4 h-4 fill-current" />
            Parar
          </Button>
        )}

        {recordedUrl && (
          <>
            <Button onClick={playRecording} variant="secondary" size="lg" className="gap-2">
              <Play className="w-4 h-4" />
              Assistir
            </Button>
            <Button onClick={downloadRecording} variant="outline" size="lg" className="gap-2">
              <Download className="w-4 h-4" />
            </Button>
            <Button onClick={deleteRecording} variant="ghost" size="icon">
              <Trash2 className="w-4 h-4" />
            </Button>
          </>
        )}
      </div>

      {showPlayback && recordedUrl && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg p-4 max-w-4xl w-full max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Reprodução</h3>
              <Button
                onClick={() => setShowPlayback(false)}
                variant="ghost"
                size="sm"
              >
                Fechar
              </Button>
            </div>
            <video
              src={recordedUrl}
              controls
              autoPlay
              className="w-full rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
};

export default VideoRecorder;
