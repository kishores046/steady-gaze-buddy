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
  const [loadingStep, setLoadingStep] = useState(0);
  const [demoMode, setDemoMode] = useState(false);

  const eyeTracking = useEyeTracking({ enabled: true });

  useEffect(() => {
    if (demoMode) return;
    const init = async () => {
      setLoadingStep(1);
      setLoadingMessage("Loading eye tracking model... 🧠");
      await eyeTracking.loadModel();

      setLoadingStep(2);
      setLoadingMessage("Starting camera... 📹");
      await eyeTracking.startCamera();

      setLoadingStep(3);
      setLoadingMessage("Ready! ✨");
      setTimeout(() => setPhase("calibration"), 500);
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode]);

  const handleDemoMode = useCallback(() => {
    setDemoMode(true);
    setPhase("calibration");
  }, []);

  const handleRetryLoad = useCallback(() => {
    window.location.reload();
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
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
        <p className="text-xl font-bold text-foreground font-display text-center">{loadingMessage}</p>

        {/* Progress steps */}
        <div className="flex gap-2 mt-2">
          {[1, 2, 3].map((step) => (
            <div
              key={step}
              className={`w-3 h-3 rounded-full transition-all duration-500 ${
                loadingStep >= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {eyeTracking.error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-5 max-w-sm text-center animate-fade-in-up">
            <p className="text-destructive font-bold text-base">{eyeTracking.error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {eyeTracking.error.includes("Camera")
                ? "Please allow camera access in your browser settings, then reload."
                : "The eye tracking model couldn't load. Check your connection and try again."}
            </p>
            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={handleRetryLoad}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold min-h-[48px]"
              >
                🔄 Retry
              </button>
              <button
                onClick={handleDemoMode}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-bold min-h-[48px]"
              >
                🎮 Demo Mode (No Camera)
              </button>
            </div>
          </div>
        )}

        {/* Demo mode shortcut (always visible) */}
        {!eyeTracking.error && (
          <button
            onClick={handleDemoMode}
            className="mt-4 text-sm text-muted-foreground underline hover:text-foreground transition-colors"
          >
            Skip → Demo Mode (testing)
          </button>
        )}

        {/* Privacy notice */}
        <p className="text-xs text-muted-foreground/60 mt-4 text-center max-w-xs">
          🔒 All video processing happens on your device. Nothing is uploaded.
        </p>
      </div>
    );
  }

  switch (phase) {
    case "calibration":
      return (
        <CalibrationScreen
          onComplete={handleCalibrationComplete}
          eyeTracking={eyeTracking}
          demoMode={demoMode}
        />
      );
    case "game":
      return (
        <SteadyReaderGame
          onComplete={handleGameComplete}
          eyeTracking={eyeTracking}
          demoMode={demoMode}
        />
      );
    case "end":
      return sessionData ? (
        <EndScreen sessionData={sessionData} onPlayAgain={handlePlayAgain} />
      ) : null;
  }
};

export default Index;
