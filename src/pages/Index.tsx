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
      try {
        setLoadingStep(1);
        setLoadingMessage("Loading eye tracking model... 🧠");
        console.log("\n🚀 === INITIALIZATION STARTED ===");
        console.log("Step 1: Loading FaceMesh model...");
        await eyeTracking.loadModel();
        console.log("Step 1: ✅ Model loaded, modelLoaded state:", eyeTracking.modelLoaded);
        console.log("Step 1: Detector ref exists?", eyeTracking ? "checking..." : "hook not ready");

        setLoadingStep(2);
        setLoadingMessage("Starting camera... 📹");
        console.log("Step 2: Starting camera...");
        const stream = await eyeTracking.startCamera();
        if (!stream) {
          throw new Error("Camera stream is null");
        }
        console.log("Step 2: ✅ Camera started");

        // Give the video a moment to start streaming
        console.log("Waiting for video to stabilize...");
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Verify detection is working with comprehensive diagnostics
        setLoadingStep(3);
        setLoadingMessage("Verifying system... ✓");
        let detectionWorking = false;
        let lastTestResult: any = null;
        
        for (let attempt = 0; attempt < 3; attempt++) {
          console.log(`\n[Test Attempt ${attempt + 1}] Calling testDetection()...`);
          const testResult = await eyeTracking.testDetection();
          lastTestResult = testResult;
          console.log("testDetection() result:", testResult);
          
          // Check for face detection
          if (testResult?.success && testResult?.faceCount > 0) {
            detectionWorking = true;
            console.log("✅✅✅ FACE DETECTED - SUCCESS!");
            break;
          }
          
          if (attempt < 2) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        console.log("\n═══ FINAL DETECTION STATUS ═══");
        if (detectionWorking) {
          console.log("✅✅✅ DETECTION WORKING - Ready for real tracking!");
        } else {
          console.error("❌ FACE DETECTION FAILED");
          if (lastTestResult?.timingInfo) {
            const { initialTime, afterRAFTime } = lastTestResult.timingInfo;
            if (initialTime === afterRAFTime) {
              console.error("🔴 ROOT CAUSE: Video currentTime not advancing");
              console.error("   MediaStream isn't properly updating the video element");
              console.error("   This is a browser/MediaStream issue");
            } else {
              console.error("⚠️ Video IS advancing but model can't find your face");
              console.error("\n🎥 LOOK FOR: Green-bordered video box in BOTTOM-RIGHT corner");
              console.error("\n🔧 TROUBLESHOOTING:");
              console.error("  1. Is your face VISIBLE in the green video box?");
              console.error("  2. Check lighting - room should be WELL-LIT (no backlight)");
              console.error("  3. Face should be FRONT-FACING (not sideways/tilted)");
              console.error("  4. Try moving CLOSER to camera (15-30cm away)");
              console.error("  5. Remove glasses/sunglasses if possible");
              console.error("  6. Refresh page and try again (F5)");
            }
          } else {
            console.error("Could not determine root cause - check video permissions");
          }
        }

        setLoadingStep(3);
        setLoadingMessage("Ready! ✨");
        setTimeout(() => setPhase("calibration"), 500);
      } catch (error) {
        console.error("❌ Init error:", error);
        setLoadingMessage("Error: " + String(error));
      }
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
