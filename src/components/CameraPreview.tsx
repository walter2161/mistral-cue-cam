import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import { Camera, CameraOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CameraPreviewProps {
  onStreamReady?: (stream: MediaStream) => void;
}

export interface CameraPreviewRef {
  getStream: () => MediaStream | null;
}

const CameraPreview = forwardRef<CameraPreviewRef, CameraPreviewProps>(({ onStreamReady }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasAutoStartedRef = useRef(false);
  const isStartingRef = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useImperativeHandle(ref, () => ({
    getStream: () => stream,
  }));

  const attachStreamToVideo = (mediaStream: MediaStream) => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = mediaStream;
    // Alguns navegadores precisam de um play explícito
    void videoRef.current.play?.().catch(() => {});
  };

  const startCamera = async () => {
    if (isStartingRef.current) return;
    isStartingRef.current = true;

    try {
      setError(null);

      // Tenta câmera + microfone; se falhar (ex.: permissão do mic), cai para vídeo apenas
      let mediaStream: MediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: true,
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      }

      setStream(mediaStream);
      setCameraEnabled(true);
      attachStreamToVideo(mediaStream);
      onStreamReady?.(mediaStream);
    } catch (err) {
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
      console.error("Camera error:", err);
    } finally {
      isStartingRef.current = false;
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
      setCameraEnabled(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  useEffect(() => {
    if (hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    void startCamera();
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      {cameraEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onLoadedMetadata={() => {
            const v = videoRef.current;
            if (!v) return;
            void v.play().catch(() => {});
          }}
          className="w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-4">
          <CameraOff className="w-16 h-16 text-muted-foreground" />
          <p className="text-muted-foreground text-center">
            {error || "Clique para ativar a câmera"}
          </p>
          <Button onClick={startCamera} variant="outline" className="gap-2">
            <Camera className="w-4 h-4" />
            Ativar Câmera
          </Button>
        </div>
      )}
      {cameraEnabled && (
        <Button
          onClick={stopCamera}
          variant="destructive"
          size="icon"
          className="absolute top-2 right-2 opacity-70 hover:opacity-100"
        >
          <CameraOff className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
});

CameraPreview.displayName = "CameraPreview";

export default CameraPreview;
