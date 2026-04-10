import { useEffect, useState, useCallback } from "react";
import Mascot from "./Mascot";

interface CalibrationScreenProps {
  onComplete: () => void;
}

const STAR_POSITIONS = [
  { x: 15, y: 15, label: "top-left" },
  { x: 85, y: 15, label: "top-right" },
  { x: 50, y: 50, label: "center" },
  { x: 15, y: 85, label: "bottom-left" },
  { x: 85, y: 85, label: "bottom-right" },
];

const MASCOT_MESSAGES = [
  "Follow the stars with your eyes! ⭐",
  "Great job! Keep going!",
  "You're a star tracker! ✨",
  "Almost done!",
  "Perfect! Let's read! 📖",
];

const CalibrationScreen = ({ onComplete }: CalibrationScreenProps) => {
  const [currentStar, setCurrentStar] = useState(-1);
  const [started, setStarted] = useState(false);

  const startCalibration = useCallback(() => {
    setStarted(true);
    setCurrentStar(0);
  }, []);

  useEffect(() => {
    if (!started || currentStar < 0) return;

    if (currentStar >= STAR_POSITIONS.length) {
      const timer = setTimeout(onComplete, 800);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => {
      setCurrentStar((prev) => prev + 1);
    }, 1200);

    return () => clearTimeout(timer);
  }, [currentStar, started, onComplete]);

  if (!started) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center space-y-4 animate-fade-in-up">
          <h1 className="text-3xl sm:text-4xl font-bold text-primary font-display">
            ⭐ Eye Calibration ⭐
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-md">
            We need to set up the eye tracker! Follow each star with your eyes as it appears.
          </p>
        </div>
        <Mascot message="Follow the stars with your eyes!" />
        <button
          onClick={startCalibration}
          className="mt-4 px-8 py-4 bg-primary text-primary-foreground rounded-2xl text-xl font-bold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 min-h-[56px]"
        >
          I'm Ready! 🌟
        </button>
      </div>
    );
  }

  const done = currentStar >= STAR_POSITIONS.length;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Progress */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
        <div className="bg-card rounded-full px-4 py-2 shadow-md">
          <span className="text-base font-bold text-foreground">
            {done ? "✅ Done!" : `Star ${currentStar + 1} of ${STAR_POSITIONS.length}`}
          </span>
        </div>
      </div>

      {/* Stars */}
      {STAR_POSITIONS.map((pos, i) => (
        <div
          key={pos.label}
          className="absolute transition-all duration-300"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          <span
            className={`text-4xl sm:text-5xl inline-block transition-all duration-300 ${
              i === currentStar
                ? "animate-sparkle opacity-100 scale-100"
                : i < currentStar
                ? "opacity-30 scale-75"
                : "opacity-0 scale-50"
            }`}
          >
            ⭐
          </span>
        </div>
      ))}

      {/* Mascot at bottom */}
      <div className="absolute bottom-6 left-6">
        <Mascot
          message={MASCOT_MESSAGES[Math.min(currentStar, MASCOT_MESSAGES.length - 1)] || "Great!"}
        />
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-6 right-6 flex gap-2">
        {STAR_POSITIONS.map((_, i) => (
          <div
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              i < currentStar
                ? "bg-success"
                : i === currentStar
                ? "bg-primary animate-pulse"
                : "bg-muted"
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default CalibrationScreen;
