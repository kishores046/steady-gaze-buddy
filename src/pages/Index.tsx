import { useState, useCallback, useEffect } from "react";
import CalibrationScreen from "@/components/CalibrationScreen";
import SteadyReaderGame from "@/components/SteadyReaderGame";
import EndScreen from "@/components/EndScreen";
import { useEyeTracking } from "@/hooks/useEyeTracking";
import type { SessionData } from "@/types/gaze";

type GamePhase = "loading" | "calibration" | "game" | "end";

const Index = () => {
  const [phase, setPhase] = useState<GamePhase>("loading");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loadingMessage, setLoadingMessage] = useState("Preparing eye tracking...");

  const eyeTracking = useEyeTracking({ enabled: true });

  // Load model and camera on mount
  useEffect(() => {
    const init = async () => {
      setLoadingMessage("Loading eye tracking model... 🧠");
      await eyeTracking.loadModel();
      setLoadingMessage("Starting camera... 📹");
      await eyeTracking.startCamera();
      setLoadingMessage("Ready! ✨");
      setTimeout(() => setPhase("calibration"), 500);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCalibrationComplete = useCallback(() => {
    setPhase("game");
  }, []);

  const handleGameComplete = useCallback((data: SessionData) => {
    setSessionData(data);
    eyeTracking.stopTracking();
    setPhase("end");
  }, [eyeTracking]);

  const handlePlayAgain = useCallback(() => {
    setSessionData(null);
    setPhase("calibration");
  }, []);

  if (phase === "loading") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
        <p className="text-xl font-bold text-foreground font-display">{loadingMessage}</p>
        {eyeTracking.error && (
          <div className="bg-destructive/10 rounded-xl p-4 max-w-sm text-center">
            <p className="text-destructive font-bold">{eyeTracking.error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              The app will still work, but gaze data will be simulated.
            </p>
            <button
              onClick={() => setPhase("calibration")}
              className="mt-3 px-6 py-2 bg-primary text-primary-foreground rounded-xl font-bold"
            >
              Continue Anyway
            </button>
          </div>
        )}
      </div>
    );
  }

  switch (phase) {
    case "calibration":
      return (
        <CalibrationScreen
          onComplete={handleCalibrationComplete}
          eyeTracking={eyeTracking}
        />
      );
    case "game":
      return (
        <SteadyReaderGame
          onComplete={handleGameComplete}
          eyeTracking={eyeTracking}
        />
      );
    case "end":
      return sessionData ? (
        <EndScreen sessionData={sessionData} onPlayAgain={handlePlayAgain} />
      ) : null;
  }
};

export default Index;
