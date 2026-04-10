import { useState, useEffect } from "react";
import type { SessionData } from "@/types/gaze";

interface EndScreenProps {
  sessionData: SessionData;
  onPlayAgain: () => void;
}

const EndScreen = ({ sessionData, onPlayAgain }: EndScreenProps) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dyslexia-session-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const collected = sessionData.gazePoints.length;
  const target = sessionData.totalPointsTarget;
  const pct = Math.round((collected / target) * 100);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
        <p className="text-xl font-bold text-foreground animate-pulse">
          ✨ Wonderful reading! Analyzing your pattern... ✨
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 gap-6">
      <div className="animate-fade-in-up text-center space-y-2">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary font-display">
          Session Complete! ✅
        </h1>
        <p className="text-lg text-muted-foreground">Great job reading!</p>
      </div>

      <div className="bg-card rounded-2xl shadow-lg p-6 w-full max-w-sm space-y-4 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Gaze points</span>
          <span className="font-bold text-foreground">{collected}/{target}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className="bg-success h-3 rounded-full transition-all duration-1000"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-bold text-foreground">{sessionData.duration}s</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">Collection rate</span>
          <span className="font-bold text-foreground">{pct}%</span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-4 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
        <button
          onClick={onPlayAgain}
          className="px-6 py-3 bg-primary text-primary-foreground rounded-2xl text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]"
        >
          🔄 Play Again
        </button>
        <button
          onClick={handleExport}
          className="px-6 py-3 bg-secondary text-secondary-foreground rounded-2xl text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]"
        >
          📥 Export Data
        </button>
      </div>
    </div>
  );
};

export default EndScreen;
