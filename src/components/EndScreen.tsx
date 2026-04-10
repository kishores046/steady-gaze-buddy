import { useState, useEffect, useMemo, useCallback } from "react";
import type { SessionData } from "@/types/gaze";
import { runFullAnalysis, type FullAnalysis } from "@/lib/featureExtraction";
import FeatureCard from "./FeatureCard";
import GazePathCanvas from "./GazePathCanvas";
import Confetti from "./Confetti";
import Mascot from "./Mascot";

interface EndScreenProps {
  sessionData: SessionData;
  onPlayAgain: () => void;
}

const EndScreen = ({ sessionData, onPlayAgain }: EndScreenProps) => {
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);

  const result: FullAnalysis = useMemo(
    () => runFullAnalysis(sessionData.gazePoints, sessionData.duration),
    [sessionData]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  const download = useCallback((data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportAnalysis = useCallback(() => {
    const { fixations, saccades, regressions, ...exportData } = result;
    download(
      { ...exportData, fixationCount: fixations.length, saccadeCount: saccades.length, regressionCount: regressions.length, rawGazeData: sessionData.gazePoints },
      `dyslexia-analysis-${Date.now()}.json`
    );
  }, [result, sessionData, download]);

  const handleExportRaw = useCallback(() => {
    download(sessionData, `dyslexia-raw-${Date.now()}.json`);
  }, [sessionData, download]);

  const collected = sessionData.gazePoints.length;
  const target = sessionData.totalPointsTarget;
  const pct = Math.round((collected / target) * 100);
  const concernCount = Object.values(result.analysis).filter((a) => a.status === "concern").length;
  const lowQuality = collected < 250;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-6">
        <div className="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin-slow" />
        <p className="text-xl font-bold text-foreground animate-pulse font-display text-center">
          ✨ Wonderful reading! Analyzing your pattern... ✨
        </p>
        {/* Progress steps */}
        <div className="flex flex-col gap-2 text-sm text-muted-foreground mt-4">
          <AnalysisStep label="Detecting fixations..." delay={0} />
          <AnalysisStep label="Identifying saccades..." delay={1000} />
          <AnalysisStep label="Calculating features..." delay={2000} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-4 sm:p-6 gap-5 overflow-y-auto">
      {showConfetti && <Confetti />}

      {/* Header with badge */}
      <div className="animate-fade-in-up text-center space-y-2 pt-4">
        <div className="text-5xl mb-2">🏆</div>
        <h1 className="text-2xl sm:text-4xl font-bold text-primary font-display">
          Expert Reader!
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground">
          {concernCount === 0
            ? "Everything looks great! 🎉"
            : `${concernCount} area${concernCount > 1 ? "s" : ""} to review 🔍`}
        </p>
      </div>

      {/* Low quality warning */}
      {lowQuality && (
        <div className="bg-warning/15 border border-warning/30 rounded-2xl p-4 max-w-sm text-center animate-fade-in-up">
          <p className="text-sm font-bold text-warning-foreground">
            ⚠️ Only {collected} of {target} gaze points collected
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Results may be less accurate. Consider replaying for better data.
          </p>
        </div>
      )}

      {/* Summary stats */}
      <div className="bg-card rounded-2xl shadow-lg p-5 w-full max-w-sm space-y-3 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
        <StatRow label="Gaze points" value={`${collected}/${target}`} />
        <div className="w-full bg-muted rounded-full h-3">
          <div className="bg-success h-3 rounded-full transition-all duration-1000" style={{ width: `${Math.min(pct, 100)}%` }} />
        </div>
        <StatRow label="Face detected" value={`${result.faceDetectedPercent.toFixed(0)}%`} />
        <StatRow label="Avg confidence" value={`${(result.avgConfidence * 100).toFixed(0)}%`} />
        <StatRow label="Fixations" value={String(result.fixations.length)} />
        <StatRow label="Regressions" value={String(result.regressions.length)} />
      </div>

      {/* Feature cards */}
      <div className="w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
        <h2 className="text-lg sm:text-xl font-bold text-foreground font-display mb-3">📊 Clinical Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(result.analysis) as (keyof typeof result.analysis)[]).map((key) => (
            <FeatureCard key={key} item={result.analysis[key]} />
          ))}
        </div>
      </div>

      {/* Gaze path */}
      <div className="w-full max-w-2xl animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
        <h2 className="text-lg sm:text-xl font-bold text-foreground font-display mb-2">👁️ Reading Path</h2>
        <p className="text-xs text-muted-foreground mb-2">
          Circles = fixations (bigger = longer). Red lines = regressions.
        </p>
        <GazePathCanvas
          fixations={result.fixations}
          saccades={result.saccades}
          width={Math.min(600, typeof window !== "undefined" ? window.innerWidth - 48 : 500)}
          height={180}
        />
      </div>

      {/* Privacy notice */}
      <div className="text-xs text-muted-foreground/70 text-center max-w-sm animate-fade-in-up" style={{ animationDelay: "0.35s" }}>
        🔒 Your video stayed on your device. No images were uploaded.
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2 pb-8 animate-fade-in-up w-full max-w-md" style={{ animationDelay: "0.4s" }}>
        <button onClick={onPlayAgain} className="flex-1 px-5 py-3 bg-primary text-primary-foreground rounded-2xl text-base sm:text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]">
          🔄 {lowQuality ? "Try Again" : "Play Again"}
        </button>
        <button onClick={handleExportAnalysis} className="flex-1 px-5 py-3 bg-secondary text-secondary-foreground rounded-2xl text-base sm:text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]">
          📊 Export Analysis
        </button>
        <button onClick={handleExportRaw} className="flex-1 px-5 py-3 bg-muted text-muted-foreground rounded-2xl text-base sm:text-lg font-bold shadow-lg hover:scale-105 transition-all duration-300 min-h-[48px]">
          📥 Raw Data
        </button>
      </div>

      <Mascot message={lowQuality ? "Want to try again for better results?" : "Great job! You're an expert reader! 🌟"} />
    </div>
  );
};

// Small helper components
const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-bold text-foreground">{value}</span>
  </div>
);

const AnalysisStep = ({ label, delay }: { label: string; delay: number }) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  if (!visible) return null;
  return <span className="animate-fade-in-up">✅ {label}</span>;
};

export default EndScreen;
