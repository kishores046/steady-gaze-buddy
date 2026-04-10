import { useEffect, useRef, useState } from "react";

interface CameraPreviewProps {
  onStreamReady?: (stream: MediaStream) => void;
  faceDetected?: boolean;
}

const CameraPreview = ({ onStreamReady, faceDetected = false }: CameraPreviewProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasCamera, setHasCamera] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 320, height: 240 },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasCamera(true);
          onStreamReady?.(stream);
        }
      } catch {
        setError("Camera not available");
      }
    };

    startCamera();

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onStreamReady]);

  const borderColor = faceDetected ? "border-success" : "border-destructive";

  return (
    <div
      className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 ${borderColor} transition-colors duration-300`}
      style={{ boxShadow: faceDetected ? "0 0 12px hsl(var(--success) / 0.5)" : "0 0 12px hsl(var(--destructive) / 0.5)" }}
    >
      {error ? (
        <div className="w-full h-full flex items-center justify-center bg-muted text-xs text-center text-muted-foreground p-1">
          📹 No cam
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
      )}
      {hasCamera && (
        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${faceDetected ? "bg-success" : "bg-destructive"} animate-pulse`} />
      )}
    </div>
  );
};

export default CameraPreview;
