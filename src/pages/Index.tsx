import { useState, useCallback } from "react";
import CalibrationScreen from "@/components/CalibrationScreen";
import SteadyReaderGame from "@/components/SteadyReaderGame";
import EndScreen from "@/components/EndScreen";
import type { SessionData } from "@/types/gaze";

type GamePhase = "calibration" | "game" | "end";

const Index = () => {
  const [phase, setPhase] = useState<GamePhase>("calibration");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  const handleCalibrationComplete = useCallback(() => {
    setPhase("game");
  }, []);

  const handleGameComplete = useCallback((data: SessionData) => {
    setSessionData(data);
    setPhase("end");
  }, []);

  const handlePlayAgain = useCallback(() => {
    setSessionData(null);
    setPhase("calibration");
  }, []);

  switch (phase) {
    case "calibration":
      return <CalibrationScreen onComplete={handleCalibrationComplete} />;
    case "game":
      return <SteadyReaderGame onComplete={handleGameComplete} />;
    case "end":
      return sessionData ? (
        <EndScreen sessionData={sessionData} onPlayAgain={handlePlayAgain} />
      ) : null;
  }
};

export default Index;
